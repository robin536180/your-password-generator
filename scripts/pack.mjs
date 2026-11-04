/**
 * scripts/pack.mjs - 将 dist/ 打包为发布用 zip（跨平台，替代原 pack 脚本的 $npm_package_name 展开问题）
 *
 * 用法：npm run pack
 * 产物：release/<name>-v<version>.zip
 */
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import bestzip from 'bestzip';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const releaseDir = join(root, 'release');
mkdirSync(releaseDir, { recursive: true });

const distDir = join(root, 'dist');
// 去掉 vite 构建元数据，避免把非扩展资源打进发布包
rmSync(join(distDir, '.vite'), { recursive: true, force: true });

const destination = `../release/${pkg.name}-v${pkg.version}.zip`;

// bestzip 内部会优先用系统 zip 命令，否则回退到 Node 实现；cwd 切到 dist，source 为当前目录
const zip = typeof bestzip === 'function' ? bestzip : (bestzip?.bestzip ?? bestzip?.zip);
await zip({
  source: '.',
  destination,
  cwd: distDir,
});

console.log(`✅ 打包完成：${join(releaseDir, `${pkg.name}-v${pkg.version}.zip`)}`);
