# 变更摘要：密码生成器接入国密算法 + 自定义算法

- **变更编号**：feature_gm_algorithm_20261028
- **类型**：功能增强（feature）
- **创建时间**：2026-10-28
- **状态**：✅ 已完成（typecheck / build / vitest 三验通过）

## 1. 需求

1. 密码生成器加入国密算法（SM3 / SM4）。
2. 支持自定义算法（引擎、字符集、模板、前后缀可配置）。

## 2. 方案要点

| 关注点 | 决策 |
|---|---|
| 算法选型 | 口令生成本质是对称派生：SM3（HMAC-SM3 摘要）与 SM4（分组密钥流）最贴合；SM2 为非对称签名/加密，不适合直接派生口令，不纳入生成引擎 |
| 派生模型 | 种子 + 盐值 + 计数器 + 参数 → 确定性输出；计数器递增即「换一个」，种子留空则取 128 bit 系统随机数 |
| 均匀性 | 字节 → 字符映射使用拒绝采样，避免取模偏置；字符集 > 256 时改用双字节索引 |
| 自定义算法 | 引擎（SM3/SM4）+ 迭代次数 + 自定义字符集 + 模板（`*` 字符集 / `#` 数字 / `?` 大写）+ 前缀 + 后缀 |
| 安全边界 | 纯本机计算，不联网、不读写存储、不依赖保管库；与免登录公开生成器完全兼容 |
| 依赖 | `sm-crypto@0.5.8`（MIT，最近 6 个月内有维护，npm integrity 校验通过；精确版本锁定） |

## 3. 文件清单

| 文件 | 变更 | 说明 |
|---|---|---|
| `src/shared/generators/gm.ts` | 新增 | 国密派生核心：`sm3Hex` / `hmacSm3Hex` / SM3-HMAC 字节流 / SM4 密钥流 / 拒绝采样映射 / 模板派生 |
| `src/types/sm-crypto.d.ts` | 新增 | 该库未自带类型，声明实际用到的 SM3 / SM4 接口 |
| `src/shared/generators/password.ts` | 修改 | 新增 `gm` / `custom` 两种模式与 `GmPasswordOptions` / `CustomPasswordOptions` |
| `src/shared/generators/utils.ts` | 修改 | `PWD_MODE_CFG` 增加 gm / custom 长度区间 |
| `src/components/PasswordGenerator.tsx` | 修改 | 顶部模式 Tab 扩至 5 个；新增引擎切换、种子、盐值、迭代、字符集、模板、前后缀等控件 |
| `src/generator/App.tsx` | 修改 | 公开生成器文案补充新模式 |
| `test/vitest/11-gm-generator.test.ts` | 新增 | 20 个用例：标准向量、确定性、字符集、随机等价、模板、边界 |
| `package.json` / `package-lock.json` | 修改 | `sm-crypto` 精确锁定 0.5.8 |

## 4. 验收证据

- `npx tsc --noEmit` → exit 0
- `npm run build` → exit 0（generator 入口产物正常，locales 复制成功）
- `npx vitest run` → 6 个文件 **51/51 通过**（新增 20 个用例）
- 标准向量：`SM3("abc")`、`SM3("")`、SM4 单分组加密均与国标一致

## 5. 风险与后续

- SM2 未接入：非对称算法不适用于口令派生；若后续需要「SM2 签名登录」类能力，应作为独立能力设计。
- 未做算法配置持久化：公开生成器约束为「不读写浏览器存储」，自定义算法参数当前仅存活于页面内存，后续如需保存到保管库，应作为加密 Item 存储。
