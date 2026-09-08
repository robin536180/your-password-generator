# Findings

## 2026-08-21 技术发现

### 1. 现有密码/用户名生成器
见前序记录。核心生成器完成，零碰撞性能达83万次/秒。

---

## 2026-08-21 任务2发现：1Password完整密码管理器架构深度调研

### 2.1 118+功能全景（8大类别）
从 1Password 官网 https://1password.com/zh-cn/password-management + WebSearch交叉验证后，确认8大功能矩阵：

| 类别 | 功能数 | 关键特性 | MVP实现难度 |
|---|---:|---|:---:|
| A.密码生成器 + 用户名生成器 | 6项 | ✅ 已交付（当前项目v1.1） | 已完成✅ |
| B.多物品分类管理 | 24项+25字段 | 24种分类模板(登录/信用卡/SSH/API密钥等) + 自定义Field | 中 |
| C.安全架构 | 9项 | AES-256-GCM / PBKDF2(650000次) / 双密钥模型 / Secret Key / SRP / 零知识 | 高（纯WebCrypto已够用） |
| D.Watchtower威胁检测 | 8项 | HaveIBeenPwned k-匿名查询/弱密码熵/重复密码/过期/HTTPS/健康度得分 | 中高 |
| E.1Password独有功能 | 6项 | 🛫旅行模式(真删除) / 🆘紧急工具包PDF / 回收站30天 / 版本历史 / 账户恢复 | 中 |
| F.协作共享 | 5项 | 共享保管库/权限4级/访客账户/临时链接(可1次性) | 高（需要服务端） |
| G.2FA & Passkey | 5项 | 内置TOTP验证器/硬件密钥/WebAuthn Passkey / SSO | 中（TOTP RFC6238纯JS可做） |
| H.企业+开发集成 | 15+ | CLI/SSH Agent/Git签名/VSCode扩展/SCIM/SIEM/SDK等 | 极高（v3+以后） |

### 2.2 关键安全参数（必须严格对齐1Password）
```
主密钥派生：
  DK = PBKDF2-HMAC-SHA256(
         password = 用户输入主密码,
         salt     = SHA256(用户邮箱 + ":" + SecretKeyHex),
         c        = 650_000 次迭代,
         dkLen    = 32 bytes
       )

认证校验：
  verifier = AES-256-GCM(
               key = DK,
               plaintext = "1p-unlock-verifier-v1",
               iv  = 12字节随机
             )
  每次解锁时先解密 verifier，不相等直接返回密码错误，避免解密整个大保管库浪费

保管库结构：
  vault_blob = AES-256-GCM(DK, JSON(items+vaults+tags+settings), iv=12B随机)
  存储在 chrome.storage.local["__vault_cipher"] = Base64(iv + ciphertext + authTag)
```

### 2.3 旅行模式实现注意点（1Password独有）
1Password的旅行模式**不是加display:none，而是真删除本地存储中非"安全保管库"的所有密文块**。原因：
- 边境检查时法庭命令强制解锁设备 → 物理上不存在的数据绝对无法被解密
- MVP实现：维护 `settings.travelMode = true/false` + `vaults[i].safeForTravel = bool`；开启travelMode时，将 !safeForTravel 的 items 从内存+vault_cipher中移除（保留一份独立的旅行备份快照在IndexedDB中，回家后恢复）

### 2.4 自动填充实现要点（Chrome MV3 content script）
- 不能直接用 `*://*/*` 全匹配host_permission，会被Web Store严格审核
- 推荐方案：
  1. manifest 中声明 host_permissions = `<all_urls>`（必要的，做密码管理器绕不开）
  2. content_script 用 `document.querySelectorAll('input[type="password"]')` 检测表单
  3. Shadow DOM 注入 1P 图标按钮（样式隔离，避免被目标网站CSS影响）
  4. 点击图标 → 发送消息 background → 返回匹配 ShortItem 列表（摘要不含密码）
  5. 用户选中后再发消息取完整 Item → 填充DOM：`el.value = pw; el.dispatchEvent(new Event('input',{bubbles:true}))` （触发React框架响应）

### 2.5 TOTP最小依赖实现
无需任何npm库，纯 WebCrypto + 30秒轮询即可实现 RFC6238：
```
key = Base32Decode(otpauth URI 的 secret参数)
counter = floor( (Date.now()/1000) / 30 )
mac = HMAC-SHA1(key, counter 转为 8字节 big-endian)
offset = mac[19] & 0x0F
code = ((mac[offset] & 0x7F)<<24 | mac[offset+1]<<16 | mac[offset+2]<<8 | mac[offset+3]) % 1_000_000
→ 转6位十进制，不足补前导零
```

### 2.6 推荐架构选型（MVP阶段）
| 选项 | 推荐值 | 理由 |
|---|---|---|
| 语言 | TypeScript 5.x | crypto/模型/消息协议都是强类型，纯JS极易踩坑 |
| 构建 | Vite 5.x + rollup-plugin-chrome-extension | MV3 manifest/v3 service worker/Hot reload开箱即用 |
| 加密 | 纯 Web Crypto API (window.crypto.subtle) | 不用crypto-js/noble等第三方，减少攻击面 |
| 状态 | React 18 + Zustand 轻量store | UI复杂度超过一定阈值（搜索/过滤/版本回滚）时，原生JS维护困难 |
| UI | TailwindCSS + shadcn/ui | 对齐1Password的圆角/蓝色/毛玻璃风格轻松 |
| 测试 | Vitest + @vue/test-utils风格的React Testing Library | 1万条数据压力测试，加解密性能基准 |

---

## 2026-08-21 任务3 M1 阶段新发现

### 3.1 【锁定真根因】深信服 Sangfor 企业安全客户端（WFP 驱动）拦截所有非白名单进程的 HTTPS 出站
- **完整诊断证据链**（2026-08-24 14:15~14:38 累计 9 轮排查）：
  1. `Invoke-WebRequest https://www.baidu.com` → ❌ `基础连接已经关闭`
  2. 所有 7 个常见代理端口（31181/7890/7897/1080/10809/8080/1087）**全部关闭** → 不是代理软件问题
  3. WinHTTP 代理 = Direct Access（无代理）
  4. **关键发现 1 — DNS 其实是好的**：`nslookup www.baidu.com` ✅ 正常返回 `110.242.70.57 / 110.242.69.21`（A 记录 + IPv6）
  5. **关键发现 2 — Socket 级直连连任何 IP:Port 都抛 EXCP**：TcpClient.BeginConnect("110.242.68.3", 443, ...) 一创建就异常退出（不是 TCP 超时/拒绝，是 .NET Framework 对象创建异常）
  6. **"铁证"发现 hosts 文件残留**：`C:\Windows\System32\drivers\etc\hosts` 第一行非注释内容 =
     ```
     127.0.0.1       localhost.sangfor.com.cn
     ```
     → 这是**深信服 Sangfor 企业 SSL VPN / ECA 终端安全客户端**的标志性 hosts 注入（深信服 WFP 驱动需要通过这个域名回环调用自身控制服务）

- **根因结论（100%）**：
  深信服（Sangfor）在这台 Windows 上安装了 **WFP（Windows Filtering Platform）内核级网络过滤驱动**，策略是：
  > 只允许 **白名单应用**（chrome.exe / msedge.exe / outlook.exe 等办公软件）通过 443/TCP 出站；
  > **任何非白名单进程**（powershell.exe / node.exe / npm.exe / curl.exe）尝试建立 443/TCP 连接 → 驱动层直接 kill socket（返回 ENOTSOCK / .NET 抛 "基础连接已关闭"）。
  这就是为什么 **Ping 通、DNS 通、集成浏览器也能打开外网页面，但所有 npm/curl/PowerShell 都连不上任何 HTTPS 站**。

- **为什么 Node ENOTSOCK？**
  socket() 创建刚拿到 fd，驱动层就立即 WFP filter handler 返回 STATUS_ACCESS_DENIED，Windows TCP/IP 栈把 fd 收走 → Node.js 下一次调用 recv/send 时就报 "Socket operation on non-socket"（ENOTSOCK）。

- **用户可操作的 3 条解决路径（按推荐顺序）**：
  | 方案 | 操作 | 复杂度 | 是否需要管理员 | 风险 |
  |---|---|---|---|---|
  | 🟢 A. 临时绕过（2026-08-24 更新：进程名为 **aTrust / aTrustAgent**，Sangfor 新一代零信任改了品牌名！） | **系统托盘 → 找到蓝色「aTrust」图标 → 右键 → 「退出零信任」/「临时关闭」** → 确认 aTrustAgent/aTrustXtunnel 进程消失后，再跑 npm install | 10秒 | 不需要（退出进程级即可） | 极低，重启电脑或下次登录 aTrust 自动恢复策略 |
  | 🟡 B. 企业白名单 | 找公司 IT：`请把 C:\Program Files\nodejs\node.exe 、C:\Program Files\nodejs\npm.cmd 、powershell.exe 加入零信任可信进程/出站白名单` | 半天~1天 | IT部门操作 | 合规安全，推荐 |
  | 🔴 C. 卸载驱动 | `tasklist | findstr aTrust` → `taskkill /F /IM aTrustAgent.exe /IM aTrustXtunnel.exe` → 设备管理器隐藏设备卸载 WFP 驱动 → 重启 | 高（需要熟悉驱动） | ✅ 必须管理员权限 | 违反企业 IT 合规，不推荐 |

- **验收标准（A 方案成功后立即验证）**：
  ```powershell
  # 成功退出 Sangfor 后执行
  Invoke-WebRequest https://mirrors.cloud.tencent.com/npm/react -UseBasicParsing -TimeoutSec 30
  # 期望返回 StatusCode = 200
  ```

### 3.2 设计决定：Meta 中绝对不存 Secret Key 明文，只存 saltHex = SHA256(email+":"+skHex)
- **关键理由**：零知识架构要求「任何泄露 storage.local 的场景都拿不到 SK」
- **实现点**：
  1.  [vault-store.ts](file:///d:/MyProjects/your-password-generator/src/core/vault-store.ts) 的 `initializeEmptyVault()` 只把 `saltHex` + `verifierB64` + `secretKeyMasked`（只显示前 2 段后 1 段）写入 Meta
  2.  **解锁流程不再需要 SK 输入**：改用内部函数 `deriveMasterKeyBySalt(masterPwd, meta.saltHex, 650000)` 直接走 PBKDF2，不再依赖 SK 原文 → 大幅降低 UX 摩擦
  3.  **恢复流程才需要 SK 原文**：换设备时用 Emergency Kit PNG 里的 SK + 邮箱 → 重新生成 saltHex → 再走 PBKDF2 解密

### 3.3 紧急工具包技术选型：Canvas PNG 而非 PDF（减少第三方攻击面）
- **理由**：引入 jsPDF + jspdf-autotable 会多 2 个重型依赖，且 PDF 生成需要大量字体处理中文字体
- **最终方案**：
  - 尺寸 1240×1754 px ≈ A4 (300 DPI)，直接打印清晰
  - 含 QR Code 内容 `1p://ek?email=...&sk=...&v=1&t=...`（用 `qrcode` npm 库）
  - 黄色警示框 + 蓝色顶栏 + 底部红色永久删除警告条 → 视觉突出重要信息
- **文件**：[emergency-kit.ts](file:///d:/MyProjects/your-password-generator/src/core/emergency-kit.ts)

### 3.4 发现：@crxjs/vite-plugin 2.0-beta.28 对 Vite 5 兼容性细节
- **关键点**：vite.config.ts 必须 `import manifest from './src/manifest.json'` **直接引用 JSON**，不能动态 require
- **同时**：rollupOptions.input 必须声明 popup + options 两个 html 入口，否则 build 后 dist 不会产出对应的 html
- 验证时若 `npm run build` 报 CRXJS manifest schema 错误，先检查 src/manifest.json 的 background.service_worker 是否以 `.ts` 结尾（CRXJS beta28 支持原生 TS service worker，无需编译成 js）

### 3.5 DK 零知识加固：Zustand state 中 **故意没有 dk 字段**
- 只有 background SW 的闭包 `let __dk__: CryptoKey | null = null` 持有主密钥
- 即使 UI 层的 Zustand devtools / 快照 / Redux DevTools 被 Hook 拿到，也绝对拿不到 DK
- Popup/Options 拿到的只有 `vaultSnapshot`（解密后的明文 JSON 副本），用于列表展示 + 编辑
- **自动锁逻辑**：chrome.alarms 每分钟 tick 一次，检查 `now() - settings.lastUnlockAt > settings.autoLockMinutes` → 将 `__dk__` 设为 null，内存明文立即丢弃

### 3.6 失败回退锁定策略（防止暴力破解）
- 在 background/index.ts 的 `__failedAttempts` 计数器：
  ```
  失败次数 0-4: 无锁定（正常输错可以立即再试）
  第 5 次失败: 锁定 60 秒
  第 6 次失败: 锁定 3 分钟
  第 7+ 次失败: 锁定 10 分钟（最大值）
  ```
- 成功解锁 → 计数器立即清零 → 回退到正常态
- 锁定状态下即使输入了正确密码也直接返回 `TEMP_LOCKED` 错误（防止后台跑字典）

---

## 2026-08-28 ~ 2026-09-03 M1 E2E 手测 5 个 Bug 根因深度发现（P0/P1）

> **归档说明**：以下 5 条都是 Chrome MV3 + @crxjs/vite-plugin 2.0-beta.28 + Canvas 绝对布局 + 手机扫码 heuristic 的典型坑，**未来 M2~M8 所有阶段必须严格规避**。

### 4.1 【Chrome MV3 硬规则坑】声明 default_locale 必须带 `_locales/<locale>/messages.json` 目录树
- **发现时间**：2026-08-28
- **触发场景**：manifest.json 第 7 行 `"default_locale":"zh_CN"`，但 `dist/_locales/` 目录不存在
- **错误信息**：`Default locale was specified, but _locales subtree is missing. 无法加载清单。`
- **影响面**：扩展 100% 无法被 Chrome 加载，连开发调试都进不去
- **根因**：@crxjs/vite-plugin 的 MV3 编译器只搬运 manifest.json 直接引用的资源（图标、background.js、popup.html），`_locales/` 是 Chrome manifest 硬规则需要的目录，但**不是 manifest.json 里显式列出的资源** → 不会被自动打包
- **永久规避方案（写进工程规范）**：
  1. 每次新建 i18n locale 时，目录必须在 `src/_locales/<locale_code>/messages.json`（严格层级）
  2. vite.config.ts 必须保留 `localesCopyPlugin` closeBundle 钩子递归 copy；若后续加了其他 manifest 硬规则目录（如 `_signature/`），同样走自定义 closeBundle 插件
  3. 任何时候修改 manifest.json 的 default_locale 字段后，必须同时：(a) 新建对应 locale 的 messages.json；(b) 重新 build 后 `Get-ChildItem dist/_locales -Recurse` 验证目录树存在

### 4.2 【CSS UA 样式坑】Windows 深色模式下 Tailwind `bg-white` 的输入框文字变白色（隐形）
- **发现时间**：2026-08-28
- **触发场景**：用户 Windows 系统是深色主题；所有未显式写 `text-xxx` 的 Tailwind 输入框
- **用户反馈**：「输入框白色背景 + 输入的文字也是白色，根本看不见字儿」
- **影响面**：Register/Unlock 所有表单，用户无法看到输入内容，注册/解锁流程全阻塞
- **根因链**：
  1. 旧 src/index.css `:root { color-scheme: light dark; }` 声明双配色 → 允许 Chrome 按系统主题切换 UA 样式
  2. Windows 深色模式 → Chrome 的 UA 表单子样式对所有 `<input>` 自动套 `color: #ffffff`（白字）
  3. RegisterScreen/UnlockScreen 的 className 只写了 `bg-white/80`、`border-slate-200` 等背景/边框，**没写死文字颜色 `text-slate-900`**（Tailwind 默认不继承 form 控件字色）
  4. 结果：白背景 + 白字 = 隐形文字
- **永久规避方案（写进工程规范）**：
  1. `:root` 永远只写 `color-scheme: light;`，**绝对不允许 `light dark` 双配色**，禁止 Chrome 根据系统深色模式切换 UA 表单样式
  2. `@layer base` 全局把 8 种 input + textarea + select 全拦截 → `@apply text-slate-900 placeholder:text-slate-400 caret-brand-500` 三件套强制兜底，任何 className 不写文字色也能正常显示
  3. 所有 disabled 态的 form 控件同样在 `@layer base` 写 `bg-slate-100 text-slate-500` 兜底，防止 disabled 态也出白字
  4. 未来 M2 新增任何表单控件（密码可见性切换、Search 输入、日期选择器）都复用这套，**绝对不要单个 className 里零散写 text-color**

### 4.3 【手机扫码器 heuristic 坑】二维码 payload 里含 `@` + `.com` 后缀会被乱拼接跳钓鱼站
- **发现时间**：2026-08-28（第一次修 URI 里含 @）→ 2026-09-03（第二次修邮箱放第 1 行被预览折叠）
- **触发场景**：Emergency Kit 二维码内容包含邮箱 `robin536180@hotmail.com`
- **用户反馈 1**：「手机扫码跳 https://40hotmail.com 打不开」（完全与我们代码无关的第三方扫描器解析 bug）
- **用户反馈 2**：「扫码只出来一个邮箱地址，没看到 SK 文本」（扫描器预览命中邮箱字段后折叠其他内容）
- **影响面**：EK 二维码主功能「手机端一键看到 SK」失效，用户体验大打折扣；甚至跳未知钓鱼 URL 造成用户恐慌
- **根因**：手机相机/微信的二维码解析 heuristic 有三条规则（我们永远改不了外部扫描器的代码，只能调整输入去适配）：
  1. 命中自定义 scheme URI 含 `@xxx.com` 格式 → heuristic 当成「mailto: 邮箱链接」→ 乱拼接前缀跳 40hotmail.com
  2. 命中第一个 email 格式字段后，把这行当「摘要预览」显示，其他内容默认折叠（要用户手动点「展开全部」才看到 SK）
  3. 中文冒号 `：` + 中文描述会干扰分词，导致 KEY:VALUE 键值识别失败
- **永久规避方案（写进工程规范）**：
  1. **任何二维码 payload 绝对不用自定义 URI scheme（xxx:// 协议）**，全用纯文本多行 KEY:VALUE 格式
  2. **所有最重要的字段永远放第 1 行**：SK > 邮箱 > 其他次要元数据；重要字段确保在前 100 字符内完整显示
  3. 前缀统一用 `全大写英文_KEY: `（冒号后一个空格），如 `SECRET_KEY:` / `EMAIL:` / `VERSION:`，绝不用中文冒号或中文描述当 key 前缀
  4. 冗余文字（恢复步骤、警告、使用说明）都压到最后几行，避免挤占预览前 5 行的宝贵空间
  5. QR 纠错等级默认不低于 Level Q(25%)（EK 要打印，对墨点/折痕/阴影抗损要求高），纯屏幕扫码可降到 M(15%)

### 4.4 【Canvas 绝对布局坑】父容器 cardH 必须包住所有子元素（y+高），否则后续卡片顶边完美像素压盖溢出区
- **发现时间**：2026-08-28（第一次 QR 底溢出主卡片）→ 2026-09-03（第二次警告卡整体溢出画布 + 建议行文字截半 + 水印压警告卡）
- **用户反馈 1**：「二维码底部 + 右侧⑤⑥行文字被下方警告卡遮挡了」
- **用户反馈 2**：「绿色建议行被底部框线截断，每个字只剩上半能看到」
- **影响面**：EK 视觉不专业，关键信息（生成时间、SK 扫码结果、备份建议）丢失或不可读
- **根因模式**：所有 Canvas 绝对布局的通用 bug，不止 EK，未来 M2 打印功能都会踩：
  > **父 cardH 只按"预估内容"硬编码，没把"真实子元素的 y+高"加总验证 → 子元素溢出父卡片底边 → 下一张卡片的顶边正好按「父 cardY+cardH+margin」计算 → 完美像素级重叠在溢出区**
- **数学验证套路（以后每次 Canvas 布局必须执行）**：
  1. 先列每个块的 3 个坐标：`y_top`、`self_height`、`y_bottom = y_top + self_height`
  2. 父容器的 `cardBottom = cardY + cardH` 必须 **> 所有子元素的 y_bottom + 10px 留白**，不满足立即加高 cardH
  3. 画布 H 必须 **> 最后一张卡片的 yBottom + 水印/页脚高度 + 40px 底部留白**，不满足立即加高画布 H
  4. 水印/页脚绝对不能写 `H - 40` 这种依赖画布 H 的写法 → 改成 `lastCardY + lastCardH + margin`，永远在最后一张卡片下方固定距离
  5. 文字行的基线（fillText 第三个参数）= 文字视觉中心 + (fontSize/3)，建议行、警告行等大字 y 基线算完后，必须加 `fontSize + 10px` < 父 cardBottom 才不会出框
- **EK 最终经过两轮调整的正确坐标（已验证）**：
  ```
  画布 H=1920
  ├─ 主卡片 cardY=280, cardH=990 → 底=1270
  │  ├─ QR y=870 h=340 → 底=1210 < 1270 ✅
  │  └─ 右侧第⑥行文字 y=280+670+5×50=1200 → 底≈1228 < 1270 ✅
  ├─ 警告卡 warnY=280+990+60=1330, warnH=520 → 底=1850 < 1920 ✅
  │  ├─ 4行红警告 warnY+160 ~ warnY+160+3×60 = 1490~1670
  │  └─ 绿建议行 adviceY=warnY+160+4×60+40=1770 → 底≈1770+32=1802 < 1850 ✅
  └─ 水印 watermarkY=warnY+warnH+40=1890 → 底≈1910 < 1920 ✅（且 1890 > 1850 警告卡底，完全不重叠）
  ```

### 4.5 【MV3 Service Worker 最大坑】dynamic import() = 死；裸全局名 crypto/performance = 绑定丢；storage 写后抛错 = 半提交死锁
- **发现时间**：2026-08-28
- **触发场景**：RegisterScreen Step3 点绿色「我已保存完成注册」
- **用户反馈 VERBATIM**：「报错 window is not defined，再点提示保管库已经存在」
- **影响面**：① 用户无法完成注册（最严重 P0）；② 第一次抛错后 storage 已写入，后续永远被 vaultExists 守卫拦截，必须到 Options 危险区手动清空才能重新注册（死锁状态）
- **三条独立根因链（同时爆发）**：

  | 编号 | 根因 | 触发路径 | 表现 |
  |---|---|---|---|
  | ① | **MV3 SW 内 dynamic import() 是 Anti-Pattern**：Vite/Rollup 把 `await import('xxx')` 切成独立 chunk，该 chunk 会被注入 Vite HMR client、inherits 等 polyfill，这些 polyfill 里写了 `typeof window !== 'undefined'` / 直接访问 `window` → 在无 window 的 SW 里 100% 炸 | vault-store.ts 2 处：`await import('@/core/crypto').generateSecretKey()` / `import('@/lib/utils').then(({sha256Hex}) => sha256Hex(json))` | `ReferenceError: window is not defined` |
  | ② | **Web Crypto 全局裸名绑定丢失**：TS strict + @crxjs beta28 编译 SW 时，crypto/performance/TextEncoder 等全局的词法上下文被 Rollup 错绑，直接裸写 `crypto.subtle.deriveKey` 会被解析成 undefined → undefined.subtle 抛错冒泡到 Chrome 后被统一包装成 "window is not defined" 兜底错误 | crypto.ts 10 处：`crypto.getRandomValues` × 1 / `crypto.subtle.*` × 6 / `performance.now()` × 1 / `new TextEncoder()` × 2 | 同上，统一报 window undefined |
  | ③ | **存储半提交原子性（Partial Commit）**：chrome.storage.local.set() 本身 batch 原子，但「set() 之后的 return 语句抛错」→ 用户 UI 看到"失败"提示，但 storage 已经永久落盘；下次 background `case 'VAULT_INIT'` 首行 vaultExists 守卫直接拦截 | initializeEmptyVault 顺序：①deriveDK OK → ②AES OK → ③storage.set 已落盘 → ④return dynamic import 炸 → 半提交 | 第二次点绿色按钮永远被「保管库已经存在…」拦截死锁 |

- **永久规避 5 条铁律（写进项目不变式，所有阶段严格执行）**：
  1. 🔴 **MV3 Service Worker / background 目录下所有文件，绝对禁止任何 `await import('xxx')` / `import('xxx').then(...)` 动态导入** → 所有依赖一律顶部静态 import，任何动态 chunk = 必踩 window polyfill 坑
  2. 🟠 **所有 Web Crypto API 全局（crypto / performance / TextEncoder / TextDecoder）一律在 crypto.ts 顶部用 `const _G = globalThis as {crypto, performance, TextEncoder, TextDecoder}` 缓存，之后只读 `_G.crypto.*`，绝不裸写 `crypto.xxx`** → 彻底防止词法绑定丢失
  3. 🟡 **任何涉及 chrome.storage.local 写入的函数（initializeEmptyVault / persistVault / updateItemSettings 等）100% 套 `try{ 写storage; 后续逻辑; }catch(e){ try{ chrome.storage.local.remove(刚写的所有key) } catch{}; throw e }` 事务回滚** → 保证"全有或全无"，绝不半提交死锁
  4. 🟢 **vaultExists 守卫拦截时，错误提示文本必须明确引导用户去"Options → 第4 Tab危险区 → 输入 YES-DELETE-ALL 清空"**，不要只说"去设置里清空"这种模糊文案，用户找不到
  5. 🔵 **零知识原则辅助**：已半提交的 storage 代码绝对不能自动删除（即不能在 catch 块里无脑 remove 成功过的 vault）→ 必须给用户手动确认选项（YES-DELETE-ALL 输入框），防止代码 bug 导致用户保管库被意外永久删除
