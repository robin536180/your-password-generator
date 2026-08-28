import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx, type ManifestV3Export } from '@crxjs/vite-plugin';
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import manifest from './src/manifest.json';

const localesSrc = resolve(__dirname, 'src/_locales');
const localesCopyPlugin = (outDir: string) => ({
  name: 'copy-locales-postbuild',
  closeBundle() {
    const localesOut = resolve(__dirname, outDir, '_locales');
    if (!existsSync(localesSrc)) return;
    if (!existsSync(localesOut)) mkdirSync(localesOut, { recursive: true });
    const walk = (src: string, dst: string) => {
      for (const f of readdirSync(src)) {
        const s = join(src, f);
        const d = join(dst, f);
        if (statSync(s).isDirectory()) {
          if (!existsSync(d)) mkdirSync(d, { recursive: true });
          walk(s, d);
        } else {
          cpSync(s, d);
        }
      }
    };
    walk(localesSrc, localesOut);
    console.log(`[copy-locales] ✅ copied _locales → ${localesOut}`);
  },
});

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  plugins: [
    react(),
    crx({ manifest: manifest as unknown as ManifestV3Export }),
    localesCopyPlugin('dist'),
  ],
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'chrome120',
    minify: 'esbuild',
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        options: resolve(__dirname, 'src/options/index.html'),
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/vitest/setup.ts'],
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    css: false,
  },
});
