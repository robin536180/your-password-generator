/**
 * core/hibp.ts — Have I Been Pwned 泄露检测（k-匿名，零知识友好）
 *
 * 原理（业界标准 k-Anonymity）：
 *   1. SHA-1(明文密码) → 40 位十六进制大写
 *   2. 只把「前 5 位」发给 api.pwnedpasswords.com/range/{prefix}
 *   3. 服务端返回该前缀下所有后缀（约 800 条），本地比对剩余 35 位
 *   4. 命中即可得到泄露次数
 *
 * 安全说明：
 *   - 完整密码、完整哈希永不出本机；服务端无法反推出密码
 *   - 响应带 Add-Padding 头，防止通过响应大小做流量分析
 *   - 纯读取，不上传任何保管库数据
 *
 * 网络：需要 manifest host_permissions 包含 https://api.pwnedpasswords.com/*
 */
import type { Item } from '@/types/models';
import { Log } from '@/core/logger';

const _G = globalThis as any;
const HIBP_RANGE_API = 'https://api.pwnedpasswords.com/range/';

/** 单次请求超时（ms） */
const REQUEST_TIMEOUT_MS = 10_000;
/** 并发上限（HIBP 为公共服务，避免打爆） */
const MAX_CONCURRENCY = 3;

export interface HibpCheckResult {
  /** 泄露出现次数；0 表示未在已知泄露库中出现 */
  count: number;
  /** 请求使用的 SHA-1 前缀（仅调试用，不含密码） */
  prefix: string;
}

export interface BreachedHit {
  itemId: string;
  fieldId: string;
  itemTitle: string;
  fieldLabel: string;
  /** 泄露出现次数 */
  count: number;
}

export interface BreachedScanResult {
  hits: BreachedHit[];
  /** 成功检查的唯一密码数 */
  checkedPasswords: number;
  /** 相关项目数（去重后参与扫描的 item 数） */
  scannedItems: number;
  /** 因网络/解析失败跳过的密码数 */
  failedPasswords: number;
  /** 总耗时 ms */
  durationMs: number;
}

/** SHA-1 → 40 位大写十六进制 */
export async function sha1HexUpper(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await _G.crypto.subtle.digest('SHA-1', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

/**
 * 查询单个密码是否泄露（k-匿名）。
 * @returns 泄露次数，0 = 未发现
 */
export async function checkPasswordPwned(password: string, signal?: AbortSignal): Promise<HibpCheckResult> {
  if (!password) return { count: 0, prefix: '' };

  const hash = await sha1HexUpper(password);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);

  try {
    const res = await fetch(`${HIBP_RANGE_API}${prefix}`, {
      method: 'GET',
      headers: {
        'Add-Padding': 'true',
      },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HIBP_HTTP_${res.status}`);

    const text = await res.text();
    // 每行格式：SUFFIX:COUNT（SUFFIX 为剩余 35 位大写十六进制）
    for (const line of text.split('\n')) {
      const idx = line.indexOf(':');
      if (idx <= 0) continue;
      if (line.slice(0, idx).trim() === suffix) {
        const count = Number(line.slice(idx + 1).trim()) || 0;
        return { count, prefix };
      }
    }
    return { count: 0, prefix };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/**
 * 批量扫描保管库中的 password 字段。
 * - 相同密码只查询一次（Map 缓存）
 * - 3 并发限流，避免打爆公共服务
 * - 单个密码失败不影响整批（分层容错）
 */
export async function scanBreachedPasswords(
  items: Item[],
  opts: {
    onProgress?: (done: number, total: number) => void;
    signal?: AbortSignal;
  } = {},
): Promise<BreachedScanResult> {
  const started = performance.now();
  const { onProgress, signal } = opts;

  // 只扫描未删除项目中的非空 password 字段；按明文密码去重
  type Target = { itemId: string; fieldId: string; itemTitle: string; fieldLabel: string; password: string };
  const targets: Target[] = [];
  let scannedItems = 0;

  for (const it of items) {
    if (it.trashed) continue;
    let used = false;
    for (const f of it.fields) {
      if (f.type !== 'password') continue;
      const pwd = String(f.value ?? '');
      if (!pwd) continue;
      used = true;
      targets.push({
        itemId: it.id,
        fieldId: f.id,
        itemTitle: it.title,
        fieldLabel: f.label,
        password: pwd,
      });
    }
    if (used) scannedItems += 1;
  }

  const uniquePasswords = Array.from(new Set(targets.map((t) => t.password)));
  const total = uniquePasswords.length;
  const cache = new Map<string, number>();
  let failedPasswords = 0;
  let cursor = 0;

  const worker = async (): Promise<void> => {
    while (cursor < uniquePasswords.length) {
      if (signal?.aborted) return;
      const pwd = uniquePasswords[cursor++];
      try {
        const r = await checkPasswordPwned(pwd, signal);
        cache.set(pwd, r.count);
      } catch (e) {
        // 单个密码失败（超时/网络/限流）不中断整批
        failedPasswords += 1;
        Log.warn('HIBP', `查询失败（已跳过）：${e instanceof Error ? e.message : String(e)}`);
      }
      onProgress?.(Math.min(cursor, total), total);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(MAX_CONCURRENCY, uniquePasswords.length) }, () => worker()),
  );

  const hits: BreachedHit[] = [];
  for (const t of targets) {
    const count = cache.get(t.password);
    if (count && count > 0) {
      hits.push({
        itemId: t.itemId,
        fieldId: t.fieldId,
        itemTitle: t.itemTitle,
        fieldLabel: t.fieldLabel,
        count,
      });
    }
  }
  hits.sort((a, b) => b.count - a.count);

  const result: BreachedScanResult = {
    hits,
    checkedPasswords: cache.size,
    scannedItems,
    failedPasswords,
    durationMs: Math.round(performance.now() - started),
  };
  Log.info(
    'HIBP',
    `泄露扫描完成：密码=${result.checkedPasswords} 命中=${hits.length} 失败=${failedPasswords} 耗时=${result.durationMs}ms`,
  );
  return result;
}
