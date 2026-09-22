/**
 * core/vault-store.ts - 保管库加密存储封装
 *
 * 职责：
 *   1) 写入 chrome.storage.local （AES-GCM 密文 Blob）
 *   2) 读取 + 解密
 *   3) 保管库元数据操作（Meta：Salt/Iter/Verifier）
 *   4) 首次初始化（创建个人保管库 / 默认设置 / 空 items）
 *
 * 所有 "写" 操作必须通过 update() 方法，保证 AES-GCM 重新加密 + IV 每次不同
 */
import { Log } from '@/core/logger';
import {
  VaultPlaintext,
  VaultMetaPlain,
  STORAGE_KEYS,
  DEFAULT_SETTINGS,
  Vault,
  Item,
  Tag,
  DeletedItem,
  AppSettings,
} from '@/types/models';
import {
  CRYPTO_CONFIG,
  deriveMasterKey,
  deriveMasterKey as _derive,  /* placeholder removed below via static import */
  generateSecretKey,
  makeVerifier,
  verifyDk,
  encryptAesGcm,
  decryptAesGcm,
} from '@/core/crypto';
import { nowMs, sha256Hex, uuidv4 } from '@/lib/utils';

export interface InitVaultResult {
  secretKey: string;
  accountEmail: string;
  meta: VaultMetaPlain;
  emptyVaultHash: string;
}

/** 初次使用：创建空保管库 + Meta（注册流程用）
 *  ⚠️  原子性保证：三步 [deriveDK → AES加密 → storage双写] 任何一步失败，
 *    会立即 chrome.storage.local.remove 两个 key，防止出现"点击注册报错但下次提示已存在"的半提交状态
 */
export const initializeEmptyVault = async (
  masterPassword: string,
  accountEmail: string,
  secretKeyInput?: string,
): Promise<InitVaultResult> => {
  const secretKey = secretKeyInput && /^[A-Z0-9-]+$/.test(secretKeyInput) ? secretKeyInput : generateSecretKey();
  Log.info('VAULT:INIT', `开始初始化新保管库 account=${accountEmail || '(无邮箱)'}`);

  let meta: VaultMetaPlain | null = null;
  let cipherB64: string | null = null;
  let json: string | null = null;
  try {
    const { dk, saltHex } = await deriveMasterKey(masterPassword, accountEmail, secretKey);
    const verifierB64 = await makeVerifier(dk);

    // 创建初始保管库（1个个人保管库 + 默认settings + 空items）
    const initialVault: VaultPlaintext = {
      items: [],
      vaults: [
        {
          id: 'vault-personal',
          name: '个人',
          description: '默认个人保管库',
          iconEmoji: '👤',
          colorHex: '#0061ff',
          safeForTravel: true,
          createdAt: nowMs(),
          updatedAt: nowMs(),
        } as Vault,
      ],
      tags: [] as Tag[],
      settings: { ...DEFAULT_SETTINGS },
      deleted: [] as DeletedItem[],
    };

    json = JSON.stringify(initialVault);
    cipherB64 = await encryptAesGcm(dk, json);

    meta = {
      version: CRYPTO_CONFIG.VAULT_SCHEMA_VERSION,
      createdAt: nowMs(),
      lastModified: nowMs(),
      saltHex,
      pbkdf2Iterations: CRYPTO_CONFIG.PBKDF2_ITERATIONS,
      verifierB64,
      accountEmail: accountEmail.trim(),
      secretKeyMasked: maskSecretKey(secretKey),
    };

    await chrome.storage.local.set({
      [STORAGE_KEYS.META]: meta,
      [STORAGE_KEYS.VAULT_CIPHER]: cipherB64,
    });

    const emptyVaultHash = await sha256Hex(json);
    Log.info('VAULT:INIT', `✅ 保管库初始化成功。items=0, vaults=${initialVault.vaults.length}, sk=${meta.secretKeyMasked}`);
    return { secretKey, accountEmail, meta, emptyVaultHash };
  } catch (err) {
    Log.error('VAULT:INIT', `❌ 初始化失败，正在回滚半写入的 storage: ${(err as Error).message ?? String(err)}`);
    try {
      await chrome.storage.local.remove([STORAGE_KEYS.META, STORAGE_KEYS.VAULT_CIPHER]);
    } catch (rbErr) {
      Log.error('VAULT:INIT', `⚠️ 回滚失败，请用户手动到 Options 危险区清空: ${(rbErr as Error).message}`);
    }
    throw err;
  }
};

/** 仅验证 Meta + 存储是否存在 （解锁UI用：判断走注册流程还是解锁流程） */
export const vaultExists = async (): Promise<boolean> => {
  const res = await chrome.storage.local.get([STORAGE_KEYS.META, STORAGE_KEYS.VAULT_CIPHER]);
  const ok = Boolean(res[STORAGE_KEYS.META] && res[STORAGE_KEYS.VAULT_CIPHER]);
  Log.debug('VAULT:EXISTS', `检查保管库是否存在 → ${ok}`);
  return ok;
};

/** 读取 Meta（明文） */
export const loadMeta = async (): Promise<VaultMetaPlain | null> => {
  const res = await chrome.storage.local.get([STORAGE_KEYS.META]);
  return (res[STORAGE_KEYS.META] as VaultMetaPlain) ?? null;
};

/** 解锁保管库 → 返回 DK + 明文保管库（失败抛错误码） */
export type UnlockErrorCode = 'NO_VAULT' | 'INVALID_PASSWORD' | 'DECRYPT_ERROR' | 'SCHEMA_MISMATCH';
export class UnlockError extends Error {
  constructor(public code: UnlockErrorCode, msg?: string) { super(msg ?? code); this.name = 'UnlockError'; }
}

export interface UnlockResult {
  dk: CryptoKey;
  vault: VaultPlaintext;
  meta: VaultMetaPlain;
}

export const unlockVault = async (masterPassword: string): Promise<UnlockResult> => {
  const meta = await loadMeta();
  if (!meta) throw new UnlockError('NO_VAULT');
  // 旧逻辑（保留注释说明）：
  // 原设计：注册时生成 SK，解锁需要主密码 × SK 双因素 → deriveMasterKey(pwd, email, SK)
  // → 但用户每次解锁都要输入 SK 太繁琐（SK 23 字符长）
  // → MVP 简化改为：saltHex = Meta.saltHex（初始化时固定 = SHA256(email:Hex(SK))）
  // → 解锁流程走 deriveMasterKeyBySalt 即可，不需要 SK 原文
  //    真正双因素恢复流程在 M2「从紧急工具包恢复」入口，再让用户贴完整 SK
  void _derive;
  const { dk: dkReal } = await deriveMasterKeyBySalt(masterPassword, meta.saltHex, meta.pbkdf2Iterations);

  const ok = await verifyDk(dkReal, meta.verifierB64);
  if (!ok) {
    Log.warn('VAULT:UNLOCK', '❌ 主密码错误 / DK 验证失败');
    throw new UnlockError('INVALID_PASSWORD');
  }
  try {
    const cipher = (await chrome.storage.local.get([STORAGE_KEYS.VAULT_CIPHER]))[STORAGE_KEYS.VAULT_CIPHER] as string;
    const pt = await decryptAesGcm(dkReal, cipher);
    const vaultRaw = JSON.parse(pt) as VaultPlaintext;
    const vault = migrateVaultPlaintext(vaultRaw);  // ⭐ M2→M3 schema 迁移：补齐 autofill 字段
    Log.info('VAULT:UNLOCK', `✅ 主密码正确，保管库解密完成 items=${vault.items.length}`);
    return { dk: dkReal, vault, meta };
  } catch (e) {
    Log.error('VAULT:UNLOCK', `❌ 保管库密文解密失败: ${(e as Error).message}`);
    throw new UnlockError('DECRYPT_ERROR');
  }
};

/** 内部版本：使用已有的 saltHex 走 PBKDF2（Meta里已保存saltHex，不需要 SecretKey 明文） */
export const deriveMasterKeyBySalt = async (
  masterPassword: string,
  saltHex: string,
  iterations: number,
): Promise<{ dk: CryptoKey }> => {
  const t0 = nowMs();
  const saltBytes = fromHex(saltHex);
  const _c = (globalThis as unknown as { crypto: Crypto }).crypto;
  const pwdKey = await _c.subtle.importKey('raw', new TextEncoder().encode(masterPassword), { name: 'PBKDF2' }, false, ['deriveKey']);
  const dk = await _c.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBytes, iterations, hash: 'SHA-256' },
    pwdKey,
    { name: CRYPTO_CONFIG.AES_ALGO, length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  Log.debug('VAULT:PBKDF2-BY-SALT', `DK派生完成 iter=${iterations} 耗时 ${Math.round(nowMs() - t0)}ms`);
  return { dk };
};

/** 重新加密保存（所有变更都走这个 → 每次换IV） */
export const persistVault = async (dk: CryptoKey, vault: VaultPlaintext, meta: VaultMetaPlain): Promise<VaultMetaPlain> => {
  const newMeta: VaultMetaPlain = { ...meta, lastModified: nowMs() };
  const json = JSON.stringify(vault);
  const cipherB64 = await encryptAesGcm(dk, json);
  await chrome.storage.local.set({
    [STORAGE_KEYS.META]: newMeta,
    [STORAGE_KEYS.VAULT_CIPHER]: cipherB64,
  });
  Log.debug('VAULT:PERSIST', `重新加密保存 items=${vault.items.length} tags=${vault.tags.length}`);
  return newMeta;
};

/** 新增 Item（乐观锁 version=1）*/
export const addItem = (vault: VaultPlaintext, partial: Partial<Item> & Pick<Item, 'category' | 'title' | 'fields'> & { vaultId?: string }): Item => {
  const newItem: Item = {
    id: uuidv4(),
    vaultId: partial.vaultId ?? 'vault-personal',
    tags: partial.tags ?? [],
    urls: partial.urls ?? [],
    createdAt: nowMs(),
    updatedAt: nowMs(),
    version: 1,
    favorite: partial.favorite ?? false,
    trashed: false,
    ...partial,
  } as Item;
  vault.items.push(newItem);
  Log.info('VAULT:ITEM:ADD', `新增 id=${newItem.id.slice(0, 8)} category=${newItem.category} title=${newItem.title}`);
  return newItem;
};

export class StoreError extends Error {
  constructor(public code: string, msg?: string) {
    super(msg ?? code);
    this.name = 'StoreError';
  }
}

export const ERR_CODES = {
  ITEM_NOT_FOUND: 'ITEM_NOT_FOUND',
  VERSION_CONFLICT: 'VERSION_CONFLICT',
  NOT_TRASHED: 'NOT_TRASHED',
  BAD_MASTER_PASSWORD: 'BAD_MASTER_PASSWORD',
  DECRYPT_FAILED: 'DECRYPT_FAILED',
  BACKUP_FORMAT_INVALID: 'BACKUP_FORMAT_INVALID',
} as const;

export const getItemById = (vault: VaultPlaintext, id: string): Item | null => {
  const it = vault.items.find((x) => x.id === id) ?? null;
  if (it) {
    Log.debug('VAULT:ITEM:GET', `get id=${id.slice(0, 8)} found=${!!it}`);
  }
  return it;
};

export const updateItem = (vault: VaultPlaintext, id: string, patch: Partial<Item>): Item => {
  const idx = vault.items.findIndex((i) => i.id === id);
  if (idx === -1) throw new StoreError(ERR_CODES.ITEM_NOT_FOUND, `Item ${id} 不存在`);
  const old = vault.items[idx];
  if (patch.version !== undefined && patch.version !== old.version) {
    Log.warn('VAULT:ITEM:UPDATE', `乐观锁冲突：期望 version=${old.version} 实际=${patch.version}`);
    throw new StoreError(ERR_CODES.VERSION_CONFLICT, `version冲突 expected=${old.version} got=${patch.version}`);
  }
  const merged: Item = { ...old, ...patch, updatedAt: nowMs(), version: old.version + 1 } as Item;
  vault.items[idx] = merged;
  Log.info('VAULT:ITEM:UPDATE', `更新 id=${id.slice(0, 8)}: changedKeys=${Object.keys(patch).join(',')} newVersion=${merged.version}`);
  return merged;
};

export const trashItem = (vault: VaultPlaintext, id: string): Item => {
  const idx = vault.items.findIndex((i) => i.id === id);
  if (idx === -1) throw new StoreError(ERR_CODES.ITEM_NOT_FOUND, `Item ${id} 不存在`);
  const it = vault.items[idx];
  if (it.trashed) {
    Log.warn('VAULT:ITEM:TRASH', `id=${id.slice(0, 8)} 已在回收站，跳过`);
    return it;
  }
  const now = nowMs();
  it.trashed = true;
  it.trashedAt = now;
  it.version += 1;
  it.updatedAt = now;
  const alreadyDeleted = vault.deleted.some((d) => d.id === id);
  if (!alreadyDeleted) {
    vault.deleted.push({
      ...(JSON.parse(JSON.stringify(it)) as Item),
      deletedAt: now,
      expireAt: now + 30 * 24 * 3600 * 1000,
    } as DeletedItem);
  }
  Log.info('VAULT:ITEM:TRASH', `移入回收站 id=${id.slice(0, 8)} title="${it.title}"，30天后自动永久删除`);
  return it;
};

export const restoreItem = (vault: VaultPlaintext, id: string): Item => {
  const idx = vault.items.findIndex((i) => i.id === id);
  if (idx === -1) throw new StoreError(ERR_CODES.ITEM_NOT_FOUND, `Item ${id} 不存在`);
  const it = vault.items[idx];
  if (!it.trashed) {
    Log.warn('VAULT:ITEM:RESTORE', `id=${id.slice(0, 8)} 不在回收站`);
    return it;
  }
  const now = nowMs();
  it.trashed = false;
  it.trashedAt = undefined;
  it.version += 1;
  it.updatedAt = now;
  const dIdx = vault.deleted.findIndex((d) => d.id === id);
  if (dIdx >= 0) vault.deleted.splice(dIdx, 1);
  Log.info('VAULT:ITEM:RESTORE', `从回收站恢复 id=${id.slice(0, 8)} title="${it.title}"`);
  return it;
};

export const deleteItemPermanently = (vault: VaultPlaintext, id: string): string => {
  const idx = vault.items.findIndex((i) => i.id === id);
  if (idx === -1) throw new StoreError(ERR_CODES.ITEM_NOT_FOUND, `Item ${id} 不存在`);
  const it = vault.items[idx];
  if (!it.trashed) {
    Log.warn('VAULT:ITEM:DELETE', `id=${id.slice(0, 8)} 尝试在未入回收站时永久删除，拒绝`);
    throw new StoreError(ERR_CODES.NOT_TRASHED, `永久删除前必须先移入回收站`);
  }
  vault.items.splice(idx, 1);
  const dIdx = vault.deleted.findIndex((d) => d.id === id);
  if (dIdx >= 0) vault.deleted.splice(dIdx, 1);
  Log.info('VAULT:ITEM:DELETE', `永久删除 id=${id.slice(0, 8)} title="${it.title}"`);
  return id;
};

export const duplicateItem = (vault: VaultPlaintext, id: string): Item => {
  const src = vault.items.find((i) => i.id === id);
  if (!src) throw new StoreError(ERR_CODES.ITEM_NOT_FOUND, `Item ${id} 不存在`);
  const clone: Item = JSON.parse(JSON.stringify(src));
  clone.id = uuidv4();
  clone.title = `${src.title} 副本`;
  clone.version = 1;
  clone.createdAt = nowMs();
  clone.updatedAt = clone.createdAt;
  clone.trashed = false;
  clone.trashedAt = undefined;
  clone.favorite = false;
  clone.fields = clone.fields.map((f) => ({ ...f, id: uuidv4() }));
  vault.items.push(clone);
  Log.info('VAULT:ITEM:DUPLICATE', `克隆 id=${id.slice(0, 8)} → 新id=${clone.id.slice(0, 8)} title="${clone.title}"`);
  return clone;
};

export const toggleFavoriteItem = (vault: VaultPlaintext, id: string): { id: string; favorite: boolean } => {
  const idx = vault.items.findIndex((i) => i.id === id);
  if (idx === -1) throw new StoreError(ERR_CODES.ITEM_NOT_FOUND, `Item ${id} 不存在`);
  const it = vault.items[idx];
  it.favorite = !it.favorite;
  it.version += 1;
  it.updatedAt = nowMs();
  Log.info('VAULT:ITEM:FAV', `切换收藏 id=${id.slice(0, 8)} favorite=${it.favorite}`);
  return { id, favorite: it.favorite };
};

export type ImportConflictStrategy = 'keep-new' | 'keep-old' | 'duplicate-both';

export interface EncryptedBackupBlob {
  schemaVersion: number;
  exportedAt: number;
  accountEmail: string;
  secretKeyMasked: string;
  saltHex: string;
  pbkdf2Iterations: number;
  verifierB64: string;
  cipherB64: string;
}

export interface EncryptExportResult {
  blobB64: string;
  fileName: string;
  sizeBytes: number;
}

export const encryptExportBlob = async (
  vault: VaultPlaintext,
  dk: CryptoKey,
  meta: VaultMetaPlain,
): Promise<EncryptExportResult> => {
  const json = JSON.stringify(vault);
  const cipherB64 = await encryptAesGcm(dk, json);
  const backup: EncryptedBackupBlob = {
    schemaVersion: CRYPTO_CONFIG.VAULT_SCHEMA_VERSION,
    exportedAt: nowMs(),
    accountEmail: meta.accountEmail,
    secretKeyMasked: meta.secretKeyMasked,
    saltHex: meta.saltHex,
    pbkdf2Iterations: meta.pbkdf2Iterations,
    verifierB64: meta.verifierB64,
    cipherB64,
  };
  const full = JSON.stringify(backup);
  const safeEmail = (meta.accountEmail || 'local').replace(/[^a-zA-Z0-9._-]/g, '_');
  const d = new Date(backup.exportedAt);
  const ts = `${d.getFullYear()}${(d.getMonth() + 1).toString().padStart(2, '0')}${d.getDate().toString().padStart(2, '0')}_${d.getHours().toString().padStart(2, '0')}${d.getMinutes().toString().padStart(2, '0')}${d.getSeconds().toString().padStart(2, '0')}`;
  const fileName = `1PassClone_Backup_${safeEmail}_${ts}.enc.json`;
  const blobB64 = btoa(unescape(encodeURIComponent(full)));
  Log.info('VAULT:EXPORT', `导出备份 ${fileName} size=${full.length} items=${vault.items.length}`);
  return {
    blobB64,
    fileName,
    sizeBytes: full.length,
  };
};

const parseBackup = (blobB64: string): EncryptedBackupBlob => {
  try {
    const jsonText = decodeURIComponent(escape(atob(blobB64)));
    const obj = JSON.parse(jsonText) as EncryptedBackupBlob;
    if (!obj || typeof obj !== 'object' || !obj.cipherB64 || !obj.saltHex || !obj.verifierB64) {
      throw new Error('结构缺失');
    }
    return obj;
  } catch (e) {
    Log.warn('VAULT:IMPORT', `备份格式无效: ${(e as Error).message}`);
    throw new StoreError(ERR_CODES.BACKUP_FORMAT_INVALID, '备份文件格式损坏或不是有效的 1PassClone 备份');
  }
};

export const decryptImportBlob = async (
  blobB64: string,
  importedMasterPassword: string,
): Promise<{ vault: VaultPlaintext; backup: EncryptedBackupBlob }> => {
  const backup = parseBackup(blobB64);
  let dk: CryptoKey;
  try {
    const { dk: derived } = await deriveMasterKeyBySalt(
      importedMasterPassword,
      backup.saltHex,
      backup.pbkdf2Iterations,
    );
    const ok = await verifyDk(derived, backup.verifierB64);
    if (!ok) throw new Error('verifier 不匹配');
    dk = derived;
  } catch (e) {
    Log.warn('VAULT:IMPORT', `导入备份主密码错误: ${(e as Error).message}`);
    throw new StoreError(ERR_CODES.BAD_MASTER_PASSWORD, '备份主密码错误，无法解密');
  }
  try {
    const plain = await decryptAesGcm(dk, backup.cipherB64);
    const vaultRaw = JSON.parse(plain) as VaultPlaintext;
    const vault = migrateVaultPlaintext(vaultRaw);  // ⭐ 导入时自动 schema 迁移，补齐缺失字段
    if (!vault || typeof vault !== 'object' || !Array.isArray(vault.items)) {
      throw new Error('VaultPlaintext 结构非法');
    }
    Log.info('VAULT:IMPORT', `解密导入备份成功 items=${vault.items.length} account=${backup.accountEmail}`);
    return { vault, backup };
  } catch (e) {
    Log.error('VAULT:IMPORT', `解密导入密文失败 (AuthTag 不匹配，可能篡改): ${(e as Error).message}`);
    throw new StoreError(ERR_CODES.DECRYPT_FAILED, '备份密文无法解密（可能被篡改或损坏）');
  }
};

export const mergeImportedVault = (
  current: VaultPlaintext,
  imported: VaultPlaintext,
  strategy: ImportConflictStrategy,
): { added: number; skipped: number; conflicted: number } => {
  const existingMap = new Map(current.items.map((i) => [i.id, i]));
  let added = 0, skipped = 0, conflicted = 0;
  for (const src of imported.items) {
    const existing = existingMap.get(src.id);
    if (!existing) {
      current.items.push(JSON.parse(JSON.stringify(src)));
      added++;
      continue;
    }
    conflicted++;
    if (strategy === 'keep-new') {
      skipped++;
    } else if (strategy === 'keep-old') {
      const idx = current.items.findIndex((x) => x.id === src.id);
      if (idx >= 0) current.items[idx] = JSON.parse(JSON.stringify(src));
    } else if (strategy === 'duplicate-both') {
      const clone: Item = JSON.parse(JSON.stringify(src));
      clone.id = uuidv4();
      clone.title = `${src.title}（导入备份）`;
      clone.version = 1;
      clone.createdAt = nowMs();
      clone.updatedAt = clone.createdAt;
      clone.fields = clone.fields.map((f) => ({ ...f, id: uuidv4() }));
      current.items.push(clone);
      added++;
    }
  }
  Log.info('VAULT:MERGE', `合并导入策略=${strategy} added=${added} skipped=${skipped} conflicted=${conflicted}`);
  return { added, skipped, conflicted };
};

export const updateSettings = (vault: VaultPlaintext, patch: Partial<AppSettings>): AppSettings => {
  vault.settings = { ...migrateSettings(vault.settings), ...patch };
  Log.info('VAULT:SETTINGS', `更新 settings: ${Object.keys(patch).join(',')}`);
  return vault.settings;
};

/**
 * Settings Schema 向前兼容迁移（M2 → M3 自动填充字段补齐）。
 *   - 任何从密文 JSON.parse 拿到的 settings，在进入 BG 闭包 / UI / IPC 返回之前，都必须走这里
 *   - 保证所有 autofill* 字段永远是定义值（不会 undefined 导致 UI 层 undefined.join 报错）
 *   - 未来 M4 有新字段只要把 DEFAULT_SETTINGS 里补默认 + 这里保持 `{...DEFAULT_SETTINGS, ...s}` 模式即可自动兼容
 */
export function migrateSettings(s: Partial<AppSettings> | null | undefined): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...(s ?? {}),
    // ⭐ 数组字段强制兜底：如果老保管库里 JSON 把字段设成 null / undefined / 非数组 → 强转空数组（防 undefined.join）
    safeForTravelVaultIds: Array.isArray((s ?? {}).safeForTravelVaultIds) ? (s as any).safeForTravelVaultIds : [],
  };
}

/** 整库迁移（目前只做 settings，未来 M4 有 item schema 升级也放这里） */
export function migrateVaultPlaintext(v: VaultPlaintext): VaultPlaintext {
  const migrated: VaultPlaintext = { ...v, settings: migrateSettings(v.settings as any) };
  if (!Array.isArray(migrated.items)) migrated.items = [];
  if (!Array.isArray(migrated.vaults)) migrated.vaults = [];
  if (!Array.isArray(migrated.tags)) migrated.tags = [];
  if (!Array.isArray(migrated.deleted)) migrated.deleted = [];
  return migrated;
}

/* ============ 工具函数 ============ */

/** SecretKey 掩码化（只保留前后，UI提示用） A3-XXXX-...-XXXX-9K2F */
export const maskSecretKey = (sk: string): string => {
  const parts = sk.split('-');
  if (parts.length < 5) return sk;
  return `${parts[0]}-${parts[1]}-****-****-${parts[4]}`;
};

const fromHex = (hex: string): Uint8Array => {
  const b = new Uint8Array(hex.length / 2);
  for (let i = 0; i < b.length; i++) b[i] = parseInt(hex.substr(i * 2, 2), 16);
  return b;
};
