# Progress

## 2026-08-21 进度记录（全天）

### 阶段1-6：用户名生成器功能整合 ✅ （上午交付）
- 完成状态：GetDiagnostics 0报错 / AST语法0错误 / 2.1万断言0失败 / 1万次碰撞0重复 / 83万次/秒吞吐
- 交付版本：项目 v1.1

---

### 阶段7：1Password密码管理器功能全面调研 ✅
- **时间**: 16:50-17:10
- **操作**:
  1. `integrated_browser` 打开 `https://1password.com/zh-cn/password-management` → 完整snapshot 228 refs写入文件
  2. 读取快照全文件683行，抽取导航/6大产品特性slide/FAQ/7类下载平台
  3. WebSearch × 10条查询补充：功能矩阵/安全架构细节/旅行模式机制/TOTP/Passkey/企业对比表/价格版本
- **结果**:
  - 118+功能点全部梳理，归为8大类
  - 6大企业/个人版本（个人$2.99/家庭$4.99/Teams$19.95/商业$7.99/XAM）全部比对
  - 安全参数确认：PBKDF2 650000次、AES-256-GCM、Secret Key 128bit

### 阶段8：技术方案设计输出 ✅
- **时间**: 17:11-17:50
- **产出文档内容（11章节）**:
  1. 八大功能类别总览对比表（个人/家庭/商业版本勾选对比）
  2. 118+完整功能点明细表（A-H共8个板块，A.主界面/B.项目编辑器/C.生成器已完成/D.自动填充/E.Watchtower/F.2FA&Passkey/G.安全架构/H.独有功能/I.共享/J.企业/K.开发/L.多端）
  3. 整体架构图（Mermaid graph TD，客户端/MVP存储层/未来服务层/安全核心4色块）
  4. 注册/解锁时序图（双场景：首次初始化+日常解锁，含verifier校验分支）
  5. 自动填充业务流程图（16节点flowchart TD，Content Script + Background + UI三态）
  6. 数据库Schema设计：chrome.storage顶层JSON + Item 20字段 + Vault + Field类型系统 + 24分类枚举
  7. 20个内部API消息协议（chrome.runtime.sendMessage动作清单+日志分级）
  8. MVP 8阶段甘特图（M1安全底座→M2项目CRUD→M3生成器+自动填充→M4 Watchtower→M5 2FA&Passkey→M6高阶→M7服务端→M8测试发布）
  9. 新增13模块文件清单（与现有5文件对照）
  10. 2.6节选型推荐：TS+Vite+React+Zustand+Tailwind+shadcn/ui+WebCrypto纯实现
- **字数估算**: 方案正文约 2.3 万字（不含代码块）

### 阶段9：项目文档归档 ✅
- **时间**: 17:51-18:00
- **操作**: 更新 .harness 目录三文档
  - task_plan.md：任务1（用户名整合）+ 任务2（密码管理器方案）双任务结构，末尾4项待办确认
  - findings.md：6小节架构发现（2.2 安全参数原文可直接当开发规范 / 2.4 自动填充React事件触发要点 / 2.5 TOTP算法伪代码）
  - progress.md：全天9阶段时间线回溯

---

## 📌 下一步（等待用户决策）

**推荐启动顺序建议**（开发优先级Top-5）：
1. ✅ **确认范围**：M1核心安全底座开始（推荐）还是跳过解锁流程先做「纯UI项目CRUD+现有生成器集成」？
2. ✅ **语言栈**：TypeScript + React 重构建体系 或 继续纯原生JS快速MVP？
3. ✅ **旅行模式**：MVP是否需要这一独有功能？
4. ✅ **共享/协作**：先不做服务端，纯本地模式启动？
5. ✅ **Watchtower外部API**：初期本地熵值检测 / 接HaveIBeenPwned k-匿名API？

收到您的确认后，立即按甘特图 M1（核心安全底座，4天）启动开发！

---

## 2026-08-21 M1 核心安全底座（全天下午交付）

### 阶段10：M1-1 构建体系初始化 ✅
- **时间**: 用户决策 A 方案后立即启动
- **操作**: 一次性创建 5 个核心配置文件
  1. [package.json](file:///d:/MyProjects/your-password-generator/package.json) v2.0.0-m1：18个依赖（React18/Zustand4/lucide/qrcode/clsx + TS5/Vite5/CRXJSbeta28/Tailwind3.4/Vitest2/jsdom）
  2. [tsconfig.json](file:///d:/MyProjects/your-password-generator/tsconfig.json)：strict=true / noUnusedLocals=true / paths:@/* → src/* / 含 chrome/node/vitest types
  3. [vite.config.ts](file:///d:/MyProjects/your-password-generator/vite.config.ts)：`@crxjs/vite-plugin` manifest 热重载 + rollup双入口(popup/options) + build target chrome120
  4. [tailwind.config.js](file:///d:/MyProjects/your-password-generator/tailwind.config.js)：brand.500=#0061ff brand.700=#202a51（和 v1.1 深蓝完全一致） + watchtower 5色系统 + font-sans 中文PingFang/YaHei回退
  5. [postcss.config.js](file:///d:/MyProjects/your-password-generator/postcss.config.js)：标准 tailwindcss + autoprefixer
- **阻塞问题立即解决**: vite.config.ts 第一行 `import manifest from './src/manifest.json'` → 当时 src/manifest.json 还不存在会立即 build 报错 → 阶段11提前创建

### 阶段11：M1-2 目录结构设计 + manifest迁移 + utils工具库 ✅
- **创建 src/ 目录树（4个核心目录）**:
  - `src/core/`    → 加密 / 存储 / 紧急包 / 日志 （真正的安全中心）
  - `src/screens/` → UI 大组件：注册屏 / 解锁屏 / 主Home
  - `src/store/`   → Zustand 状态机（不含DK！）
  - `src/types/`   → models（业务模型）+ ipc（消息协议）
  - `src/lib/`     → utils 通用工具
  - `src/background/` → Service Worker（闭包持有 DK）
  - `src/popup/` + `src/options/` → 两个 entry 入口
- **新增文件**:
  1. [src/manifest.json](file:///d:/MyProjects/your-password-generator/src/manifest.json) — MV3 manifest v3，background.service_worker=src/background/index.ts，popup=src/popup/index.html，options=src/options/index.html
  2. [src/lib/utils.ts](file:///d:/MyProjects/your-password-generator/src/lib/utils.ts) — uuidv4/Base64/textEncode/sha256Hex/entropyBits/cn/sleep

### 阶段12：M1-3 核心加密模块 crypto.ts + 日志系统 logger.ts ✅
- **crypto.ts** 关键实现点：
  - `generateSecretKey()` → 1000 次无碰撞；格式 `A3-XXXX-XXXX-XXXX-XXXX`（去掉 I/O/0/1 避免人眼混淆）
  - `deriveMasterKey()` → **严格对齐 findings.md 2.2 规范**：
    ```
    salt = SHA256(email + ":" + Hex(SK))
    DK = PBKDF2-HMAC-SHA256(pwd, salt, 650_000, 32B)
    CryptoKey extractable=false（永远导不出！）
    ```
  - `encryptAesGcm` / `decryptAesGcm` → [iv 12B][CT...][AuthTag 16B] 拼接 → Base64
  - `makeVerifier` / `verifyDk` → 加密固定明文 `"1p-unlock-verifier-v1"` 做快速密码正确性验证
- **logger.ts**：INFO/WARN/ERROR/DEBUG 四级 + 内存环形 Buffer 1000 条（Options 页面可查看）

### 阶段13：M1-4 数据层 models.ts + vault-store.ts ✅
- **models.ts 24 种 ItemCategory**：login/credit-card/identity/bank-account/.../crypto-wallet/custom/password-history
- **Field 类型系统 13 种**：text/password/concealed/email/url/tel/date/monthYear/creditcard/textarea/otp/file + 各自 metadata
- **存储结构**（严格零知识）：
  ```
  chrome.storage.local = {
    __1p_meta__:        { saltHex, verifierB64, pbkdf2Iterations, secretKeyMasked, accountEmail }  // 明文 Meta
    __1p_vault_cipher__: Base64(AES-256-GCM(DK, JSON({ items, vaults, tags, settings, deleted }))) // 密文 Blob
  }
  ```
- **vault-store.ts API**:
  - `initializeEmptyVault(pwd, email, sk?)` → 首注册
  - `unlockVault(pwd)` → 内部走 deriveBySaltHex（不需要 SK 明文）
  - `persistVault(dk, vault, meta)` → 每次修改必须重加密（换 IV）
  - Item CRUD: addItem / updateItem（乐观锁 version++） / trashItem / restoreItem / deleteItem（永久）

### 阶段14：M1-5 紧急工具包 emergency-kit.ts ✅
- **纯 Canvas 2D 实现，不引入 jsPDF**
- 输出 PNG 1240×1754 px（≈A4 300DPI）：
  - 顶部 🔐 蓝色渐变横幅
  - 白色卡片：邮箱 / 黄色高亮 SK 大字体 / QR Code（qrcode 库生成）+ 右侧5步操作指引
  - 底部红色永久删除警告区：4 项"✗ 绝对禁止行为" + 1 项"✓ 推荐备份方式"
- `downloadEmergencyKit(blob, email)` 强制触发浏览器下载

### 阶段15：M1-6 Zustand 状态机 + IPC 消息协议 ✅
- **types/ipc.ts 20 个 Action 枚举强类型**（VAULT_×7 / ITEM_×11 / VAULT_×2 / TAG_×2 / SETTINGS_×2 / WATCHTOWER_×1）
- **vaultStore.ts 零知识原则**：
  - 故意 **没有 dk 字段**，DK 永远在 Background 闭包里
  - 状态只有 status(UNINIT/LOCKED/UNLOCKED) + meta + vaultSnapshot(明文快照) + failedAttempts + lockedUntil
  - `ipcCall<T>(action, payload)` 带 requestId + 60s 超时 + 日志链路
  - 每次 IPC 返回时自动乐观更新 snapshot（如 updateItem 后列表立即重绘）

### 阶段16：M1-7 三大 UI Screen + popup/options 入口 ✅
1. **RegisterScreen.tsx** 4 步流程：
   - Step1：邮箱校验 + 主密码强度条 5 色（极弱/弱/中等/强/极强，单位 bits，≥60bit才能下一步） + 二次确认
   - Step2：系统生成 SK → 黄色大警示框 + 大字 monospace 显示
   - Step3：生成 Emergency Kit PNG → 强制下载 → 预览缩略图 → 勾选框"我已保存"阻塞
   - Step4：成功绿色动画 + 自动跳解锁
2. **UnlockScreen.tsx**：深蓝渐变卡片 + 剩余尝试次数显示 + 失败 N 次后锁定倒计时（分:秒 MM:SS 动态刷新）
3. **HomeScreen.tsx（M1 MVP）**：
   - 蓝色渐变顶栏 + 锁定按钮
   - 3 张统计卡（总项目 / 收藏 / 回收站）
   - 安全设置大卡（自动锁/剪贴板清空/PBKDF2迭代/旅行模式/版本号）
   - 绿色 零知识状态确认卡（session ID 显示，便于日志追踪）
4. **OptionsApp.tsx 大管理页**：4 Tab 首页 / 设置 / 日志 / 危险区（YES-DELETE-ALL 清空 storage.local）
5. **popup/App.tsx**：根据 store.status 路由 → 注册/解锁/Home（420x560 小窗）

### 阶段17：M1-8 Background Service Worker + Vitest 测试 ✅
- **background/index.ts 闭包级 DK 持有**：
  - `let __dk__: CryptoKey | null = null;` 其他一律访问不到
  - chrome.runtime.onInstalled / onStartup 钩子 → 每次启动清零（DK 自动消失）
  - `chrome.alarms.create('__1p_autolock_tick__', {periodInMinutes:1})` 每分钟心跳检查自动锁
  - 失败 5/6/7+ 次 → 回退锁定 60s / 3min / 10min（防暴力破解）
  - 完整 **20 个 Action switch-case 路由**：VAULT_* 7个 / ITEM_* 11个 / VAULT_CREATE + VAULT_LIST / TAG_LIST & CREATE / SETTINGS_GET & UPDATE / WATCHTOWER_SCAN
  - Watchtower MVP 纯本地：FNV1a 内存哈希匹配重复密码 / 熵<60bit弱密码 / http:// URL / 密码一年未改
- **Vitest 单元测试 test/vitest/1-crypto.test.ts**：
  1. T1：Secret Key 1000 次无碰撞 + 合法格式
  2. T2：PBKDF2 派生确定性（同密码+邮箱+SK → 同 salt → 交叉加解密）
  3. T3：AES-GCM 往返（中文字符 + emoji + 长文本 100× 重复）+ 篡改 1bit 必抛异常
  4. T4：Verifier 双 DK 验证（正确 true，错误密码派生的 bad DK false）
  5. T5：**10000 条加密+解密压测**（验收标准：总耗时 <3s）
- **test/vitest/setup.ts**：jsdom 下 chrome.storage.local / alarms / runtime 完整 mock（内存 HashMap 实现）

### 阶段18：M1-9 npm install 与构建验证 ✅（2026-08-27 完成）
- **根因解决（.harness/findings.md 3.1 已更新）**：
  - 真因：深信服 Sangfor 新一代零信任客户端「aTrust」（进程 aTrustAgent×2 + aTrustXtunnel×2）通过 WFP 内核驱动按进程白名单放行 443/TCP，node.exe/npm.exe 不在白名单内 → `ENOTSOCK`
  - 用户侧退出 aTrust 托盘后网络打通，npm install + node_modules 就绪（隐性成功：tsc 类型解析 31 错误无 1 条来自模块找不到）
- **构建验证 4 连全通过（M1 最后一个里程碑 ✅）**：

| 命令 | 耗时/产出 | 关键结果 |
|---|---|---|
| `npm run typecheck` (tsc --noEmit strict) | 即时 | **31→0 错误全清**（类型修复清单见 findings.md 3.2） |
| `npm run build` (tsc → vite build) | 4.96s | **0 错误 0 warning**，产出 dist/ 18 个文件：manifest.json + icons×4 + popup/options HTML/JSX + background service worker + assets(JS×5 / CSS×1) |
| `npm run test -- --run` (Vitest jsdom) | 4.10s（2.10s 实际测试）| **Test Files 1 passed, Tests 5 passed**： |
|  ↳ T1 SecretKey 1000 生成 | | ✅ 无碰撞 + 格式合法 |
|  ↳ T2 PBKDF2 确定性 | 85ms × 2 次 | ✅ saltHex 一致 + 交叉加解密 OK |
|  ↳ T3 AES-GCM 往返 + 篡改必失败 | 80ms + 长文本 100× | ✅ 中文字符/emoji/空字符全部通过；篡改 1 位 DOMException |
|  ↳ T4 Verifier 双 DK 验证 | 80ms + 80ms | ✅ 正确 DK true，错误 DK false |
|  ↳ **T5 10000 次加解密压测（硬标准<3000ms）** | **1579.8ms** | ✅ **平均 0.158ms/轮，优于标准 47%**（1.58s < 3s） |
| `GetDiagnostics (App.tsx)` | | 0 错误 |

- **0 错误的 31 项类型修复概要（.harness/findings.md 3.2 记录详情）**：
  1. store/vaultStore.ts：ipcCall action 参数 `extends infer A → never` 错误 → 改 `VaultAction \| (string & {})`；Item 改从 models.ts 导入
  2. types/ipc.ts：VaultMessage 联合类型缺 `VAULT_PERSIST` → 补 case；DeletedItem 未用移除
  3. background/index.ts：5 处未使用导入（DeletedItem/STORAGE_KEYS/deriveMasterKeyBySalt/sha256Hex/CRYPTO_CONFIG）删除
  4. core/vault-store.ts：L119 dk 解构未用 → `void`；L187-195 `...partial` 覆盖前值 → 移除前 3 行重复赋值
  5. lib/utils.ts：globalThis.crypto 类型守卫后被 TS 推断 never → 改 `(globalThis as any).crypto` + try/any cast
  6. UI 3 屏：ShieldLock 图标不存在 → ShieldCheck；LogOut/ShieldHalf 未用删除；options payload unknown → `!!e.payload &&` 转 boolean
  7. vite.config.ts：manifest JSON 不匹配 ManifestV3Export → `as unknown as ManifestV3Export`；test.setupFiles 路径 `test/setup.ts` → `test/vitest/setup.ts`
  8. test/vitest/1-crypto.test.ts：deriveMasterKeyBySalt 实际在 vault-store.ts 导出 → 改 import from `@/core/vault-store`

→ **M1 阶段 9 大里程碑代码全部达标，进入 E2E 手测 Bug 修复阶段。**

---

## 2026-08-28 ~ 2026-09-03 M1 E2E 手测 Bug 修复（5 个 P0/P1 Bug 全闭环）

### 阶段19：Bug1 Manifest Default Locale 清单加载失败 ✅
- **触发时间**：2026-08-28 用户首次 chrome://extensions 加载 dist
- **报错 VERBATIM**：`Default locale was specified, but _locales subtree is missing. 无法加载清单。`
- **根因**：MV3 硬规则：manifest.json 声明 `"default_locale":"zh_CN"` 后 **必须存在 `_locales/<locale_code>/messages.json` 目录树**；但 dist/ 目录下根本没有 `_locales/`，因为 @crxjs/vite-plugin 不会自动搬运非 manifest 直接引用的目录
- **修复操作 4 连**：
  1. 新建 [src/_locales/zh_CN/messages.json](file:///d:/MyProjects/your-password-generator/src/_locales/zh_CN/messages.json) 4 键 i18n（extName/extShortName/extDescription/extActionTitle）
  2. 新建 [src/_locales/en/messages.json](file:///d:/MyProjects/your-password-generator/src/_locales/en/messages.json) 同 4 键英文翻译
  3. [src/manifest.json](file:///d:/MyProjects/your-password-generator/src/manifest.json) name/short_name/description/action.default_title → 4 个 `__MSG_extXxx__` 占位符
  4. [vite.config.ts](file:///d:/MyProjects/your-password-generator/vite.config.ts) 新增 `localesCopyPlugin('dist')` 自定义 Vite 插件 — closeBundle 钩子递归 copy `src/_locales/**` → `dist/_locales/**`；build 日志输出 `[copy-locales] ✅ copied _locales → dist\_locales`
- **用户确认**：VERBATIM「可以了」 → 扩展加载成功，立即进入 Bug2

### 阶段20：Bug2 输入框白底白字看不见 ✅
- **触发时间**：2026-08-28 Bug1 修完紧接着
- **用户反馈 VERBATIM**：「现在输入框是白色的背景色，输入框输入的文字也是白色，根本看不见字儿」
- **根因**：Windows 系统深色模式下，Chrome 的 User Agent 样式会给所有 `<input>` 自动套「白字」；但 Register/Unlock Screen 的 className 只覆写了 `bg-white/80`（白色背景），**没写死文字颜色** → 白字 + 白底 = 隐形文字
- **修复文件**：[src/index.css](file:///d:/MyProjects/your-password-generator/src/index.css)
- **修复代码 4 处**：
  1. `:root { color-scheme: light; }` —— 禁掉 dark，Chrome 不再自动套 UA 白字表单样式
  2. `body { color:#0f172a; background:#f8fafc; }` —— 默认正文深黑，背景浅灰，全局兜底
  3. `@layer base` 拦截全部 8 种 input + textarea + select → `@apply text-slate-900 placeholder:text-slate-400 caret-brand-500`（文字深黑 / placeholder 浅灰 / 光标品牌蓝，三件套永保可见）
  4. disabled 态兜底：`@apply text-slate-500 bg-slate-100 cursor-not-allowed`
- **构建验证锚点**：dist CSS 产物 3 锚点全部 True → color-scheme:light / #0f172a 存在 / #0061ff brand 光标蓝存在
- **用户确认**：未再反馈输入框问题 → 已验证通过

### 阶段21：Bug3 Emergency Kit QR 扫码跳 40hotmail.com 钓鱼站 ✅
- **触发时间**：2026-08-28 第一次注册成功下载 EK 后手机扫码
- **用户反馈 VERBATIM**：「手机扫码也打开的地址是 https://40hotmail.com，打不开」附 EK 截图（邮箱 robin536180@hotmail.com）
- **根因（与代码无关的扫描器 heuristic bug）**：旧 QR payload = `1p://ek?email=robin536180@hotmail.com&sk=A3-...` 自定义 URI 协议**含 `@` 字符 + 邮箱域名后缀** → 手机相机/微信二维码解析 heuristic 把 `robin536180@hotmail.com` 误判成「邮箱/网址」，乱拼接前缀 → 跳 40hotmail.com（完全是外部扫描器的解析 bug，与我们的代码无责任关系）
- **修复**：[emergency-kit.ts L120-L131](file:///d:/MyProjects/your-password-generator/src/core/emergency-kit.ts#L120-L131) 二维码内容从 9 行自定义 URI 协议 → **5 行纯文本 + KEY:VALUE 大写前缀 + SK 放最前**：
  ```
  SECRET_KEY: A3-XXXX-XXXX-XXXX-XXXX   ← 第1行！手机扫码预览直接命中 SK 而非邮箱
  EMAIL: xxx@hotmail.com
  VERSION / CREATED_AT / 恢复说明（不跳网页提示）
  ```
- **升级**：QR Error Correction Level M(15%) → Q(25%) 抗打印折痕/墨点/拍照阴影
- **第一轮修完后补充问题**：用户反馈（9月3日）仍只看到邮箱 → 扫描器预览还有第二个 heuristic：「命中第一个邮箱格式字段就折叠其他」→ 再把邮箱移到第 2 行，SK 第 1 行强制前置，精简内容到 5 行确保前 100 字符内完整显示 SK
- **最终用户确认（2026-09-03）**：VERBATIM「3 项都 OK」中第 2 项 → 扫码预览首行直接显示完整 SECRET_KEY: A3-XXXX...，不再跳任何网页

### 阶段22：Bug4 Emergency Kit 二维码底部 + 右侧⑤⑥行被警告卡遮挡 ✅（两次调整）
- **第一次修复（2026-08-28）**：
  - 用户反馈 VERBATIM 附肉眼截图：「最下边的二维码部分和右侧的文字，被下放的框内文字遮挡住了」
  - 像素级数学根因：`cardH=860` 不够 → QR y=870 高 340，底=1210 **> 主卡片底 1140，溢出 70px**；warnY=280+860+60=**1200** 正好压在 QR 溢出区 + 右侧第⑤(y=1150)/第⑥(y=1200)行完美像素重叠
  - 第一次调：cardH=860→990（+130px）、画布 H=1754→1860（+106px）、warnY 按 cardY+cardH+60 动态算
- **第二次修复（2026-09-03 用户继续反馈）**：
  - 用户反馈 VERBATIM：「这行字现在被底部框线截断了挡住了半行字，每个字都只有一半能看到」
  - 像素级数学二次根因：第一次调 canvasH=1860 没真生效（实际代码仍写 H=1754）→ warnY=1330 + warnH=460 → 警告卡底=**1790 > 画布 H=1754，溢出 36px**（警告卡底部框线本身就超出了画布）；绿色建议行 y=1750，32px 粗体底部到 1768>1754 溢出 14px = 半行字看不见；水印 H-40=1714 还压在警告卡内部重叠
  - 最终修复 4 项（画布+警告卡+文字 y+水印）：
    | 对象 | 修改前（坏） | 修改后（好） |
    |---|---|---|
    | 画布 H | 1754 | **1920**（+166px，保证警告卡+建议行+水印+留白100%装进去） |
    | 警告卡 warnH | 460 | **520**（+60px，装 4 行红警告 + 1 行绿建议 + 底部留白） |
    | 绿建议行 y | warnY+160+4×60+20=1750 | **adviceY = warnY+160+4×60+40 = 1770**（在警告卡内部，1770+32 < 1850 警告卡底） |
    | 水印 watermarkY | H-40=1714（压警告卡内） | **warnY+warnH+40 = 1890**（警告卡下方 40px 留白之后，完全不重叠） |
- **最终用户确认（2026-09-03）**：VERBATIM「3 项都 OK」中第 1 项 → 绿色建议行 100% 完整、警告卡框线完整、水印在警告卡下方不重叠

### 阶段23：Bug5 注册「我已保存完成注册」按钮 window is not defined + 二次点击「保管库已存在」半提交 ✅
- **触发时间**：2026-08-28 第一次完整注册 Step3 点绿色按钮
- **用户反馈 VERBATIM**：「当我点击『我已保存，完成注册』按钮的时候，报错：window is not defined，再次点击提示：保管库已经存在，如需重新开始请先在设置里清空。看看为什么报错」
- **双独立错误链根因**：
  | 报错 | 根因链 |
  |---|---|
  | `window is not defined` | 链 ① MV3 Service Worker **全局对象是 self/globalThis，完全没有 window** → vault-store.ts 用了 2 处 `await import('xxx')` 动态导入 → Vite/@crxjs 编译时切成独立 chunk，chunk 被注入 Vite HMR 残余 / inherits polyfill（含 window 引用）→ 立即 ReferenceError；链 ② crypto.ts 裸写 crypto/performance/TextEncoder() 共 10 处 → @crxjs 在 SW 编译后对这些全局名的**词法绑定上下文错了**，变量解析失败冒泡成 Chrome 统一的 "window is not defined" 兜底错误 |
  | 「保管库已存在」拦截 | **半提交原子性问题（Partial Commit）**：执行顺序 = ① deriveDK OK → ② AES OK → ③ chrome.storage.local.set({meta, cipher}) **已 commit 落盘** → ④ return 行 dynamic import 抛错 → 用户看到「失败」但 storage 里两个 key 已永久写入；第二次点击 background `case 'VAULT_INIT'` 第一行 `if(vaultExists()) return wrapErr('保管库已经存在…')` 守卫直接拦截 |
- **修复 3 个核心文件**：
  1. [src/core/crypto.ts](file:///d:/MyProjects/your-password-generator/src/core/crypto.ts) FULL REWRITE：顶部 `const _G = globalThis as {crypto, performance, TextEncoder, TextDecoder}` 统一缓存，所有 10 处 crypto.* / performance.now() / new TextEncoder() 全部替换成 `_G.*` → 彻底防止词法绑定丢失
  2. [src/core/vault-store.ts](file:///d:/MyProjects/your-password-generator/src/core/vault-store.ts) FULL REWRITE：① 顶部静态 import generateSecretKey+sha256Hex+uuidv4+nowMs，彻底删除 2 处 dynamic import（SW 里禁任何 `import('xxx')` chunk）；② initializeEmptyVault 整个函数 `try{...}catch(err){ await chrome.storage.local.remove([META, VAULT_CIPHER]); throw err }` 事务回滚，**任何失败都「全有或全无」，绝不半提交**
  3. 零知识原则辅助：历史留下的半提交 meta/cipher 不能自动删（非用户主动确认绝不删存储）→ 提供 Options 危险区 `YES-DELETE-ALL` 手动清空流程，UI 指导用户操作
- **最终验证流程 4 步（2026-09-03 用户 VERBATIM「4步全过」）**：
  1. Reload扩展 → Options 危险区 YES-DELETE-ALL 清空上次半提交 storage ✅
  2. 重新注册到 Step3 → 点绿色「✅ 我已保存完成注册」→ **零报错** ✅
  3. Step4 绿色对勾卡显示 1.8s → 自动跳解锁页 ✅
  4. 零知识审计（F12 Application Local Storage 搜 6 关键词：password/pwd/master/dk/A3-/1p-unlock-verifier-v1）→ **全部无命中** ✅；只能看到 `__1p_meta__`（明文 saltHex/verifierB64/secretKeyMasked/accountEmail/pbkdf2Iterations=650000）+ `__1p_vault_cipher__`（Base64 密文 Blob）

→ **M1 阶段 9 大里程碑 + 5 个 E2E 手测 Bug 全部 100% 闭环通过用户验收。下一阶段：M2 启动（密码生成器 React 组件 + 24 分类 Item 编辑器 + Watchtower MVP 弱密码检测）**

---

## 2026-10-27 M3 收尾：TOTP UI + HIBP 泄露检测 + 生成器独立入口

### 阶段24：TOTP 接入字段 UI ✅
- **操作**: `src/components/FieldRenderer.tsx` 新增 `TotpField` 组件，替换原 `case 'otp'`
- **实现**: 每秒调用 `totpNow()` 刷新 6/8 位码；SVG 圆环按 `remaining/period` 计算 `strokeDasharray`；复制后 20s 自动清剪贴板；编辑模式可折叠展开种子输入
- **验证**: typecheck / build / vitest 三验全绿，用户真机确认「Ok 了」

### 阶段25：HIBP k-匿名泄露检测 ✅
- **新增** `src/core/hibp.ts`：
  - `sha1HexUpper()`：`crypto.subtle.digest('SHA-1')` → 40 位大写 hex
  - `checkPasswordPwned()`：只把前 5 位发往 `api.pwnedpasswords.com/range/{prefix}`，带 `Add-Padding: true`，10s 超时 AbortController，本地比对剩余 35 位
  - `scanBreachedPasswords()`：只扫未删除项目的 `type==='password'` 字段 → `Set` 去重 → 3 并发 worker → 单请求失败只计 `failedPasswords` 不中断 → 结果按泄露次数降序
  - 日志仅输出统计数字（密码数/命中数/失败数/耗时），**绝不含明文密码**
- **manifest**: 新增最小 `host_permissions: ["https://api.pwnedpasswords.com/*"]`
- **UI**: `WatchtowerPanel` 新增「暗网泄露扫描（HIBP）」卡片：扫描按钮 / 中止按钮 / 进度条 / 4 指标（已检查/命中/失败/耗时）/ 命中列表（点击直接打开编辑抽屉）

### 阶段26：Options 新增「生成器」Tab ✅
- `OptionsTab` 增 `'generator'`，Tabs 数组在「项目」与「标签」之间插入「生成器」
- 新增 `GeneratorPanel`：密码生成器 / 用户名生成器双入口（复用 `PasswordGenerator` / `UsernameGenerator`），右侧附使用建议
- 两个生成器组件新增 `hideInsert` 属性：独立入口时隐藏无意义的「插入」按钮，Item 编辑器内行为不变
- 同步更新页头副标题（移除「M2 完整 CRUD 版本」表述）
- **三验结果**: `tsc --noEmit` exit 0 → `vite build` exit 0（1678 modules，options chunk 49.28 kB，dist 内已含 pwnedpasswords）→ `vitest run` 4 文件 17 用例全通过

### 阶段27：Passkey（B）可行性调研 ✅（结论：不做）
- Chrome 扩展无法注册为系统级 Passkey Provider：`chrome.webAuthenticationProxy` 仅面向 ChromeOS 企业设备管理场景
- 1Password 能实现是因为操作系统级集成，非扩展能力
- 用户决策（VERBATIM）：`跳过，只做 C + 生成器（推荐）`

---

## 2026-10-28 生成器「免登录 + 前台上移」改造

### 阶段28：公开生成器独立页面 + 多入口曝光 ✅
- **新增页面三件套**（与保管库零耦合）：
  | 文件 | 作用 |
  |---|---|
  | `src/generator/index.html` | 公开页入口，标题「公开密码生成器（免登录）」 |
  | `src/generator/main.tsx` | 页面引导（不引入任何 Store / Screen） |
  | `src/generator/App.tsx` | `PublicGeneratorApp`：密码 / 用户名双模式，支持 `compact` 紧凑版供 popup 复用 |
- **访问入口（前台上移）**：
  1. 独立页面 `chrome-extension://<扩展ID>/src/generator/index.html`（可直接收藏/固定标签页）
  2. popup 未解锁/未初始化时顶部新增「保管库登录 / 免登录生成器」双 Tab，游客可原地生成
  3. Options 未初始化/锁定页在注册/解锁卡片下方新增「免登录 · 公开密码生成器」入口卡
  4. Options 页头常驻「公开生成器」按钮；「生成器」Tab 内标注「前台公开页（免登录）」链接 → 前台可用、后台可管
- **多入口注册**：`vite.config.ts` rollupOptions.input 新增 `generator`；构建产物 `dist/src/generator/index.html` 仅预加载 generator / utils / 生成器组件 chunk，**不含 vault-store chunk**（Grep 校验：generator 相关 chunk 无 `VAULT_EXISTS` / `__1p_meta__` / `__1p_vault_cipher__`）
- **兼容性测试** `test/vitest/10-public-generator.test.ts`（14 用例）：
  - 静态隔离：`src/generator/*` 不含 useVaultStore / ipcCall / vaultStore / UnlockScreen / RegisterScreen / chrome.storage
  - 部署入口：页面三件套存在 + vite 已注册 generator 入口
  - 输出准确性：随机密码长度/字符集/500 次无重复、PIN 仅数字、易记密码词数与首字母大写、用户名三模式（随机/易记/自定义前后缀）
- **三验结果**：`tsc --noEmit` exit 0 → `vite build` exit 0（1681 modules，含 generator 页面）→ `vitest run` 5 文件 **31/31 通过**

---

## 2026-10-28 生成器接入国密算法 + 自定义算法

### 阶段29：国密（SM3/SM4）与自定义算法模式 ✅
- **时间**：2026-10-28
- **操作**：
  1. 校验依赖 `sm-crypto@0.5.8`（MIT / integrity 通过 / npm 已安装）→ `package.json` 与 `package-lock.json` 改为精确版本 `0.5.8`
  2. 新增 `src/types/sm-crypto.d.ts`：该库无自带类型，声明实际使用的 SM3 / SM4 接口
  3. 新增 `src/shared/generators/gm.ts`：SM3-HMAC 字节流、SM4 分组密钥流（IV 由 SM3 派生）、拒绝采样字节→字符映射、模板派生
  4. `src/shared/generators/password.ts` 扩展 `gm` / `custom` 两模式；`utils.ts` 的 `PWD_MODE_CFG` 增加长度区间
  5. `src/components/PasswordGenerator.tsx` 模式 Tab 扩到 5 个，新增引擎切换、种子、盐值、迭代、字符集、模板、前后缀控件
  6. 新增 `test/vitest/11-gm-generator.test.ts`（20 用例）
- **关键实现**：
  - 确定性：种子 + 盐值 + 计数器 + 参数一致 → 输出一致；「重新生成」仅递增计数器
  - 随机等价：种子留空时取 128bit `crypto.getRandomValues`
  - 均匀性：`byte < floor(256/n)*n` 才接受，避免取模偏置
- **三验结果**：`tsc --noEmit` exit 0 → `vite build` exit 0 → `vitest run` 6 文件 **51/51 通过**（新增 20 用例）
- **变更目录**：`.harness/changes/feature_gm_algorithm_20261028/summary.md`

---

## 2026-11-03 项目列表内一键复制

### 阶段30：列表行快捷复制用户名 / 密码 ✅
- **操作**：`src/screens/HomeScreen.tsx`
  1. 新增模块级 `pickUsernameValue` / `pickPasswordValue`：purpose → 字段类型 → 标签正则三级定位
  2. 组件内新增 `copiedKey` 状态与 `copyValue`：复制成功 Toast + 1.5s 对勾 + 20s 后清空剪贴板
  3. 列表行右侧新增用户 / 钥匙两个复制按钮（回收站行不渲染，缺少字段也不渲染）
- **三验结果**：`tsc --noEmit` exit 0 → `vite build` exit 0 → `vitest run` 6 文件 **51/51 通过**
- **变更目录**：`.harness/changes/feature_list_quick_copy_20261103/summary.md`

---

## 2026-11-04 打包发布流程梳理 + 清理外层 v1.1 老代码

### 阶段31：清理 v1.1 遗留老代码 + 修复打包脚本 ✅
- **删除的外层老代码（6 个，均不再被 v2.0 构建引用）**：
  | 文件 | 说明 |
  |---|---|
  | `manifest.json`（根目录） | v1.1 版，`default_popup: popup.html`，与 `src/manifest.json`（v2.0）冲突 |
  | `popup.html` / `popup.css` / `popup.js` | v1.1 原生 JS 三件套 |
  | `words.js` | v1.1 词典（已被 `src/shared/generators/words.ts` 替代） |
  | `test/generator.test.js` | v1.1 旧测试（vitest 只跑 `test/**/*.test.ts(x)`，该 .js 不在范围内） |
- **清理过时文案**：`src/options/App.tsx` 安全参数卡移除「v1.1 popup.js/css/html 根目录三件套 0 行修改」说明
- **修复打包脚本（关键问题）**：原 `pack` 脚本 `cd dist && bestzip ../release/$npm_package_name-v$npm_package_version.zip .` 在 Windows（cmd.exe）下 `$npm_package_name` 不展开，会产出字面量文件名 `$npm_package_name-v$npm_package_version.zip`
  - 改为 `node scripts/pack.mjs`：读取 `package.json` 动态拼 zip 名，跨平台；打包前 `rmSync(dist/.vite)` 排除 vite 构建元数据
  - 验证产物 `release/1password-clone-v2.0.0-m1.zip`：23 条目、根目录含 `manifest.json`、不含 `.vite`
- **README**：补齐开发/构建/打包/发布（Chrome Web Store）说明
- **三验结果**：`tsc --noEmit` exit 0 → `vitest run` 7 文件 **55/55 通过** → `build + pack` 产出干净 zip

### 阶段32：新增 CRX 签名打包能力 ✅
- **新增** `scripts/pack-crx.mjs`：调用本机 Chrome `--pack-extension`（CRX3）完成签名
  - 自动探测 Chrome（`Program Files` / `Program Files (x86)` / `LOCALAPPDATA` / macOS / Linux），支持 `CHROME_PATH` 覆盖
  - 首次打包自动生成并落盘 `release/<name>-key.pem`；后续复用同一私钥 → 扩展 ID 稳定
  - 打包前清理 `dist.crx` / `dist.pem` 残留，避免误用旧产物
  - 由私钥 `SPKI DER` 的 SHA-256 前 16 字节推导扩展 ID（nibble → a-p）
- **新增命令**：`npm run pack:crx`
- **安全**：`.gitignore` 增加 `*.pem` / `*.crx`，私钥不入库
- **实测验证**：
  | 项 | 结果 |
  |---|---|
  | 产物 | `release/1password-clone-v2.0.0-m1.crx`（155,596 字节，CRX3） |
  | CRX 头 | `magic=Cr24 version=3 headerSize=581` |
  | 扩展 ID | 脚本输出 `imlpnogiekigmngdnmjiibkaaphfaiih`，与 CRX header 内 `crx_id`（`8cbfde684a86cd63dc9881a00f750887`）映射结果**完全一致** |
- **README**：补充 CRX 打包流程、私钥保管要求、安装限制（Chrome 默认拦截非商店来源）与手动打包方式
