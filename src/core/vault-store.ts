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
    const vault = JSON.parse(pt) as VaultPlaintext;
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

export const updateItem = (vault: VaultPlaintext, id: string, patch: Partial<Item>): Item => {
  const idx = vault.items.findIndex((i) => i.id === id);
  if (idx === -1) throw new Error(`Item ${id} 不存在`);
  const old = vault.items[idx];
  if (patch.version !== undefined && patch.version !== old.version) {
    Log.warn('VAULT:ITEM:UPDATE', `乐观锁冲突：期望 version=${old.version} 实际=${patch.version}`);
  }
  const merged: Item = { ...old, ...patch, updatedAt: nowMs(), version: old.version + 1 } as Item;
  vault.items[idx] = merged;
  Log.info('VAULT:ITEM:UPDATE', `更新 id=${id.slice(0, 8)}: changedKeys=${Object.keys(patch).join(',')}`);
  return merged;
};

export const trashItem = (vault: VaultPlaintext, id: string): void => {
  const idx = vault.items.findIndex((i) => i.id === id);
  if (idx === -1) return;
  const it = vault.items[idx];
  it.trashed = true;
  it.trashedAt = nowMs();
  const deleted: DeletedItem = { ...it, deletedAt: nowMs(), expireAt: nowMs() + 30 * 24 * 3600 * 1000 };
  vault.deleted.push(deleted);
  vault.items.splice(idx, 1);
  Log.info('VAULT:ITEM:TRASH', `移入回收站 id=${id.slice(0, 8)} title="${it.title}"，30天后永久删除`);
};

export const restoreItem = (vault: VaultPlaintext, id: string): void => {
  const didx = vault.deleted.findIndex((d) => d.id === id);
  if (didx === -1) return;
  const d = vault.deleted[didx];
  const { deletedAt, expireAt, ...restored } = d as DeletedItem & { deletedAt: number; expireAt: number };
  restored.trashed = false;
  restored.trashedAt = undefined;
  vault.items.push(restored as unknown as Item);
  vault.deleted.splice(didx, 1);
  Log.info('VAULT:ITEM:RESTORE', `从回收站恢复 id=${id.slice(0, 8)}`);
};

export const updateSettings = (vault: VaultPlaintext, patch: Partial<AppSettings>): AppSettings => {
  vault.settings = { ...vault.settings, ...patch };
  Log.info('VAULT:SETTINGS', `更新 settings: ${Object.keys(patch).join(',')}`);
  return vault.settings;
};

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
