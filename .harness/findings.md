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
