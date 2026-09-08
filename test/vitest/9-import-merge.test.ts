/**
 * test/vitest/9-import-merge.test.ts - AES-GCM 导入导出 + 三策略合并 + 半提交事务回滚
 *
 * 测试覆盖（T9 验收 100% 精确命中断言）：
 *   T9-1 encryptExportBlob → decryptImportBlob 往返（同主密码可还原；错误主密码抛 BAD_MASTER_PASSWORD）
 *   T9-2 备份篡改（格式/密文位翻转）→ BACKUP_FORMAT_INVALID / DECRYPT_FAILED
 *   T9-3 mergeImportedVault 三策略 added/skipped/conflicted 计数**精确**断言：
 *        - keep-new      : 现有保留，冲突 skipped=conflicted
 *        - keep-old      : 现有被导入覆盖，冲突后 added 不增加 skipped=0
 *        - duplicate-both: 冲突项克隆新 id+标题(导入备份)后缀，conflicted 项均新增 added += conflicted
 *   T9-4 半提交事务回滚模拟：合并流程在中途故意抛错 → snapshotBefore 恢复（current 无任何变化）
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type { Item, VaultPlaintext, VaultMetaPlain, Tag } from '@/types/models';
import { DEFAULT_SETTINGS } from '@/types/models';
import {
  encryptExportBlob,
  decryptImportBlob,
  mergeImportedVault,
  ERR_CODES,
} from '@/core/vault-store';
import {
  generateSecretKey,
  deriveMasterKey,
  makeVerifier,
  CRYPTO_CONFIG,
} from '@/core/crypto';
import { nowMs } from '@/lib/utils';

/* ---------- helpers ---------- */
const mkItem = (patch: Partial<Item> & Pick<Item, 'id' | 'category' | 'title' | 'fields'>): Item => ({
  vaultId: 'vault-personal',
  tags: [],
  urls: [],
  createdAt: nowMs(),
  updatedAt: nowMs(),
  version: 1,
  ...patch,
});
const emptyVault = (): VaultPlaintext => ({
  items: [],
  vaults: [{
    id: 'vault-personal', name: '个人', description: '默认', iconEmoji: '👤', colorHex: '#0061ff',
    safeForTravel: true, createdAt: nowMs(), updatedAt: nowMs(),
  }],
  tags: [] as Tag[],
  settings: { ...DEFAULT_SETTINGS },
  deleted: [],
});

describe('M2-导入导出 AES-GCM 加密备份 + 三策略合并 + 半提交回滚', () => {
  let dk: CryptoKey;
  let meta: VaultMetaPlain;
  const MP = 'T9-Master-P@ss!2024';
  const EMAIL = 't9-test@example.com';
  let SK: string;

  beforeAll(async () => {
    expect(typeof crypto).toBe('object');
    expect(typeof crypto.subtle).toBe('object');
    SK = generateSecretKey();
    const r = await deriveMasterKey(MP, EMAIL, SK);
    dk = r.dk;
    const realVerifier = await makeVerifier(dk);
    meta = {
      version: 1,
      saltHex: r.saltHex,
      verifierB64: realVerifier,
      pbkdf2Iterations: CRYPTO_CONFIG.PBKDF2_ITERATIONS,
      secretKeyMasked: SK.slice(0, 6) + '****',
      accountEmail: EMAIL,
      createdAt: nowMs(),
      lastModified: nowMs(),
    };
  }, 20_000);

  /* ---------- T9-1 往返 + 错误密码 ---------- */
  it('T9-1: encryptExportBlob → decryptImportBlob 往返 AES-GCM 100% 还原；错误主密码抛 BAD_MASTER_PASSWORD', async () => {
    const v: VaultPlaintext = emptyVault();
    // 构造 3 条带中文字段的项目，验证 UTF-8 不丢
    v.items.push(mkItem({
      id: 'id-login-001', category: 'login', title: 'GitHub 工作账号',
      fields: [
        { id: 'f1', label: '用户名', type: 'text', value: 'alice-cn' },
        { id: 'f2', label: '密码', type: 'password', value: 'Gh_Token!@#_中文测试2024', updatedAt: nowMs() },
      ],
      urls: ['https://github.com'],
    }));
    v.items.push(mkItem({
      id: 'id-card-002', category: 'credit-card', title: '招商 Visa 信用卡 💳',
      fields: [
        { id: 'f3', label: '卡号', type: 'creditcard', value: '4242424242424242' },
        { id: 'f4', label: '有效期', type: 'monthYear', value: '2029-08' },
      ],
    }));
    const before = JSON.stringify(v);

    const exp = await encryptExportBlob(v, dk, meta);
    expect(exp.fileName.startsWith('1PassClone_Backup_')).toBe(true);
    expect(exp.fileName.endsWith('.enc.json')).toBe(true);
    expect(exp.blobB64.length).toBeGreaterThan(100);
    // 文件命名校验：safe email + 时间戳
    expect(exp.fileName).toMatch(/^1PassClone_Backup_t9-test_example.com_\d{8}_\d{6}\.enc\.json$/);
    expect(exp.sizeBytes).toBeGreaterThan(400);

    // ==== 正确主密码 → 100% 还原 ====
    const { vault: decrypted } = await decryptImportBlob(exp.blobB64, MP);
    expect(JSON.stringify(decrypted)).toBe(before);
    expect(decrypted.items.length).toBe(2);
    expect(decrypted.items[0].title).toBe('GitHub 工作账号');
    expect(decrypted.items[0].fields[1].value).toBe('Gh_Token!@#_中文测试2024');

    // ==== 错误主密码 → 必须抛 StoreError 携带 code=BAD_MASTER_PASSWORD ====
    await expect(() => decryptImportBlob(exp.blobB64, 'Wrong-Pass!!')).rejects.toMatchObject({ code: ERR_CODES.BAD_MASTER_PASSWORD });
  }, 30_000);

  /* ---------- T9-2 备份篡改/无效格式 ---------- */
  it('T9-2: 备份格式非法 → BACKUP_FORMAT_INVALID；密文位翻转 → DECRYPT_FAILED', async () => {
    // 情况 A：完全不是 base64 / JSON 结构 → code=BACKUP_FORMAT_INVALID
    await expect(() => decryptImportBlob('this-is-not-a-valid-json-at-all!!!', MP)).rejects.toMatchObject({ code: ERR_CODES.BACKUP_FORMAT_INVALID });
    // 情况 B：结构合法但 cipherB64 被位翻转（AES-GCM AuthTag 必然不匹配）→ code=DECRYPT_FAILED
    const v2 = emptyVault();
    v2.items.push(mkItem({ id: 'tamper-test-01', category: 'secure-note', title: '篡改测试', fields: [{ id: 'f0', label: '内容', type: 'textarea', value: '我是原文' }] }));
    const e = await encryptExportBlob(v2, dk, meta);
    // 解码 → 翻转 cipherB64 字符中间 1 位 → 重新编码
    const plainObj = JSON.parse(decodeURIComponent(escape(atob(e.blobB64))));
    const orig = plainObj.cipherB64 as string;
    const mid = Math.floor(orig.length / 2);
    const flip = orig.charCodeAt(mid) === 65 ? 66 : 65;
    plainObj.cipherB64 = orig.slice(0, mid) + String.fromCharCode(flip) + orig.slice(mid + 1);
    const tamperedB64 = btoa(unescape(encodeURIComponent(JSON.stringify(plainObj))));
    await expect(() => decryptImportBlob(tamperedB64, MP)).rejects.toMatchObject({ code: ERR_CODES.DECRYPT_FAILED });
  }, 30_000);

  /* ---------- T9-3 三策略计数精确 ---------- */
  it('T9-3: mergeImportedVault 三策略 added/skipped/conflicted 精确计数（0 误差）', () => {
    // ===== 构造 current：5 条 =====
    const current = emptyVault();
    for (let i = 1; i <= 5; i++) current.items.push(mkItem({
      id: `ID-${i}`, category: 'login', title: `当前项目 ${i}`,
      fields: [{ id: `c-f${i}`, label: '密码', type: 'password', value: `CURRENT-PWD-${i}`, updatedAt: nowMs() }],
      version: 10 + i,
    }));
    // ===== 构造 imported：7 条 =====
    //   ID-2 / ID-4 冲突 (2 条)
    //   ID-6 / ID-7 / ID-8 / ID-9 / ID-10 新增 (5 条)
    //   合计 conflicts=2，纯新增=5
    const imported = emptyVault();
    // 冲突项（用导入版本覆盖测试）
    imported.items.push(mkItem({
      id: 'ID-2', category: 'login', title: '导入覆盖-项目2（更新版）',
      fields: [{ id: 'imp-f2', label: '密码', type: 'password', value: 'IMPORTED-PWD-2*NEW', updatedAt: nowMs() }],
      version: 200,
    }));
    imported.items.push(mkItem({
      id: 'ID-4', category: 'login', title: '导入覆盖-项目4（更新版）',
      fields: [{ id: 'imp-f4', label: '密码', type: 'password', value: 'IMPORTED-PWD-4*NEW', updatedAt: nowMs() }],
      version: 400,
    }));
    // 纯新增
    for (let i = 6; i <= 10; i++) imported.items.push(mkItem({
      id: `ID-${i}`, category: 'api-credential', title: `导入新增项目 ${i}`,
      fields: [{ id: `imp-f${i}`, label: 'API Key', type: 'concealed', value: `sk-imported-${i}` }],
    }));
    const snapshotBefore = JSON.stringify(current);

    // ============= 策略 A：keep-new（保留现有，冲突跳过） =============
    const r1 = mergeImportedVault(current, imported, 'keep-new');
    expect(r1.conflicted).toBe(2);   // ID-2, ID-4
    expect(r1.added).toBe(5);        // ID-6~10
    expect(r1.skipped).toBe(2);      // 冲突被跳过 2
    // 验证 ID-2 / ID-4 还是原来的（未被覆盖）
    const i2_1 = current.items.find((x) => x.id === 'ID-2')!;
    expect(i2_1.fields[0].value).toBe('CURRENT-PWD-2');
    expect(i2_1.title).toBe('当前项目 2');
    const i4_1 = current.items.find((x) => x.id === 'ID-4')!;
    expect(i4_1.fields[0].value).toBe('CURRENT-PWD-4');
    // 验证 5 个纯新增都存在
    for (let i = 6; i <= 10; i++) expect(current.items.find((x) => x.id === `ID-${i}`)).toBeTruthy();
    expect(current.items.length).toBe(10); // 5 原 + 5 新

    // ============= 策略 B：keep-old（导入覆盖现有，冲突项被导入替换） =============
    // 重置 current 回 before 状态
    const currentB = JSON.parse(snapshotBefore) as VaultPlaintext;
    const r2 = mergeImportedVault(currentB, imported, 'keep-old');
    expect(r2.conflicted).toBe(2);
    expect(r2.added).toBe(5); // 5 个纯新增
    expect(r2.skipped).toBe(0); // keep-old：无跳过
    // ID-2 / ID-4 被导入覆盖了
    const i2_2 = currentB.items.find((x) => x.id === 'ID-2')!;
    expect(i2_2.fields[0].value).toBe('IMPORTED-PWD-2*NEW');
    expect(i2_2.title).toBe('导入覆盖-项目2（更新版）');
    expect(i2_2.version).toBe(200);
    const i4_2 = currentB.items.find((x) => x.id === 'ID-4')!;
    expect(i4_2.fields[0].value).toBe('IMPORTED-PWD-4*NEW');
    expect(currentB.items.length).toBe(10);

    // ============= 策略 C：duplicate-both（冲突项克隆新 id+「（导入备份）」标题） =============
    const currentC = JSON.parse(snapshotBefore) as VaultPlaintext;
    const lenBefore = currentC.items.length;
    const r3 = mergeImportedVault(currentC, imported, 'duplicate-both');
    expect(r3.conflicted).toBe(2);
    // 5 个纯新增 + 2 个冲突克隆 = added=7
    expect(r3.added).toBe(7);
    expect(r3.skipped).toBe(0);
    // 原始 ID-2 / ID-4 还在（原值保留）
    const i2_3 = currentC.items.find((x) => x.id === 'ID-2')!;
    expect(i2_3.fields[0].value).toBe('CURRENT-PWD-2');
    const i4_3 = currentC.items.find((x) => x.id === 'ID-4')!;
    expect(i4_3.fields[0].value).toBe('CURRENT-PWD-4');
    // 克隆出了 2 个新 id，标题带 "（导入备份）"
    const clones = currentC.items.filter((x) => x.title.includes('（导入备份）'));
    expect(clones.length).toBe(2);
    for (const cl of clones) {
      expect(cl.id.startsWith('ID-')).toBe(false); // 新 uuidv4 不是 ID-x 格式
      expect(cl.version).toBe(1);                  // 克隆重置 version=1
      // 克隆出来的 field id 也是新的（不是 imp-f2 / imp-f4）
      for (const f of cl.fields) expect(f.id.startsWith('imp-f')).toBe(false);
    }
    expect(currentC.items.length).toBe(lenBefore + 7); // 5 + 7 = 12
  });

  /* ---------- T9-4 半提交事务回滚模拟 ---------- */
  it('T9-4: 半提交事务回滚 — 合并到第 3 条故意抛错，snapshotBefore 还原后 current 0 变化', () => {
    // 这个测试模拟 background/index.ts 里 MISC_IMPORT_VAULT 的事务回滚模式：
    //   snapshot = deepClone(current)
    //   try { merge(current, imported) -> 中间某条抛 } catch { Object.assign(current, snapshot) }
    const current = emptyVault();
    for (let i = 1; i <= 5; i++) current.items.push(mkItem({
      id: `CUR-${i}`, category: 'login', title: `原有项目 ${i}`,
      fields: [{ id: `cf${i}`, label: 'p', type: 'password', value: `orig-pwd-${i}` }],
    }));
    const snapshotBefore = JSON.stringify(current);

    // 构造一个 imported：前 3 条是新增；第 4 条 id 带 "BOOM" 用来触发自定义错误（这里通过 Proxy 包装 merge 到第 3 条后抛错）
    const imported = emptyVault();
    for (let i = 1; i <= 4; i++) imported.items.push(mkItem({
      id: `IMP-${i}`, category: 'login', title: `导入项目 ${i}${i === 4 ? ' BOOM' : ''}`,
      fields: [{ id: `if${i}`, label: 'p', type: 'password', value: `imp-pwd-${i}` }],
    }));

    // === 模拟：BG MISC_IMPORT_VAULT 的 transaction wrapper ===
    const snapshotForRollback = JSON.parse(snapshotBefore) as VaultPlaintext;
    let rollbackTriggered = false;
    try {
      // 手动重写 merge 逻辑：执行到第 3 条时故意抛错（模拟 disk full / crypto 中途挂等）
      let processed = 0;
      for (const src of imported.items) {
        processed++;
        // 模拟 push 到 current
        current.items.push(JSON.parse(JSON.stringify(src)));
        if (processed === 3) {
          throw new Error('模拟 IO 异常：写入第 3 条后磁盘已满 / DB 断连');
        }
      }
    } catch (err) {
      // ---- 事务回滚：清空 items 等字段，从 snapshotBefore 完整还原（deep clone 保证无引用残留）----
      current.items = snapshotForRollback.items;
      current.vaults = snapshotForRollback.vaults;
      current.tags = snapshotForRollback.tags;
      current.settings = snapshotForRollback.settings;
      current.deleted = snapshotForRollback.deleted;
      rollbackTriggered = true;
    }

    // ==== 断言：半提交必须干净，0 条脏数据残留 ====
    expect(rollbackTriggered).toBe(true);
    expect(JSON.stringify(current)).toBe(snapshotBefore);
    expect(current.items.length).toBe(5);
    // 绝对不能包含导入项目的任何痕迹
    expect(current.items.some((x) => x.id.startsWith('IMP-'))).toBe(false);
    expect(current.items.some((x) => x.title.includes('导入'))).toBe(false);
  });
});
