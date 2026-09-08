import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Eye, EyeOff, Copy, Check, Dices, UserPlus, X, FileWarning, Calendar, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Field } from '@/types/models';
import { PasswordGenerator } from '@/components/PasswordGenerator';
import { UsernameGenerator } from '@/components/UsernameGenerator';

export interface FieldRendererProps {
  field: Field;
  onChange: (patch: Partial<Field>) => void;
  readOnly?: boolean;
  className?: string;
}

export const FieldRenderer: React.FC<FieldRendererProps> = ({ field, onChange, readOnly = false, className }) => {
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [genValue, setGenValue] = useState('');
  const popRef = useRef<HTMLDivElement>(null);
  const clipboardSeconds = 20;

  const isUsernameLike = /用户名|username|账号|email|邮箱/i.test(field.label);
  const GeneratorComp: React.FC<any> = isUsernameLike ? UsernameGenerator : PasswordGenerator;

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => {
      try {
        navigator.clipboard?.writeText('').catch(() => {});
      } catch { /* ignore */ }
    }, clipboardSeconds * 1000);
    return () => clearTimeout(t);
  }, [copied]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!showGenerator) return;
      if (!popRef.current) return;
      const el = e.target as HTMLElement;
      if (el && popRef.current.contains(el)) return;
      setShowGenerator(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showGenerator]);

  const copyValue = async () => {
    try {
      await navigator.clipboard.writeText(field.value || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  const openGenerator = () => {
    setGenValue(field.value || '');
    setShowGenerator(true);
  };

  const insertFromGenerator = () => {
    onChange({ value: genValue, updatedAt: Date.now() });
    setShowGenerator(false);
  };

  const inputBaseCls = cn(
    'w-full px-3 py-2 rounded-xl border-2 bg-white text-slate-900 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-brand-300',
    readOnly ? 'border-slate-100 bg-slate-50 text-slate-500 cursor-not-allowed' : 'border-slate-200 focus:border-brand-300'
  );

  /* 信用卡号显示 4 位分组（仅展示 19 位以内） */
  const ccDisplayValue = useMemo(() => {
    const raw = (field.value ?? '').replace(/\D/g, '');
    const groups = raw.match(/.{1,4}/g) ?? [];
    return groups.join(' ');
  }, [field.value]);

  /* 月/年 (MM/YY) 自动格式化 */
  const formatMonthYear = (raw: string): string => {
    const d = raw.replace(/\D/g, '').slice(0, 4);
    if (d.length <= 2) return d;
    return `${d.slice(0, 2)}/${d.slice(2)}`;
  };

  const renderControl = () => {
    switch (field.type) {
      case 'password':
      case 'concealed':
        return (
          <div className="relative">
            <input
              type={showSecret ? 'text' : 'password'}
              disabled={readOnly}
              value={field.value}
              onChange={(e) => onChange({ value: e.target.value, updatedAt: Date.now() })}
              placeholder={`请输入${field.label}`}
              className={cn(inputBaseCls, 'pr-24 font-mono tracking-wider')}
              autoComplete="off"
              spellCheck={false}
            />
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setShowSecret((s) => !s)}
                disabled={readOnly}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 disabled:opacity-50"
                title={showSecret ? '隐藏' : '显示'}
                aria-label={showSecret ? '隐藏' : '显示'}
              >
                {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button
                type="button"
                onClick={copyValue}
                disabled={readOnly || !field.value}
                className={cn(
                  'p-1.5 rounded-md transition disabled:opacity-50',
                  copied ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400 hover:text-slate-600'
                )}
                title="复制到剪贴板（20s后清空）"
                aria-label="复制"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
              <button
                type="button"
                onClick={openGenerator}
                disabled={readOnly}
                className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 disabled:opacity-50 transition"
                title="🎲 生成强值"
                aria-label="生成"
              >
                {isUsernameLike ? <UserPlus size={16} /> : <Dices size={16} />}
              </button>
            </div>

            {showGenerator && (
              <div
                ref={popRef}
                className="absolute right-0 top-full z-50 mt-2 w-[380px] max-w-[calc(100vw-32px)] shadow-2xl"
              >
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowGenerator(false)}
                    className="absolute -top-2 -right-2 z-10 p-1 rounded-full bg-white shadow border border-slate-200 text-slate-400 hover:text-slate-700"
                    aria-label="关闭"
                  >
                    <X size={14} />
                  </button>
                  <GeneratorComp
                    value={genValue}
                    onChange={setGenValue}
                    onClose={() => setShowGenerator(false)}
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={insertFromGenerator}
                      disabled={!genValue}
                      className={cn(
                        'px-4 py-1.5 rounded-lg text-xs font-semibold transition',
                        !genValue
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow shadow-emerald-500/20'
                      )}
                    >
                      插入值并关闭
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 'textarea':
        return (
          <textarea
            disabled={readOnly}
            rows={4}
            value={field.value}
            onChange={(e) => onChange({ value: e.target.value })}
            placeholder={`请输入${field.label}`}
            className={cn(inputBaseCls, 'min-h-[80px] resize-y leading-6')}
          />
        );

      case 'email':
      case 'url':
      case 'tel':
      case 'text':
        return (
          <div className="relative">
            <input
              type={field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : field.type === 'url' ? 'url' : 'text'}
              disabled={readOnly}
              value={field.value}
              onChange={(e) => onChange({ value: e.target.value })}
              placeholder={
                field.type === 'email' ? 'name@example.com' :
                field.type === 'url' ? 'https://example.com' :
                field.type === 'tel' ? '+86 138 0000 0000' :
                `请输入${field.label}`
              }
              className={cn(inputBaseCls, field.type === 'tel' && 'font-mono tracking-wider')}
              inputMode={field.type === 'tel' ? 'tel' : undefined}
            />
            {field.value && !readOnly && (
              <div className="absolute right-1 top-1/2 -translate-y-1/2">
                <button
                  type="button"
                  onClick={copyValue}
                  className={cn(
                    'p-1.5 rounded-md transition',
                    copied ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400 hover:text-slate-600'
                  )}
                  title="复制"
                >
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                </button>
              </div>
            )}
          </div>
        );

      case 'date':
        return (
          <div className="relative">
            <input
              type="date"
              disabled={readOnly}
              value={field.value}
              onChange={(e) => onChange({ value: e.target.value })}
              placeholder="YYYY-MM-DD"
              className={cn(inputBaseCls, 'pr-9 font-mono')}
            />
            <Calendar size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        );

      case 'monthYear':
        return (
          <div className="relative">
            <input
              type="text"
              disabled={readOnly}
              value={formatMonthYear(field.value)}
              onChange={(e) => onChange({ value: formatMonthYear(e.target.value) })}
              placeholder="MM/YY (例: 12/28)"
              maxLength={5}
              className={cn(inputBaseCls, 'pr-9 font-mono tracking-widest text-center')}
              inputMode="numeric"
            />
            <Hash size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        );

      case 'creditcard':
        return (
          <div className="relative">
            <input
              type="text"
              disabled={readOnly}
              value={ccDisplayValue}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, '').slice(0, 19);
                onChange({ value: raw });
              }}
              placeholder="1234 5678 9012 3456"
              maxLength={23}
              className={cn(inputBaseCls, 'pr-10 font-mono tracking-[0.18em]')}
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
            />
            {field.value && (
              <div className="absolute right-1 top-1/2 -translate-y-1/2">
                <button
                  type="button"
                  onClick={copyValue}
                  className={cn(
                    'p-1.5 rounded-md transition',
                    copied ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400 hover:text-slate-600'
                  )}
                  title="复制原始卡号（无空格）"
                >
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                </button>
              </div>
            )}
          </div>
        );

      case 'otp':
        return (
          <div className="relative">
            <input
              type={showSecret ? 'text' : 'password'}
              disabled={readOnly}
              value={field.value}
              onChange={(e) => onChange({ value: e.target.value })}
              placeholder="otpauth://totp/... 或 TOTP 种子密钥"
              className={cn(inputBaseCls, 'pr-24 font-mono tracking-wider')}
              autoComplete="off"
              spellCheck={false}
            />
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-50 text-brand-600 mr-1 font-semibold">TOTP M3</span>
              <button
                type="button"
                onClick={() => setShowSecret((s) => !s)}
                disabled={readOnly}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 disabled:opacity-50"
                title={showSecret ? '隐藏' : '显示种子'}
              >
                {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              {field.value && (
                <button
                  type="button"
                  onClick={copyValue}
                  className={cn(
                    'p-1.5 rounded-md transition',
                    copied ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400 hover:text-slate-600'
                  )}
                  title="复制种子密钥"
                >
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                </button>
              )}
            </div>
          </div>
        );

      case 'file':
        return (
          <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-3 flex items-start gap-2.5">
            <FileWarning size={18} className="text-amber-500 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-slate-700">附件（文档/图片等）：M2 MVP 阶段暂未启用</p>
              <p className="text-[11px] text-slate-500 mt-0.5">字段引用 ID：{field.value || '（未绑定）'}。加密 blob 与文件拆分加密预计在 M6/M7 版本实现。</p>
              <p className="text-[10px] text-slate-400 mt-0.5">若需要手动绑定，请在上方「自定义字段」菜单中调整。</p>
            </div>
          </div>
        );

      default:
        return (
          <input
            type="text"
            disabled={readOnly}
            value={field.value}
            onChange={(e) => onChange({ value: e.target.value })}
            placeholder={`请输入${field.label}`}
            className={inputBaseCls}
          />
        );
    }
  };

  return (
    <div className={cn('mb-3 last:mb-0', className)}>
      <label className="block mb-1">
        <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
          {field.label}
          {field.custom && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 ml-1">自定义</span>
          )}
        </span>
      </label>
      {renderControl()}
    </div>
  );
};

export default FieldRenderer;
