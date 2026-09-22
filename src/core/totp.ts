/**
 * core/totp.ts — RFC 6238 TOTP (Time-based One-Time Password)
 * 纯 TS 零依赖，仅依赖 globalThis._G.crypto.subtle（已在 crypto.ts 初始化 globalThis._G）
 *
 * 标准：https://datatracker.ietf.org/doc/html/rfc6238
 * - Base32 decode 自写（RFC 4648，不含 padding 宽松）
 * - HMAC-SHA1（默认）/ SHA256 / SHA512（参数可配，默认 SHA1 兼容 1Password/Authy/Google Authenticator）
 * - period 默认 30 秒，digits 默认 6
 *
 * Test Vector（RFC 6238 官方附录 B + 社区 known vector）：
 *   secret = "JBSWY3DPEHPK3PXP"（Base32 → 字节 = "12345678901234567890" ASCII）
 *   time = 0 (1970-01-01) → digits=6 → "287082"
 *   time = 1788844800000 / 30_000 = 59628160 → ...
 */

import { Log } from '@/core/logger';

const _G = globalThis as any;

/* ------------------- Base32 RFC 4648 解码（宽松） ------------------- */
const B32_MAP: Record<string, number> = {};
'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.split('').forEach((ch, i) => { B32_MAP[ch] = i; });

export function base32Decode(input: string): Uint8Array {
  const clean = input.replace(/[\s=-]/g, '').toUpperCase();
  const outBits: boolean[] = [];
  for (const ch of clean) {
    const v = B32_MAP[ch];
    if (v === undefined) continue;
    for (let i = 4; i >= 0; i -= 1) outBits.push(((v >> i) & 1) === 1);
  }
  // 8 bits 一组凑字节
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= outBits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j += 1) if (outBits[i + j]) b |= (1 << (7 - j));
    bytes.push(b);
  }
  return new Uint8Array(bytes);
}

/* ------------------- HMAC-SHA1 via crypto.subtle ------------------- */
async function hmacSha(keyBytes: Uint8Array, counterBytes: Uint8Array, algo: 'SHA-1' | 'SHA-256' | 'SHA-512' = 'SHA-1'): Promise<Uint8Array> {
  const ck = await _G.crypto.subtle.importKey(
    'raw', keyBytes, { name: 'HMAC', hash: algo }, false, ['sign'],
  );
  const sig = await _G.crypto.subtle.sign('HMAC', ck, counterBytes);
  return new Uint8Array(sig);
}

function dt(hmac: Uint8Array): number {
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return binCode >>> 0;
}

/* ------------------- Public API ------------------- */

export interface TotpOptions {
  period?: number;       // 默认 30s
  digits?: 6 | 8;        // 默认 6
  algorithm?: 'SHA-1' | 'SHA-256' | 'SHA-512'; // 默认 SHA-1（Google/1P 标准）
}

export interface TotpCode {
  code: string;          // 固定 6 或 8 位字符串（前导零补齐）
  remainingSec: number;  // 当前 period 剩余秒数（向下取整，0 ≤ x < period）
  periodStartAt: number; // ms 时间戳：本 period 起始（Content Script 每秒刷新用）
}

/**
 * 解析 otpauth:// URI 为结构化参数（可失败）
 * 例：otpauth://totp/Example:alice@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Example&period=30&digits=6&algorithm=SHA1
 */
export function parseOtpAuthUri(uri: string): { label: string; issuer: string; secret: string; opts: TotpOptions } | null {
  try {
    if (!uri || !uri.startsWith('otpauth://totp/')) return null;
    const [, rest1] = uri.split('otpauth://totp/');
    const [labelRaw, queryRaw = ''] = rest1.split('?');
    const label = decodeURIComponent(labelRaw.split(':').slice(1).join(':') || labelRaw);
    const params = new URLSearchParams(queryRaw);
    const secret = params.get('secret') || '';
    if (!secret) return null;
    const issuer = params.get('issuer') || '';
    const period = Number(params.get('period')) || 30;
    const digits = ((Number(params.get('digits')) || 6) as 6 | 8);
    const algoRaw = (params.get('algorithm') || 'SHA1').toUpperCase().replace(/^SHA([1-5])/, 'SHA-$1');
    const algorithm = (['SHA-1', 'SHA-256', 'SHA-512'].includes(algoRaw) ? algoRaw : 'SHA-1') as TotpOptions['algorithm'];
    return { label, issuer, secret, opts: { period, digits, algorithm } };
  } catch (e) {
    Log.warn('TOTP', `parseOtpAuthUri 失败：${String(e)}`);
    return null;
  }
}

/**
 * 计算 TOTP 当前码。
 * @param secretOrUri Base32 秘密或完整 otpauth:// URI
 * @param nowMs 可选覆盖当前时间（测试用）
 */
export async function totpNow(secretOrUri: string, nowMs: number = Date.now()): Promise<TotpCode> {
  const parsed = parseOtpAuthUri(secretOrUri);
  const opts: TotpOptions = parsed?.opts ?? {};
  const period = opts.period ?? 30;
  const digits = opts.digits ?? 6;
  const algorithm = opts.algorithm ?? 'SHA-1';
  const secretBytes = base32Decode(parsed?.secret ?? secretOrUri);
  if (secretBytes.length === 0) return { code: '0'.repeat(digits), remainingSec: 0, periodStartAt: 0 };

  const periodStartAt = Math.floor(nowMs / (period * 1000)) * period * 1000;
  let counter = Math.floor(nowMs / (period * 1000));
  const counterBytes = new Uint8Array(8);
  for (let i = 7; i >= 0; i -= 1) { counterBytes[i] = counter & 0xff; counter >>>= 8; }
  const hmac = await hmacSha(secretBytes, counterBytes, algorithm);
  const codeNum = dt(hmac) % Math.pow(10, digits);
  const code = codeNum.toString().padStart(digits, '0');
  const elapsed = (nowMs - periodStartAt) / 1000;
  const remainingSec = Math.max(0, Math.floor(period - elapsed));
  return { code, remainingSec, periodStartAt };
}

/** 返回 30 秒 period 的倒计时占比（0-1，UI 画进度用） */
export function totpProgress(nowMs: number = Date.now(), period = 30): number {
  const elapsed = (nowMs % (period * 1000)) / 1000;
  return Math.max(0, Math.min(1, 1 - elapsed / period));
}
