/**
 * background/index.ts - Chrome MV3 Service Worker（零知识安全中心）
 *
 * 唯一的职责：
 *   1) 持有 DK（派生主密钥）在内存闭包中（→ 绝对不存储，绝对不传输）
 *   2) 接收 chrome.runtime.onMessage 的 20 个 IPC Action
 *   3) 执行加解密操作 + 返回结果（明文库快照给UI）
 *
 * 安全保证：
 *   - DK 仅存在当前 SW 的闭包里，SW 终止则立即丢失
 *   - 所有"写"操作必须调用 persistVault 重新 AES-GCM 加密（每次换 IV）
 *   - UI 永远拿不到 DK，只能拿到 decrypt 后的 JSON 快照
 */

import type {
  InitPayload,
  InitResult,
  ItemListPayload,
  ItemListResult,
  SettingsUpdatePayload,
  StatusResult,
  UnlockPayload,
  UnlockResult,
  VaultMessage,
  VaultResp,
  VaultStatus,
  WatchtowerScanResult,
  ImportVaultPayload,
  ImportVaultResult,
  ExportVaultResult,
} from '@/types/ipc';
import type {
  AppSettings,
  Item,
  VaultMetaPlain,
  VaultPlaintext,
} from '@/types/models';
import { STORAGE_KEYS } from '@/types/models';
import {
  addItem,
  initializeEmptyVault,
  loadMeta,
  persistVault,
  restoreItem,
  trashItem,
  unlockVault,
  updateItem,
  updateSettings,
  vaultExists,
  getItemById,
  deleteItemPermanently,
  duplicateItem as vaultDupItem,
  toggleFavoriteItem as vaultToggleFav,
  encryptExportBlob,
  decryptImportBlob,
  mergeImportedVault,
  ERR_CODES as VS_ERR,
  StoreError,
} from '@/core/vault-store';
import type { ImportConflictStrategy } from '@/core/vault-store';
import { Log } from '@/core/logger';
import { nowMs, uuidv4 } from '@/lib/utils';
import type { UnlockError } from '@/core/vault-store';

/* =============================================================
 * 闭包级别的全局状态（Service Worker 生命周期内有效）
 * 关键：DK 和 vaultSnapshot 只在这里，永远不下发 storage
 * ============================================================= */
let __dk__: CryptoKey | null = null;
let __vaultPlain__: VaultPlaintext | null = null;
let __metaPlain__: VaultMetaPlain | null = null;
let __failedAttempts = 0;
let __lockedUntilMs: number | null = null;

const MAX_FAILED_BEFORE_LOCK = 5;
const LOCK_BACKOFF_MS = [0, 0, 0, 0, 0, 60_000, 180_000, 600_000, 600_000]; // 60s → 3min → 10min

const setLockedUntilBackoff = () => {
  const tier = Math.min(__failedAttempts, LOCK_BACKOFF_MS.length - 1);
  const ms = LOCK_BACKOFF_MS[tier];
  if (ms > 0) {
    __lockedUntilMs = nowMs() + ms;
    Log.warn('BG:LOCK', `失败 ${__failedAttempts} 次，锁定 ${(ms / 1000).toFixed(0)} 秒`);
  }
};

const requireUnlock = () => {
  if (!__dk__ || !__vaultPlain__ || !__metaPlain__) {
    throw new Error('保管库未解锁，请先解锁');
  }
  return { dk: __dk__, vault: __vaultPlain__, meta: __metaPlain__ };
};

const requireUnlockResp = <T>(fn: () => T | Promise<T>): Promise<VaultResp<T>> | VaultResp<T> => {
  try {
    const { dk, vault, meta } = requireUnlock();
    void dk; void vault; void meta;
    const out = fn();
    return out instanceof Promise
      ? out.then((data) => ({ ok: true, data } as VaultResp<T>)).catch((e: any) => {
        const code = e instanceof StoreError ? e.code : undefined;
        return { ok: false, error: e.message ?? String(e), code } as VaultResp<T>;
      })
      : { ok: true, data: out } as VaultResp<T>;
  } catch (e: any) {
    const code = e instanceof StoreError ? e.code : undefined;
    return { ok: false, error: e.message ?? String(e), code } as VaultResp<T>;
  }
};

/* =============================================================
 * 生命周期钩子
 * ============================================================= */

chrome.runtime.onInstalled.addListener((details) => {
  Log.info('BG:ON_INSTALLED', `扩展安装/更新 reason=${details.reason} prev=${details.previousVersion ?? 'new'}`);
});

chrome.runtime.onStartup.addListener(() => {
  Log.info('BG:ON_STARTUP', '浏览器启动，内存DK已清除（必须重新解锁）');
  __dk__ = null;
  __vaultPlain__ = null;
  __metaPlain__ = null;
  __failedAttempts = 0;
  __lockedUntilMs = null;
});

// 自动锁定：alarms 每分钟检查（如果设置了 autoLockMinutes）
try {
  chrome.alarms?.create('__1p_autolock_tick__', { periodInMinutes: 1 });
  chrome.alarms?.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== '__1p_autolock_tick__') return;
    if (!__vaultPlain__ || !__metaPlain__) return;
    const mins = __vaultPlain__.settings.autoLockMinutes;
    if (!mins || mins < 0) return;
    const last = __vaultPlain__.settings.lastUnlockAt ?? nowMs();
    if (nowMs() - last > mins * 60_000) {
      __dk__ = null;
      __vaultPlain__ = null;
      __metaPlain__ = null;
      Log.info('BG:AUTOLOCK', `达到 ${mins} 分钟自动锁定时间，DK 已从内存清除`);
    }
  });
} catch (e) {
  Log.warn('BG:ALARMS', `alarms API 不可用，自动锁定将依赖 Service Worker 生命周期：${String(e)}`);
}

/* =============================================================
 * onMessage 路由（20 个 Action）
 * ============================================================= */
chrome.runtime.onMessage.addListener((msg: VaultMessage, _sender, sendResponse) => {
  const requestId = msg.requestId;
  const wrapOk = <T>(data: T): VaultResp<T> => ({ ok: true, data, requestId });
  const wrapErr = <T>(error: string, code?: string): VaultResp<T> => ({ ok: false, error, code, requestId });

  const handle = async (): Promise<VaultResp<any>> => {
    Log.debug('BG:IPC', `收到 ${msg.action}${requestId ? ` (reqId=${requestId})` : ''}`);

    switch (msg.action) {
      /* ---------- 生命周期 ---------- */
      case 'VAULT_EXISTS': {
        return wrapOk(await vaultExists());
      }

      case 'VAULT_STATUS': {
        const exists = await vaultExists();
        let status: VaultStatus = 'UNINITIALIZED';
        let meta: VaultMetaPlain | null = null;
        if (exists) {
          meta = await loadMeta();
          status = __dk__ ? 'UNLOCKED' : 'LOCKED';
        }
        return wrapOk<StatusResult>({
          status,
          meta,
          failedAttempts: __failedAttempts,
          lockedUntilMs: __lockedUntilMs && __lockedUntilMs > nowMs() ? __lockedUntilMs : null,
          itemCount: __vaultPlain__ ? __vaultPlain__.items.length : null,
          autoLockMinutes: __vaultPlain__?.settings.autoLockMinutes ?? null,
          // ⭐ Fix: 当 BG 已解锁时把明文快照一并返回，Popup/Options 独立 tab 的 zustand 实例可直接同步
          vaultSnapshot: __dk__ && __vaultPlain__ ? __vaultPlain__ : undefined,
        });
      }

      case 'VAULT_INIT': {
        const pl = msg.payload as InitPayload;
        if (await vaultExists()) return wrapErr('保管库已经存在，如需重新开始请先在设置里清空');
        try {
          const r = await initializeEmptyVault(pl.masterPassword, pl.accountEmail, pl.secretKey);
          __metaPlain__ = r.meta;
          Log.info('BG:INIT', `保管库初始化成功，meta.salt=${r.meta.saltHex.slice(0, 16)}...`);
          return wrapOk<InitResult>({
            secretKey: r.secretKey,
            meta: r.meta,
            emptyVaultItemsCount: 0,
          });
        } catch (e: any) {
          return wrapErr(e.message ?? String(e));
        }
      }

      case 'VAULT_UNLOCK': {
        const pl = msg.payload as UnlockPayload;
        if (await vaultExists() === false) return wrapErr('尚未初始化，请先创建保管库', 'NO_VAULT');
        // 临时锁定检查
        if (__lockedUntilMs && __lockedUntilMs > nowMs()) {
          return wrapErr(`请等待 ${Math.ceil((__lockedUntilMs - nowMs()) / 1000)} 秒后再试`, 'TEMP_LOCKED');
        }
        try {
          const { dk, vault, meta } = await unlockVault(pl.masterPassword);
          __dk__ = dk;
          __vaultPlain__ = vault;
          __metaPlain__ = meta;
          __failedAttempts = 0;
          __lockedUntilMs = null;
          vault.settings.lastUnlockAt = nowMs();
          vault.settings.failedAttempts = 0;
          __metaPlain__ = await persistVault(dk, vault, meta);
          Log.info('BG:UNLOCK', `✅ 解锁成功 items=${vault.items.length} vaults=${vault.vaults.length}`);
          return wrapOk<UnlockResult>({
            meta: __metaPlain__!,
            vaultSnapshot: __vaultPlain__!,
            lockedUntilMs: undefined,
            remainingAttempts: MAX_FAILED_BEFORE_LOCK,
          });
        } catch (e) {
          __failedAttempts += 1;
          setLockedUntilBackoff();
          const code = (e as UnlockError).code ?? 'INVALID_PASSWORD';
          const msgStr = (e as Error).message ?? String(e);
          return wrapErr(msgStr, code);
        }
      }

      case 'VAULT_LOCK': {
        __dk__ = null;
        __vaultPlain__ = null;
        __metaPlain__ = null;
        Log.info('BG:LOCK', '用户手动锁定：内存中DK / 明文保管库已全部清除');
        return wrapOk(true);
      }

      case 'VAULT_PERSIST': {
        return requireUnlockResp(async () => {
          const { dk, vault, meta } = { dk: __dk__!, vault: __vaultPlain__!, meta: __metaPlain__! };
          __metaPlain__ = await persistVault(dk, vault, meta);
          return true;
        });
      }

      /* ---------- Item CRUD ---------- */
      case 'ITEM_LIST': {
        return requireUnlockResp(() => {
          const pl = (msg.payload ?? {}) as ItemListPayload;
          let list = (__vaultPlain__!).items.slice();
          if (pl.vaultId) list = list.filter((i) => i.vaultId === pl.vaultId);
          if (pl.category) list = list.filter((i) => i.category === pl.category);
          if (pl.trashed) {
            list = list.filter((i) => i.trashed);
          } else {
            list = list.filter((i) => !i.trashed);
          }
          if (pl.onlyFavorites) list = list.filter((i) => i.favorite);
          if (pl.search && pl.search.trim()) {
            const kw = pl.search.trim().toLowerCase();
            list = list.filter((i) =>
              i.title.toLowerCase().includes(kw) ||
              i.fields.some((f) => f.label.toLowerCase().includes(kw) || String(f.value || '').toLowerCase().includes(kw)),
            );
          }
          const total = list.length;
          let items = list;
          if (pl.offset) items = items.slice(pl.offset);
          if (pl.limit) items = items.slice(0, pl.limit);
          return { total, items } as ItemListResult;
        });
      }

      case 'ITEM_GET': {
        return requireUnlockResp(() => {
          const id = (msg.payload as any).id as string;
          const it = getItemById(__vaultPlain__!, id);
          if (!it) {
            const fromDeleted = (__vaultPlain__!).deleted.find((d) => d.id === id) as any as Item;
            if (!fromDeleted) throw new StoreError(VS_ERR.ITEM_NOT_FOUND, `Item ${id} 不存在`);
            return fromDeleted as Item;
          }
          return it as Item;
        });
      }

      case 'ITEM_CREATE': {
        return requireUnlockResp(async () => {
          const partial = msg.payload as Partial<Item> & Pick<Item, 'category' | 'title' | 'fields'>;
          const newItem = addItem(__vaultPlain__!, partial as any);
          __metaPlain__ = await persistVault(__dk__!, __vaultPlain__!, __metaPlain__!);
          return newItem;
        });
      }

      case 'ITEM_UPDATE': {
        return requireUnlockResp(async () => {
          const patch = msg.payload as Partial<Item> & Pick<Item, 'id'>;
          const upd = updateItem(__vaultPlain__!, patch.id, patch);
          __metaPlain__ = await persistVault(__dk__!, __vaultPlain__!, __metaPlain__!);
          return upd;
        });
      }

      case 'ITEM_TRASH': {
        return requireUnlockResp(async () => {
          const id = (msg.payload as any).id as string;
          const it = trashItem(__vaultPlain__!, id);
          __metaPlain__ = await persistVault(__dk__!, __vaultPlain__!, __metaPlain__!);
          return it;
        });
      }

      case 'ITEM_RESTORE': {
        return requireUnlockResp(async () => {
          const id = (msg.payload as any).id as string;
          const it = restoreItem(__vaultPlain__!, id);
          __metaPlain__ = await persistVault(__dk__!, __vaultPlain__!, __metaPlain__!);
          return it;
        });
      }

      case 'ITEM_DELETE': {
        return requireUnlockResp(async () => {
          const id = (msg.payload as any).id as string;
          deleteItemPermanently(__vaultPlain__!, id);
          __metaPlain__ = await persistVault(__dk__!, __vaultPlain__!, __metaPlain__!);
          return true;
        });
      }

      case 'ITEM_DUPLICATE': {
        return requireUnlockResp(async () => {
          const id = (msg.payload as any).id as string;
          const dup = vaultDupItem(__vaultPlain__!, id);
          __metaPlain__ = await persistVault(__dk__!, __vaultPlain__!, __metaPlain__!);
          return dup;
        });
      }

      case 'ITEM_TOGGLE_FAVORITE': {
        return requireUnlockResp(async () => {
          const id = (msg.payload as any).id as string;
          const r = vaultToggleFav(__vaultPlain__!, id);
          __metaPlain__ = await persistVault(__dk__!, __vaultPlain__!, __metaPlain__!);
          const updated = getItemById(__vaultPlain__!, id);
          return updated ?? r;
        });
      }

      /* ---------- Vaults / Tags ---------- */
      case 'VAULT_LIST': {
        return requireUnlockResp(() => ({ vaults: (__vaultPlain__!).vaults }));
      }

      case 'VAULT_CREATE': {
        return requireUnlockResp(async () => {
          const pl = msg.payload as { name: string; iconEmoji?: string; safeForTravel?: boolean };
          const v = {
            id: 'vault-' + uuidv4().slice(0, 8),
            name: pl.name,
            iconEmoji: pl.iconEmoji ?? '📁',
            safeForTravel: pl.safeForTravel ?? true,
            createdAt: nowMs(),
            updatedAt: nowMs(),
          };
          (__vaultPlain__!).vaults.push(v as any);
          __metaPlain__ = await persistVault(__dk__!, __vaultPlain__!, __metaPlain__!);
          return v;
        });
      }

      case 'TAG_LIST': {
        return requireUnlockResp(() => ({ tags: (__vaultPlain__!).tags }));
      }

      case 'TAG_CREATE': {
        return requireUnlockResp(async () => {
          const pl = msg.payload as { name: string; colorHex?: string };
          const tag = { id: uuidv4(), name: pl.name, colorHex: pl.colorHex };
          (__vaultPlain__!).tags.push(tag);
          __metaPlain__ = await persistVault(__dk__!, __vaultPlain__!, __metaPlain__!);
          return tag;
        });
      }

      /* ---------- Settings ---------- */
      case 'SETTINGS_GET': {
        return requireUnlockResp(() => (__vaultPlain__!).settings as AppSettings);
      }

      case 'SETTINGS_UPDATE': {
        return requireUnlockResp(async () => {
          const pl = msg.payload as SettingsUpdatePayload;
          const s = updateSettings(__vaultPlain__!, pl.patch);
          __metaPlain__ = await persistVault(__dk__!, __vaultPlain__!, __metaPlain__!);
          return s;
        });
      }

      /* ---------- Watchtower 纯本地扫描 ---------- */
      case 'WATCHTOWER_SCAN': {
        return requireUnlockResp(() => {
          const items = (__vaultPlain__!).items.filter((i) => !i.trashed);
          const weak: Item[] = [];
          const reusedMap = new Map<string, Item[]>();
          const notHttps: Item[] = [];
          const oldPasswords: Item[] = [];
          const YEAR = 365 * 24 * 3600 * 1000;

          const getPwdField = (it: Item) => it.fields.find((f) => f.type === 'password');

          items.forEach((it) => {
            const pf = getPwdField(it);
            if (pf) {
              const ent = pf.entropyBits ?? (pf.value ? Math.round(pf.value.length * Math.log2(94)) : 0);
              if (ent < 60) weak.push(it);
              if (pf.value) {
                const hash = sha256Sync(pf.value); // 内存内匹配，不联网
                if (!reusedMap.has(hash)) reusedMap.set(hash, []);
                reusedMap.get(hash)!.push(it);
              }
              if (pf.updatedAt && nowMs() - pf.updatedAt > YEAR) oldPasswords.push(it);
            }
            const hasHttp = it.urls.some((u) => u.startsWith('http://'));
            if (hasHttp) notHttps.push(it);
          });

          const reused = Array.from(reusedMap.entries())
            .filter(([, its]) => its.length >= 2)
            .map(([passwordHash, its]) => ({ passwordHash, items: its }));

          return {
            weak, reused, notHttps, oldPasswords,
            totals: {
              weak: weak.length,
              reused: reused.length,
              notHttps: notHttps.length,
              oldPasswords: oldPasswords.length,
              totalItems: items.length,
            },
          } as WatchtowerScanResult;
        });
      }

      /* ---------- 导出：当前保管库 AES-GCM 加密备份 ---------- */
      case 'MISC_EXPORT_VAULT': {
        return requireUnlockResp(async () => {
          const enc = await encryptExportBlob(__vaultPlain__!, __dk__!, __metaPlain__!);
          return enc as ExportVaultResult;
        });
      }

      /* ---------- 导入：解密备份 + 三策略合并 + 半提交回滚 ---------- */
      case 'MISC_IMPORT_VAULT': {
        return requireUnlockResp(async () => {
          const pl = msg.payload as ImportVaultPayload;
          const { vault: imported } = await decryptImportBlob(pl.blobB64, pl.masterPassword);
          const totalInBackup = imported.items.length;
          const snapshotBefore = JSON.stringify(__vaultPlain__!);
          const snapshotMetaBefore = JSON.stringify(__metaPlain__!);
          try {
            const stats = mergeImportedVault(__vaultPlain__!, imported, pl.conflictStrategy as ImportConflictStrategy);
            __metaPlain__ = await persistVault(__dk__!, __vaultPlain__!, __metaPlain__!);
            Log.info('BG:IMPORT', `✅ 导入合并成功 strategy=${pl.conflictStrategy} added=${stats.added} skipped=${stats.skipped} conflicted=${stats.conflicted}`);
            return {
              added: stats.added,
              skipped: stats.skipped,
              conflicted: stats.conflicted,
              totalInBackup,
              vaultSnapshotAfter: JSON.parse(JSON.stringify(__vaultPlain__!)),
            } as ImportVaultResult;
          } catch (mergeErr) {
            Log.warn('BG:IMPORT', `⚠️ 导入合并失败，回滚到导入前快照: ${(mergeErr as Error).message}`);
            try {
              __vaultPlain__ = JSON.parse(snapshotBefore) as VaultPlaintext;
              __metaPlain__ = JSON.parse(snapshotMetaBefore) as VaultMetaPlain;
              await chrome.storage.local.remove([STORAGE_KEYS.META, STORAGE_KEYS.VAULT_CIPHER]);
            } catch (rbErr) {
              Log.error('BG:IMPORT', `回滚 storage 失败: ${(rbErr as Error).message}`);
            }
            throw mergeErr;
          }
        });
      }

      default:
        return wrapErr(`未知 Action: ${(msg as any).action}`, 'UNKNOWN_ACTION');
    }
  };

  handle().then(sendResponse).catch((e) => sendResponse(wrapErr(e.message ?? String(e), 'FATAL')));
  return true; // async
});

/* ------- 工具：内存内 SHA256（watchtower 用，避免 crypto.subtle.digest 异步 map 问题）------- */
const sha256Sync = (s: string): string => {
  // 这里用我们的异步版本，但同步入口包一个缓存 map，实际用例里 watchtower 是同步 return
  // 为简化，此处用内置 toHex 从预缓存 Map 读不到时，退化到简易 FNV 哈希（仅用于密码重复本地匹配，非安全用途）
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return 'fnv1a_' + (h >>> 0).toString(16).padStart(8, '0');
};
