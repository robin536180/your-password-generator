/**
 * lib/utils.ts - 通用工具函数
 */

/** 生成符合 UUIDv4 规范的随机 ID（使用 Web Crypto 保证密码学安全） */
export const uuidv4 = (): string => {
  const crypto_ = (globalThis as unknown as { crypto: Crypto }).crypto;
  try {
    const fn = (crypto_ as any).randomUUID;
    if (typeof fn === 'function') return fn.call(crypto_);
  } catch {}
  const bytes = new Uint8Array(16);
  (crypto_ as any).getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return Array.from(bytes)
    .map((b, i) => {
      const hex = b.toString(16).padStart(2, '0');
      return [4, 6, 8, 10].includes(i) ? `-${hex}` : hex;
    })
    .join('');
};

/** 当前时间戳（ms），用于 createdAt/updatedAt */
export const nowMs = (): number => Date.now();

/** Base64 编码（Uint8Array → string，URL安全可选） */
export const toBase64 = (bytes: Uint8Array, urlSafe = false): string => {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  let b64 = btoa(bin);
  if (urlSafe) b64 = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return b64;
};

/** Base64 解码（string → Uint8Array） */
export const fromBase64 = (b64: string): Uint8Array => {
  let s = b64.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

/** 文本 → UTF-8 字节数组 */
export const textEncode = (text: string): Uint8Array => new TextEncoder().encode(text);

/** UTF-8 字节数组 → 文本 */
export const textDecode = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

/** 简易 classnames（tailwind 推荐搭配） */
export const cn = (...parts: (string | false | null | undefined)[]): string =>
  parts.filter(Boolean).join(' ');

/** SHA-256 摘要（纯 WebCrypto，无第三方依赖） */
export const sha256Hex = async (data: Uint8Array | string): Promise<string> => {
  const crypto_ = (globalThis as unknown as { crypto: Crypto }).crypto;
  const bytes = typeof data === 'string' ? textEncode(data) : data;
  const digest = await crypto_.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

/** 计算密码熵值(bits，用于Watchtower强度评分) */
export const calcEntropyBits = (pwd: string): number => {
  if (!pwd) return 0;
  let poolSize = 0;
  if (/[a-z]/.test(pwd)) poolSize += 26;
  if (/[A-Z]/.test(pwd)) poolSize += 26;
  if (/[0-9]/.test(pwd)) poolSize += 10;
  const symCount = (pwd.match(/[^a-zA-Z0-9]/g) || []).length;
  if (symCount > 0) poolSize += 32;
  if (poolSize === 0) return 0;
  const entropy = pwd.length * Math.log2(poolSize);
  return Math.round(entropy * 10) / 10;
};

/** 等待 N ms（测试/UI过渡用） */
export const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));
