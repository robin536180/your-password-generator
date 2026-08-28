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
} from '@/types/ipc';
import type { AppSettings, Item, VaultMetaPlain, VaultPlaintext } from '@/types/models';
import { Log } from '@/core/logger';

const REQ_ID_PREFIX = 'ui';
let __reqSeq = 0;
const nextReqId = () => `${REQ_ID_PREFIX}-${Date.now()}-${(++__reqSeq).toString(36)}`;

/** sendMessage 包装：自动带 requestId + 超时保护 */
export const ipcCall = async <T>(
  action: VaultAction | (string & {}),
  payload?: unknown,
  timeoutMs = 60_000,
): Promise<VaultResp<T>> => {
  const requestId = nextReqId();
  const msg = { action, payload, requestId };
  Log.debug('IPC:CALL', `→ ${action}  reqId=${requestId}`, payload);

  const timer = setTimeout(() => {
    Log.error('IPC:TIMEOUT', `⏱ ${action} 超时 (${timeoutMs}ms) reqId=${requestId}`);
  }, timeoutMs);

  try {
    const resp = (await chrome.runtime.sendMessage(msg)) as VaultResp<T> | undefined;
    clearTimeout(timer);
    if (!resp) {
      return { ok: false, error: 'Background 无响应（可能 Service Worker 被终止，请重新打开 popup）', requestId };
    }
    resp.requestId = requestId;
    if (resp.ok) {
      Log.debug('IPC:RESP', `← ${action} ✅  reqId=${requestId}`);
    } else {
      Log.warn('IPC:RESP', `← ${action} ❌  reqId=${requestId} err=${resp.error} code=${resp.code ?? '-'}`);
    }
    return resp;
  } catch (e) {
    clearTimeout(timer);
    const msg = e instanceof Error ? e.message : String(e);
    Log.error('IPC:ERROR', `${action} catch: ${msg}`);
    return { ok: false, error: msg, requestId };
  }
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
  createItem: (item: Partial<Item> & Pick<Item, 'category' | 'title' | 'fields'> & { vaultId?: string }) => Promise<Item | null>;
  updateItem: (patch: Partial<Item> & Pick<Item, 'id'>) => Promise<Item | null>;
  trashItem: (id: string) => Promise<boolean>;
  toggleFavorite: (id: string) => Promise<boolean>;

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
    Log.info('STORE:STATUS', `refresh → ${status}, failed=${failedAttempts}, items=${itemCount ?? 'N/A'}`);
    set({
      status,
      meta,
      failedAttempts,
      lockedUntilMs,
      remainingAttempts: Math.max(0, 5 - failedAttempts),
      autoLockMinutes: autoLockMinutes ?? 10,
      // LOCKED 时 snapshot 清空（避免内存残留明文）
      vaultSnapshot: status === 'UNLOCKED' ? get().vaultSnapshot : null,
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

  createItem: async (partial) => {
    const r = await ipcCall<Item>('ITEM_CREATE', partial as unknown as Record<string, unknown>);
    if (!r.ok) return null;
    // 乐观更新 snapshot
    const snap = get().vaultSnapshot;
    if (snap) set({ vaultSnapshot: { ...snap, items: [...snap.items, r.data] } });
    return r.data;
  },

  updateItem: async (patch) => {
    const r = await ipcCall<Item>('ITEM_UPDATE', patch as unknown as Record<string, unknown>);
    if (!r.ok) return null;
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
    const r = await ipcCall<void>('ITEM_TRASH', { id });
    if (!r.ok) return false;
    const snap = get().vaultSnapshot;
    if (snap) {
      set({
        vaultSnapshot: {
          ...snap,
          items: snap.items.filter((i) => i.id !== id),
        },
      });
    }
    return true;
  },

  toggleFavorite: async (id) => {
    const r = await ipcCall<Item>('ITEM_TOGGLE_FAVORITE', { id });
    if (!r.ok) return false;
    const snap = get().vaultSnapshot;
    if (snap) {
      set({
        vaultSnapshot: {
          ...snap,
          items: snap.items.map((i) => (i.id === id ? (r.data as Item) : i)),
        },
      });
    }
    return true;
  },

  updateSettings: async (patch) => {
    const r = await ipcCall<AppSettings>('SETTINGS_UPDATE', { patch });
    if (!r.ok) return false;
    const snap = get().vaultSnapshot;
    if (snap) set({ vaultSnapshot: { ...snap, settings: r.data as AppSettings } });
    return true;
  },
}));
