import { CHARSET, getRandomInt, shuffleInPlace } from './utils';
import { WORDS, SYLLABLES } from './words';

export type UsernameMode = 'random' | 'memorable' | 'custom';

export interface RandomUsernameOptions {
  length: number;
  useNumbers: boolean;
  useSymbols: boolean;
}

export interface MemorableUsernameOptions {
  wordCount: number;
  capitalize: boolean;
  useFullWords: boolean;
}

export interface CustomUsernameOptions {
  midLength: number;
  midUseNumbers: boolean;
  midUseSymbols: boolean;
  prefix?: string;
  suffix?: string;
}

export type GenerateUsernameOptions =
  | { mode: 'random'; opts: RandomUsernameOptions }
  | { mode: 'memorable'; opts: MemorableUsernameOptions }
  | { mode: 'custom'; opts: CustomUsernameOptions };

export const generateRandomUsername = (length: number, useNumbers: boolean, useSymbols: boolean): string => {
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

export const generateMemorableUsername = (count: number, capitalize: boolean, fullWords: boolean): string => {
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

export const generateCustomUsername = (
  midLength: number,
  midUseNumbers: boolean,
  midUseSymbols: boolean,
  prefix: string = '',
  suffix: string = ''
): string => {
  const { LOWER, UPPER, NUMBERS, SYMBOLS } = CHARSET;
  let chars = LOWER + UPPER;
  const guaranteed: string[] = [
    LOWER[getRandomInt(LOWER.length)],
    UPPER[getRandomInt(UPPER.length)]
  ];
  if (midUseNumbers) {
    chars += NUMBERS;
    guaranteed.push(NUMBERS[getRandomInt(NUMBERS.length)]);
  }
  if (midUseSymbols) {
    chars += SYMBOLS;
    guaranteed.push(SYMBOLS[getRandomInt(SYMBOLS.length)]);
  }
  const realMidLen = Math.max(midLength, guaranteed.length);
  const mid: string[] = [];
  for (let i = guaranteed.length; i < realMidLen; i++) {
    mid.push(chars[getRandomInt(chars.length)]);
  }
  mid.push(...guaranteed);
  const midShuffled = shuffleInPlace(mid).join('');
  return (prefix || '') + midShuffled + (suffix || '');
};

export const generateUsername = (options: GenerateUsernameOptions): string => {
  switch (options.mode) {
    case 'random':
      return generateRandomUsername(options.opts.length, options.opts.useNumbers, options.opts.useSymbols);
    case 'memorable':
      return generateMemorableUsername(options.opts.wordCount, options.opts.capitalize, options.opts.useFullWords);
    case 'custom':
      return generateCustomUsername(
        options.opts.midLength,
        options.opts.midUseNumbers,
        options.opts.midUseSymbols,
        options.opts.prefix,
        options.opts.suffix
      );
  }
};
