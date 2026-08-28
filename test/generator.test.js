/**
 * test/generator.test.js — 核心生成函数单元测试（纯逻辑，不依赖浏览器DOM）
 * 运行方式：在项目根目录下执行 `node test/generator.test.js`
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// ============ 加载 words/syllables 词典数据（复用 words.js） ============
// 注意：words.js 使用 const 声明，需通过 IIFE 包装提取导出
const wordsJsPath = path.resolve(__dirname, '..', 'words.js');
const wordsJsRaw = fs.readFileSync(wordsJsPath, 'utf8');
const extractor = new Function(`${wordsJsRaw}; return { words, syllables };`);
const dict = extractor();
const words = dict.words;
const syllables = dict.syllables;
assert.ok(words && words.length > 50, `words 数组长度不足: ${words && words.length}`);
assert.ok(syllables && syllables.length > 50, `syllables 数组长度不足: ${syllables && syllables.length}`);
console.log(`✅ 词典加载成功: words=${words.length} 个, syllables=${syllables.length} 个`);

// ============ 通用工具 & 字符集（和 popup.js 保持一致） ============
const CHARSET = {
  LOWER:   'abcdefghijklmnopqrstuvwxyz',
  UPPER:   'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  NUMBERS: '0123456789',
  SYMBOLS: '!@#$%^&*()_+~`|}{[]:;?><,./-='
};
const getRandomInt = (max) => Math.floor(Math.random() * Math.max(1, max));

// ============ 以下函数完全复制自 popup.js 的生成逻辑（保持100%一致） ============

// 密码: random
function generateRandomPassword(length, useNum, useSym) {
  const { LOWER, UPPER, NUMBERS, SYMBOLS } = CHARSET;
  let chars = LOWER + UPPER;
  const guaranteed = [LOWER[getRandomInt(LOWER.length)], UPPER[getRandomInt(UPPER.length)]];
  if (useNum) { chars += NUMBERS; guaranteed.push(NUMBERS[getRandomInt(NUMBERS.length)]); }
  if (useSym) { chars += SYMBOLS; guaranteed.push(SYMBOLS[getRandomInt(SYMBOLS.length)]); }
  let pwd = '';
  for (let i = guaranteed.length; i < length; i++) pwd += chars[getRandomInt(chars.length)];
  pwd += guaranteed.join('');
  return pwd.split('').sort(() => 0.5 - Math.random()).join('');
}
// 密码: memorable
function generateMemorablePassword(count, capitalize, fullWords) {
  const source = fullWords ? words : syllables;
  const parts = [];
  for (let i = 0; i < count; i++) {
    let w = source[getRandomInt(source.length)] || '';
    if (capitalize && w.length) w = w.charAt(0).toUpperCase() + w.slice(1);
    parts.push(w);
  }
  return parts.join('-');
}
// 密码: PIN
function generatePinPassword(length) {
  const { NUMBERS } = CHARSET;
  let pwd = '';
  for (let i = 0; i < length; i++) pwd += NUMBERS[getRandomInt(NUMBERS.length)];
  return pwd;
}
// 用户名: random
function generateRandomUsername(length, useNum, useSym) {
  const { LOWER, UPPER, NUMBERS, SYMBOLS } = CHARSET;
  let chars = LOWER + UPPER;
  const guaranteed = [LOWER[getRandomInt(LOWER.length)], UPPER[getRandomInt(UPPER.length)]];
  if (useNum) { chars += NUMBERS; guaranteed.push(NUMBERS[getRandomInt(NUMBERS.length)]); }
  if (useSym) { chars += SYMBOLS; guaranteed.push(SYMBOLS[getRandomInt(SYMBOLS.length)]); }
  let res = '';
  for (let i = guaranteed.length; i < length; i++) res += chars[getRandomInt(chars.length)];
  res += guaranteed.join('');
  return res.split('').sort(() => 0.5 - Math.random()).join('');
}
// 用户名: memorable
function generateMemorableUsername(count, capitalize, fullWords) {
  const source = fullWords ? words : syllables;
  const parts = [];
  for (let i = 0; i < count; i++) {
    let w = source[getRandomInt(source.length)] || '';
    if (capitalize && w.length) w = w.charAt(0).toUpperCase() + w.slice(1);
    parts.push(w);
  }
  return parts.join('-');
}
// 用户名: custom
function generateCustomUsername(midLength, useNum, useSym, prefix = '', suffix = '') {
  const { LOWER, UPPER, NUMBERS, SYMBOLS } = CHARSET;
  let chars = LOWER + UPPER;
  const guaranteed = [LOWER[getRandomInt(LOWER.length)], UPPER[getRandomInt(UPPER.length)]];
  if (useNum) { chars += NUMBERS; guaranteed.push(NUMBERS[getRandomInt(NUMBERS.length)]); }
  if (useSym) { chars += SYMBOLS; guaranteed.push(SYMBOLS[getRandomInt(SYMBOLS.length)]); }
  const realMidLen = Math.max(midLength, guaranteed.length);
  let mid = '';
  for (let i = guaranteed.length; i < realMidLen; i++) mid += chars[getRandomInt(chars.length)];
  mid += guaranteed.join('');
  mid = mid.split('').sort(() => 0.5 - Math.random()).join('');
  return (prefix || '') + mid + (suffix || '');
}

// ============ 压力测试 & 校验工具 ============
const RE_LOWER = /[a-z]/;
const RE_UPPER = /[A-Z]/;
const RE_NUM   = /[0-9]/;
const RE_SYM   = /[^a-zA-Z0-9]/;

function runTimes(label, fn, times, validator) {
  console.log(`\n🧪 [${label}] 运行 ${times} 次压力测试...`);
  const start = Date.now();
  let lengths = new Set();
  for (let i = 0; i < times; i++) {
    const result = fn(i);
    if (validator) validator(result, i, times);
    lengths.add(result.length);
  }
  const ms = Date.now() - start;
  console.log(`   ✅ 通过，耗时 ${ms}ms，平均 ${(ms/times*1000).toFixed(2)}μs/次，输出长度集合: ${[...lengths].sort((a,b)=>a-b).join(',')}`);
  // 覆盖率检查：1000次以上则输出是否包含数字/符号的概率
  if (times >= 500) {
    let hasNum = 0, hasSym = 0;
    for (let i = 0; i < 200; i++) {
      const r = fn(i);
      if (RE_NUM.test(r)) hasNum++;
      if (RE_SYM.test(r)) hasSym++;
    }
    console.log(`   📊 采样200次: 含数字率=${(hasNum/200*100).toFixed(0)}%，含符号率=${(hasSym/200*100).toFixed(0)}%`);
  }
}

// ============ 开始执行测试 ============
console.log('═══════════════════════════════════════════════════');
console.log('🚀 密码 & 用户名生成器单元测试启动');
console.log('═══════════════════════════════════════════════════');

// ---------- 测试1: 随机密码 ----------
console.log('\n━━━━━━━━━━ 密码生成器测试 ━━━━━━━━━━');
runTimes('密码/随机(20字符,含数字+不含符号)', (i) => generateRandomPassword(20, true, false), 1000, (r) => {
  assert.strictEqual(r.length, 20, '长度必须=20');
  assert.ok(RE_LOWER.test(r), '必须含小写字母');
  assert.ok(RE_UPPER.test(r), '必须含大写字母');
  assert.ok(RE_NUM.test(r),   '必须含数字（开启选项）');
  assert.ok(!RE_SYM.test(r),  '必须不含符号（关闭选项）');
});

runTimes('密码/随机(100字符,数字+符号全开)', (i) => generateRandomPassword(100, true, true), 500, (r) => {
  assert.strictEqual(r.length, 100, '长度必须=100');
  assert.ok(RE_LOWER.test(r) && RE_UPPER.test(r), '必须含大小写');
});

runTimes('密码/易记(4词,首字母大写+完整单词)', (i) => generateMemorablePassword(4, true, true), 500, (r) => {
  const parts = r.split('-');
  assert.strictEqual(parts.length, 4, '必须4段');
  parts.forEach(p => {
    assert.ok(p.length > 0, '每段非空');
    assert.strictEqual(p[0], p[0].toUpperCase(), '首字母必须大写');
  });
});

runTimes('密码/易记(3音节,小写)', (i) => generateMemorablePassword(3, false, false), 500, (r) => {
  const parts = r.split('-');
  assert.strictEqual(parts.length, 3, '必须3段');
  parts.forEach(p => {
    assert.strictEqual(p, p.toLowerCase(), '必须全小写');
  });
});

runTimes('密码/PIN(6位)', (i) => generatePinPassword(6), 1000, (r) => {
  assert.strictEqual(r.length, 6);
  assert.ok(/^[0-9]{6}$/.test(r), '必须全是6位数字');
});

runTimes('密码/PIN(12位边界值)', (i) => generatePinPassword(12), 500, (r) => {
  assert.strictEqual(r.length, 12);
  assert.ok(/^[0-9]{12}$/.test(r), '必须全是12位数字');
});

// ---------- 测试2: 用户名 ----------
console.log('\n━━━━━━━━━━ 用户名生成器测试 ━━━━━━━━━━');
runTimes('用户名/随机(默认8字符,数字开,符号关)', (i) => generateRandomUsername(8, true, false), 2000, (r) => {
  assert.strictEqual(r.length, 8, '默认用户名长度=8');
  assert.ok(RE_LOWER.test(r) && RE_UPPER.test(r), '必须含大小写');
  assert.ok(!RE_SYM.test(r), '默认不含符号');
});

runTimes('用户名/随机(32字符上限,符号全开)', (i) => generateRandomUsername(32, true, true), 1000, (r) => {
  assert.strictEqual(r.length, 32);
  assert.ok(RE_LOWER.test(r) && RE_UPPER.test(r));
});

runTimes('用户名/易记(2词下限)', (i) => generateMemorableUsername(2, false, true), 500, (r) => {
  assert.strictEqual(r.split('-').length, 2);
});
runTimes('用户名/易记(8词上限,首字母大写)', (i) => generateMemorableUsername(8, true, true), 500, (r) => {
  const parts = r.split('-');
  assert.strictEqual(parts.length, 8);
  parts.forEach(p => assert.strictEqual(p[0], p[0].toUpperCase()));
});

runTimes('用户名/自定义(无前后缀,中段12字符)', (i) => generateCustomUsername(12, true, false, '', ''), 1000, (r) => {
  assert.ok(r.length >= 12, '中段长度不少于设置值');
  assert.ok(RE_LOWER.test(r) && RE_UPPER.test(r) && RE_NUM.test(r));
});
runTimes('用户名/自定义(prefix=dev_ suffix=_2026)', (i) => generateCustomUsername(8, true, false, 'dev_', '_2026'), 1000, (r) => {
  assert.ok(r.startsWith('dev_'), '必须以dev_开头');
  assert.ok(r.endsWith('_2026'), '必须以_2026结尾');
  assert.ok(r.length >= 'dev_'.length + 8 + '_2026'.length, '总长度达标');
});

// ---------- 性能与随机性分布 ----------
console.log('\n━━━━━━━━━━ 性能与随机性抽样 ━━━━━━━━━━');
const N_PERF = 10000;
console.log(`📈 运行 ${N_PERF} 次「用户名随机8字符」...`);
let t0 = Date.now();
const buckets = new Map();
for (let i = 0; i < N_PERF; i++) {
  const r = generateRandomUsername(8, true, false);
  buckets.set(r, (buckets.get(r) || 0) + 1);
}
const elapsed = Date.now() - t0;
const duplicates = [...buckets.values()].filter(v => v > 1).length;
console.log(`   ⚡ 耗时 ${elapsed}ms，吞吐 ${Math.round(N_PERF / elapsed * 1000)} 次/秒`);
console.log(`   🎲 碰撞检测: 总结果=${buckets.size} 唯一，重复结果=${duplicates} (N=${N_PERF}时${duplicates === 0 ? '完全无碰撞✅' : '可接受'})`);

console.log('\n═══════════════════════════════════════════════════');
console.log('🎉 全部测试通过！✅');
console.log('═══════════════════════════════════════════════════');
