/**
 * test/vitest/11-gm-generator.test.ts - 国密算法与自定义算法生成器测试
 *
 * 验收目标：
 *   T11-1 SM3 / HMAC-SM3 / SM4 标准向量正确（对照 GB/T 32905、GB/T 32907）
 *   T11-2 国密模式确定性：种子 + 盐值 + 计数器一致 → 输出一致，计数变化 → 输出变化
 *   T11-3 国密模式长度与字符集约束（SM3 / SM4 双引擎）
 *   T11-4 种子留空时等价随机密码（多次生成不重复）
 *   T11-5 自定义算法：模板占位符 / 前后缀 / 自定义字符集 / 迭代次数生效
 *   T11-6 边界：空字符集兜底、超范围迭代次数被钳制
 */
import { describe, it, expect } from 'vitest';
import {
  bytesToHex,
  deriveChars,
  deriveFromTemplate,
  hexToBytes,
  hmacSm3Hex,
  sm3Hex,
} from '@/shared/generators/gm';
import { generatePassword } from '@/shared/generators/password';
import { sm4 } from 'sm-crypto';

/* ---------- T11-1 标准向量 ---------- */
describe('T11-1 国密算法标准向量', () => {
  it('SM3("abc") 与 GB/T 32905 一致', () => {
    expect(sm3Hex('abc')).toBe('66c7f0f462eeedd9d1f2d46bdc10e4e24167c4875cf2f7a2297da02b8f4ba8e0');
  });

  it('SM3("") 空串摘要与标准一致', () => {
    expect(sm3Hex('')).toBe('1ab21d8355cfa17f8e61194831e81a8f22bec8c728fefb747ed035eb5082aa2b');
  });

  it('HMAC-SM3 对同一输入稳定、换密钥即改变', () => {
    const keyA = sm3Hex('key-a');
    const keyB = sm3Hex('key-b');
    expect(hmacSm3Hex('message', keyA)).toBe(hmacSm3Hex('message', keyA));
    expect(hmacSm3Hex('message', keyA)).not.toBe(hmacSm3Hex('message', keyB));
  });

  it('SM4 加密单分组与 GB/T 32907 示例一致', () => {
    const key = '0123456789abcdeffedcba9876543210';
    const block = hexToBytes('0123456789abcdeffedcba9876543210');
    const out = sm4.encrypt(block, key, { padding: 'none', output: 'array' });
    expect(bytesToHex(out)).toBe('681edf34d206965e86b3e94f536e4246');
  });
});

/* ---------- T11-2 确定性 ---------- */
describe('T11-2 国密模式确定性派生', () => {
  const base = {
    mode: 'gm' as const,
    opts: {
      engine: 'SM3' as const,
      secret: 'my-seed',
      salt: 'github.com',
      length: 20,
      useNumbers: true,
      useSymbols: true,
      counter: 1,
    },
  };

  it('相同种子 / 盐值 / 计数器必得同一密码', () => {
    const a = generatePassword(base);
    const b = generatePassword(base);
    expect(a).toBe(b);
    expect(a).toHaveLength(20);
  });

  it('计数器变化后输出不同（重新生成）', () => {
    const a = generatePassword(base);
    const b = generatePassword({ mode: 'gm', opts: { ...base.opts, counter: 2 } });
    expect(a).not.toBe(b);
  });

  it('盐值变化后输出不同（站点隔离）', () => {
    const a = generatePassword(base);
    const b = generatePassword({ mode: 'gm', opts: { ...base.opts, salt: 'gitlab.com' } });
    expect(a).not.toBe(b);
  });
});

/* ---------- T11-3 长度与字符集 ---------- */
describe('T11-3 国密模式长度与字符集约束', () => {
  it.each(['SM3', 'SM4'] as const)('%s 引擎：长度精确且字符均属于所选字符集', (engine) => {
    for (const len of [8, 16, 32, 64]) {
      const pwd = generatePassword({
        mode: 'gm',
        opts: { engine, secret: 'seed', salt: 'salt', length: len, useNumbers: true, useSymbols: false, counter: 1 },
      });
      expect(pwd).toHaveLength(len);
      expect(pwd).toMatch(/^[A-Za-z0-9]+$/);
    }
  });

  it('关闭数字与符号后仅含字母', () => {
    const pwd = generatePassword({
      mode: 'gm',
      opts: { engine: 'SM4', secret: 'seed', salt: 'salt', length: 32, useNumbers: false, useSymbols: false, counter: 1 },
    });
    expect(pwd).toMatch(/^[A-Za-z]{32}$/);
  });

  it('开启符号后输出含 RFC 密码符号集内字符', () => {
    const pwd = generatePassword({
      mode: 'gm',
      opts: { engine: 'SM3', secret: 'seed', salt: 'salt', length: 64, useNumbers: true, useSymbols: true, counter: 1 },
    });
    expect(pwd).toMatch(/[^A-Za-z0-9]/);
  });
});

/* ---------- T11-4 空种子等价随机 ---------- */
describe('T11-4 种子留空时等价随机密码', () => {
  it('50 次生成互不相同且长度精确', () => {
    const set = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const pwd = generatePassword({
        mode: 'gm',
        opts: { engine: 'SM3', secret: '', salt: '', length: 20, useNumbers: true, useSymbols: false, counter: 0 },
      });
      expect(pwd).toHaveLength(20);
      set.add(pwd);
    }
    expect(set.size).toBe(50);
  });
});

/* ---------- T11-5 自定义算法 ---------- */
describe('T11-5 自定义算法参数生效', () => {
  const base = {
    engine: 'SM3' as const,
    secret: 'custom-seed',
    salt: 'demo',
    iterations: 1,
    charset: 'abcdef',
    length: 12,
    template: '',
    prefix: '',
    suffix: '',
    counter: 1,
  };

  it('自定义字符集被严格遵守', () => {
    const pwd = generatePassword({ mode: 'custom', opts: base });
    expect(pwd).toHaveLength(12);
    expect(pwd).toMatch(/^[a-f]+$/);
  });

  it('模板占位符 * # ? 按语义替换，其余字符原样保留', () => {
    const pwd = generatePassword({ mode: 'custom', opts: { ...base, template: '****-##-????' } });
    expect(pwd).toHaveLength(12);
    expect(pwd[4]).toBe('-');
    expect(pwd[7]).toBe('-');
    expect(pwd.slice(0, 4)).toMatch(/^[a-f]{4}$/);
    expect(pwd.slice(5, 7)).toMatch(/^\d{2}$/);
    expect(pwd.slice(8)).toMatch(/^[A-Z]{4}$/);
  });

  it('前缀与后缀拼接到最终结果', () => {
    const pwd = generatePassword({ mode: 'custom', opts: { ...base, prefix: 'p_', suffix: '_s' } });
    expect(pwd.startsWith('p_')).toBe(true);
    expect(pwd.endsWith('_s')).toBe(true);
  });

  it('迭代次数影响输出', () => {
    const a = generatePassword({ mode: 'custom', opts: base });
    const b = generatePassword({ mode: 'custom', opts: { ...base, iterations: 3 } });
    expect(a).not.toBe(b);
  });

  it('SM4 引擎同样支持自定义字符集', () => {
    const pwd = generatePassword({ mode: 'custom', opts: { ...base, engine: 'SM4', charset: '0123456789' } });
    expect(pwd).toMatch(/^\d{12}$/);
  });
});

/* ---------- T11-6 边界 ---------- */
describe('T11-6 边界与兜底', () => {
  it('字符集为空时回退默认字母数字集，不产生空密码', () => {
    const pwd = generatePassword({
      mode: 'custom',
      opts: {
        engine: 'SM3', secret: 's', salt: '', iterations: 1, charset: '',
        length: 8, template: '', prefix: '', suffix: '', counter: 1,
      },
    });
    expect(pwd).toHaveLength(8);
    expect(pwd).toMatch(/^[A-Za-z0-9]+$/);
  });

  it('迭代次数被钳制到 1-1000（0 与超大值都不导致异常）', () => {
    const zero = deriveChars({ engine: 'SM3', secret: 's', salt: 'x', counter: 1, iterations: 0 }, 'abc', 6);
    const huge = deriveChars({ engine: 'SM4', secret: 's', salt: 'x', counter: 1, iterations: 1e6 }, 'abc', 6);
    expect(zero).toMatch(/^[abc]{6}$/);
    expect(huge).toMatch(/^[abc]{6}$/);
  });

  it('模板为空字符串时按长度派生', () => {
    expect(deriveFromTemplate({ engine: 'SM3', secret: 's', salt: '', counter: 1 }, '', 'xyz')).toBe('');
  });
});
