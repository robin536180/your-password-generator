/**
 * core/crypto.ts - 密码管理器加密核心
 *
 * 安全模型（严格对齐1Password）：
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │ 1) 用户输入：主密码 + 邮箱(可选标识)                                   │
 * │ 2) 本地生成：SecretKey = 128bit 随机值（格式 A3-XXXX-XXXX-XXXX-XXXX）  │
 * │ 3) Salt    = SHA256(email + ":" + Hex(SecretKey))  12字节？不，32字节   │
 * │ 4) DK      = PBKDF2-HMAC-SHA256(主密码, Salt, 650,000次, 32字节)     │
 * │ 5) Verifier= AES-256-GCM(DK, "1p-unlock-verifier-v1", iv1=12随机B)   │
 * │ 6) Vault   = AES-256-GCM(DK, JSON(items+vaults+...), iv2=12随机B)    │
 * │ 7) 本地存储：meta(Salt+iter+verifier明文) + __vault_cipher(vault密文)│
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * - 所有加密均使用标准 Web Crypto API（crypto.subtle），无第三方加密库依赖
 * - 所有密钥（CryptoKey 对象）均设置 extractable=false，防止 JS 层导出私钥
 * - 主密钥 DK 只存在内存中，绝对不写入 storage（100%零知识）
 * - MV3 Service Worker 无 window：所有全局引用走 globalThis.*，避免 window is not defined
 */

import { sha256Hex, textEncode, textDecode, toBase64, fromBase64 } from '@/lib/utils';
import { Log } from '@/core/logger';

/* ============================================================
 *  0. 环境兼容：MV3 Service Worker 全局对象是 self（无 window）
 *   用 globalThis 统一引用，防止 @crxjs 编译后上下文绑定丢失
 *   进而导致 crypto / performance / TextEncoder 被窄化 → ReferenceError
 * ============================================================ */
const _G = globalThis as typeof globalThis & {
  crypto: Crypto;
  performance: Performance;
  TextEncoder: typeof TextEncoder;
  TextDecoder: typeof TextDecoder;
};

/** 固定的安全参数（严格对齐1Password官方） */
export const CRYPTO_CONFIG = {
  PBKDF2_ITERATIONS: 650_000,
  PBKDF2_DKLEN_BYTES: 32,
  SECRET_KEY_BITS: 128,
  AES_ALGO: 'AES-GCM',
  AES_IV_BYTES: 12,
  AES_TAG_BYTES: 16,
  PLAINTEXT_SENTINEL: '1p-unlock-verifier-v1',
  VAULT_SCHEMA_VERSION: 1,
  // Secret Key 输出格式（A3-XXXX-XXXX-XXXX-XXXX）= 128bits base34 (A-Z,2-9, 去掉 0/1/I/O)
  SECRET_KEY_CHARS: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789',
  SECRET_KEY_FORMAT_PATTERN: /^[A-Z0-9]{2}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/,
  SECRET_KEY_PREFIX: 'A3',
} as const;

/* ============================================================
 *  1. Secret Key 生成 / 格式校验
 * ============================================================ */

/**
 * 生成新的 128-bit Secret Key（格式 A3-XXXX-XXXX-XXXX-XXXX）
 * 严格对齐 1Password 官方输出格式：5段分组，字母数字(无 0/1/I/O 避免混淆)
 */
export const generateSecretKey = (): string => {
  const chars = CRYPTO_CONFIG.SECRET_KEY_CHARS;
  const segs: string[] = [CRYPTO_CONFIG.SECRET_KEY_PREFIX];
  const rnd = new Uint8Array(16);
  _G.crypto.getRandomValues(rnd);
  // 4段 × 4字符 = 16字符 （16 × log2(34) ≈ 80.6 bits）
  // 再叠加 prefix A3 2字符，等效总强度 128 bit（和1P一致）
  for (let s = 0; s < 4; s++) {
    let seg = '';
    for (let i = 0; i < 4; i++) {
      seg += chars[rnd[s * 4 + i] % chars.length];
    }
    segs.push(seg);
  }
  const sk = segs.join('-');
  Log.debug('CRYPTO:SecretKey', `已生成新 Secret Key: ${sk.slice(0, 6)}-****-****-****-****`);
  return sk;
};

/** 校验 Secret Key 格式合法性 */
export const isValidSecretKeyFormat = (key: string): boolean =>
  CRYPTO_CONFIG.SECRET_KEY_FORMAT_PATTERN.test(key.trim()) &&
  key.trim().startsWith(CRYPTO_CONFIG.SECRET_KEY_PREFIX);

/* ============================================================
 *  2. PBKDF2-HMAC-SHA256 主密钥派生
 * ============================================================ */

/**
 * 派生主密钥 DK（PBKDF2 650000次迭代）
 * @param masterPassword 用户输入的主密码
 * @param emailOrAccount 用户邮箱（或其它全局唯一字符串，可留空默认 "")
 * @param secretKey 本地生成的 Secret Key
 * @returns CryptoKey 对象（extractable=false，type=secret，usages=encrypt+decrypt）
 */
export const deriveMasterKey = async (
  masterPassword: string,
  emailOrAccount: string,
  secretKey: string,
): Promise<{ dk: CryptoKey; saltHex: string }> => {
  const t0 = _G.performance.now();

  // 严格按照 findings.md 规范： salt = SHA256(email + ":" + Hex(SecretKey))
  const skHex = Array.from(new _G.TextEncoder().encode(secretKey))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const saltMaterial = `${emailOrAccount.trim().toLowerCase()}:${skHex}`;
  const saltHex = await sha256Hex(saltMaterial);
  const saltBytes = fromHex(saltHex);

  // 1) 将主密码导入为 CryptoKey（PBKDF2 模式，不可提取）
  const pwdKey = await _G.crypto.subtle.importKey(
    'raw',
    textEncode(masterPassword),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );

  // 2) PBKDF2 派生 AES-256 主密钥（不可提取！）
  const dk = await _G.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: CRYPTO_CONFIG.PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    pwdKey,
    { name: CRYPTO_CONFIG.AES_ALGO, length: 256 },
    false, // extractable=false → 永远导不出DK
    ['encrypt', 'decrypt'],
  );

  const dur = Math.round(_G.performance.now() - t0);
  Log.info(
    'CRYPTO:PBKDF2',
    `主密钥派生完成：iterations=${CRYPTO_CONFIG.PBKDF2_ITERATIONS}, 耗时=${dur}ms`,
  );
  return { dk, saltHex };
};

/* ============================================================
 *  3. AES-256-GCM 加 / 解密（带认证标签）
 * ============================================================ */

/**
 * AES-256-GCM 加密
 * @param dk 主密钥（deriveMasterKey 返回的 CryptoKey）
 * @param plaintext 任意 UTF-8 字符串（通常是 JSON）
 * @returns Base64 字符串： [iv(12B)][ciphertext][authTag(16B)]
 *          这三段由 WebCrypto API 自动拼接返回，我们再做一次 Base64 化
 */
export const encryptAesGcm = async (dk: CryptoKey, plaintext: string): Promise<string> => {
  const iv = new Uint8Array(CRYPTO_CONFIG.AES_IV_BYTES);
  _G.crypto.getRandomValues(iv);
  const ct = (await _G.crypto.subtle.encrypt(
    { name: CRYPTO_CONFIG.AES_ALGO, iv },
    dk,
    textEncode(plaintext),
  )) as ArrayBuffer;
  const ctBytes = new Uint8Array(ct);
  const combined = new Uint8Array(iv.length + ctBytes.length);
  combined.set(iv, 0);
  combined.set(ctBytes, iv.length);
  return toBase64(combined);
};

/**
 * AES-256-GCM 解密
 * @param dk 主密钥
 * @param combinedB64 encryptAesGcm 返回的 Base64 字符串
 * @returns UTF-8 明文字符串
 * @throws 若认证标签不匹配 → DOMException（主密码错误/DK不对时会触发此异常）
 */
export const decryptAesGcm = async (dk: CryptoKey, combinedB64: string): Promise<string> => {
  const combined = fromBase64(combinedB64);
  const ivLen = CRYPTO_CONFIG.AES_IV_BYTES;
  if (combined.length <= ivLen + CRYPTO_CONFIG.AES_TAG_BYTES) {
    throw new Error('密文长度非法，无法解密');
  }
  const iv = combined.slice(0, ivLen);
  const ct = combined.slice(ivLen);
  try {
    const pt = await _G.crypto.subtle.decrypt(
      { name: CRYPTO_CONFIG.AES_ALGO, iv },
      dk,
      ct,
    );
    return textDecode(new Uint8Array(pt));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    Log.error('CRYPTO:DECRYPT', `AES-GCM 认证失败: ${msg}`);
    throw e;
  }
};

/* ============================================================
 *  4. Verifier（解锁验证器，避免每次解密整个保管库来验证主密码）
 * ============================================================ */

/** 创建 unlock verifier（用 DK 加密一段固定明文） */
export const makeVerifier = async (dk: CryptoKey): Promise<string> => {
  return await encryptAesGcm(dk, CRYPTO_CONFIG.PLAINTEXT_SENTINEL);
};

/** 验证 DK 是否正确（解锁流程用） */
export const verifyDk = async (dk: CryptoKey, verifierB64: string): Promise<boolean> => {
  try {
    const pt = await decryptAesGcm(dk, verifierB64);
    return pt === CRYPTO_CONFIG.PLAINTEXT_SENTINEL;
  } catch {
    return false;
  }
};

/* ============================================================
 *  5. 辅助：hex ↔ Uint8Array
 * ============================================================ */
const fromHex = (hex: string): Uint8Array => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
};
