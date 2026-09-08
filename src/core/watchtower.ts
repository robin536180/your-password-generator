/**
 * core/watchtower.ts - Watchtower MVP 纯本地算法
 *
 * 4 维评估（不联网，纯函数）：
 *  1. weak     : password 字段熵 < 60 bits（粗略估算： charset^len ≈ 2^entropy 计算，取最大的 password 字段）
 *  2. reused   : 跨 items 的 password 字段 FNV-1a hash 相同（重复密码检测）
 *  3. notHttps : urls 数组里有以 http:// 开头的项（不含 https://）
 *  4. outdated : 任一 password 字段 updatedAt 距今 > 365 天 或 项目 updatedAt>365天且密码未更新
 */
import type { Item } from '@/types/models';

export type WatchtowerIssueKey = 'weak' | 'reused' | 'notHttps' | 'outdated';

export type WatchtowerIssue = {
  itemId: string;
  reason: string;
  /** reused/weak: 指向具体 fieldId；notHttps: URL；outdated: daysOld */
  detail?: string;
  severityBits?: number;
};

export type WatchtowerReport = {
  weak: WatchtowerIssue[];
  reused: WatchtowerIssue[];
  notHttps: WatchtowerIssue[];
  outdated: WatchtowerIssue[];
  totalItemsScanned: number;
  totalPasswordsScanned: number;
  /** 扫描耗时 ms（用于 Vitest 性能断言 T8 1万条 <500ms） */
  scanMs: number;
};

/* ---------- 熵估算（粗略，不追求精确） ---------- */
export const estimateEntropyBits = (pwd: string): number => {
  if (!pwd) return 0;
  let charsetSize = 0;
  if (/[a-z]/.test(pwd)) charsetSize += 26;
  if (/[A-Z]/.test(pwd)) charsetSize += 26;
  if (/[0-9]/.test(pwd)) charsetSize += 10;
  if (/[^A-Za-z0-9]/.test(pwd)) charsetSize += 32; /* 常见符号估算 */
  if (charsetSize <= 1) charsetSize = 2;
  const entropyPerChar = Math.log2(charsetSize);
  return Math.round(pwd.length * entropyPerChar);
};

/* ---------- FNV-1a 32bit hash（用于密码重复检测） ---------- */
export const fnv1a32 = (s: string): string => {
  if (!s) return '0';
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
};

const WEAK_ENTROPY_THRESHOLD = 60;
const OUTDATED_DAYS_THRESHOLD = 365;
const MS_PER_DAY = 86_400_000;

export const scanWatchtower = (items: Item[]): WatchtowerReport => {
  const started = performance.now();
  const report: WatchtowerReport = {
    weak: [],
    reused: [],
    notHttps: [],
    outdated: [],
    totalItemsScanned: 0,
    totalPasswordsScanned: 0,
    scanMs: 0,
  };
  if (!items || !items.length) {
    report.scanMs = Math.round((performance.now() - started) * 100) / 100;
    return report;
  }

  /* password 字段 FNV hash → 出现的 issue[] 用于 reused 归类 */
  const hashToOccurrences = new Map<string, { itemId: string; fieldId: string }[]>();

  for (const it of items) {
    if (it.trashed) continue;
    report.totalItemsScanned++;
    let strongestEntropy = 0;
    let hasPwd = false;
    let newestPwdTs: number | undefined;

    for (const f of it.fields) {
      if (f.type !== 'password') continue;
      hasPwd = true;
      report.totalPasswordsScanned++;
      const bits = f.entropyBits && f.entropyBits > 0 ? f.entropyBits : estimateEntropyBits(f.value);
      if (bits > strongestEntropy) strongestEntropy = bits;
      if (bits < WEAK_ENTROPY_THRESHOLD && f.value.length > 0) {
        report.weak.push({
          itemId: it.id,
          reason: `密码熵仅 ${bits} bits（阈值 ${WEAK_ENTROPY_THRESHOLD} bits）`,
          detail: `fieldId=${f.id}, len=${f.value.length}`,
          severityBits: bits,
        });
      }
      if (f.updatedAt) {
        if (newestPwdTs === undefined || f.updatedAt > newestPwdTs) newestPwdTs = f.updatedAt;
      }
      if (f.value && f.value.length >= 4) {
        const h = fnv1a32(f.value);
        const arr = hashToOccurrences.get(h) ?? [];
        arr.push({ itemId: it.id, fieldId: f.id });
        hashToOccurrences.set(h, arr);
      }
    }

    /* notHttps */
    if (Array.isArray(it.urls)) {
      for (const u of it.urls) {
        if (!u) continue;
        const uLower = u.trim().toLowerCase();
        if (!uLower) continue;
        if (uLower.startsWith('http://')) {
          report.notHttps.push({
            itemId: it.id,
            reason: '未加密 HTTP 网址（有被窃听风险）',
            detail: u,
          });
        }
      }
    }

    /* outdated：有 password 字段，且最新 password updatedAt 或项目 updatedAt 距今超过 1 年 */
    if (hasPwd) {
      const ts = newestPwdTs ?? it.updatedAt;
      if (ts) {
        const days = Math.floor((Date.now() - ts) / MS_PER_DAY);
        if (days > OUTDATED_DAYS_THRESHOLD) {
          report.outdated.push({
            itemId: it.id,
            reason: `密码已 ${days} 天未更新（建议 ${OUTDATED_DAYS_THRESHOLD} 天内轮换）`,
            detail: `days=${days}`,
            severityBits: days,
          });
        }
      }
    }
  }

  /* reused：hashToOccurrences 中 size>1 才收集 */
  for (const [, arr] of hashToOccurrences.entries()) {
    if (arr.length <= 1) continue;
    for (const o of arr) {
      report.reused.push({
        itemId: o.itemId,
        reason: `与另外 ${arr.length - 1} 个项目使用了相同密码（撞库风险）`,
        detail: `fieldId=${o.fieldId}, group=${arr.length}个`,
      });
    }
  }

  /* 弱密码按熵升序（越弱越靠前）；outdated 按天数降序（越旧越前） */
  report.weak.sort((a, b) => (a.severityBits ?? 0) - (b.severityBits ?? 0));
  report.outdated.sort((a, b) => (b.severityBits ?? 0) - (a.severityBits ?? 0));

  report.scanMs = Math.round((performance.now() - started) * 100) / 100;
  return report;
};

/* ---------- 快速统计 ---------- */
export const summariseRiskCount = (r: WatchtowerReport): number =>
  r.weak.length + r.reused.length + r.notHttps.length + r.outdated.length;
