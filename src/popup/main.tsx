/**
 * popup/main.tsx - Popup 入口
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import '@/index.css';
import { PopupApp } from '@/popup/App';

const container = document.getElementById('root');
if (!container) throw new Error('#root not found');
createRoot(container).render(
  <React.StrictMode>
    <PopupApp />
  </React.StrictMode>,
);
