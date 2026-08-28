/**
 * screens/UnlockScreen.tsx - 解锁屏（已初始化后的入口：主密码解锁）
 *
 * 失败策略：连续 5 次失败 → 锁定 60 秒，失败次数越高锁定时间越长（最多 10 分钟）
 */
import React, { useEffect, useState } from 'react';
import { AlertTriangle, Eye, EyeOff, KeyRound, LogIn, ShieldCheck, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVaultStore } from '@/store/vaultStore';
import { Log } from '@/core/logger';

export const UnlockScreen: React.FC<{ onGoRegister?: () => void }> = ({ onGoRegister }) => {
  const refreshStatus = useVaultStore((s) => s.refreshStatus);
  const unlock = useVaultStore((s) => s.unlockVault);
  const meta = useVaultStore((s) => s.meta);
  const remaining = useVaultStore((s) => s.remainingAttempts);
  const lockedUntil = useVaultStore((s) => s.lockedUntilMs);
  const failed = useVaultStore((s) => s.failedAttempts);

  const [pwd, setPwd] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const isLocked = !!lockedUntil && lockedUntil > now;
  const lockSec = isLocked ? Math.max(1, Math.ceil((lockedUntil! - now) / 1000)) : 0;
  const m = Math.floor(lockSec / 60);
  const s = lockSec % 60;

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!pwd || isLocked || busy) return;
    setBusy(true);
    setErr(null);
    Log.info('UI:UNLOCK', `尝试解锁：${failed + 1}/5`);
    try {
      const r = await unlock({ masterPassword: pwd });
      if (!r.ok) {
        if (r.code === 'INVALID_PASSWORD') {
          setErr(`主密码错误，还剩 ${Math.max(0, remaining - 1)} 次机会`);
        } else {
          setErr(r.error ?? '解锁失败');
        }
      }
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-brand-50 via-white to-slate-50">
      {/* Header */}
      <div className="px-5 pt-6 pb-3 flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-xl shadow-brand-500/20">
          <ShieldCheck size={32} className="text-white" />
        </div>
        <h1 className="mt-4 text-xl font-bold text-brand-700 flex items-center gap-2">
          <KeyRound size={20} /> 1Pass Clone 密码管理器
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          {meta?.accountEmail ? `${meta.accountEmail} 的保管库` : '您的本地加密保管库'}
          {meta && <span className="ml-1">· SK: {meta.secretKeyMasked}</span>}
        </p>
      </div>

      <form onSubmit={submit} className="flex-1 flex flex-col px-5">
        <label className="block">
          <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
            <Lock size={12} /> 主密码
          </span>
          <div className="mt-1 relative">
            <input
              disabled={isLocked || busy}
              type={show ? 'text' : 'password'}
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="请输入主密码解锁保管库"
              autoFocus
              className={cn(
                'w-full px-3 pr-10 py-3 rounded-xl border-2 bg-white/80 transition focus:outline-none focus:ring-2 focus:ring-brand-300',
                isLocked ? 'border-slate-200 text-slate-400 bg-slate-100 cursor-not-allowed'
                  : 'border-slate-200 focus:border-brand-300'
              )}
            />
            <button
              type="button"
              onClick={() => setShow((x) => !x)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-600"
              aria-label={show ? '隐藏' : '显示'}
            >
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </label>

        {isLocked && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2 animate-pulse">
            <AlertTriangle size={18} className="text-red-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-800">已临时锁定</p>
              <p className="text-xs text-red-700 mt-0.5">
                请等待 <b>{m}:{s.toString().padStart(2, '0')}</b> 后再试。
                连续失败 5 次触发，保护您的密码不被暴力破解。
              </p>
            </div>
          </div>
        )}

        {!isLocked && failed > 0 && (
          <p className="mt-3 text-xs text-orange-600 flex items-center gap-1">
            <AlertTriangle size={12} /> 最近已失败 {failed} 次，失败 5 次将临时锁定。
          </p>
        )}

        {err && (
          <p className="mt-3 p-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            {err}
          </p>
        )}

        <div className="flex-1" />

        <button
          type="submit"
          disabled={!pwd || isLocked || busy}
          className={cn(
            'w-full py-3 rounded-xl font-semibold text-white transition-all shadow-lg flex items-center justify-center gap-2',
            pwd && !isLocked && !busy ? 'bg-brand-500 hover:bg-brand-600 active:scale-[0.99]' : 'bg-slate-300 cursor-not-allowed shadow-none'
          )}
        >
          <LogIn size={18} />
          {busy ? '解密中（PBKDF2 650,000次迭代）…' : '解锁保管库'}
        </button>

        {onGoRegister && (
          <p className="mt-3 text-center text-xs text-slate-500">
            还没有保管库？{' '}
            <button type="button" onClick={onGoRegister} className="text-brand-600 hover:underline font-semibold">
              创建新保管库
            </button>
          </p>
        )}
        <p className="mt-2 text-center text-[10px] text-slate-400 pb-3">
          AES-256-GCM · PBKDF2 650,000次 · 本地零知识 · DK不写磁盘
        </p>
      </form>
    </div>
  );
};
