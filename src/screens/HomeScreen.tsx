/**
 * screens/HomeScreen.tsx - M1 MVP Home：解锁后展示「已解锁」占位页
 *
 * 完整的 item CRUD / 24 分类 UI 属于 M2，M1 只需要保证：
 *   ✅ 解锁成功能进入，显示 meta 信息
 *   ✅ 手动锁定按钮
 *   ✅ 显示 settings（自动锁定时间等）
 *   ✅ Watchtower 概览（纯本地，不联网）
 */
import React from 'react';
import { Lock, Shield, ShieldCheck, Settings2 } from 'lucide-react';
import { useVaultStore } from '@/store/vaultStore';

export const HomeScreen: React.FC = () => {
  const meta = useVaultStore((s) => s.meta);
  const snap = useVaultStore((s) => s.vaultSnapshot);
  const lock = useVaultStore((s) => s.lockVault);
  const sessionId = useVaultStore((s) => s.sessionId);

  if (!snap || !meta) return <div className="p-4">状态异常…</div>;

  const settings = snap.settings;
  const itemsTotal = snap.items.length;
  const trashedTotal = snap.deleted.length;
  const favorites = snap.items.filter((i) => i.favorite).length;

  const card = (title: string, value: string | number, color: string) => (
    <div className={`rounded-xl p-3 ${color} shadow-sm`}>
      <p className="text-[11px] opacity-80">{title}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="px-4 pt-4 pb-3 bg-gradient-to-br from-brand-500 to-brand-700 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-white/20">
              <ShieldCheck size={18} />
            </div>
            <div>
              <p className="text-[11px] opacity-80">已安全解锁</p>
              <p className="text-sm font-semibold leading-tight">{meta.accountEmail || '本地保管库'}</p>
            </div>
          </div>
          <button
            onClick={() => lock()}
            className="p-2 rounded-lg bg-white/15 hover:bg-white/25 transition flex items-center gap-1.5 text-sm font-medium"
            title="锁定保管库（清空内存中的主密钥DK）"
          >
            <Lock size={15} /> <span className="hidden sm:inline">锁定</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 统计卡片 */}
        <div className="grid grid-cols-3 gap-2">
          {card('总项目数', itemsTotal, 'bg-white text-brand-700')}
          {card('⭐ 收藏', favorites, 'bg-amber-50 text-amber-700')}
          {card('回收站', trashedTotal, 'bg-slate-100 text-slate-700')}
        </div>

        {/* Settings 卡 */}
        <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-2">
            <Settings2 size={16} className="text-brand-500" /> 安全设置（M1 MVP）
          </h3>
          <ul className="text-xs text-slate-600 space-y-1.5">
            <li className="flex justify-between"><span>⏰ 自动锁定</span><b>{settings.autoLockMinutes} 分钟无操作后</b></li>
            <li className="flex justify-between"><span>📋 剪贴板自动清空</span><b>{settings.clipboardClearSeconds} 秒</b></li>
            <li className="flex justify-between"><span>🛡️ PBKDF2 迭代</span><b>{settings.pbkdf2Iterations.toLocaleString()} 次</b></li>
            <li className="flex justify-between"><span>🌐 Watchtower HIBP</span><b>{settings.hibpOffline ? '纯本地模式 (MVP)' : '已启用（联网）'}</b></li>
            <li className="flex justify-between"><span>🛫 旅行模式</span><b>{settings.travelMode ? '开启' : '关闭'}</b></li>
            <li className="flex justify-between"><span>🔑 保管库结构版本</span><b>v{settings.vaultSchemaVersion}</b></li>
          </ul>
        </div>

        {/* Security status */}
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 flex items-start gap-2">
          <Shield size={18} className="text-emerald-600 mt-0.5 shrink-0" />
          <div className="text-xs text-emerald-800">
            <p className="font-bold">✅ M1 安全底座运行中</p>
            <p className="mt-1 opacity-90">
              数据全程 AES-256-GCM 加密；主密钥 DK 仅保存在内存中，
              绝对未写入 chrome.storage.local；<br />
              您可随时检查 <code>chrome.storage.local</code> 确认仅含 Base64 密文。
            </p>
            <p className="mt-1 opacity-80">会话ID: {sessionId}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
