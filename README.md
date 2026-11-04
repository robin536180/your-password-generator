# 1Password Clone（Chrome MV3 密码管理器）

基于 TypeScript + React + Vite + @crxjs/vite-plugin 的 Chrome MV3 扩展，提供本地零知识加密的密码保管库、密码/用户名生成器、TOTP、瞭望塔风险检测等功能。

## 技术栈

- TypeScript 5 + React 18 + Vite 5 + @crxjs/vite-plugin（MV3）
- Tailwind CSS + Zustand
- Web Crypto（PBKDF2 650,000 次 + AES-256-GCM）+ 国密 SM3/SM4

## 常用命令

```bash
npm install          # 安装依赖
npm run dev          # 开发模式（Vite HMR）
npm run typecheck    # TypeScript 类型检查
npm run test         # Vitest 单元测试
npm run build        # 类型检查 + 构建产物到 dist/
npm run pack         # 将 dist/ 打包为发布 zip（release/<name>-v<version>.zip）
npm run pack:crx     # 将 dist/ 打包为签名 CRX（release/<name>-v<version>.crx）
```

## 本地调试

1. `npm run build`
2. 打开 Chrome → `chrome://extensions`
3. 右上角开启「开发者模式」
4. 点击「加载已解压的扩展程序」，选择项目根目录下的 `dist/` 文件夹

## 打包发布

1. 确保版本号正确：`src/manifest.json` 的 `version` 字段（与 `package.json` 保持一致）
2. 执行 `npm run build`，产物输出到 `dist/`
3. 执行 `npm run pack`，生成 `release/1password-clone-v2.0.0-m1.zip`

`npm run pack` 会：

- 自动读取 `package.json` 的 `name` / `version` 生成 zip 文件名（跨平台，已修复原脚本在 Windows 下 `$npm_package_name` 不展开的问题）
- 自动排除 `dist/.vite` 构建元数据，保证 zip 根目录即 `manifest.json`

### 发布到 Chrome Web Store

1. 将 `release/` 下的 zip 上传到 [Chrome Web Store 开发者控制台](https://chrome.google.com/webstore/devconsole)（需一次性 $5 开发者注册费）
2. 填写商店信息、隐私政策、截图后提交审核
3. 审核通过后即可上架；企业内部可走「私密发布」或自托管 CRX

## 打包为 CRX

```bash
npm run build
npm run pack:crx
```

产物：

| 文件 | 说明 |
|---|---|
| `release/1password-clone-v2.0.0-m1.crx` | CRX3 签名包 |
| `release/1password-clone-key.pem` | RSA 私钥，**首次打包自动生成，必须长期备份** |

要点：

- 脚本调用本机 Chrome 的 `--pack-extension` 完成签名，无需额外工具；找不到 Chrome 时可用 `CHROME_PATH` 环境变量指定
- **扩展 ID 由私钥决定**：复用同一个 `.pem` 才能保持扩展 ID 不变，已安装用户可原地升级；丢失私钥等于换了一个新扩展
- `.pem` / `.crx` 已加入 `.gitignore`，切勿提交到仓库
- Chrome 默认拦截非商店来源的 CRX 安装。本地验证推荐「加载已解压的扩展程序」指向 `dist/`；企业内分发可通过组策略 `ExtensionInstallAllowlist` / `ExtensionSettings` 白名单放行

### 手动方式（不使用脚本）

打开 `chrome://extensions` → 开启开发者模式 → 点击「打包扩展程序」→ 扩展程序根目录选 `dist/`，私钥文件首次留空 → 生成 `.crx` 与 `.pem`。
