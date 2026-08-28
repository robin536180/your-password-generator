/**
 * options/main.tsx - Options 管理页入口
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import '@/index.css';
import { OptionsApp } from '@/options/App';

const container = document.getElementById('root');
if (!container) throw new Error('#root not found');
createRoot(container).render(
  <React.StrictMode>
    <OptionsApp />
  </React.StrictMode>,
);
