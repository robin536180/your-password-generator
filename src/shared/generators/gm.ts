/**
 * shared/generators/gm.ts - 国密算法（SM3 / SM4）密码派生核心
 *
 * 核心设计：
 *  1. 口令生成本质是「对称派生」问题：SM3（HMAC-SM3 摘要）与 SM4（分组密钥流）最贴合；
 *     SM2 属于非对称签名/加密算法，不适合直接派生口令，故不作为生成引擎。
 *  2. 全部计算在本机完成，不联网、不读写存储，与保管库完全解耦。
 *  3. 相同「种子 + 盐值 + 计数器 + 参数」必然得到相同输出；计数器递增即可重新生成。
 *  4. 种子留空时自动取 128 bit 系统安全随机数，等价于一次一密的随机密码。
 */
import { sm3, sm4 } from 'sm-crypto';
import { CHARSET } from './utils';

export type GmEngine = 'SM3' | 'SM4';

/** 自定义算法默认字符集：大小写字母 + 数字 */
export const DEFAULT_CUSTOM_CHARSET = CHARSET.LOWER + CHARSET.UPPER + CHARSET.NUMBERS;

/** 迭代次数取值范围（防止误填导致长时间卡顿） */
export const MIN_ITERATIONS = 1;
export const MAX_ITERATIONS = 1000;

export const bytesToHex = (bytes: number[]): string =>
  bytes.map((b) => b.toString(16).padStart(2, '0')).join('');

export const hexToBytes = (hex: string): number[] => {
  const out: number[] = [];
  for (let i = 0; i + 1 < hex.length; i += 2) out.push(parseInt(hex.slice(i, i + 2), 16));
  return out;
};

/** SM3 摘要（十六进制小写） */
export const sm3Hex = (text: string): string => sm3(text);

/** SM3-HMAC 摘要（十六进制小写） */
export const hmacSm3Hex = (text: string, keyHex: string): string => sm3(text, { mode: 'hmac', key: keyHex });

/** 生成 128 bit 系统安全随机种子（十六进制） */
export const randomSecretHex = (byteLength = 16): string => {
  const arr = new Uint8Array(byteLength);
  (globalThis as unknown as { crypto: Crypto }).crypto.getRandomValues(arr);
  return bytesToHex(Array.from(arr));
};

export interface DeriveCharsOptions {
  engine: GmEngine;
  /** 种子；为空时内部生成随机种子 */
  secret: string;
  /** 盐值 / 域标识，用于隔离不同站点或用途 */
  salt: string;
  /** 计数器，用于「重新生成」 */
  counter: number;
  /** 迭代次数，默认 1 */
  iterations?: number;
}

const clampIterations = (n?: number): number => {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v) || v < MIN_ITERATIONS) return MIN_ITERATIONS;
  return v > MAX_ITERATIONS ? MAX_ITERATIONS : v;
};

/** SM3-HMAC 无限字节流 */
function* sm3Stream(keyHex: string, salt: string, counter: number, iterations: number): Generator<number, void, undefined> {
  for (let block = 0; ; block++) {
    let hex = sm3(`${salt}\u0000${counter}\u0000${block}`, { mode: 'hmac', key: keyHex });
    for (let round = 1; round < iterations; round++) hex = sm3(hex, { mode: 'hmac', key: keyHex });
    yield* hexToBytes(hex);
  }
}

/** SM4 密钥流：以派生 IV 为起点，逐分组做 SM4 加密输出 16 字节/组 */
function* sm4Stream(keyHex: string, ivHex: string, iterations: number): Generator<number, void, undefined> {
  for (let block = 0; ; block++) {
    let blockHex = `${ivHex}${block.toString(16).padStart(8, '0').slice(-8)}`;
    for (let round = 0; round < iterations; round++) {
      const out = sm4.encrypt(hexToBytes(blockHex), keyHex, { padding: 'none', output: 'array' });
      blockHex = bytesToHex(out);
    }
    yield* hexToBytes(blockHex);
  }
}

/** 依据引擎构造字节流生成器（每次调用只解析一次种子，保证同一条口令内部一致） */
const makeStream = (options: DeriveCharsOptions): Generator<number, void, undefined> => {
  const secret = options.secret || randomSecretHex(16);
  const salt = options.salt || '1p-gm';
  const iterations = clampIterations(options.iterations);
  if (options.engine === 'SM4') {
    const keyHex = sm3(`${secret}\u0000${salt}`).slice(0, 32);
    const ivHex = sm3(`${salt}\u0000${secret}\u0000${options.counter}`).slice(0, 24);
    return sm4Stream(keyHex, ivHex, iterations);
  }
  const keyHex = sm3(`${secret}\u0000${salt}\u0000key`);
  return sm3Stream(keyHex, salt, options.counter, iterations);
};

/** 从字节流中按「拒绝采样」均匀取一个字符（避免取模偏置） */
const pickChar = (stream: Iterator<number>, charset: string): string => {
  const n = charset.length;
  if (n === 0) return '';
  if (n > 256) {
    const high = stream.next().value ?? 0;
    const low = stream.next().value ?? 0;
    return charset[((high << 8) | low) % n];
  }
  const limit = Math.floor(256 / n) * n;
  for (let guard = 0; guard < 4096; guard++) {
    const byte = stream.next().value ?? 0;
    if (byte < limit) return charset[byte % n];
  }
  return charset[0];
};

/** 按指定字符集派生固定长度的字符串 */
export const deriveChars = (options: DeriveCharsOptions, charset: string, count: number): string => {
  const target = charset || DEFAULT_CUSTOM_CHARSET;
  if (count <= 0) return '';
  const stream = makeStream(options);
  let out = '';
  for (let i = 0; i < count; i++) out += pickChar(stream, target);
  return out;
};

/**
 * 按模板派生字符串
 *   * → 自定义字符集
 *   # → 数字
 *   ? → 大写字母
 *   其他字符原样保留
 */
export const deriveFromTemplate = (options: DeriveCharsOptions, template: string, charset: string): string => {
  const target = charset || DEFAULT_CUSTOM_CHARSET;
  const stream = makeStream(options);
  let out = '';
  for (const token of template) {
    if (token === '*') out += pickChar(stream, target);
    else if (token === '#') out += pickChar(stream, CHARSET.NUMBERS);
    else if (token === '?') out += pickChar(stream, CHARSET.UPPER);
    else out += token;
  }
  return out;
};
