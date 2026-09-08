/**
 * test/vitest/8-watchtower.test.ts - Watchtower MVP 4 维精准检测 + 1万条压测
 *
 * 测试覆盖（T8 验收 100% 精确命中断言）：
 *   T8-1 estimateEntropyBits 熵估算正确性（弱/强边界）
 *   T8-2 fnv1a32 哈希一致性（同字符串必同 hash；不同字符串碰撞率≈0）
 *   T8-3 scanWatchtower 4 维精准命中：
 *        - weak    : 密码熵 < 60 bits
 *        - reused  : 不同 item 的 password 字段值相同
 *        - notHttps: urls 数组中存在 http:// (不含 https)
 *        - outdated: password.updatedAt 或 item.updatedAt > 365 天
 *   T8-4(压测) 10,000 条随机 items 扫描总耗时 < 500ms（T8 性能指标）
 */
import { describe, it, expect } from 'vitest';
import type { Item, Field } from '@/types/models';
import {
  estimateEntropyBits,
  fnv1a32,
  scanWatchtower,
  type WatchtowerReport,
} from '@/core/watchtower';
import { uuidv4 } from '@/lib/utils';

/* ---------- helpers ---------- */
const mkPwdField = (value: string, updatedAtDaysAgo?: number, entropy?: number): Field => ({
  id: uuidv4(),
  label: '密码',
  type: 'password',
  value,
  updatedAt: updatedAtDaysAgo !== undefined ? Date.now() - updatedAtDaysAgo * 86_400_000 : Date.now(),
  entropyBits: entropy,
});
const mkItem = (patch: Partial<Item> & Pick<Item, 'category' | 'title' | 'fields'>): Item => ({
  id: uuidv4(),
  vaultId: 'vault-personal',
  tags: [],
  urls: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  version: 1,
  ...patch,
});

describe('M2-Watchtower 瞭望塔 MVP（纯本地 4 维检测）', () => {
  it('T8-1: estimateEntropyBits 熵估算边界精确', () => {
    expect(estimateEntropyBits('')).toBe(0);
    // 纯小写 8 位 ≈ 8 * log2(26) ≈ 37.6 → 38 bits (< 60 → weak)
    expect(estimateEntropyBits('abcdefgh')).toBeLessThan(60);
    expect(estimateEntropyBits('abcdefgh')).toBeGreaterThan(30);
    // 大小写+数字+符号 14 位 → 14 * log2(94) ≈ 14 * 6.555 ≈ 91.8 bits → strong
    const strong = 'Abc123!@#Xyz_QR';
    expect(estimateEntropyBits(strong)).toBeGreaterThanOrEqual(60);
    expect(estimateEntropyBits(strong)).toBeLessThan(120);
    // 仅数字 6 位 → 6 * log2(10) ≈ 19.9 → 20 bits
    const pin = '123456';
    expect(estimateEntropyBits(pin)).toBeLessThan(30);
  });

  it('T8-2: fnv1a32 哈希一致性 + 无碰撞率验证', () => {
    // 完全相同字符串 → 必须相同 hash
    const s1 = 'Hello-Password-123!';
    expect(fnv1a32(s1)).toBe(fnv1a32(s1));
    expect(fnv1a32(s1).length).toBe(8); // 8 hex chars
    expect(/^[0-9a-f]{8}$/.test(fnv1a32(s1))).toBe(true);
    // 空字符串兜底
    expect(fnv1a32('')).toBe('0');
    // 10,000 个不同字符串 → hash 碰撞概率 < 0.1% (FNV-1a 32bit 实际分布测试)
    const seen = new Map<string, number>();
    let collision = 0;
    for (let i = 0; i < 10_000; i++) {
      const h = fnv1a32(`ITEM-${i}-${Math.random().toString(36).slice(2)}`);
      const before = seen.get(h) ?? 0;
      if (before > 0) collision++;
      seen.set(h, before + 1);
    }
    expect(collision).toBeLessThanOrEqual(5); // FNV-1a 32bit 在 10k 规模碰撞 ≤ 5 可接受
  });

  it('T8-3: scanWatchtower 4 维检测精确命中 0 误报 0 漏报', () => {
    const OLD_400_DAYS = 400;
    // ==== 构造精准数据集：共 7 项，其中 5 项含不同类型风险 ====
    // item0: 完美登录项（强密码 + https + 新）→ 0 风险
    const perfect = mkItem({
      category: 'login', title: '完美的登录项',
      fields: [mkPwdField('Abc123!@#XYZ999_QRst', 10)],
      urls: ['https://example.com'],
    });
    // item1: 弱密码（纯 6 位数字）→ weak 命中
    const weakItem = mkItem({
      category: 'login', title: '弱密码-银行卡PIN',
      fields: [mkPwdField('123456', 5)],
      urls: ['https://bank.example.com'],
    });
    // item2 + item3: 共用密码 "SharedPwd789!" → reused 命中 (两个 item)
    const sharedPwd = 'SharedPwd789!';
    const reusedA = mkItem({
      category: 'login', title: '重复密码-A网站',
      fields: [mkPwdField(sharedPwd, 20)],
      urls: ['https://site-a.com'],
    });
    const reusedB = mkItem({
      category: 'email-account', title: '重复密码-B邮箱',
      fields: [mkPwdField(sharedPwd, 25)],
      urls: ['https://mail-b.com'],
    });
    // item4: HTTP 明文 URL（没有 https://）→ notHttps 命中
    const httpItem = mkItem({
      category: 'server', title: '内网后台-明文HTTP',
      fields: [mkPwdField('Admin@2024!#Secure', 3)],
      urls: ['http://192.168.1.100:8080/admin', 'https://safe.example.com'],
    });
    // item5: 密码 400 天未改 + item 本身也老 → outdated 命中
    const outdatedItem = mkItem({
      category: 'login', title: '陈旧密码-多年未改',
      fields: [mkPwdField('OldPasswordButStrong$99', OLD_400_DAYS)],
      urls: ['https://old-forum.example.org'],
      updatedAt: Date.now() - OLD_400_DAYS * 86_400_000,
    });
    // item6: 移到回收站（trashed=true）→ 所有风险跳过
    const trashedWeak = mkItem({
      category: 'login', title: '回收站里的弱密码(不计入)',
      fields: [mkPwdField('0000')],
      urls: ['http://insecure-trash.com'],
      trashed: true,
    });

    const items = [perfect, weakItem, reusedA, reusedB, httpItem, outdatedItem, trashedWeak];
    const report: WatchtowerReport = scanWatchtower(items);

    // --- 总量统计（不含 trashed=true → 6 项被扫描，共 7 个 password 字段（每个 1 个））---
    expect(report.totalItemsScanned).toBe(6);
    expect(report.totalPasswordsScanned).toBe(6);

    // --- weak: 应该仅 weakItem 命中 1 条（完美项合格；重复密码 "SharedPwd789!" 熵=14*log2(90)=91 bits 不弱；其他均 strong） ---
    expect(report.weak.length).toBe(1);
    expect(report.weak[0].itemId).toBe(weakItem.id);
    expect(report.weak[0].reason).toContain('熵');
    expect(report.weak[0].severityBits).toBeLessThan(60);

    // --- reused: 应该命中 reusedA + reusedB 共 2 条（sharedPwd 出现 2 次） ---
    expect(report.reused.length).toBe(2);
    const reusedItemIds = report.reused.map((r) => r.itemId).sort();
    expect(reusedItemIds).toEqual([reusedA.id, reusedB.id].sort());

    // --- notHttps: 应该仅 httpItem 命中 1 条（含 http://192.168.1.100:8080/admin） ---
    expect(report.notHttps.length).toBe(1);
    expect(report.notHttps[0].itemId).toBe(httpItem.id);
    expect(report.notHttps[0].reason).toMatch(/http|HTTP/i);

    // --- outdated: 应该仅 outdatedItem 命中 1 条（400 天未改 > 365 天阈值） ---
    expect(report.outdated.length).toBe(1);
    expect(report.outdated[0].itemId).toBe(outdatedItem.id);
    expect(report.outdated[0].reason).toMatch(/天|陈旧|outdated/i);

    // --- 完美登录项（0 风险）→ 不出现在任何 4 类中 ---
    const allIssueIds = [
      ...report.weak.map((r) => r.itemId),
      ...report.reused.map((r) => r.itemId),
      ...report.notHttps.map((r) => r.itemId),
      ...report.outdated.map((r) => r.itemId),
    ];
    expect(allIssueIds.includes(perfect.id)).toBe(false);
    // --- 回收站项（trashed=true）→ 绝对不出现在任何统计中（硬要求：0 误报 0 计入） ---
    expect(allIssueIds.includes(trashedWeak.id)).toBe(false);
  });

  it('T8-4(压测): 10,000 条随机 items 扫描总耗时 < 500ms', () => {
    const N = 10_000;
    const catPool: Item['category'][] = ['login', 'credit-card', 'identity', 'server', 'email-account', 'secure-note', 'api-credential', 'bank-account'];
    const items: Item[] = Array.from({ length: N }, (_, i) => {
      const hasWeak = i % 17 === 0; // ~588 条弱密码
      const hasHttp = i % 29 === 0; // ~344 条 HTTP 明文
      const isOld = i % 47 === 0;    // ~212 条陈旧
      const pwdVal = hasWeak
        ? (i % 1000).toString().padStart(4, '0')  // 4 位 PIN（弱）
        : `P@ss_${i.toString(36)}_${Math.random().toString(36).slice(2, 10)}!`; // 强
      return mkItem({
        category: catPool[i % catPool.length],
        title: `压测项目 #${i}`,
        fields: [mkPwdField(pwdVal, isOld ? 500 : 5)],
        urls: hasHttp ? [`http://internal-${i}.local/page`] : [`https://site-${i}.example.com`],
      });
    });
    // 重复密码池：随机 300 条共享同一密码 "CommonReusedPwd!2024"（复用检测命中 ~600 条）
    const shared = 'CommonReusedPwd!2024';
    for (let k = 0; k < 300; k++) {
      const idx = (k * 31 + 7) % N;
      items[idx].fields[0] = mkPwdField(shared, 15);
    }
    // ---- 开始计时 ----
    const t0 = performance.now();
    const r = scanWatchtower(items);
    const dur = performance.now() - t0;
    console.log(`[WATCHTOWER-BENCH] N=${N} items → weak=${r.weak.length}, reused=${r.reused.length}, notHttps=${r.notHttps.length}, outdated=${r.outdated.length}, scanMs=${r.scanMs}ms, actual=${dur.toFixed(1)}ms`);
    // ---- 性能断言 < 500ms ----
    expect(dur).toBeLessThan(500);
    expect(r.scanMs).toBeLessThan(500);
    // ---- 基本逻辑合理性（不精准但有下限/上限） ----
    expect(r.totalItemsScanned).toBe(N);
    expect(r.weak.length).toBeGreaterThanOrEqual(500);
    expect(r.notHttps.length).toBeGreaterThanOrEqual(300);
    expect(r.outdated.length).toBeGreaterThanOrEqual(200);
    expect(r.reused.length).toBeGreaterThanOrEqual(300); // 300 条共享至少都算 reused
  });
});
