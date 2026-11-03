/**
 * test/vitest/10-public-generator.test.ts - 免登录（游客）生成器功能兼容性测试
 *
 * 验收目标：
 *   T10-1 静态隔离：公开生成器页面源码不得依赖保管库 / 登录链路 / 本地存储
 *   T10-2 部署入口：vite 多入口已注册 src/generator/index.html，页面三件套齐全
 *   T10-3 随机密码：长度 / 字符集 / 500 次无重复（未登录下输出准确）
 *   T10-4 PIN：仅数字 + 长度精确
 *   T10-5 易记密码：词数与首字母大写规则准确
 *   T10-6 用户名三模式：随机 / 易记 / 自定义前缀后缀
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { generatePassword } from '@/shared/generators/password';
import { generateUsername } from '@/shared/generators/username';

const ROOT = process.cwd();
const GEN_DIR = join(ROOT, 'src/generator');

/* ---------- T10-1 静态隔离 ---------- */
describe('T10-1 公开生成器与登录链路完全解耦（静态断言）', () => {
  const files = readdirSync(GEN_DIR).filter((f) => /\.(ts|tsx)$/.test(f));

  it('生成器目录至少包含 main.tsx 与 App.tsx', () => {
    expect(files).toContain('main.tsx');
    expect(files).toContain('App.tsx');
  });

  it.each(files)('%s 不引用保管库 / IPC / 解锁注册 / 本地存储', (file) => {
    const code = readFileSync(join(GEN_DIR, file), 'utf8');
    // 禁止出现任何登录态或存储耦合（浏览器扩展页面可用的 chrome.runtime 除外）
    expect(code).not.toMatch(/useVaultStore/);
    expect(code).not.toMatch(/ipcCall/);
    expect(code).not.toMatch(/vault-store|vaultStore/);
    expect(code).not.toMatch(/UnlockScreen|RegisterScreen/);
    expect(code).not.toMatch(/chrome\.storage/);
  });
});

/* ---------- T10-2 部署入口 ---------- */
describe('T10-2 公开生成器部署路径与多入口注册', () => {
  it('页面三件套齐全（index.html / main.tsx / App.tsx）', () => {
    for (const f of ['index.html', 'main.tsx', 'App.tsx']) {
      expect(existsSync(join(GEN_DIR, f))).toBe(true);
    }
  });

  it('vite build 已注册 generator 多入口（否则产物缺失）', () => {
    const cfg = readFileSync(join(ROOT, 'vite.config.ts'), 'utf8');
    expect(cfg).toMatch(/src\/generator\/index\.html/);
  });
});

/* ---------- T10-3 随机密码 ---------- */
describe('T10-3 随机密码输出准确性（免登录直调）', () => {
  it('长度精确 20，且必含大写/小写/数字/符号', () => {
    for (let i = 0; i < 100; i++) {
      const pwd = generatePassword({
        mode: 'random',
        opts: { length: 20, useNumbers: true, useSymbols: true },
      });
      expect(pwd).toHaveLength(20);
      expect(pwd).toMatch(/[a-z]/);
      expect(pwd).toMatch(/[A-Z]/);
      expect(pwd).toMatch(/[0-9]/);
      expect(pwd).toMatch(/[^A-Za-z0-9]/);
    }
  });

  it('关闭数字选项后不出现数字', () => {
    for (let i = 0; i < 50; i++) {
      const pwd = generatePassword({
        mode: 'random',
        opts: { length: 16, useNumbers: false, useSymbols: false },
      });
      expect(pwd).toHaveLength(16);
      expect(pwd).toMatch(/^[A-Za-z]+$/);
    }
  });

  it('500 次生成无重复', () => {
    const set = new Set<string>();
    for (let i = 0; i < 500; i++) {
      set.add(generatePassword({ mode: 'random', opts: { length: 20, useNumbers: true, useSymbols: true } }));
    }
    expect(set.size).toBe(500);
  });
});

/* ---------- T10-4 PIN ---------- */
describe('T10-4 PIN 输出准确性', () => {
  it('仅数字且长度精确（3 / 6 / 12）', () => {
    for (const len of [3, 6, 12]) {
      for (let i = 0; i < 50; i++) {
        const pin = generatePassword({ mode: 'pin', opts: { length: len } });
        expect(pin).toHaveLength(len);
        expect(pin).toMatch(new RegExp(`^\\d{${len}}$`));
      }
    }
  });
});

/* ---------- T10-5 易记密码 ---------- */
describe('T10-5 易记密码词数与大小写规则', () => {
  it('4 词组合 → 3 个连字符、4 段', () => {
    const pwd = generatePassword({
      mode: 'memorable',
      opts: { wordCount: 4, capitalize: false, useFullWords: true },
    });
    expect(pwd.split('-')).toHaveLength(4);
  });

  it('开启首字母大写后每段首字母为大写', () => {
    const pwd = generatePassword({
      mode: 'memorable',
      opts: { wordCount: 5, capitalize: true, useFullWords: true },
    });
    for (const seg of pwd.split('-')) {
      expect(seg).toMatch(/^[A-Z]/);
    }
  });
});

/* ---------- T10-6 用户名三模式 ---------- */
describe('T10-6 用户名三模式输出准确性', () => {
  it('随机模式长度精确 8 且必含大小写', () => {
    for (let i = 0; i < 50; i++) {
      const u = generateUsername({ mode: 'random', opts: { length: 8, useNumbers: false, useSymbols: false } });
      expect(u).toHaveLength(8);
      expect(u).toMatch(/[a-z]/);
      expect(u).toMatch(/[A-Z]/);
    }
  });

  it('易记模式 4 段', () => {
    const u = generateUsername({ mode: 'memorable', opts: { wordCount: 4, capitalize: false, useFullWords: true } });
    expect(u.split('-')).toHaveLength(4);
  });

  it('自定义模式保留前后缀并匹配中间长度', () => {
    const u = generateUsername({
      mode: 'custom',
      opts: { midLength: 12, midUseNumbers: true, midUseSymbols: false, prefix: 'user_', suffix: '_dev' },
    });
    expect(u.startsWith('user_')).toBe(true);
    expect(u.endsWith('_dev')).toBe(true);
    expect(u.length).toBe('user_'.length + 12 + '_dev'.length);
  });
});
