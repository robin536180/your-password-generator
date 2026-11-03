/**
 * generator/main.tsx - 公开生成器页面入口（免登录）
 *
 * 该页面不依赖保管库、主密码或任何 IPC 通道，打开即可使用。
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import '@/index.css';
import { PublicGeneratorApp } from '@/generator/App';

const container = document.getElementById('root');
if (!container) throw new Error('#root not found');
createRoot(container).render(
  <React.StrictMode>
    <PublicGeneratorApp />
  </React.StrictMode>,
);
