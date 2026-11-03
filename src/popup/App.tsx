/**
 * popup/App.tsx - Popup 总路由（注册 / 解锁 / Home / 免登录生成器）
 */
import React, { useEffect } from 'react';
import { KeyRound, Wand2 } from 'lucide-react';
import { useVaultStore } from '@/store/vaultStore';
import { RegisterScreen } from '@/screens/RegisterScreen';
import { UnlockScreen } from '@/screens/UnlockScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { PublicGeneratorApp } from '@/generator/App';
import { Log } from '@/core/logger';
import { ipcCall } from '@/store/vaultStore';
import { cn } from '@/lib/utils';

export const PopupApp: React.FC = () => {
  const status = useVaultStore((s) => s.status);
  const refresh = useVaultStore((s) => s.refreshStatus);
  const [forceRegister, setForceRegister] = React.useState(false);
  /** 免登录生成器：默认关闭，未解锁时可在顶部切换 */
  const [guest, setGuest] = React.useState(false);

  useEffect(() => {
    // Warmup: 立即发一次最轻量的 IPC 来强制唤醒 MV3 Service Worker，
    // 吸收冷启动竞态窗口（sendMessage 会触发 SW 启动）。即使这一次返回 Receiving-end，
    // ipcCall 内部的 3 次重试机制也会自动兜底。
    ipcCall('VAULT_EXISTS').catch(() => {});
    refresh();
    Log.info('POPUP:MOUNT', `Popup 打开，session=${useVaultStore.getState().sessionId}, init status=${status}`);
  }, []); // eslint-disable-line

  const renderByStatus = () => {
    if (forceRegister || status === 'UNINITIALIZED') {
      return (
        <RegisterScreen
          onBackToUnlock={forceRegister ? () => setForceRegister(false) : undefined}
          onDone={() => { setForceRegister(false); refresh(); }}
        />
      );
    }
    if (status === 'LOCKED') {
      return <UnlockScreen onGoRegister={() => setForceRegister(true)} />;
    }
    return <div className="p-4 text-sm text-slate-500">读取状态中…</div>;
  };

  const unlocked = status === 'UNLOCKED' && !forceRegister;

  return (
    <div className="h-full w-full flex flex-col relative">
      {!unlocked && (
        <div className="flex items-center gap-1 p-1.5 bg-slate-100 border-b border-slate-200 shrink-0">
          <button
            onClick={() => setGuest(false)}
            className={cn(
              'flex-1 py-1.5 rounded-lg text-[12px] font-semibold transition flex items-center justify-center gap-1',
              !guest ? 'bg-white text-brand-700 shadow' : 'text-slate-600 hover:text-slate-800',
            )}
          ><KeyRound size={12}/> 保管库登录</button>
          <button
            onClick={() => setGuest(true)}
            className={cn(
              'flex-1 py-1.5 rounded-lg text-[12px] font-semibold transition flex items-center justify-center gap-1',
              guest ? 'bg-white text-brand-700 shadow' : 'text-slate-600 hover:text-slate-800',
            )}
          ><Wand2 size={12}/> 免登录生成器</button>
        </div>
      )}
      <div className="flex-1 min-h-0">
        {unlocked ? <HomeScreen /> : guest ? <PublicGeneratorApp compact /> : renderByStatus()}
      </div>
    </div>
  );
};
