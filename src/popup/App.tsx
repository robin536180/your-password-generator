/**
 * popup/App.tsx - Popup 总路由（注册 / 解锁 / Home）
 */
import React, { useEffect } from 'react';
import { useVaultStore } from '@/store/vaultStore';
import { RegisterScreen } from '@/screens/RegisterScreen';
import { UnlockScreen } from '@/screens/UnlockScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { Log } from '@/core/logger';
import { ipcCall } from '@/store/vaultStore';

export const PopupApp: React.FC = () => {
  const status = useVaultStore((s) => s.status);
  const refresh = useVaultStore((s) => s.refreshStatus);
  const [forceRegister, setForceRegister] = React.useState(false);

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
    if (status === 'UNLOCKED') {
      return <HomeScreen />;
    }
    return <div className="p-4 text-sm text-slate-500">读取状态中…</div>;
  };

  return (
    <div className="h-full w-full flex flex-col relative">
      {renderByStatus()}
    </div>
  );
};
