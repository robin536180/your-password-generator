/**
 * shared/constants/category-templates.ts
 * 24 种 ItemCategory → 默认字段模板（创建 Item 时预填充）
 *
 * 设计原则：
 *  - 不自定义的常见登录/信用卡/身份证 → 贴近 1Password 惯例
 *  - 所有默认 field 的 custom=false，用户手动增/删/重排后的标 custom=true
 *  - 对 password/信用卡号等敏感字段，type 设置为 password/concealed/creditcard
 */
import { uuidv4 } from '@/lib/utils';
import type { Field, FieldType, ItemCategory } from '@/types/models';

export type CategoryTemplate = {
  /** 创建时填入的 title 占位（如 "新登录项"） */
  defaultTitle: string;
  /** 默认字段列表（新建 Drawer 打开时就是这些字段） */
  defaultFields: Omit<Field, 'id' | 'value' | 'entropyBits' | 'updatedAt' | 'otpCode' | 'otpRemainingSec'>[] & {};
  /** 默认 urls 数量（新建时给 1 个空字符串） */
  defaultUrlCount?: number;
};

const f = (
  label: string,
  type: FieldType = 'text',
  custom = false,
): Omit<Field, 'id' | 'value' | 'entropyBits' | 'updatedAt' | 'otpCode' | 'otpRemainingSec'> => ({
  label, type, custom,
});

const buildDefaultFields = (
  specs: Omit<Field, 'id' | 'value' | 'entropyBits' | 'updatedAt' | 'otpCode' | 'otpRemainingSec'>[],
): Field[] => specs.map((s) => ({
  id: uuidv4(),
  label: s.label,
  type: s.type,
  value: '',
  custom: s.custom ?? false,
}));

export const buildFieldsFromTemplate = (cat: ItemCategory): Field[] => {
  const tpl = CATEGORY_FIELD_TEMPLATES[cat];
  if (!tpl) return buildDefaultFields([f('名称', 'text'), f('备注', 'textarea')]);
  return buildDefaultFields(tpl.defaultFields as any);
};

export const getDefaultTitle = (cat: ItemCategory): string =>
  CATEGORY_FIELD_TEMPLATES[cat]?.defaultTitle ?? '新项目';

export const CATEGORY_FIELD_TEMPLATES: Partial<Record<ItemCategory, CategoryTemplate>> = {
  /* ========== 1. 登录项（最常用） ========== */
  login: {
    defaultTitle: '新登录项',
    defaultUrlCount: 1,
    defaultFields: [
      f('用户名', 'text'),
      f('密码', 'password'),
      f('网站', 'url'),
      f('一次性密码', 'otp'),
      f('备注', 'textarea'),
    ],
  },

  /* ========== 2. 信用卡 / 借记卡 ========== */
  'credit-card': {
    defaultTitle: '新信用卡',
    defaultFields: [
      f('持卡人', 'text'),
      f('信用卡号', 'creditcard'),
      f('有效期 (MM/YY)', 'monthYear'),
      f('CVV', 'concealed'),
      f('银行名称', 'text'),
      f('取款密码', 'password'),
      f('备注', 'textarea'),
    ],
  },

  /* ========== 3. 身份信息 ========== */
  identity: {
    defaultTitle: '新身份信息',
    defaultFields: [
      f('姓名', 'text'),
      f('性别', 'text'),
      f('出生日期', 'date'),
      f('电子邮箱', 'email'),
      f('手机号码', 'tel'),
      f('身份证号', 'concealed'),
      f('户籍地址', 'textarea'),
      f('现居住址', 'textarea'),
    ],
  },

  /* ========== 4. 银行账户 ========== */
  'bank-account': {
    defaultTitle: '新银行账户',
    defaultFields: [
      f('开户银行', 'text'),
      f('账户名', 'text'),
      f('账号/卡号', 'creditcard'),
      f('开户行支行', 'text'),
      f('登录密码', 'password'),
      f('取款密码', 'password'),
      f('网银登录', 'url'),
      f('备注', 'textarea'),
    ],
  },

  /* ========== 5. 驾照 ========== */
  'drivers-license': {
    defaultTitle: '新驾驶证',
    defaultFields: [
      f('持证人', 'text'),
      f('驾驶证号', 'text'),
      f('准驾车型', 'text'),
      f('初次领证日期', 'date'),
      f('有效期至', 'date'),
      f('签发机关', 'text'),
      f('档案编号', 'text'),
      f('备注', 'textarea'),
    ],
  },

  /* ========== 6. 护照 ========== */
  passport: {
    defaultTitle: '新护照',
    defaultFields: [
      f('持照人', 'text'),
      f('护照号', 'text'),
      f('国籍', 'text'),
      f('出生日期', 'date'),
      f('签发日期', 'date'),
      f('有效期至', 'date'),
      f('签发机关', 'text'),
      f('签发地', 'text'),
      f('备注', 'textarea'),
    ],
  },

  /* ========== 7. Wi-Fi 密码 ========== */
  'wireless-network': {
    defaultTitle: '新 Wi-Fi',
    defaultFields: [
      f('网络名称 (SSID)', 'text'),
      f('加密方式', 'text'),
      f('密码', 'password'),
      f('管理地址', 'url'),
      f('管理员账号', 'text'),
      f('管理员密码', 'password'),
      f('备注', 'textarea'),
    ],
  },

  /* ========== 8. 会员卡 ========== */
  membership: {
    defaultTitle: '新会员卡',
    defaultFields: [
      f('商家名称', 'text'),
      f('会员名', 'text'),
      f('会员卡号', 'text'),
      f('密码', 'password'),
      f('会员等级', 'text'),
      f('注册日期', 'date'),
      f('到期日期', 'date'),
      f('官网', 'url'),
      f('备注', 'textarea'),
    ],
  },

  /* ========== 9. 积分/奖励卡 ========== */
  'reward-card': {
    defaultTitle: '新积分卡',
    defaultFields: [
      f('商家名称', 'text'),
      f('会员号', 'text'),
      f('当前积分', 'text'),
      f('奖励余额', 'text'),
      f('兑换规则', 'textarea'),
      f('官网', 'url'),
      f('备注', 'textarea'),
    ],
  },

  /* ========== 10. 服务器 ========== */
  server: {
    defaultTitle: '新服务器',
    defaultFields: [
      f('服务器名称', 'text'),
      f('IP 地址 / 主机名', 'text'),
      f('协议 (SSH/RDP)', 'text'),
      f('端口', 'text'),
      f('用户名', 'text'),
      f('密码', 'password'),
      f('一次性密码', 'otp'),
      f('管理员面板', 'url'),
      f('备注', 'textarea'),
    ],
  },

  /* ========== 11. 数据库 ========== */
  database: {
    defaultTitle: '新数据库',
    defaultFields: [
      f('数据库类型 (MySQL/PG/Mongo)', 'text'),
      f('主机', 'text'),
      f('端口', 'text'),
      f('数据库名', 'text'),
      f('用户名', 'text'),
      f('密码', 'password'),
      f('连接串', 'concealed'),
      f('备注', 'textarea'),
    ],
  },

  /* ========== 12. SSH 密钥 ========== */
  'ssh-key': {
    defaultTitle: '新 SSH 密钥',
    defaultFields: [
      f('名称', 'text'),
      f('公钥', 'textarea'),
      f('私钥', 'concealed'),
      f('创建日期', 'date'),
      f('指纹', 'text'),
      f('Passphrase', 'password'),
      f('备注', 'textarea'),
    ],
  },

  /* ========== 13. API 凭证 ========== */
  'api-credential': {
    defaultTitle: '新 API 凭证',
    defaultFields: [
      f('服务/平台', 'text'),
      f('Access Key / App ID', 'text'),
      f('Secret Key / Token', 'concealed'),
      f('环境 (prod/test)', 'text'),
      f('权限范围 scopes', 'textarea'),
      f('申请日期', 'date'),
      f('过期日期', 'date'),
      f('控制台', 'url'),
      f('备注', 'textarea'),
    ],
  },

  /* ========== 14. 软件许可 / 激活码 ========== */
  'software-license': {
    defaultTitle: '新软件许可证',
    defaultFields: [
      f('软件名称', 'text'),
      f('版本', 'text'),
      f('许可证类型', 'text'),
      f('许可方/发行商', 'text'),
      f('许可证号 / 激活码', 'concealed'),
      f('授权邮箱', 'email'),
      f('注册用户名', 'text'),
      f('购买日期', 'date'),
      f('到期日期', 'date'),
      f('官网', 'url'),
      f('备注', 'textarea'),
    ],
  },

  /* ========== 15. 保单 ========== */
  insurance: {
    defaultTitle: '新保单',
    defaultFields: [
      f('保险公司', 'text'),
      f('险种', 'text'),
      f('保单号', 'text'),
      f('被保险人', 'text'),
      f('保险金额', 'text'),
      f('保费金额', 'text'),
      f('缴费年限', 'text'),
      f('生效日期', 'date'),
      f('到期日期', 'date'),
      f('业务员/联系方式', 'textarea'),
      f('官网/客服', 'text'),
      f('备注', 'textarea'),
    ],
  },

  /* ========== 16. 医疗记录 ========== */
  'medical-record': {
    defaultTitle: '新医疗记录',
    defaultFields: [
      f('患者姓名', 'text'),
      f('医院', 'text'),
      f('就诊日期', 'date'),
      f('科室', 'text'),
      f('主治医生', 'text'),
      f('诊断结果', 'textarea'),
      f('处方/用药', 'textarea'),
      f('诊疗费用', 'text'),
      f('下次复查', 'date'),
      f('医保卡号', 'concealed'),
      f('备注', 'textarea'),
    ],
  },

  /* ========== 17. 户外/超市会员（山姆/Costco/盒马等）========== */
  'outdoor-membership': {
    defaultTitle: '新超市会员',
    defaultFields: [
      f('超市/门店', 'text'),
      f('会员姓名', 'text'),
      f('会员卡号', 'text'),
      f('绑定手机', 'tel'),
      f('会员等级', 'text'),
      f('到期日期', 'date'),
      f('卡余额', 'text'),
      f('预约网址 / App 下载', 'url'),
      f('备注', 'textarea'),
    ],
  },

  /* ========== 18. 加密货币钱包 ========== */
  'crypto-wallet': {
    defaultTitle: '新加密钱包',
    defaultFields: [
      f('钱包名称 / 平台', 'text'),
      f('钱包地址', 'text'),
      f('公钥', 'textarea'),
      f('私钥', 'concealed'),
      f('助记词 (12/24 词)', 'concealed'),
      f('创建日期', 'date'),
      f('备注', 'textarea'),
    ],
  },

  /* ========== 19. 邮箱账户 ========== */
  'email-account': {
    defaultTitle: '新邮箱账户',
    defaultFields: [
      f('邮箱地址', 'email'),
      f('密码', 'password'),
      f('SMTP 服务器', 'text'),
      f('SMTP 端口', 'text'),
      f('IMAP/POP3 服务器', 'text'),
      f('一次性密码', 'otp'),
      f('登录页', 'url'),
      f('绑定手机', 'tel'),
      f('备用邮箱', 'email'),
      f('备注', 'textarea'),
    ],
  },

  /* ========== 20. 安全备注（大文本）========== */
  'secure-note': {
    defaultTitle: '新安全备注',
    defaultFields: [
      f('标题', 'text'),
      f('内容', 'textarea'),
      f('分类标签', 'text'),
    ],
  },

  /* ========== 21. 文档（附件入口，M2 先文本占位）========== */
  document: {
    defaultTitle: '新文档',
    defaultFields: [
      f('文档名', 'text'),
      f('文档类型', 'text'),
      f('创建日期', 'date'),
      f('文档内容摘要', 'textarea'),
      f('附件引用 ID', 'file'),
      f('备注', 'textarea'),
    ],
  },

  /* ========== 22. 身份证号（敏感证件）========== */
  'social-security-number': {
    defaultTitle: '新身份证号',
    defaultFields: [
      f('持卡人姓名', 'text'),
      f('身份证号', 'concealed'),
      f('性别', 'text'),
      f('民族', 'text'),
      f('出生日期', 'date'),
      f('签发机关', 'text'),
      f('有效期开始', 'date'),
      f('有效期结束', 'date'),
      f('住址', 'textarea'),
    ],
  },

  /* ========== 23. 自定义分类 ========== */
  custom: {
    defaultTitle: '新项目',
    defaultFields: [
      f('标题', 'text'),
      f('描述', 'textarea'),
    ],
  },

  /* ========== 24. 密码历史（内部使用，不展示在创建菜单）========== */
  'password-history': {
    defaultTitle: '密码历史',
    defaultFields: [
      f('项目ID', 'text'),
      f('原密码', 'password'),
      f('修改时间', 'date'),
    ],
  },
};
