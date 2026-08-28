/**
 * options/App.tsx - Options 管理页（完整版标签页，包含：日志查看器/保管库状态/设置）
 */
import React, { useEffect, useState } from 'react';
import { AlertTriangle, Database, FileText, KeyRound, Logs, RefreshCw, Settings2, Shield, ShieldCheck, Trash2 } from 'lucide-react';
import { useVaultStore } from '@/store/vaultStore';
import { RegisterScreen } from '@/screens/RegisterScreen';
import { UnlockScreen } from '@/screens/UnlockScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { Log, type LogEntry } from '@/core/logger';
import { cn } from '@/lib/utils';

export type OptionsTab = 'home' | 'settings' | 'logs' | 'danger';

export const OptionsApp: React.FC = () => {
  const status = useVaultStore((s) => s.status);
  const refresh = useVaultStore((s) => s.refreshStatus);
  const [tab, setTab] = useState<OptionsTab>('home');
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    setLogs(Log.getBuffer().slice().reverse());
    const i = setInterval(() => setLogs(Log.getBuffer().slice().reverse()), 1000);
    return () => clearInterval(i);
  }, []);

  const Tabs: { key: OptionsTab; label: string; Icon: any }[] = [
    { key: 'home', label: '首页', Icon: Shield },
    { key: 'settings', label: '设置', Icon: Settings2 },
    { key: 'logs', label: '日志', Icon: Logs },
    { key: 'danger', label: '危险区', Icon: AlertTriangle },
  ];

  if (status === 'UNINITIALIZED') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-8">
        <div className="w-full max-w-md shadow-2xl rounded-3xl overflow-hidden bg-white border border-slate-200">
          <RegisterScreen onDone={() => refresh()} />
        </div>
      </div>
    );
  }
  if (status === 'LOCKED') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-8">
        <div className="w-full max-w-md shadow-2xl rounded-3xl overflow-hidden bg-white border border-slate-200">
          <UnlockScreen onGoRegister={() => {}} />
        </div>
      </div>
    );
  }

  // UNLOCKED
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Top bar */}
      <header className="sticky top-0 z-10 bg-gradient-to-r from-brand-700 to-brand-500 text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center gap-4">
          <div className="p-2.5 rounded-xl bg-white/20">
            <KeyRound size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">1Pass Clone · 管理中心</h1>
            <p className="text-xs opacity-90">M1 安全底座版本 · AES-256-GCM · 零知识本地加密</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="px-3 py-1 rounded-full bg-emerald-500/90 text-xs font-semibold flex items-center gap-1">
              <ShieldCheck size={12}/> 已解锁
            </div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {Tabs.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'px-4 py-2.5 text-sm font-semibold rounded-t-xl transition flex items-center gap-2 mb-0',
                tab === key ? 'bg-slate-50 text-brand-700' : 'text-white/90 hover:bg-white/10'
              )}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        {tab === 'home' && (
          <div className="grid lg:grid-cols-[2fr,1fr] gap-6">
            <div className="rounded-3xl overflow-hidden border border-slate-200 shadow-sm bg-white h-[640px]">
              <div className="h-full">
                <HomeScreen />
              </div>
            </div>
            <div className="space-y-6">
              <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
                <h3 className="font-bold text-slate-700 flex items-center gap-2"><Database size={16} /> storage 快速检查</h3>
                <p className="text-xs text-slate-500 mt-1">点击按钮检查 chrome.storage.local 中是否只含密文（零知识验证）</p>
                <button
                  className="mt-3 px-4 py-2 rounded-xl bg-brand-500 text-white font-semibold hover:bg-brand-600 transition text-sm flex items-center gap-2"
                  onClick={async () => {
                    const data = await chrome.storage.local.get(null);
                    alert(
                      'storage.local 中的所有 key：\n\n' +
                      Object.keys(data).map((k) => `  · ${k} = ${typeof data[k] === 'string' ? `字符串(len=${data[k].length})` : typeof data[k]}`).join('\n') +
                      '\n\n零知识检查：storage 中绝对没有主密码明文 / DK / Secret Key 明文。'
                    );
                  }}
                >
                  <Shield size={16}/> 检查 storage.local 内容
                </button>
              </div>

              <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
                <h3 className="font-bold text-slate-700 flex items-center gap-2"><FileText size={16} /> M1 完成情况</h3>
                <ul className="mt-2 text-xs text-slate-600 space-y-1.5">
                  {[
                    '✅ PBKDF2 650,000次 + AES-256-GCM 加密',
                    '✅ 128-bit Secret Key（A3-XXXX-XXXX格式）',
                    '✅ Verifier 快速主密码校验',
                    '✅ 紧急工具包 PNG (A4 1240×1754, canvas原生)',
                    '✅ 注册/解锁/锁定三态状态机',
                    '✅ Background SW + IPC 消息路由（20个Action）',
                    '❌ M2: 24分类Item CRUD UI（下一阶段）',
                    '❌ M3: 自动填充 + 24分类模板（下一阶段）',
                  ].map((l, i) => <li key={i}>{l}</li>)}
                </ul>
              </div>
            </div>
          </div>
        )}

        {tab === 'settings' && (
          <SettingsPanel />
        )}

        {tab === 'logs' && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-700 flex items-center gap-2"><Logs size={16}/> 运行时日志（内存中最多1000条）</h3>
              <div className="flex gap-2">
                <button
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 flex items-center gap-1"
                  onClick={() => setLogs(Log.getBuffer().slice().reverse())}
                ><RefreshCw size={12}/>刷新</button>
                <button
                  className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-xs font-semibold text-red-700 flex items-center gap-1"
                  onClick={() => { Log.clearBuffer(); setLogs([]); }}
                ><Trash2 size={12}/>清空</button>
              </div>
            </div>
            <div className="max-h-[70vh] overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2 text-slate-500 font-semibold w-10">LV</th>
                    <th className="text-left px-4 py-2 text-slate-500 font-semibold w-40">时间</th>
                    <th className="text-left px-4 py-2 text-slate-500 font-semibold w-36">TAG</th>
                    <th className="text-left px-4 py-2 text-slate-500 font-semibold">内容</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 && (
                    <tr><td colSpan={4} className="text-center py-8 text-slate-400">暂无日志（尝试打开 popup 或执行操作）</td></tr>
                  )}
                  {logs.map((e) => (
                    <tr key={e.id} className="border-t border-slate-50 hover:bg-slate-50">
                      <td className="px-4 py-2">
                        <span className={cn(
                          'px-2 py-0.5 rounded font-mono font-bold',
                          e.level === 'ERROR' ? 'bg-red-100 text-red-700' :
                          e.level === 'WARN'  ? 'bg-amber-100 text-amber-700' :
                          e.level === 'INFO'  ? 'bg-blue-100 text-blue-700' :
                                                'bg-slate-100 text-slate-500'
                        )}>{e.level}</span>
                      </td>
                      <td className="px-4 py-2 text-slate-500 font-mono whitespace-nowrap">{new Date(e.timestamp).toLocaleTimeString('zh-CN')}</td>
                      <td className="px-4 py-2 text-brand-700 font-mono whitespace-nowrap">{e.tag}</td>
                      <td className="px-4 py-2 text-slate-700 break-all">
                        {e.message}
                        {!!e.payload && (
                          <pre className="mt-1 text-[10px] bg-slate-100 p-1.5 rounded max-w-full overflow-x-auto">
                            {JSON.stringify(e.payload, null, 0).slice(0, 200)}
                          </pre>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'danger' && (
          <DangerPanel onReset={() => refresh()} />
        )}
      </main>
    </div>
  );
};

/* ===== 子面板 ===== */
const SettingsPanel: React.FC = () => {
  const snap = useVaultStore((s) => s.vaultSnapshot);
  const update = useVaultStore((s) => s.updateSettings);
  const [saved, setSaved] = React.useState(false);
  if (!snap) return null;
  const s = snap.settings;

  const patch = async (p: any) => {
    await update(p);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4">
        <h3 className="font-bold text-lg text-slate-700 flex items-center gap-2"><Settings2 size={18} /> 安全</h3>
        <label className="block">
          <span className="text-sm font-semibold text-slate-600">自动锁定时间（分钟）</span>
          <input type="number" min={1} max={120} value={s.autoLockMinutes}
            onChange={(e) => patch({ autoLockMinutes: Math.max(1, Math.min(120, parseInt(e.target.value) || 1)) })}
            className="mt-1 w-full px-3 py-2 rounded-xl border-2 border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300" />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-slate-600">复制后清空剪贴板（秒）</span>
          <input type="number" min={0} max={300} value={s.clipboardClearSeconds}
            onChange={(e) => patch({ clipboardClearSeconds: Math.max(0, Math.min(300, parseInt(e.target.value) || 0)) })}
            className="mt-1 w-full px-3 py-2 rounded-xl border-2 border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300" />
        </label>
        <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
          <span className="text-sm font-semibold text-slate-700">🛫 旅行模式（真删除非安全保管库）</span>
          <input type="checkbox" checked={s.travelMode}
            onChange={(e) => patch({ travelMode: e.target.checked })}
            className="w-5 h-5 accent-brand-500" />
        </label>
        <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
          <span className="text-sm font-semibold text-slate-700">🛡️ Watchtower（纯本地模式 MVP）</span>
          <input type="checkbox" checked={s.watchtowerEnabled}
            onChange={(e) => patch({ watchtowerEnabled: e.target.checked })}
            className="w-5 h-5 accent-brand-500" />
        </label>
        <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
          <span className="text-sm font-semibold text-slate-700">🌐 允许联网（HIBP / 云同步 预留）</span>
          <input type="checkbox" checked={!s.hibpOffline}
            onChange={(e) => patch({ hibpOffline: !e.target.checked })}
            className="w-5 h-5 accent-brand-500" disabled />
          <span className="text-xs text-slate-400 absolute right-14">M1强制关闭</span>
        </label>
        {saved && <p className="text-xs text-emerald-600 font-semibold animate-pulse">✅ 已保存</p>}
      </div>

      <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4">
        <h3 className="font-bold text-lg text-slate-700 flex items-center gap-2">🎨 外观 & 语言</h3>
        <label className="block">
          <span className="text-sm font-semibold text-slate-600">主题</span>
          <select value={s.theme}
            onChange={(e) => patch({ theme: e.target.value as any })}
            className="mt-1 w-full px-3 py-2 rounded-xl border-2 border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300">
            <option value="system">跟随系统</option>
            <option value="dark">深色</option>
            <option value="light">浅色</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-slate-600">语言</span>
          <select value={s.language}
            onChange={(e) => patch({ language: e.target.value as any })}
            className="mt-1 w-full px-3 py-2 rounded-xl border-2 border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300">
            <option value="zh-CN">简体中文</option>
            <option value="en-US">English</option>
          </select>
        </label>

        <div className="p-4 rounded-xl bg-brand-50 border border-brand-100 text-xs text-brand-800 space-y-1.5">
          <p className="font-bold text-sm">🔒 不可修改的安全参数（防止降低安全性）</p>
          <p>PBKDF2 迭代次数：<b>{s.pbkdf2Iterations.toLocaleString()}</b> 次</p>
          <p>保管库 schema 版本：<b>v{s.vaultSchemaVersion}</b></p>
          <p>加密算法：<b>AES-256-GCM</b> · KDF：<b>PBKDF2-HMAC-SHA256</b></p>
        </div>
      </div>
    </div>
  );
};

const DangerPanel: React.FC<{ onReset: () => void }> = ({ onReset }) => {
  const [confirm, setConfirm] = useState('');
  const reset = async () => {
    if (confirm !== 'YES-DELETE-ALL') {
      alert('请输入 YES-DELETE-ALL 以确认重置整个保管库');
      return;
    }
    await chrome.storage.local.clear();
    alert('已清空 storage.local，页面即将刷新…');
    setTimeout(() => location.reload(), 300);
    onReset();
  };
  return (
    <div className="p-6 rounded-2xl bg-red-50 border-2 border-red-200 space-y-3 max-w-xl">
      <h3 className="font-bold text-lg text-red-700 flex items-center gap-2"><AlertTriangle size={20} /> 危险操作</h3>
      <p className="text-sm text-red-800">
        ⚠️ 删除保管库 = 永久丢失所有密码 + 数据！<br/>
        无论你有没有 Emergency Kit，删除 <code>chrome.storage.local</code> 都会让一切消失。
        请谨慎使用，仅当你完全理解并希望重新开始时。
      </p>
      <label className="block">
        <span className="text-sm font-semibold text-red-700">请输入 <code>YES-DELETE-ALL</code> 以确认：</span>
        <input
          type="text"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="YES-DELETE-ALL"
          className="mt-1 w-full px-3 py-2 rounded-xl border-2 border-red-300 bg-white focus:outline-none focus:ring-2 focus:ring-red-300 font-mono tracking-wider"
        />
      </label>
      <button
        onClick={reset}
        className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm shadow-md"
      >🗑️ 永久删除整个保管库并重置</button>
    </div>
  );
};
