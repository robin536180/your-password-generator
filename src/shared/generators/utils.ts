const _G = globalThis as typeof globalThis & {
  crypto: Crypto;
};

export const CHARSET = {
  LOWER: 'abcdefghijklmnopqrstuvwxyz',
  UPPER: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  NUMBERS: '0123456789',
  SYMBOLS: '!@#$%^&*()_+~`|}{[]:;?><,./-='
} as const;

export type PasswordModeCfg = { min: number; max: number; default: number };
export const PWD_MODE_CFG: Record<string, PasswordModeCfg> = {
  random: { min: 8, max: 100, default: 20 },
  memorable: { min: 3, max: 15, default: 4 },
  pin: { min: 3, max: 12, default: 6 }
} as const;

export const USR_MODE_CFG: Record<string, PasswordModeCfg> = {
  random: { min: 8, max: 32, default: 8 },
  memorable: { min: 2, max: 8, default: 4 },
  custom: { min: 4, max: 32, default: 12 }
} as const;

export type CharType = 'lower' | 'upper' | 'digit' | 'symbol' | 'separator' | 'word';
export type ColoredChar = { char: string; type: CharType };

export const getRandomInt = (max: number): number => {
  const safeMax = Math.max(1, Math.floor(max));
  if (safeMax <= 1) return 0;
  const arr = new Uint32Array(1);
  _G.crypto.getRandomValues(arr);
  return arr[0] % safeMax;
};

export const shuffleInPlace = <T>(arr: T[]): T[] => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = getRandomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

export const formatStringWithColors = (text: string, mode: 'pin' | 'memorable' | 'default' = 'default'): ColoredChar[] => {
  const out: ColoredChar[] = [];
  if (mode === 'pin') {
    for (let i = 0; i < text.length; i++) out.push({ char: text[i], type: 'digit' });
    return out;
  }
  if (mode === 'memorable') {
    let buffer = '';
    const flush = () => {
      if (buffer.length) {
        out.push({ char: buffer, type: 'word' });
        buffer = '';
      }
    };
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '-') {
        flush();
        out.push({ char: '-', type: 'separator' });
      } else {
        buffer += c;
      }
    }
    flush();
    return out;
  }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (/[0-9]/.test(ch)) out.push({ char: ch, type: 'digit' });
    else if (/[a-z]/.test(ch)) out.push({ char: ch, type: 'lower' });
    else if (/[A-Z]/.test(ch)) out.push({ char: ch, type: 'upper' });
    else out.push({ char: ch, type: 'symbol' });
  }
  return out;
};
