import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Check, Dice1, Shuffle, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  generatePassword,
  PasswordMode,
  type RandomPasswordOptions,
  type MemorablePasswordOptions,
  type PinPasswordOptions,
} from '@/shared/generators/password';
import { formatStringWithColors, ColoredChar, PWD_MODE_CFG } from '@/shared/generators/utils';

export interface PasswordGeneratorProps {
  value: string;
  onChange: (next: string) => void;
  onClose?: () => void;
  initialMode?: PasswordMode;
  className?: string;
}

const charTypeClass: Record<ColoredChar['type'], string> = {
  lower: 'text-slate-700',
  upper: 'text-slate-900 font-semibold',
  digit: 'text-brand-700',
  symbol: 'text-rose-600',
  separator: 'text-rose-600',
  word: 'text-slate-800',
};

export const PasswordGenerator: React.FC<PasswordGeneratorProps> = ({
  value,
  onChange,
  onClose,
  initialMode = 'random',
  className,
}) => {
  const [mode, setMode] = useState<PasswordMode>(initialMode);
  const cfg = PWD_MODE_CFG[mode];

  const [randomOpts, setRandomOpts] = useState<RandomPasswordOptions>({ length: cfg.default, useNumbers: true, useSymbols: false });
  const [memOpts, setMemOpts] = useState<MemorablePasswordOptions>({ wordCount: cfg.default, capitalize: false, useFullWords: true });
  const [pinOpts, setPinOpts] = useState<PinPasswordOptions>({ length: cfg.default });
  const [copied, setCopied] = useState(false);

  const regenerate = () => {
    let next = '';
    if (mode === 'random') next = generatePassword({ mode, opts: randomOpts });
    else if (mode === 'memorable') next = generatePassword({ mode, opts: memOpts });
    else next = generatePassword({ mode, opts: pinOpts });
    onChange(next);
  };

  useEffect(() => {
    if (!value) regenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const colored: ColoredChar[] = useMemo(
    () => formatStringWithColors(value, mode === 'pin' ? 'pin' : mode === 'memorable' ? 'memorable' : 'default'),
    [value, mode]
  );

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const switchMode = (next: PasswordMode) => {
    setMode(next);
    const c = PWD_MODE_CFG[next];
    if (next === 'random') setRandomOpts({ length: c.default, useNumbers: true, useSymbols: false });
    else if (next === 'memorable') setMemOpts({ wordCount: c.default, capitalize: false, useFullWords: true });
    else setPinOpts({ length: c.default });
  };

  const SliderRow: React.FC<{
    label: string; value: number; min: number; max: number;
    onChange: (v: number) => void;
  }> = ({ label, value, min, max, onChange: onCh }) => (
    <div className="flex items-center gap-3">
      <span className="w-16 text-xs font-medium text-slate-600">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onCh(parseInt(e.target.value, 10))}
        className="flex-1 accent-brand-600"
      />
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onCh(Math.min(max, Math.max(min, parseInt(e.target.value, 10) || min)))}
        className="w-16 px-2 py-1 text-sm rounded-lg border border-slate-200 bg-white text-slate-900 text-right"
      />
    </div>
  );

  const SwitchRow: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void }> = ({
    label, checked, onChange: onCh,
  }) => (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-700">{label}</span>
      <button
        type="button"
        onClick={() => onCh(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
          checked ? 'bg-brand-600' : 'bg-slate-300'
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-6' : 'translate-x-1'
          )}
        />
      </button>
    </div>
  );

  return (
    <div className={cn('w-full bg-white rounded-2xl border border-slate-200 shadow-lg shadow-slate-200/60 p-4', className)}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1">
          <Dice1 size={16} className="text-brand-600" /> 密码生成器
        </h3>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-2 py-1 rounded-md text-slate-500 hover:bg-slate-100"
          >
            关闭
          </button>
        )}
      </div>

      <div className="flex gap-1.5 mb-3">
        {([
          ['random', '随机', <Shuffle key="r" size={14} />],
          ['memorable', '易记', '💡'],
          ['pin', 'PIN', <Hash key="p" size={14} />],
        ] as const).map(([m, label, icon]) => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition',
              mode === m
                ? 'bg-brand-600 text-white shadow shadow-brand-500/20'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3 mb-3 min-h-[56px] flex items-center">
        <div className="w-full break-all font-mono text-base leading-6 select-all">
          {colored.length === 0 ? (
            <span className="text-slate-400">点击生成按钮</span>
          ) : (
            colored.map((c, idx) => (
              <span key={idx} className={charTypeClass[c.type]}>{c.char}</span>
            ))
          )}
        </div>
      </div>

      <div className="space-y-2.5 mb-3 text-sm">
        {mode === 'random' && (
          <>
            <SliderRow
              label="长度"
              min={cfg.min}
              max={cfg.max}
              value={randomOpts.length}
              onChange={(v) => setRandomOpts({ ...randomOpts, length: v })}
            />
            <SwitchRow
              label="包含数字"
              checked={randomOpts.useNumbers}
              onChange={(v) => setRandomOpts({ ...randomOpts, useNumbers: v })}
            />
            <SwitchRow
              label="包含符号"
              checked={randomOpts.useSymbols}
              onChange={(v) => setRandomOpts({ ...randomOpts, useSymbols: v })}
            />
          </>
        )}
        {mode === 'memorable' && (
          <>
            <SliderRow
              label="词数"
              min={cfg.min}
              max={cfg.max}
              value={memOpts.wordCount}
              onChange={(v) => setMemOpts({ ...memOpts, wordCount: v })}
            />
            <SwitchRow
              label="首字母大写"
              checked={memOpts.capitalize}
              onChange={(v) => setMemOpts({ ...memOpts, capitalize: v })}
            />
            <SwitchRow
              label="使用完整单词"
              checked={memOpts.useFullWords}
              onChange={(v) => setMemOpts({ ...memOpts, useFullWords: v })}
            />
          </>
        )}
        {mode === 'pin' && (
          <SliderRow
            label="位数"
            min={cfg.min}
            max={cfg.max}
            value={pinOpts.length}
            onChange={(v) => setPinOpts({ length: v })}
          />
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={regenerate}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white text-sm font-semibold shadow shadow-brand-500/20 transition"
        >
          <RefreshCw size={14} /> 重新生成
        </button>
        <button
          type="button"
          onClick={copyToClipboard}
          className={cn(
            'px-3 py-2 rounded-xl text-sm font-semibold border transition',
            copied
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          )}
        >
          {copied ? <><Check size={14} className="inline mr-1" />已复制</> : '复制'}
        </button>
        <button
          type="button"
          onClick={() => value && onChange(value)}
          disabled={!value}
          className={cn(
            'px-4 py-2 rounded-xl text-sm font-semibold border transition',
            !value
              ? 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed'
              : 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700 shadow shadow-emerald-500/20'
          )}
        >
          插入
        </button>
      </div>
    </div>
  );
};

export default PasswordGenerator;
