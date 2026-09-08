/**
 * store/vaultStore.ts - Zustand 解锁状态机（仅在 Background Service Worker 持有真实 DK）
 *
 * 【零知识架构关键】
 *  ⚠️  DK（派生主密钥）**永远只存在于 Background SW 的内存闭包中**
 *  ⚠️  绝对不会写入 chrome.storage、绝对不会写入 Zustand state、绝对不会通过 sendMessage 传给 Popup/Options UI
 *  ⚠️  Popup UI 能拿到的只是 `vaultSnapshot`（保管库解密后的明文副本，仅用于展示）
 *
 * UI 端状态机： UNINITIALIZED → LOCKED → UNLOCKED
 * （DK 实际在 Background 里，UI 只反映是否已解锁 + 明文快照）
 */
import { create } from 'zustand';
import type {
  InitPayload,
  InitResult,
  ItemListPayload,
  StatusResult,
  UnlockPayload,
  UnlockResult,
  VaultResp,
  VaultStatus,
  VaultAction,
  ImportVaultPayload,
  ImportVaultResult,
  ExportVaultResult,
} from '@/types/ipc';
import type { AppSettings, Item, VaultMetaPlain, VaultPlaintext } from '@/types/models';
import type { ImportConflictStrategy } from '@/core/vault-store';
import { Log } from '@/core/logger';

const REQ_ID_PREFIX = 'ui';
let __reqSeq = 0;
const nextReqId = () => `${REQ_ID_PREFIX}-${Date.now()}-${(++__reqSeq).toString(36)}`;
const __sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** sendMessage 包装：自动带 requestId + 超时保护 + MV3 SW 冷启动自动重试 */
export const ipcCall = async <T>(
  action: VaultAction | (string & {}),
  payload?: unknown,
  timeoutMs = 60_000,
): Promise<VaultResp<T>> => {
  const requestId = nextReqId();
  const msg = { action, payload, requestId };
  Log.debug('IPC:CALL', `→ ${action}  reqId=${requestId}`, payload);

  const overallStartTs = Date.now();
  const RETRY_BACKOFF = [0, 100, 200];
  let lastRawMsg: string | null = null;
  let lastReceivingEnd = false;
  let attemptIdx = 0;

  for (; attemptIdx < RETRY_BACKOFF.length; attemptIdx += 1) {
    if (RETRY_BACKOFF[attemptIdx] > 0) {
      await __sleep(RETRY_BACKOFF[attemptIdx]);
      Log.debug('IPC:RETRY', `⟳ ${action} 第${attemptIdx + 1}次尝试，已等待${RETRY_BACKOFF[attemptIdx]}ms reqId=${requestId}`);
    }
    const timer = setTimeout(() => {
      Log.error('IPC:TIMEOUT', `⏱ ${action} 超时 (${timeoutMs}ms) reqId=${requestId}`);
    }, timeoutMs);
    try {
      const resp = (await chrome.runtime.sendMessage(msg)) as VaultResp<T> | undefined;
      clearTimeout(timer);
      if (!resp) {
        lastRawMsg = 'Background 无响应（sendMessage 返回 undefined）';
        continue;
      }
      resp.requestId = requestId;
      if (attemptIdx > 0) {
        Log.info('IPC:RECOVERY', `✅ ${action} 重试${attemptIdx}次后成功 reqId=${requestId} totalWait=${Date.now() - overallStartTs}ms`);
      }
      if (resp.ok) {
        Log.debug('IPC:RESP', `← ${action} ✅  reqId=${requestId}`);
      } else {
        Log.warn('IPC:RESP', `← ${action} ❌  reqId=${requestId} err=${resp.error} code=${resp.code ?? '-'}`);
      }
      return resp;
    } catch (e) {
      clearTimeout(timer);
      const rawMsg = e instanceof Error ? (e.message ?? String(e)) : String(e);
      const isReceivingEnd = /Receiving end does not exist/i.test(rawMsg);
      lastRawMsg = rawMsg;
      lastReceivingEnd = isReceivingEnd;
      Log.error('IPC:ERROR', `${action} catch(attempt=${attemptIdx + 1}): ${rawMsg}`);
      if (!isReceivingEnd) {
        return { ok: false, error: rawMsg, requestId };
      }
    }
  }

  Log.error('IPC:EXHAUSTED', `💥 ${action} 重试${RETRY_BACKOFF.length}次全部失败 reqId=${requestId} totalWait=${Date.now() - overallStartTs}ms lastErr=${lastRawMsg ?? '-'}`);
  const finalMsg = lastReceivingEnd
    ? 'Background Service Worker 启动超时（MV3 冷启动竞态），请关闭扩展后重新打开（或刷新页面）重试。'
    : (lastRawMsg ?? 'Unknown IPC error');
  return { ok: false, error: finalMsg, requestId };
};

/* ============ Zustand store ============ */

export interface VaultStoreState {
  status: VaultStatus;
  meta: VaultMetaPlain | null;
  vaultSnapshot: VaultPlaintext | null;
  failedAttempts: number;
  lockedUntilMs: number | null;
  /** 内存提示用：当前剩余尝试次数（最大5次 → 锁定 1分钟） */
  remainingAttempts: number;
  autoLockMinutes: number;
  /** 本次会话的 requestId 方便日志追踪 */
  sessionId: string;

  /* ---------- 方法：生命周期 ---------- */
  refreshStatus: () => Promise<void>;
  registerVault: (p: InitPayload) => Promise<{ ok: boolean; secretKey?: string; error?: string }>;
  unlockVault: (p: UnlockPayload) => Promise<{ ok: boolean; error?: string; code?: string }>;
  lockVault: () => Promise<void>;

  /* ---------- 方法：Item ---------- */
  fetchItems: (p?: ItemListPayload) => Promise<Item[]>;
  getItemById: (id: string) => Promise<Item | null>;
  createItem: (item: Partial<Item> & Pick<Item, 'category' | 'title' | 'fields'> & { vaultId?: string }) => Promise<Item | null>;
  updateItem: (patch: Partial<Item> & Pick<Item, 'id'>) => Promise<Item | null>;
  trashItem: (id: string) => Promise<{ ok: boolean; code?: string; error?: string }>;
  restoreItem: (id: string) => Promise<{ ok: boolean; code?: string; error?: string }>;
  deleteItemPermanently: (id: string) => Promise<{ ok: boolean; code?: string; error?: string }>;
  duplicateItem: (id: string) => Promise<Item | null>;
  toggleFavorite: (id: string) => Promise<{ ok: boolean; code?: string; error?: string }>;

  /* ---------- 方法：导入导出（加密备份） ---------- */
  exportVault: () => Promise<{ ok: boolean; data?: ExportVaultResult; error?: string; code?: string }>;
  importVault: (blobB64: string, masterPassword: string, strategy: ImportConflictStrategy) => Promise<{ ok: boolean; data?: ImportVaultResult; error?: string; code?: string }>;

  /* ---------- 方法：Settings ---------- */
  updateSettings: (patch: Partial<AppSettings>) => Promise<boolean>;
}

const makeSessionId = () => `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const useVaultStore = create<VaultStoreState>((set, get) => ({
  status: 'UNINITIALIZED',
  meta: null,
  vaultSnapshot: null,
  failedAttempts: 0,
  lockedUntilMs: null,
  remainingAttempts: 5,
  autoLockMinutes: 10,
  sessionId: makeSessionId(),

  refreshStatus: async () => {
    const r = await ipcCall<StatusResult>('VAULT_STATUS');
    if (!r.ok) return;
    const { status, meta, failedAttempts, lockedUntilMs, itemCount, autoLockMinutes } = r.data;
    // ⭐ Fix: 如果 BG 已解锁并返回了明文快照 → 立即写入当前 zustand（支持 Options 独立新 tab 同步）
    const vaultPlain: VaultPlaintext | null | undefined = (r.data as any).vaultSnapshot;
    const nextSnapshot = vaultPlain ?? (status === 'UNLOCKED' ? get().vaultSnapshot : null);
    Log.info(
      'STORE:STATUS',
      `refresh → ${status}, failed=${failedAttempts}, items=${vaultPlain ? `${vaultPlain.items.length}(from BG)` : (itemCount ?? 'N/A')}`,
    );
    set({
      status,
      meta,
      failedAttempts,
      lockedUntilMs,
      remainingAttempts: Math.max(0, 5 - failedAttempts),
      autoLockMinutes: autoLockMinutes ?? 10,
      vaultSnapshot: nextSnapshot,
    });
  },

  registerVault: async (p) => {
    const r = await ipcCall<InitResult>('VAULT_INIT', p as unknown as Record<string, unknown>);
    if (!r.ok) return { ok: false, error: r.error };
    set({ status: 'LOCKED', meta: r.data.meta, failedAttempts: 0, lockedUntilMs: null, remainingAttempts: 5 });
    return { ok: true, secretKey: r.data.secretKey };
  },

  unlockVault: async (p) => {
    const r = await ipcCall<UnlockResult>('VAULT_UNLOCK', p as unknown as Record<string, unknown>);
    if (!r.ok) {
      set((s) => ({
        failedAttempts: Math.min(s.failedAttempts + 1, 999),
        remainingAttempts: Math.max(0, s.remainingAttempts - 1),
      }));
      return { ok: false, error: r.error, code: r.code };
    }
    set({
      status: 'UNLOCKED',
      meta: r.data.meta,
      vaultSnapshot: r.data.vaultSnapshot,
      failedAttempts: 0,
      lockedUntilMs: r.data.lockedUntilMs ?? null,
      remainingAttempts: 5,
      autoLockMinutes: r.data.vaultSnapshot.settings.autoLockMinutes,
    });
    return { ok: true };
  },

  lockVault: async () => {
    await ipcCall<void>('VAULT_LOCK');
    set({ status: 'LOCKED', vaultSnapshot: null, remainingAttempts: Math.max(0, 5 - get().failedAttempts) });
    Log.info('STORE:LOCK', '已手动锁定，vaultSnapshot 已从内存中清除');
  },

  fetchItems: async (p) => {
    const r = await ipcCall<{ items: Item[]; total: number }>(
      'ITEM_LIST',
      p as unknown as Record<string, unknown>,
    );
    return r.ok ? r.data.items : [];
  },

  getItemById: async (id) => {
    const r = await ipcCall<Item>('ITEM_GET', { id });
    return r.ok ? r.data : null;
  },

  createItem: async (partial) => {
    const r = await ipcCall<Item>('ITEM_CREATE', partial as unknown as Record<string, unknown>);
    if (!r.ok) return null;
    const snap = get().vaultSnapshot;
    if (snap) {
      set({ vaultSnapshot: { ...snap, items: [r.data, ...snap.items] } });
    }
    return r.data;
  },

  updateItem: async (patch) => {
    const r = await ipcCall<Item>('ITEM_UPDATE', patch as unknown as Record<string, unknown>);
    if (!r.ok) {
      Log.warn('STORE:UPDATE', `乐观锁或更新失败 code=${r.code} id=${patch.id}`);
      return null;
    }
    const snap = get().vaultSnapshot;
    if (snap) {
      set({
        vaultSnapshot: {
          ...snap,
          items: snap.items.map((i) => (i.id === r.data!.id ? (r.data as Item) : i)),
        },
      });
    }
    return r.data;
  },

  trashItem: async (id) => {
    const r = await ipcCall<Item>('ITEM_TRASH', { id });
    if (!r.ok) return { ok: false, code: r.code, error: r.error };
    const snap = get().vaultSnapshot;
    if (snap) {
      set({
        vaultSnapshot: {
          ...snap,
          items: snap.items.map((i) => (i.id === id ? { ...i, trashed: true, trashedAt: Date.now() } : i)),
        },
      });
    }
    return { ok: true };
  },

  restoreItem: async (id) => {
    const r = await ipcCall<Item>('ITEM_RESTORE', { id });
    if (!r.ok) return { ok: false, code: r.code, error: r.error };
    const snap = get().vaultSnapshot;
    if (snap) {
      set({
        vaultSnapshot: {
          ...snap,
          items: snap.items.map((i) => {
            if (i.id !== id) return i;
            const c = { ...i };
            delete (c as any).trashedAt;
            return { ...c, trashed: false };
          }),
        },
      });
    }
    return { ok: true };
  },

  deleteItemPermanently: async (id) => {
    const r = await ipcCall<boolean>('ITEM_DELETE', { id });
    if (!r.ok) return { ok: false, code: r.code, error: r.error };
    const snap = get().vaultSnapshot;
    if (snap) {
      set({
        vaultSnapshot: {
          ...snap,
          items: snap.items.filter((i) => i.id !== id),
          deleted: snap.deleted.filter((d) => d.id !== id),
        },
      });
    }
    return { ok: true };
  },

  duplicateItem: async (id) => {
    const r = await ipcCall<Item>('ITEM_DUPLICATE', { id });
    if (!r.ok) return null;
    const snap = get().vaultSnapshot;
    if (snap) {
      set({ vaultSnapshot: { ...snap, items: [r.data, ...snap.items] } });
    }
    return r.data;
  },

  toggleFavorite: async (id) => {
    const r = await ipcCall<Item | { id: string; favorite: boolean }>('ITEM_TOGGLE_FAVORITE', { id });
    if (!r.ok) return { ok: false, code: r.code, error: r.error };
    const snap = get().vaultSnapshot;
    if (snap) {
      const newFav = 'favorite' in r.data ? (r.data as any).favorite : (r.data as Item).favorite;
      set({
        vaultSnapshot: {
          ...snap,
          items: snap.items.map((i) => (i.id === id ? { ...i, favorite: Boolean(newFav) } : i)),
        },
      });
    }
    return { ok: true };
  },

  exportVault: async () => {
    const r = await ipcCall<ExportVaultResult>('MISC_EXPORT_VAULT', {});
    if (!r.ok) return { ok: false, error: r.error, code: r.code };
    return { ok: true, data: r.data };
  },

  importVault: async (blobB64, masterPassword, strategy) => {
    const payload: ImportVaultPayload = { blobB64, masterPassword, conflictStrategy: strategy };
    const r = await ipcCall<ImportVaultResult>(
      'MISC_IMPORT_VAULT',
      payload as unknown as Record<string, unknown>,
    );
    if (!r.ok) return { ok: false, error: r.error, code: r.code };
    set({ vaultSnapshot: r.data.vaultSnapshotAfter });
    Log.info('STORE:IMPORT', `✅ 导入快照已同步 added=${r.data.added} skipped=${r.data.skipped}`);
    return { ok: true, data: r.data };
  },

  updateSettings: async (patch) => {
    const r = await ipcCall<AppSettings>('SETTINGS_UPDATE', { patch });
    if (!r.ok) return false;
    const snap = get().vaultSnapshot;
    if (snap) set({ vaultSnapshot: { ...snap, settings: r.data as AppSettings } });
    return true;
  },
}));
