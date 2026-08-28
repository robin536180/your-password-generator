/**
 * types/ipc.ts - 20个 Action API 消息协议（严格对齐技术方案4.5节）
 *
 * 调用方（Popup/Options UI）通过 `chrome.runtime.sendMessage({action, payload})`
 * 发给 Background SW → SW 路由到对应 handler → 返回 { ok: true, data } | { ok:false, error }
 *
 * 约定：每个 Action 的入参/出参都在这里定义，方便 IDE 推断 + 测试断言
 */

import type {
  AppSettings,
  Item,
  ItemCategory,
  Tag,
  Vault,
  VaultMetaPlain,
  VaultPlaintext,
} from '@/types/models';

export type VaultAction =
  /* ================= 初始化 / 生命周期 ================= */
  | 'VAULT_EXISTS'          // 是否已初始化
  | 'VAULT_INIT'            // 首次注册：创建空保管库（注册屏调用）
  | 'VAULT_UNLOCK'          // 解锁：输入主密码 → 返回明文保管库快照
  | 'VAULT_LOCK'            // 手动锁定（清空内存中 DK）
  | 'VAULT_STATUS'          // 获取当前状态（LOCKED/UNLOCKED/UNINITIALIZED）
  | 'VAULT_PERSIST'         // 手动触发保存（通常由修改操作自动调用）
  /* ================= Item CRUD 11个 ================= */
  | 'ITEM_LIST'             // 条件查询（分类/保管库ID/关键词/回收站）
  | 'ITEM_GET'              // 根据 id 获取一条
  | 'ITEM_CREATE'           // 新增
  | 'ITEM_UPDATE'           // 更新
  | 'ITEM_DELETE'           // 真删除（超过30天或用户主动）
  | 'ITEM_TRASH'            // 移入回收站
  | 'ITEM_RESTORE'          // 从回收站恢复
  | 'ITEM_DUPLICATE'        // 克隆
  | 'ITEM_TOGGLE_FAVORITE'  // ⭐ 收藏切换
  | 'ITEM_ATTACH_UPLOAD'    // （预留）附件上传 → IndexedDB
  | 'ITEM_ATTACH_DOWNLOAD'  // （预留）附件下载
  /* ================= Vault / Tags 组织管理 4个 ================= */
  | 'VAULT_LIST'            // 保管库列表
  | 'VAULT_CREATE'          // 新建保管库
  | 'TAG_LIST'              // 标签列表
  | 'TAG_CREATE'            // 新增标签
  /* ================= Settings 2个 ================= */
  | 'SETTINGS_GET'
  | 'SETTINGS_UPDATE'
  /* ================= Watchtower 1个 ================= */
  | 'WATCHTOWER_SCAN';      // 扫描全库：重复/弱密码/过期（纯本地，不联网）

export type VaultStatus = 'UNINITIALIZED' | 'LOCKED' | 'UNLOCKED';

export interface VaultMessageBase {
  action: VaultAction;
  requestId?: string;
  payload?: Record<string, unknown>;
}

/* ----------- 各 Action 的 payload / 返回类型 ----------- */
export type VaultResp<T> = { ok: true; data: T; requestId?: string } | { ok: false; error: string; code?: string; requestId?: string };

export interface InitPayload {
  masterPassword: string;
  accountEmail: string;
  secretKey?: string;          // 可用户指定（测试/恢复场景），不填则自动生成
}
export interface InitResult {
  secretKey: string;           // 完整格式 Secret Key（UI需强制用户下载紧急工具包）
  meta: VaultMetaPlain;
  emptyVaultItemsCount: number;
}

export interface UnlockPayload {
  masterPassword: string;
}
export interface UnlockResult {
  meta: VaultMetaPlain;
  vaultSnapshot: VaultPlaintext;
  lockedUntilMs?: number;
  remainingAttempts: number;
}

export interface StatusResult {
  status: VaultStatus;
  meta: VaultMetaPlain | null;
  failedAttempts: number;
  lockedUntilMs: number | null;
  itemCount: number | null;     // UNINITIALIZED/LOCKED → null
  autoLockMinutes: number | null;
}

export interface ItemListPayload {
  vaultId?: string;
  category?: ItemCategory;
  trashed?: boolean;
  search?: string;
  onlyFavorites?: boolean;
  onlyWith2faIssues?: boolean;
  limit?: number;
  offset?: number;
}
export interface ItemListResult {
  total: number;
  items: Item[];
}

export interface VaultListResult { vaults: Vault[]; }
export interface VaultCreatePayload { name: string; iconEmoji?: string; safeForTravel?: boolean; }
export interface TagListResult { tags: Tag[]; }
export interface TagCreatePayload { name: string; colorHex?: string; }
export interface SettingsUpdatePayload { patch: Partial<AppSettings>; }
export interface WatchtowerScanResult {
  weak: Item[];
  reused: Array<{ passwordHash: string; items: Item[] }>;
  notHttps: Item[];
  oldPasswords: Item[];        // 一年未变更
  totals: { weak: number; reused: number; notHttps: number; oldPasswords: number; totalItems: number };
}

/* ---------- 联合类型导出（Background handler 做 switch） ---------- */
export type VaultMessage =
  | ({ action: 'VAULT_EXISTS' } & VaultMessageBase)
  | ({ action: 'VAULT_INIT'; payload: InitPayload } & VaultMessageBase)
  | ({ action: 'VAULT_UNLOCK'; payload: UnlockPayload } & VaultMessageBase)
  | ({ action: 'VAULT_LOCK' } & VaultMessageBase)
  | ({ action: 'VAULT_STATUS' } & VaultMessageBase)
  | ({ action: 'VAULT_PERSIST' } & VaultMessageBase)
  | ({ action: 'ITEM_LIST'; payload: ItemListPayload } & VaultMessageBase)
  | ({ action: 'ITEM_GET'; payload: { id: string } } & VaultMessageBase)
  | ({ action: 'ITEM_CREATE'; payload: Partial<Item> & Pick<Item, 'category' | 'title' | 'fields'> } & VaultMessageBase)
  | ({ action: 'ITEM_UPDATE'; payload: Partial<Item> & Pick<Item, 'id'> } & VaultMessageBase)
  | ({ action: 'ITEM_TRASH'; payload: { id: string } } & VaultMessageBase)
  | ({ action: 'ITEM_RESTORE'; payload: { id: string } } & VaultMessageBase)
  | ({ action: 'ITEM_DELETE'; payload: { id: string } } & VaultMessageBase)
  | ({ action: 'ITEM_DUPLICATE'; payload: { id: string } } & VaultMessageBase)
  | ({ action: 'ITEM_TOGGLE_FAVORITE'; payload: { id: string } } & VaultMessageBase)
  | ({ action: 'VAULT_LIST' } & VaultMessageBase)
  | ({ action: 'VAULT_CREATE'; payload: VaultCreatePayload } & VaultMessageBase)
  | ({ action: 'TAG_LIST' } & VaultMessageBase)
  | ({ action: 'TAG_CREATE'; payload: TagCreatePayload } & VaultMessageBase)
  | ({ action: 'SETTINGS_GET' } & VaultMessageBase)
  | ({ action: 'SETTINGS_UPDATE'; payload: SettingsUpdatePayload } & VaultMessageBase)
  | ({ action: 'WATCHTOWER_SCAN' } & VaultMessageBase);
