/**
 * screens/RegisterScreen.tsx - 注册屏（首次使用：创建新保管库）
 *
 * 步骤：
 *   ① 邮箱 + 主密码（2次确认 + 强度条）
 *   ② 系统生成 Secret Key → 展示给用户
 *   ③ 强制下载 Emergency Kit PNG（阻塞式：不下载无法进入下一步）
 *   ④ 用户确认 "我已妥善保存 Secret Key 和 Emergency Kit"
 *   ⑤ 完成注册 → 进入「解锁状态 LOCKED 等待解锁
 */
import React, { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Download, Eye, EyeOff, KeyRound, Mail, ShieldAlert, ShieldCheck } from 'lucide-react';
import { generateSecretKey, isValidSecretKeyFormat, CRYPTO_CONFIG } from '@/core/crypto';
import { calcEntropyBits } from '@/lib/utils';
import { useVaultStore } from '@/store/vaultStore';
import { generateEmergencyKitPng, downloadEmergencyKit } from '@/core/emergency-kit';
import { Log } from '@/core/logger';
import { cn } from '@/lib/utils';

type Step = 1 | 2 | 3 | 4;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const strengthLabel = (bits: number) => {
  if (bits < 40) return { label: '极弱', color: 'bg-red-500', pct: 10, text: 'text-red-600' };
  if (bits < 60) return { label: '弱',   color: 'bg-orange-500', pct: 30, text: 'text-orange-600' };
  if (bits < 80) return { label: '中等', color: 'bg-yellow-500', pct: 55, text: 'text-yellow-700' };
  if (bits < 110) return { label: '强', color: 'bg-lime-500', pct: 80, text: 'text-lime-700' };
  return { label: '极强', color: 'bg-emerald-500', pct: 100, text: 'text-emerald-700' };
};

export const RegisterScreen: React.FC<{ onBackToUnlock?: () => void; onDone?: () => void }> = ({ onBackToUnlock, onDone }) => {
  const registerVault = useVaultStore((s) => s.registerVault);

  const [step, setStep] = useState<Step>(1);
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sk, setSk] = useState<string | null>(null);
  const [ekDownloaded, setEkDownloaded] = useState(false);
  const [ekPreview, setEkPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const entropy = useMemo(() => calcEntropyBits(pwd), [pwd]);
  const strength = useMemo(() => strengthLabel(entropy), [entropy]);
  const okEmail = email.length === 0 || EMAIL_RE.test(email);
  const okPwdMatch = pwd.length > 0 && pwd === pwd2;
  const okPwdStrength = entropy >= 60;
  const canStep1 = !!okEmail && pwd.length >= 8 && okPwdMatch && okPwdStrength;

  const goStep2 = async () => {
    if (!canStep1) return;
    setError(null);
    setBusy(true);
    try {
      const newSk = generateSecretKey();
      if (!isValidSecretKeyFormat(newSk)) throw new Error('Secret Key 生成失败，请重试');
      setSk(newSk);
      setStep(2);
      Log.info('UI:REGISTER', `Step1→2 密码强度=${entropy}bits, email=${email}`);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const goStep3 = async () => {
    if (!sk) return;
    setError(null);
    setBusy(true);
    try {
      const { dataUrl, blob } = await generateEmergencyKitPng({
        accountEmail: email,
        secretKey: sk,
        createdAt: Date.now(),
      });
      setEkPreview(dataUrl);
      const fname = downloadEmergencyKit(blob, email);
      Log.info('UI:REGISTER', `Step2→3 紧急工具包下载文件名: ${fname}`);
      setEkDownloaded(true);
      setStep(3);
    } catch (e: any) {
      setError(`紧急工具包生成失败：${e.message || String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const confirmFinish = async () => {
    if (!sk || !ekDownloaded) return;
    setBusy(true);
    setError(null);
    try {
      const r = await registerVault({ masterPassword: pwd, accountEmail: email, secretKey: sk });
      if (!r.ok) {
        setError(r.error ?? '注册失败');
        return;
      }
      Log.info('UI:REGISTER', `Step4→完成 保管库初始化成功`);
      setStep(4);
      setTimeout(() => onDone?.(), 1800);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-brand-50/70 via-white to-slate-50">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-center gap-2">
        {onBackToUnlock && step === 1 && (
          <button onClick={onBackToUnlock} className="p-1.5 rounded-lg hover:bg-slate-200/50 transition text-slate-600" aria-label="返回">
            <ArrowLeft size={18} />
          </button>
        )}
        <div className="flex items-center gap-2 text-brand-700">
          <KeyRound size={20} />
          <span className="font-semibold">1Pass Clone · 创建新保管库</span>
        </div>
        <div className="ml-auto flex gap-1">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={cn(
                'w-7 h-1.5 rounded-full transition-colors',
                step >= i ? 'bg-brand-500' : 'bg-slate-200',
              )}
            />
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 pb-5">
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-brand-700 flex items-center gap-2">
                <ShieldCheck size={22} /> 开始设置您的保管库
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                您的数据使用 AES-256-GCM 在本地加密，我们（或任何第三方）都无法访问。
                主密码 + Secret Key 同时丢失 = 永久无法恢复。
              </p>
            </div>

            {/* 邮箱 */}
            <label className="block">
              <span className="text-xs font-semibold text-slate-600 flex items-center gap-1"><Mail size={12}/>邮箱地址（可选，用于识别您的保管库）</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={cn(
                  'mt-1 w-full px-3 py-2.5 rounded-xl border-2 bg-white/80 transition focus:outline-none focus:ring-2 focus:ring-brand-300',
                  okEmail ? 'border-slate-200' : 'border-red-300 focus:border-red-400'
                )}
              />
              {!okEmail && <p className="text-xs text-red-600 mt-1">邮箱格式不正确</p>}
            </label>

            {/* 主密码 */}
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">主密码（至少 8 位，建议 ≥60bit熵值）</span>
              <div className="mt-1 relative">
                <input
                  type={show ? 'text' : 'password'}
                  value={pwd}
                  onChange={(e) => setPwd(e.target.value)}
                  placeholder="选择一个足够强且您能记住的主密码"
                  className="w-full px-3 pr-10 py-2.5 rounded-xl border-2 border-slate-200 bg-white/80 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-300"
                />
                <button
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-600"
                  aria-label={show ? '隐藏' : '显示'}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {/* 强度条 */}
              <div className="mt-2">
                <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div className={cn('h-full transition-all duration-500', strength.color)} style={{ width: `${strength.pct}%` }} />
                </div>
                <div className="mt-1 flex justify-between items-center text-xs">
                  <span className={cn('font-semibold', strength.text)}>
                    {entropy === 0 ? '尚未输入' : `强度：${strength.label}（${entropy.toFixed(0)} bits）`}
                  </span>
                  <span className="text-slate-400">
                    PBKDF2 迭代 {CRYPTO_CONFIG.PBKDF2_ITERATIONS.toLocaleString()} 次
                  </span>
                </div>
                {pwd.length > 0 && !okPwdStrength && (
                  <p className="mt-1 text-xs text-orange-600 flex items-start gap-1">
                    <ShieldAlert size={12} className="mt-0.5 shrink-0" /> 建议至少 60 bits（12位以上大小写数字+符号组合）
                  </p>
                )}
              </div>
            </label>

            {/* 确认主密码 */}
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">再次输入主密码</span>
              <input
                type={show ? 'text' : 'password'}
                value={pwd2}
                onChange={(e) => setPwd2(e.target.value)}
                placeholder="与上面输入保持一致"
                className={cn(
                  'mt-1 w-full px-3 py-2.5 rounded-xl border-2 bg-white/80 focus:outline-none focus:ring-2 focus:ring-brand-300',
                  pwd2.length === 0 || okPwdMatch ? 'border-slate-200' : 'border-red-300 focus:border-red-400'
                )}
              />
              {pwd2.length > 0 && !okPwdMatch && (
                <p className="mt-1 text-xs text-red-600">两次输入的主密码不一致</p>
              )}
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
          <h2 className="text-xl font-bold text-brand-700 flex items-center gap-2">
            <KeyRound size={22} /> 您的 Secret Key（最重要！）
          </h2>
          <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 space-y-2">
            <p className="text-sm text-amber-800">
              ⚠️ 这是恢复您保管库需要的双因素之一。<br/>
              丢失 = 无法恢复，请保存到打印纸上（离线）或 U 盘加密分区，
              切勿上传到任何云盘/邮箱。
            </p>
            <div className="mt-2 p-3 rounded-xl bg-white border border-amber-200 font-mono text-lg tracking-wider text-brand-700 font-bold select-all break-all">
              {sk}
            </div>
            <p className="text-xs text-amber-700">格式：{CRYPTO_CONFIG.SECRET_KEY_PREFIX}-XXXX-XXXX-XXXX-XXXX（128 bits）</p>
          </div>
        </div>
        )}

        {step === 3 && ekPreview && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-brand-700 flex items-center gap-2">
              <Download size={22} /> 紧急工具包下载
            </h2>
            <div className="p-3 rounded-2xl bg-emerald-50 border-2 border-emerald-300 flex items-start gap-2">
              <CheckCircle2 size={20} className="text-emerald-600 mt-0.5" />
              <div className="text-sm text-emerald-800">
                <p className="font-semibold">已下载到默认下载目录</p>
                <p className="text-xs mt-0.5">
                  文件名形如 <code className="bg-white px-1 rounded">1PassClone_EmergencyKit_*.png</code>。
                  请打开确认图片完整后再继续。
                </p>
              </div>
            </div>
            <div className="rounded-2xl overflow-hidden border-2 border-slate-200 shadow-md bg-white">
              <img src={ekPreview} alt="Emergency Kit 预览" className="w-full h-auto" />
            </div>
            <label className="block flex items-start gap-2 p-3 rounded-xl bg-slate-100 hover:bg-slate-200/70 cursor-pointer transition">
              <input type="checkbox" checked={ekDownloaded} onChange={(e) => setEkDownloaded(e.target.checked)} className="mt-0.5 w-4 h-4 accent-brand-500" />
              <span className="text-sm text-slate-700">
                我已将紧急工具包 PNG 保存到安全位置（打印或离线U盘），明白若丢失无法恢复。
              </span>
            </label>
          </div>
        )}

        {step === 4 && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="mx-auto w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
                <ShieldCheck size={40} className="text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold text-brand-700">注册完成！</h2>
              <p className="text-sm text-slate-500">正在进入解锁界面…请使用刚刚设置的主密码解锁。</p>
            </div>
          </div>
        )}

        {error && step !== 4 && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* Footer 按钮区 */}
      {step < 4 && (
        <div className="px-5 py-3 border-t border-slate-200 bg-white/60 backdrop-blur">
          {step === 1 && (
            <button
              disabled={!canStep1 || busy}
              onClick={goStep2}
              className={cn(
                'w-full py-2.5 rounded-xl font-semibold text-white transition-all shadow-md',
                canStep1 && !busy ? 'bg-brand-500 hover:bg-brand-600 active:scale-[0.99]' : 'bg-slate-300 cursor-not-allowed shadow-none'
              )}
            >
              {busy ? '处理中…' : '下一步：生成 Secret Key'}
            </button>
          )}
          {step === 2 && (
            <div className="flex gap-2">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2.5 rounded-xl font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
              >返回</button>
              <button
                disabled={busy || !sk}
                onClick={goStep3}
                className={cn(
                  'flex-1 py-2.5 rounded-xl font-semibold text-white transition-all shadow-md flex items-center justify-center gap-2',
                  !busy ? 'bg-brand-500 hover:bg-brand-600 active:scale-[0.99]' : 'bg-slate-300 cursor-not-allowed shadow-none'
                )}
              >
                <Download size={18} /> {busy ? '生成中…' : '下载紧急工具包（必须）'}
              </button>
            </div>
          )}
          {step === 3 && (
            <div className="flex gap-2">
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2.5 rounded-xl font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition">返回</button>
              <button
                disabled={!ekDownloaded || busy}
                onClick={confirmFinish}
                className={cn(
                  'flex-1 py-2.5 rounded-xl font-semibold text-white transition-all shadow-md',
                  ekDownloaded && !busy ? 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99]' : 'bg-slate-300 cursor-not-allowed shadow-none'
                )}
              >
                {busy ? '初始化保管库中…' : '✅ 我已保存，完成注册'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
