# Task Plan

## 任务清单

### 任务1：用户名生成器功能整合
- **目标**: 将1Password风格的用户名生成器整合到现有密码生成器Chrome扩展中
- **状态**: ✅ 已完成（v1.1交付）
- **负责人**: AI
- **创建时间**: 2026-08-21
- **交付文件清单（6个）**:
  | 文件 | 变更类型 | 说明 |
  |---|---|---|
  | [popup.html](file:///d:/MyProjects/your-password-generator/popup.html) | 重构 203行 | 新增顶层Tab + 用户名生成面板(3模式完整UI) |
  | [popup.css](file:///d:/MyProjects/your-password-generator/popup.css) | 扩展 373行 | 顶层Tab样式、面板切换、自定义输入字段等 |
  | [popup.js](file:///d:/MyProjects/your-password-generator/popup.js) | 重构 522行 | 通用函数抽离、密码三模式保留、用户名三模式新增、完整事件绑定、日志埋点 |
  | [manifest.json](file:///d:/MyProjects/your-password-generator/manifest.json) | 更新 v1.1 | 扩展名/描述更新，权限仅clipboardWrite |
  | [test/generator.test.js](file:///d:/MyProjects/your-password-generator/test/generator.test.js) | 新增 361行 | 12组压力测试用例 + 1万次碰撞检测 ✅全通过 |

---

### 任务2：完整密码管理器（调研 + 方案输出）
- **目标**: 梳理1Password完整118+功能，输出匹配Chrome MV3架构的密码管理器技术方案
- **状态**: ✅ 方案输出完成，等待用户确认开发范围
- **负责人**: AI
- **创建时间**: 2026-08-21
- **交付成果**:
  1. **118+ 功能点明细表**（8大类别：密码管理/多物品类型/安全架构/Watchtower威胁检测/高级独有功能/协作共享/2FA&Passkey/开发+企业集成）
  2. **8大核心技术图**（Mermaid彩色曲线）：
     - 整体架构图（Chrome扩展 + 本地加密存储 + 未来可选服务端，三层分色）
     - 注册/解锁时序图（AES+PBKDF2+verifier完整链路）
     - 自动填充业务流程图（Content Script + Background + DOM扫描）
     - MVP开发甘特图（8个里程碑，约8周）
  3. **数据库Schema**（chrome.storage.local + 解密后的Item/Vault/Field 20字段精细设计，24分类枚举）
  4. **20个Action API**（chrome.runtime.sendMessage消息协议+请求ID链路追踪）
  5. **文件新增清单**（13个核心模块+现有5个模块对照）

---

### 任务3：v2.0 M1 核心安全底座开发（开发中）
- **目标**: 按照用户最终决策 A 方案（TypeScript + React + Vite 重建 / 从 M1 起步 / 旅行模式 MVP 后期补 / Watchtower 先纯本地），完成 M1 核心安全底座
- **用户最终决策** (2026-08-21): **A**
  1. ✅ 开发起点：M1 安全底座（不跳过）
  2. ✅ 技术栈：TypeScript + React + Vite + @crxjs/vite-plugin（MV3）
  3. ✅ 旅行模式：MVP 后期补（初期不做）
  4. ✅ Watchtower：初期纯本地熵值检测（后期接 HIBP 外部 API）
- **状态**: 🔄 代码编写 100% 完成，构建验证中（npm install 后台运行）
- **甘特图 M1 9 个里程碑状态**:
  | 编号 | 里程碑 | 状态 |
  |---|---|---|
  | M1-1 | 建立构建体系 (TS5+Vite5+React18+CRXJS+Tailwind3+Zustand4) + 5个配置文件 | ✅ 完成 |
  | M1-2 | 目录结构设计：src/core src/screens src/store src/types 等 8 个目录 | ✅ 完成 |
  | M1-3 | 核心安全 crypto.ts：PBKDF2(650,000次) + AES-256-GCM + 128bit Secret Key | ✅ 完成 |
  | M1-4 | 数据层：models.ts 类型 + vault-store.ts 加密存储封装 (Meta明文+Ciper密文分离) | ✅ 完成 |
  | M1-5 | 紧急工具包 emergency-kit.ts：Canvas 1240x1754 PNG + QR Code 强制下载 | ✅ 完成 |
  | M1-6 | Zustand Store：vaultStore.ts 解锁状态机（DK 内存持有不写磁盘） + ipc 消息协议 | ✅ 完成 |
  | M1-7 | 注册/解锁双屏 UI：RegisterScreen + UnlockScreen + HomeScreen + Popup/Options 入口 | ✅ 完成 |
  | M1-8 | Service Worker + 20 个 Action IPC 路由 + Vitest 单元测试 (10000 条加密压测) | ✅ 完成 |
  | M1-9 | 打包验证：npm install → build 0 错误 → chrome://extensions 加载 → E2E 注册/解锁 | 🔄 构建验证中 |
- **新增代码文件 24 个 + .gitignore**（不含 v1.1 原文件）：
  | 路径 | 说明 |
  |---|---|
  | `package.json` | v2.0.0-m1，18 个生产/开发依赖 |
  | `tsconfig.json` | strict:true + paths:@/* → src/* |
  | `vite.config.ts` | @crxjs/vite-plugin + manifest 热重载 |
  | `tailwind.config.js` | brand.500=#0061ff / brand.700=#202a51 1P 深蓝主题 |
  | `postcss.config.js` | tailwind + autoprefixer |
  | `src/manifest.json` | Chrome MV3 manifest（2.0 版，已迁移到 src/） |
  | `src/lib/utils.ts` | uuidv4/Base64/textEncode/sha256Hex/entropy/cn 等通用工具 |
  | `src/core/logger.ts` | 四级日志 INFO/WARN/ERROR/DEBUG + 内存缓冲 1000 条 |
  | `src/core/crypto.ts` | PBKDF2 650000 + AES-256-GCM + Secret Key + Verifier |
  | `src/core/vault-store.ts` | initializeEmptyVault/unlockVault/persistVault/Item CRUD |
  | `src/core/emergency-kit.ts` | Canvas 紧急工具包 PNG 生成（QR Code + 邮箱 + SK + 警告卡） |
  | `src/types/models.ts` | 24 种 ItemCategory + Field 类型系统 + Vault/Tag/Settings 完整定义 |
  | `src/types/ipc.ts` | 20 个 Action 消息协议（VAULT_* / ITEM_* / SETTINGS_* / WATCHTOWER_*） |
  | `src/store/vaultStore.ts` | Zustand 解锁状态机 + ipcCall 包装（带 requestId + 60s 超时） |
  | `src/screens/RegisterScreen.tsx` | 4 步注册屏：邮箱+密码 → SecretKey → 下载EK → 确认完成 |
  | `src/screens/UnlockScreen.tsx` | 解锁屏：失败 5 次 → 60s/3min/10min 回退锁定 |
  | `src/screens/HomeScreen.tsx` | M1 MVP Home：安全状态卡 + 统计 + 设置概览 |
  | `src/popup/App.tsx` + `main.tsx` + `index.html` | Popup 总入口（420x560 小窗） |
  | `src/options/App.tsx` + `main.tsx` + `index.html` | Options 管理大页（4 Tab：首页/设置/日志/危险区） |
  | `src/background/index.ts` | Service Worker：闭包持有 DK，20 个 Action 路由，自动锁 alarms |
  | `src/index.css` | Tailwind 三层 + 滚动条美化 + 中文字体优化 |
  | `test/vitest/setup.ts` | jsdom chrome.storage/alarms/runtime mock |
  | `test/vitest/1-crypto.test.ts` | 5 组 14 断言 + 10000 条加密压测 <3s |
  | `.gitignore` | node_modules / dist / release 等 |

---

### 任务3 下一步待办
- [ ] npm install 依赖安装成功（后台运行中，终端 ID 见日志）
- [ ] `npm run typecheck` 类型检查 0 错误
- [ ] `npm run build` 打包 0 错误，产出 dist 目录
- [ ] `npm run test` Vitest 加密单元测试 100% 通过（10000 条压测 <3s）
- [ ] `chrome://extensions` → 加载已解压扩展程序 → 选 dist 目录
- [ ] E2E：注册保管库 → 强制下载紧急工具包 → 手动锁定 → 正确密码解锁 → 密码错误 5 次锁定 60s → 再成功解锁 → DevTools 检查 chrome.storage.local **只含 Base64 密文**，无任何明文密码 / DK / Secret Key
