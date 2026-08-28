/**
 * types/models.ts - 完整数据模型定义（严格对齐技术方案2.4节）
 *
 * 24种分类 × 核心实体：Item / Vault / Field / Tag / Settings
 */

/* ==================== 24 种分类枚举 ==================== */
export type ItemCategory =
  | 'login'              // 登录项（最常用）
  | 'credit-card'        // 信用卡 / 借记卡
  | 'identity'           // 身份（身份证/姓名/地址）
  | 'bank-account'       // 银行账户
  | 'drivers-license'    // 驾照
  | 'passport'           // 护照
  | 'wireless-network'   // Wi-Fi 密码
  | 'membership'         // 会员（健身房/超市等）
  | 'reward-card'        // 积分/奖励卡
  | 'server'             // 服务器（SSH/RDP）
  | 'database'           // 数据库连接
  | 'ssh-key'            // SSH 密钥（公钥/私钥）
  | 'api-credential'     // API Token / 密钥
  | 'software-license'   // 软件许可证 / 激活码
  | 'insurance'          // 保单
  | 'medical-record'     // 医疗记录
  | 'outdoor-membership' // 户外会员（山姆/ Costco等）
  | 'crypto-wallet'      // 加密货币钱包（助记词/私钥）
  | 'email-account'      // 邮箱账户
  | 'secure-note'        // 安全备注（大文本）
  | 'document'           // 文档附件
  | 'social-security-number' // 社保号 / 身份证号（敏感证件）
  | 'custom'             // 自定义分类
  | 'password-history';  // （内部）历史密码记录

/* ==================== Field 字段类型系统 ==================== */
export type FieldType =
  | 'text'        // 普通文本
  | 'password'    // 密码（默认星号，可显示，复制20秒清空）
  | 'concealed'   // 隐藏文本（CVV/验证码等）
  | 'email'
  | 'url'
  | 'tel'         // 电话
  | 'date'        // Unix ms 时间戳
  | 'monthYear'   // "YYYY-MM"
  | 'creditcard'  // 卡号（分组显示）
  | 'textarea'    // 多行文本
  | 'otp'         // TOTP URI（otpauth://totp/...）
  | 'file';       // 附件引用（存储在 IndexedDB）

export interface Field {
  id: string;                 // 字段ID（uuid）
  label: string;              // 显示名（"用户名"、"CVV"等）
  type: FieldType;
  value: string;              // 值（password/concealed 显示为 ****）
  /** password 字段专用：修改时间和熵值（用于Watchtower） */
  updatedAt?: number;
  entropyBits?: number;
  /** OTP 字段专用：最近一次生成的 6 位码（非持久，仅运行时计算） */
  otpCode?: string;
  otpRemainingSec?: number;
  /** 是否为自定义字段（默认字段可从模板自动生成） */
  custom?: boolean;
}

/* ==================== Vault 保管库 ==================== */
export interface Vault {
  id: string;                    // vault-personal / vault-work / ...
  name: string;                  // 展示名：个人 / 工作 / 家庭
  description?: string;
  iconEmoji?: string;            // 可选 emoji 图标
  colorHex?: string;             // 可选品牌色
  safeForTravel: boolean;        // 🛫 旅行模式：是否保留（非安全库真删除）
  createdAt: number;
  updatedAt: number;
}

/* ==================== Item 项目（核心实体 20 字段） ==================== */
export interface Item {
  id: string;                              // UUID v4
  vaultId: string;                         // 所属保管库
  category: ItemCategory;                  // 24种分类
  title: string;                           // 标题（搜索/展示主字段）
  favorite?: boolean;                      // ⭐ 收藏置顶
  tags: string[];                          // 标签（云同步多对多）
  fields: Field[];                         // 模板字段（按 category 预置）
  notesPlain?: string;                     // 安全备注大文本
  attachments?: AttachmentRef[];           // 附件引用列表
  urls: string[];                          // 登录域名匹配列表（自动填充）
  otpAuthUri?: string;                     // 2FA TOTP 种子 URI
  passwordHistory?: PasswordHistoryEntry[];// 密码修改历史
  /** Watchtower 自动计算字段，每次 save 时重算（不暴露给用户编辑） */
  strengthEntropyBits?: number;            // 密码熵（最高的一个 password 字段）
  breached?: boolean;                      // HIBP 泄露命中
  reused?: boolean;                        // 保管库中重复密码
  weak?: boolean;                          // 熵<60bit → 弱密码
  notHttpsUrl?: boolean;                   // 存在 http:// URL
  twoFactorEnabled?: boolean;              // 该账号是否启用了2FA
  /** 元数据 */
  createdAt: number;
  updatedAt: number;
  trashed?: boolean;                       // true → 回收站 30天
  trashedAt?: number;
  version: number;                         // 乐观锁（每次+1，冲突拒绝更新）
}

export interface PasswordHistoryEntry {
  at: number;           // 修改时间戳
  value: string;        // 加密后的旧密码（同样走AES-GCM，不存明文）
}

export interface AttachmentRef {
  id: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  objectKey: string;    // IndexedDB 大 Blob key
  sha256Hex: string;    // 完整性校验
}

/* ==================== Tag 标签（虽然简单，先建规范） ==================== */
export interface Tag {
  id: string;
  name: string;
  colorHex?: string;
}

/* ==================== Settings 偏好设置 ==================== */
export interface AppSettings {
  autoLockMinutes: number;              // 自动锁定分钟（默认10）
  clipboardClearSeconds: number;        // 复制密码后 X 秒清空（默认20）
  theme: 'system' | 'dark' | 'light';
  watchtowerEnabled: boolean;           // 是否启用安全瞭望塔
  hibpOffline: boolean;                 // MVP先本地不联网 → true
  biometricUnlock: boolean;             // 是否允许生物识别（需要扩展权限）
  language: 'zh-CN' | 'en-US';
  travelMode: boolean;                  // 🛫 旅行模式开关
  safeForTravelVaultIds: string[];      // 旅行安全保管库ID列表
  failedAttempts: number;               // 连续失败次数（达到5后锁定 N 分钟）
  lastUnlockAt: number | null;
  /** 性能调优：密码生成器 / PBKDF2 迭代次数锁定到 650k，不允许用户降低 */
  pbkdf2Iterations: number;
  vaultSchemaVersion: number;           // 1.0，未来升级迁移用
}

export const DEFAULT_SETTINGS: AppSettings = {
  autoLockMinutes: 10,
  clipboardClearSeconds: 20,
  theme: 'system',
  watchtowerEnabled: true,
  hibpOffline: true,
  biometricUnlock: false,
  language: 'zh-CN',
  travelMode: false,
  safeForTravelVaultIds: [],
  failedAttempts: 0,
  lastUnlockAt: null,
  pbkdf2Iterations: 650_000,
  vaultSchemaVersion: 1,
};

/* ==================== Deleted 回收站（30天） ==================== */
export interface DeletedItem extends Item {
  deletedAt: number;                    // 放入回收站时间
  expireAt: number;                     // 30天后永久删除
}

/* ==================== 解密后的保管库明文结构（内存态） ==================== */
export interface VaultPlaintext {
  items: Item[];
  vaults: Vault[];
  tags: Tag[];
  settings: AppSettings;
  deleted: DeletedItem[];
}

/* ==================== chrome.storage.local 存储明文元数据（不含密钥！） ==================== */
export interface VaultMetaPlain {
  version: number;
  createdAt: number;
  lastModified: number;
  saltHex: string;                      // PBKDF2 Salt HEX
  pbkdf2Iterations: number;             // 650_000（写死，防止未来降低）
  verifierB64: string;                  // AES-GCM(DK, sentinel) → 用于快速验证主密码
  accountEmail: string;                 // 用户邮箱标识，可空
  secretKeyMasked: string;              // 只保留前后缀用于UI提示 "A3-XXXX-...-XXXX-9K2F"
}

/** storage key 常量 */
export const STORAGE_KEYS = {
  META: '__1p_meta__',
  VAULT_CIPHER: '__1p_vault_cipher__',
} as const;
