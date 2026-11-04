/**
 * scripts/pack-crx.mjs - 将 dist/ 打包为 Chrome 扩展签名包（.crx）
 *
 * 用法：npm run pack:crx（需先 npm run build）
 * 产物：release/<name>-v<version>.crx
 * 密钥：release/<name>-key.pem（首次自动生成，务必长期保管且不要提交到仓库）
 *
 * 原理：调用本机 Chrome 的 --pack-extension 生成 CRX3 签名包。
 *   - 首次打包（无 pem）→ Chrome 生成新私钥，扩展 ID 由此私钥决定
 *   - 后续打包复用同一 pem → 扩展 ID 保持不变，已安装用户可原地升级
 */
import { createHash, createPrivateKey, createPublicKey } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const distDir = join(root, 'dist');
const releaseDir = join(root, 'release');
const keyPath = join(releaseDir, `${pkg.name}-key.pem`);
const crxOut = join(releaseDir, `${pkg.name}-v${pkg.version}.crx`);

if (!existsSync(join(distDir, 'manifest.json'))) {
  console.error('❌ 未找到 dist/manifest.json，请先执行 npm run build');
  process.exit(1);
}

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  join(process.env['ProgramFiles'] ?? '', 'Google/Chrome/Application/chrome.exe'),
  join(process.env['ProgramFiles(x86)'] ?? '', 'Google/Chrome/Application/chrome.exe'),
  join(process.env['LOCALAPPDATA'] ?? '', 'Google/Chrome/Application/chrome.exe'),
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

const chromePath = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!chromePath) {
  console.error('❌ 未找到 Chrome，可设置环境变量 CHROME_PATH 指向 chrome 可执行文件');
  process.exit(1);
}

mkdirSync(releaseDir, { recursive: true });

// Chrome 会把 <dir>.crx / <dir>.pem 生成到 dist 的父目录，先清理避免拿到旧产物
const chromeCrx = join(root, 'dist.crx');
const chromePem = join(root, 'dist.pem');
rmSync(chromeCrx, { force: true });
if (!existsSync(keyPath)) rmSync(chromePem, { force: true });

const args = [`--pack-extension=${distDir}`];
if (existsSync(keyPath)) args.push(`--pack-extension-key=${keyPath}`);
args.push('--no-message-box');

console.log(`🔧 使用 Chrome：${chromePath}`);
console.log(`🔑 私钥：${existsSync(keyPath) ? keyPath : '（首次打包，将新建密钥）'}`);

try {
  execFileSync(chromePath, args, { stdio: 'inherit' });
} catch {
  // Chrome 打包完成后返回值不稳定，产物存在即视为成功，下面统一校验
}

if (!existsSync(chromeCrx)) {
  console.error('❌ 打包失败：未生成 dist.crx');
  process.exit(1);
}

if (!existsSync(keyPath) && existsSync(chromePem)) {
  renameSync(chromePem, keyPath);
  console.log(`🔐 已保存私钥：${keyPath}（请备份，丢失后无法生成相同扩展 ID）`);
}

rmSync(chromePem, { force: true });
renameSync(chromeCrx, crxOut);

// 由私钥推导扩展 ID：取公钥 SubjectPublicKeyInfo(DER) 的 SHA-256 前 16 字节，每个 nibble 映射为 a-p
const pem = readFileSync(keyPath, 'utf8');
const publicKey = createPublicKey(createPrivateKey(pem));
const der = publicKey.export({ type: 'spki', format: 'der' });
const hash = createHash('sha256').update(der).digest('hex').slice(0, 32);
const extensionId = [...hash].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');

console.log(`✅ CRX 打包完成：${crxOut}`);
console.log(`🆔 扩展 ID：${extensionId}`);
console.log('⚠️  安装提示：Chrome 默认阻止安装非商店来源的 CRX；本地验证请改用「加载已解压的扩展程序」指向 dist/');
