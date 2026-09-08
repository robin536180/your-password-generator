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

### 任务3：v2.0 M1 核心安全底座开发
- **目标**: 按照用户最终决策 A 方案（TypeScript + React + Vite 重建 / 从 M1 起步 / 旅行模式 MVP 后期补 / Watchtower 先纯本地），完成 M1 核心安全底座 + 5 个 E2E 手测 Bug 闭环
- **用户最终决策** (2026-08-21): **A**
  1. ✅ 开发起点：M1 安全底座（不跳过）
  2. ✅ 技术栈：TypeScript + React + Vite + @crxjs/vite-plugin（MV3）
  3. ✅ 旅行模式：MVP 后期补（初期不做）
  4. ✅ Watchtower：初期纯本地熵值检测（后期接 HIBP 外部 API）
- **状态**: ✅ 完成（9 大里程碑 + 5 个 P0/P1 E2E Bug 全部 100% 通过用户 2026-09-03 验收）
- **验收确认时间**: 2026-09-03（用户 VERBATIM 双反馈：「3 项都 OK」+「4 步全过」）
- **甘特图 M1 9 个里程碑状态**:
  | 编号 | 里程碑 | 状态 |
  |---|---|---|
  | M1-1 | 建立构建体系 (TS5+Vite5+React18+CRXJS+Tailwind3+Zustand4) + 5个配置文件 | ✅ 完成 |
  | M1-2 | 目录结构设计：src/core src/screens src/store src/types 等 8 个目录 | ✅ 完成 |
  | M1-3 | 核心安全 crypto.ts：PBKDF2(650,000次) + AES-256-GCM + 128bit Secret Key | ✅ 完成 |
  | M1-4 | 数据层：models.ts 类型 + vault-store.ts 加密存储封装 (Meta明文+Ciper密文分离) | ✅ 完成 |
  | M1-5 | 紧急工具包 emergency-kit.ts：Canvas 1240x1920 PNG + QR Code 强制下载 | ✅ 完成（两轮 EK 布局修复后通过用户验收） |
  | M1-6 | Zustand Store：vaultStore.ts 解锁状态机（DK 内存持有不写磁盘） + ipc 消息协议 | ✅ 完成 |
  | M1-7 | 注册/解锁双屏 UI：RegisterScreen + UnlockScreen + HomeScreen + Popup/Options 入口 | ✅ 完成 |
  | M1-8 | Service Worker + 20 个 Action IPC 路由 + Vitest 单元测试 (10000 条加密压测) | ✅ 完成 |
  | M1-9 | 打包验证 + 5 个 E2E Bug 闭环（详见任务4 清单） + chrome://extensions 注册/解锁手测全通过 | ✅ 完成 |
- **新增代码文件 24 个 + .gitignore**（不含 v1.1 原文件）：
  | 路径 | 说明 |
  |---|---|
  | `package.json` | v2.0.0-m1，18 个生产/开发依赖 |
  | `tsconfig.json` | strict:true + paths:@/* → src/* |
  | `vite.config.ts` | @crxjs/vite-plugin + manifest 热重载 + localesCopyPlugin |
  | `tailwind.config.js` | brand.500=#0061ff / brand.700=#202a51 1P 深蓝主题 |
  | `postcss.config.js` | tailwind + autoprefixer |
  | `src/manifest.json` | Chrome MV3 manifest（2.0 版，已迁移到 src/，default_locale=zh_CN + __MSG_xxx__ 4 占位符） |
  | `src/_locales/zh_CN/messages.json` + `src/_locales/en/messages.json` | Chrome i18n 双语 4 键 |
  | `src/lib/utils.ts` | uuidv4/Base64/textEncode/sha256Hex/entropy/cn 等通用工具 |
  | `src/core/logger.ts` | 四级日志 INFO/WARN/ERROR/DEBUG + 内存缓冲 1000 条 |
  | `src/core/crypto.ts` | PBKDF2 650000 + AES-256-GCM + Secret Key + Verifier；globalThis._G 统一缓存防绑定丢 |
  | `src/core/vault-store.ts` | initializeEmptyVault(unlockVault/persistVault/Item CRUD；静态 import 禁 dynamic；事务回滚防半提交) |
  | `src/core/emergency-kit.ts` | Canvas 紧急工具包 1240x1920 PNG 生成；QR 5 行纯文本 SK 首行；画布高警告卡高坐标校验 |
  | `src/types/models.ts` | 24 种 ItemCategory + Field 类型系统 + Vault/Tag/Settings 完整定义 |
  | `src/types/ipc.ts` | 20 个 Action 消息协议（VAULT_* / ITEM_* / SETTINGS_* / WATCHTOWER_*） |
  | `src/store/vaultStore.ts` | Zustand 解锁状态机 + ipcCall 包装（带 requestId + 60s 超时） |
  | `src/screens/RegisterScreen.tsx` | 4 步注册屏：邮箱+密码 → SecretKey → 下载EK → 确认完成 |
  | `src/screens/UnlockScreen.tsx` | 解锁屏：失败 5 次 → 60s/3min/10min 回退锁定 |
  | `src/screens/HomeScreen.tsx` | M1 MVP Home：安全状态卡 + 统计 + 设置概览 |
  | `src/popup/App.tsx` + `main.tsx` + `index.html` | Popup 总入口（420x560 小窗） |
  | `src/options/App.tsx` + `main.tsx` + `index.html` | Options 管理大页（4 Tab：首页/设置/日志/危险区 YES-DELETE-ALL） |
  | `src/background/index.ts` | Service Worker：闭包持有 DK，20 个 Action 路由，自动锁 alarms |
  | `src/index.css` | Tailwind 三层 + color-scheme:light 禁 UA dark + @layer base 全局 input 三件套兜底 |
  | `test/vitest/setup.ts` | jsdom chrome.storage/alarms/runtime mock |
  | `test/vitest/1-crypto.test.ts` | 5 组 14 断言 + 10000 条加密压测 <3s（实测 1579.8ms 余量 47%） |
  | `.gitignore` | node_modules / dist / release 等 |

---

### 任务4：M1 E2E 手测 5 个 Bug 修复（2026-08-28 ~ 2026-09-03 全闭环通过用户验收）
- **目标**: 修复用户 E2E 手测过程中暴露的 5 个 P0/P1 Bug，保证注册→下载 EK→扫码→解锁→零知识审计 全流程 0 报错
- **状态**: ✅ 完成（2026-09-03 用户 VERBATIM「3 项都 OK」+「4 步全过」双确认）
- **5 个 Bug 清单 + 修复 + 验证结果**:

| 编号 | Bug 描述 (用户 VERBATIM) | 根因分类（详见 findings.md 4.x）| 核心修复文件 | 用户手测验证结果 |
|---|---|---|---|---|
| Bug1 | `Default locale was specified, but _locales subtree is missing. 无法加载清单。` | [4.1 MV3 default_locale 硬规则坑](file:///d:/MyProjects/your-password-generator/.harness/findings.md#L167-L177) | manifest.json 占位符 + zh_CN/en messages.json × 2 + vite.config.ts localesCopyPlugin | ✅ 用户「可以了」→ 扩展成功加载 |
| Bug2 | 「输入框是白色的背景色，输入的文字也是白色，根本看不见字儿」 | [4.2 CSS UA dark 白字坑](file:///d:/MyProjects/your-password-generator/.harness/findings.md#L178-L192) | src/index.css（color-scheme:light + @layer base input/textarea/select 三件套兜底） | ✅ 用户未再反馈输入框问题，已 verified |
| Bug3 | 「手机扫码也打开的地址是 https://40hotmail.com 打不开」→ 后续补充「扫码只出来一个邮箱地址，没看到 SK 文本」 | [4.3 手机扫码 heuristic 坑](file:///d:/MyProjects/your-password-generator/.harness/findings.md#L194-L209) | emergency-kit.ts（9 行 URI→5 行纯文本；SK 首行 SECRET_KEY:；EC 等级 Q(25%)） | ✅ 2026-09-03 用户「3 项都 OK」第 2 项 |
| Bug4 | 「最下边的二维码部分和右侧的文字，被下方的框内文字遮挡住了」→ 后续补充「L180 这行字现在被底部框线截断了挡住了半行字，每个字都只有一半能看到」 | [4.4 Canvas 绝对布局子元素溢出重叠坑](file:///d:/MyProjects/your-password-generator/.harness/findings.md#L211-L234) | emergency-kit.ts（两轮调：画布 H=1754→1920；warnH=460→520；adviceY=1770；watermarkY=warnY+warnH+40 独立计算非 H-40） | ✅ 2026-09-03 用户「3 项都 OK」第 1 项 |
| Bug5 | 「点击『我已保存，完成注册』报错：window is not defined，再次点击提示：保管库已经存在，如需重新开始请先在设置里清空」 | [4.5 MV3 SW dynamic import + 裸全局绑定丢 + 半提交死锁](file:///d:/MyProjects/your-password-generator/.harness/findings.md#L236-L254) | crypto.ts 10 处 globalThis._G.*；vault-store.ts 静态 import 删 dynamic + try/catch storage 事务回滚 | ✅ 2026-09-03 用户「4 步全过」+ 零知识审计 6 关键词 0 命中 |

---

### 任务3 + 任务4 待办全打勾
- [x] npm install 依赖安装成功（后台运行中，终端 ID 见日志）→ 2026-08-27 Sangfor aTrust 退出后 node_modules 就绪
- [x] `npm run typecheck` 类型检查 0 错误 → M1 初次 31→0，Bug 修复后累计 3 次实跑全部 exit 0
- [x] `npm run build` 打包 0 错误，产出 dist 目录 → 每次修复后均 exit 0，locales 插件复制成功
- [x] `npm run test` Vitest 加密单元测试 100% 通过（10000 条压测 <3s，实测 1579.8ms 47% 余量）
- [x] `chrome://extensions` → 加载已解压扩展程序 → 选 dist 目录 → Bug1 修复后成功加载
- [x] Bug1 Default Locale：新建 zh_CN + en messages.json + i18n 占位符 + localesCopyPlugin
- [x] Bug2 白底白字：color-scheme:light 禁 UA dark + @layer base 全局 input 三件套兜底
- [x] Bug3 QR 跳 40hotmail + 只看邮箱：9行URI→5行纯文本 + SK 首行 SECRET_KEY: + Level Q 25%
- [x] Bug4 EK 重叠 + 文字截半：H=1920 + warnH=520 + adviceY=1770 + watermarkY=warnY+warnH+40
- [x] Bug5 window undefined + 半提交：crypto._G 统一缓存 10 处替换；vault-store 静态 import + 事务回滚
- [x] E2E：注册保管库 → 强制下载紧急工具包 → 点绿色完成按钮零报错 → step4 1.8s 跳解锁 → 正确密码解锁
- [x] E2E 失败分支：密码错误 5 次锁定 60s → 解锁页 MM:SS 倒计时正常（Bug2 修完文字可见）
- [x] E2E 零知识审计：DevTools 检查 chrome.storage.local 6 关键词（password/pwd/master/dk/A3-/1p-unlock-verifier-v1）全 0 命中；仅 2 合法 key：__1p_meta__(saltHex/verifierB64/secretKeyMasked/accountEmail/650000) + __1p_vault_cipher__(Base64 密文 Blob)

---

### 任务5：v2.0 M2 阶段 — 密码生成器 + 24 分类 Item 编辑器 + Watchtower MVP（待启动，等待用户确认开发范围）
- **目标**: 复用 v1.1 纯原生 JS 密码+用户名生成器，封装为 React 组件；实现 24 分类 Item 编辑器模板；Watchtower MVP 纯本地弱密码/重复密码/熵值检测
- **状态**: 🔵 待启动（等待用户确认开发优先级 + 输出 M2 TDD 方案文档）
- **M2 初步规划 4 大子任务（TDD 详细方案等用户确认后输出）**:
  | 编号 | 子任务 | 说明 |
  |---|---|---|
  | M2-1 | 生成器 React 化 | v1.1 popup.html/css/js 的密码三模式 + 用户名三模式 → 封装为 `<PasswordGenerator />` + `<UsernameGenerator />` 两个受控组件，可嵌入 Item 编辑器「生成按钮」；原 v1.1 文件保留不动（DRY 原则，逻辑抽 shared/lib） |
  | M2-2 | Item CRUD + 列表展示 | HomeScreen 升级：左侧分类导航（24 分类 + 收藏 + 最近删除 + 全部）；右侧 Item 列表 + Search 框；点击 Item 弹出右侧抽屉编辑器 |
  | M2-3 | 24 分类编辑器模板 + Field 系统 | 24 个 ItemCategory 各自的默认字段集（login 6 字段/信用卡 12 字段/身份证 8 字段/银行账户 10 字段等）；Field type 系统（text/password/concealed/otp/creditcard/date/url 等）可新增自定义字段 |
  | M2-4 | Watchtower MVP（纯本地） | 复用 background 的 Watchtower 路由：(1) 熵<60bit 弱密码；(2) FNV1a 重复密码；(3) http:// 非加密 URL；(4) 密码 >365 天未改；4 色风险卡 + 受影响 Item 列表 |
  | M2-5 | Options 首页：保管库一键 JSON 导入/导出备份 | 导出 AES-256-GCM 加密 JSON（DK 加密，防止明文泄露）；导入支持同名 Item 去重（按 itemId 合并） |

