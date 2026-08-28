/**
 * test/vitest/1-crypto.test.ts - 核心加密模块 Vitest 单元测试
 *
 * 测试覆盖：
 *   1) Secret Key 生成 / 格式校验 ✅
 *   2) PBKDF2 迭代 650,000 次：同一输入产出一致 DK（不可逆验证）
 *   3) AES-256-GCM 加密 → 解密 往返，明文一致；篡改密文一定抛异常
 *   4) Verifier 验证：正确 DK 能解密，错误 DK 必返回 false
 *   5) 压力：10000 次 AES-GCM 加解密总耗时 < 3s（验收标准）
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
  CRYPTO_CONFIG,
  decryptAesGcm,
  deriveMasterKey,
  encryptAesGcm,
  generateSecretKey,
  isValidSecretKeyFormat,
  makeVerifier,
  verifyDk,
} from '@/core/crypto';
import { deriveMasterKeyBySalt } from '@/core/vault-store';

describe('M1-核心加密模块 crypto.ts', () => {
  beforeAll(() => {
    // jsdom 自带 crypto.subtle，大部分环境 ok；兜底 WebCrypto shim 此处跳过
    expect(typeof crypto).toBe('object');
    expect(typeof crypto.subtle).toBe('object');
  });

  it('T1: Secret Key 生成 1000 次，格式全部合法且无碰撞', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const sk = generateSecretKey();
      expect(sk.startsWith(CRYPTO_CONFIG.SECRET_KEY_PREFIX + '-')).toBe(true);
      expect(isValidSecretKeyFormat(sk)).toBe(true);
      expect(seen.has(sk)).toBe(false);
      seen.add(sk);
    }
    expect(seen.size).toBe(1000);
    expect(isValidSecretKeyFormat('X9-XXXX-XXXX-XXXX-XXXX')).toBe(false);
    expect(isValidSecretKeyFormat('A3-XXX-XXXX-XXXX-XXXX')).toBe(false);
  });

  it('T2: PBKDF2 派生确定性：相同密码+邮箱+SK 得出相同 saltHex + 可加密', async () => {
    const sk = generateSecretKey();
    const r1 = await deriveMasterKey('我是一个强密码Abc123!@#', 'alice@test.com', sk);
    const r2 = await deriveMasterKey('我是一个强密码Abc123!@#', 'alice@test.com', sk);
    expect(r1.saltHex).toBe(r2.saltHex);
    // 不能直接比较 DK（extractable=false），用 encrypt+decrypt 间接验证等价
    const msg = JSON.stringify({ hello: '世界', n: 42, arr: [1, 2, 3] });
    const c1 = await encryptAesGcm(r1.dk, msg);
    const d2 = await decryptAesGcm(r2.dk, c1);
    expect(d2).toBe(msg);
  }, 15000); // 650,000 iter x 2 → Vitest 默认 5s 不够

  it('T3: AES-256-GCM 往返 + 篡改密文必失败', async () => {
    const sk = generateSecretKey();
    const { dk } = await deriveMasterKey('P@ssw0rd123!', '', sk);
    const plaintext = '中文测试 / UTF-8 / 😀 emoji / \0 空字符 / long'.repeat(100);
    const c = await encryptAesGcm(dk, plaintext);
    expect(c).not.toEqual(plaintext);
    expect(typeof c).toBe('string');
    const dec = await decryptAesGcm(dk, c);
    expect(dec).toBe(plaintext);

    // 篡改任何一位都必须失败
    const tampered = c.replace(/[A-Za-z0-9+/=]/, (ch) => {
      const pick = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
      let next = pick[(pick.indexOf(ch) + 3) % pick.length];
      if (next === ch) next = pick[(pick.indexOf(ch) + 7) % pick.length];
      return next;
    });
    await expect(() => decryptAesGcm(dk, tampered)).rejects.toThrow();
  }, 15000);

  it('T4: Verifier 验证 — 正确DK返回true，错误DK返回false', async () => {
    const sk = generateSecretKey();
    const { dk, saltHex } = await deriveMasterKey('正确的密码 XyZ99!', 'bob@test.com', sk);
    const v = await makeVerifier(dk);
    expect(await verifyDk(dk, v)).toBe(true);

    // 用错误密码派生另一个 DK，必须 false
    const { dk: badDk } = await deriveMasterKeyBySalt('错误的密码', saltHex, CRYPTO_CONFIG.PBKDF2_ITERATIONS);
    expect(await verifyDk(badDk, v)).toBe(false);
  }, 15000);

  it('T5(压测): 10,000 次 AES-GCM 加解密总耗时 < 3s', async () => {
    const sk = generateSecretKey();
    const { dk } = await deriveMasterKey('B3nchm@rk!', '', sk);
    const messages = Array.from({ length: 10_000 }, (_, i) => `ITEM#${i}__${'长文本测试 '.repeat(10)}`);

    const t0 = performance.now();
    const ciphers: string[] = [];
    for (let i = 0; i < 10_000; i++) ciphers.push(await encryptAesGcm(dk, messages[i]));
    for (let i = 0; i < 10_000; i++) {
      const pt = await decryptAesGcm(dk, ciphers[i]);
      expect(pt).toBe(messages[i]);
    }
    const dur = performance.now() - t0;
    console.log(`[BENCH] 10000 encrypt+decrypt total=${dur.toFixed(1)}ms (avg=${(dur / 10000).toFixed(3)}ms/round)`);
    expect(dur).toBeLessThan(3000); // M1 验收标准
  }, 30_000);
});
