/**
 * generator/App.tsx - 公开生成器（免登录）
 *
 * 设计约束（前台可用）：
 *  1. 绝不引用保管库状态、后台 IPC 通道或任何登录屏组件，页面打开即用，不触发注册/解锁
 *  2. 不读写浏览器本地存储，不读取保管库快照，生成结果只存在当前页面内存
 *  3. 同一组件同时服务「独立页面」与「popup 紧凑模式」
 */
import React, { useState } from 'react';
import { KeyRound, UserRound, ShieldCheck, Wand2, ArrowUpRight, Lock } from 'lucide-react';
import { PasswordGenerator } from '@/components/PasswordGenerator';
import { UsernameGenerator } from '@/components/UsernameGenerator';
import { cn } from '@/lib/utils';

/** 扩展内绝对地址（popup 与独立页面共用，避免相对路径差异） */
const extUrl = (path: string): string => {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) return chrome.runtime.getURL(path);
  } catch {
    /* 非扩展环境回退相对路径 */
  }
  return `../${path.replace(/^src\//, '')}`;
};

export interface PublicGeneratorAppProps {
  /** popup 紧凑模式：无大页头，纵向滚动 */
  compact?: boolean;
}

export const PublicGeneratorApp: React.FC<PublicGeneratorAppProps> = ({ compact = false }) => {
  const [kind, setKind] = useState<'password' | 'username'>('password');
  const [pwd, setPwd] = useState('');
  const [usr, setUsr] = useState('');

  const switcher = (
    <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
      <button
        onClick={() => setKind('password')}
        className={cn(
          'px-3 py-1.5 rounded-lg text-[12px] font-semibold transition flex items-center gap-1.5',
          kind === 'password' ? 'bg-white text-brand-700 shadow' : 'text-slate-600 hover:text-slate-800',
        )}
      ><KeyRound size={13}/> 密码生成器</button>
      <button
        onClick={() => setKind('username')}
        className={cn(
          'px-3 py-1.5 rounded-lg text-[12px] font-semibold transition flex items-center gap-1.5',
          kind === 'username' ? 'bg-white text-brand-700 shadow' : 'text-slate-600 hover:text-slate-800',
        )}
      ><UserRound size={13}/> 用户名生成器</button>
    </div>
  );

  const generator = kind === 'password'
    ? <PasswordGenerator value={pwd} onChange={setPwd} hideInsert />
    : <UsernameGenerator value={usr} onChange={setUsr} hideInsert />;

  if (compact) {
    return (
      <div className="flex flex-col h-full min-h-0 bg-slate-50">
        <div className="px-3 pt-3 pb-2.5 space-y-2 border-b border-slate-200 bg-white">
          {switcher}
          <p className="text-[10.5px] text-slate-500 flex items-center gap-1">
            <ShieldCheck size={11} className="text-emerald-600" /> 免登录 · 完全本机生成 · 不读取保管库 · 不联网
          </p>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-3">{generator}</div>
        <div className="px-3 py-2 border-t border-slate-200 bg-white flex items-center justify-between gap-2">
          <a
            href={extUrl('src/generator/index.html')}
            target="_blank"
            rel="noreferrer"
            className="text-[11.5px] text-brand-600 hover:underline font-semibold flex items-center gap-1"
          >在独立页面打开 <ArrowUpRight size={12}/></a>
          <span className="text-[10.5px] text-slate-400 flex items-center gap-1"><Lock size={10}/> 无需登录</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="bg-gradient-to-r from-brand-700 to-brand-500 text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-6 py-6 flex flex-wrap items-center gap-4">
          <div className="p-3 rounded-2xl bg-white/20"><Wand2 size={26} /></div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold">1Pass Clone · 公开生成器</h1>
            <p className="text-xs opacity-90">无需登录 · 完全本机生成 · 不读取保管库 · 不联网</p>
          </div>
          <a
            href={extUrl('src/options/index.html')}
            className="ml-auto px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-sm font-semibold flex items-center gap-1.5 transition"
          ><KeyRound size={15} /> 进入保管库管理中心 <ArrowUpRight size={14} /></a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        <div className="grid lg:grid-cols-[minmax(0,540px),1fr] gap-6 items-start">
          <div className="space-y-3">
            {switcher}
            {generator}
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
            <h2 className="font-bold text-slate-700 flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-600" /> 为什么可以免登录使用？
            </h2>
            <div className="mt-3 space-y-2.5 text-[12px] text-slate-600">
              <p>· 生成器只依赖浏览器内置的 <b>crypto.getRandomValues</b>，与保管库、主密码、Secret Key 完全解耦。</p>
              <p>· 打开本页不会触发注册或解锁流程，也不会读取浏览器本地存储中的任何保管库数据。</p>
              <p>· 生成结果只存在于当前页面内存，关闭页面即消失；需要保存请进入管理中心登录后新建或编辑项目。</p>
              <p>· 支持全部模式：随机 / 易记 / PIN / 国密（SM3·SM4）/ 自定义算法，以及随机 / 易记 / 自定义用户名。</p>
            </div>
            <div className="mt-4 rounded-xl bg-slate-50 border border-slate-100 p-3 text-[11px] text-slate-500">
              安全提示：复制后请尽快粘贴保存，避免剪贴板被其他程序读取。管理中心「生成器」Tab 保留完整配置入口，供已登录用户使用。
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default PublicGeneratorApp;
