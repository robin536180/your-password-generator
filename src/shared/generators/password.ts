import { CHARSET, getRandomInt, shuffleInPlace } from './utils';
import { WORDS, SYLLABLES } from './words';
import {
  deriveChars,
  deriveFromTemplate,
  DEFAULT_CUSTOM_CHARSET,
  MAX_ITERATIONS,
  MIN_ITERATIONS,
  type GmEngine,
} from './gm';

export type PasswordMode = 'random' | 'memorable' | 'pin' | 'gm' | 'custom';

export interface RandomPasswordOptions {
  length: number;
  useNumbers: boolean;
  useSymbols: boolean;
}

export interface MemorablePasswordOptions {
  wordCount: number;
  capitalize: boolean;
  useFullWords: boolean;
}

export interface PinPasswordOptions {
  length: number;
}

/** 国密算法模式：SM3（HMAC 摘要派生）/ SM4（分组密钥流派生） */
export interface GmPasswordOptions {
  engine: GmEngine;
  /** 种子，留空则每次取系统安全随机数 */
  secret: string;
  /** 盐值 / 域标识（建议按站点区分） */
  salt: string;
  length: number;
  useNumbers: boolean;
  useSymbols: boolean;
  /** 计数器，用于「重新生成」时输出不同结果 */
  counter: number;
}

/** 自定义算法模式：引擎 + 字符集 + 模板 + 前后缀完全由用户定义 */
export interface CustomPasswordOptions {
  engine: GmEngine;
  secret: string;
  salt: string;
  /** 迭代次数，范围 1-1000 */
  iterations: number;
  /** 自定义字符集 */
  charset: string;
  /** 无模板时的长度 */
  length: number;
  /** 输出模板：* 自定义字符集，# 数字，? 大写字母，其余原样 */
  template: string;
  prefix: string;
  suffix: string;
  counter: number;
}

export type GeneratePasswordOptions =
  | { mode: 'random'; opts: RandomPasswordOptions }
  | { mode: 'memorable'; opts: MemorablePasswordOptions }
  | { mode: 'pin'; opts: PinPasswordOptions }
  | { mode: 'gm'; opts: GmPasswordOptions }
  | { mode: 'custom'; opts: CustomPasswordOptions };

export const generateRandomPassword = (length: number, useNumbers: boolean, useSymbols: boolean): string => {
  const { LOWER, UPPER, NUMBERS, SYMBOLS } = CHARSET;
  let chars = LOWER + UPPER;
  const guaranteed: string[] = [
    LOWER[getRandomInt(LOWER.length)],
    UPPER[getRandomInt(UPPER.length)]
  ];
  if (useNumbers) {
    chars += NUMBERS;
    guaranteed.push(NUMBERS[getRandomInt(NUMBERS.length)]);
  }
  if (useSymbols) {
    chars += SYMBOLS;
    guaranteed.push(SYMBOLS[getRandomInt(SYMBOLS.length)]);
  }
  const realLen = Math.max(length, guaranteed.length);
  const parts: string[] = [];
  for (let i = guaranteed.length; i < realLen; i++) {
    parts.push(chars[getRandomInt(chars.length)]);
  }
  parts.push(...guaranteed);
  return shuffleInPlace(parts).join('');
};

export const generateMemorablePassword = (count: number, capitalize: boolean, fullWords: boolean): string => {
  const source: string[] = fullWords ? WORDS : SYLLABLES;
  if (!source || source.length === 0) return '';
  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    let w = source[getRandomInt(source.length)] || '';
    if (capitalize && w.length) {
      w = w.charAt(0).toUpperCase() + w.slice(1);
    }
    parts.push(w);
  }
  return parts.join('-');
};

export const generatePinPassword = (length: number): string => {
  const { NUMBERS } = CHARSET;
  let pwd = '';
  for (let i = 0; i < length; i++) {
    pwd += NUMBERS[getRandomInt(NUMBERS.length)];
  }
  return pwd;
};

/** 国密模式字符集：固定包含大小写字母，按需追加数字 / 符号 */
export const buildGmCharset = (useNumbers: boolean, useSymbols: boolean): string => {
  const { LOWER, UPPER, NUMBERS, SYMBOLS } = CHARSET;
  return LOWER + UPPER + (useNumbers ? NUMBERS : '') + (useSymbols ? SYMBOLS : '');
};

/** 国密算法生成（SM3 / SM4 确定性派生） */
export const generateGmPassword = (opts: GmPasswordOptions): string =>
  deriveChars(
    {
      engine: opts.engine,
      secret: opts.secret,
      salt: opts.salt,
      counter: opts.counter,
    },
    buildGmCharset(opts.useNumbers, opts.useSymbols),
    opts.length
  );

/** 自定义算法生成：模板优先，其次按长度 + 自定义字符集 */
export const generateCustomPassword = (opts: CustomPasswordOptions): string => {
  const base = {
    engine: opts.engine,
    secret: opts.secret,
    salt: opts.salt,
    counter: opts.counter,
    iterations: Math.min(MAX_ITERATIONS, Math.max(MIN_ITERATIONS, Math.floor(opts.iterations) || MIN_ITERATIONS)),
  };
  const charset = opts.charset || DEFAULT_CUSTOM_CHARSET;
  const core = opts.template
    ? deriveFromTemplate(base, opts.template, charset)
    : deriveChars(base, charset, opts.length);
  return `${opts.prefix}${core}${opts.suffix}`;
};

export const generatePassword = (options: GeneratePasswordOptions): string => {
  switch (options.mode) {
    case 'random':
      return generateRandomPassword(options.opts.length, options.opts.useNumbers, options.opts.useSymbols);
    case 'memorable':
      return generateMemorablePassword(options.opts.wordCount, options.opts.capitalize, options.opts.useFullWords);
    case 'pin':
      return generatePinPassword(options.opts.length);
    case 'gm':
      return generateGmPassword(options.opts);
    case 'custom':
      return generateCustomPassword(options.opts);
  }
};
