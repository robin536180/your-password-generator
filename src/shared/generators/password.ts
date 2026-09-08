import { CHARSET, getRandomInt, shuffleInPlace } from './utils';
import { WORDS, SYLLABLES } from './words';

export type PasswordMode = 'random' | 'memorable' | 'pin';

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

export type GeneratePasswordOptions =
  | { mode: 'random'; opts: RandomPasswordOptions }
  | { mode: 'memorable'; opts: MemorablePasswordOptions }
  | { mode: 'pin'; opts: PinPasswordOptions };

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

export const generatePassword = (options: GeneratePasswordOptions): string => {
  switch (options.mode) {
    case 'random':
      return generateRandomPassword(options.opts.length, options.opts.useNumbers, options.opts.useSymbols);
    case 'memorable':
      return generateMemorablePassword(options.opts.wordCount, options.opts.capitalize, options.opts.useFullWords);
    case 'pin':
      return generatePinPassword(options.opts.length);
  }
};
