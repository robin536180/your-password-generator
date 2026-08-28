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

→ **M1 阶段 9 大里程碑全部达标（代码 + 类型 + 构建 + 加密压测）。下一阶段 M2：集成 v1.1 密码+用户名生成器到 Item 编辑器 + 24 分类模板 + E2E 手测流程**
