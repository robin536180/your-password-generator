/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx,html}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // 1Password 深蓝品牌色
        brand: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#0061ff',  // 主色调 1P蓝
          600: '#0052cc',
          700: '#202a51',  // 弹窗背景深蓝色
          800: '#1a2347',
          900: '#141b38',
        },
        surface: {
          50:  '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
        },
        watchtower: {
          weak:     '#ef4444',  // 红 弱密码
          reused:   '#f59e0b',  // 橙 重复密码
          breached: '#dc2626',  // 深红 已泄露
          good:     '#10b981',  // 绿 安全
          okay:     '#0ea5e9',  // 蓝 可接受
        }
      },
      fontFamily: {
        sans: [
          '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto',
          'Helvetica', 'Arial', 'PingFang SC', 'Hiragino Sans GB',
          'Microsoft YaHei', 'sans-serif',
        ],
        mono: [
          'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco',
          'Consolas', 'Liberation Mono', 'Courier New', 'monospace',
        ],
      },
      borderRadius: {
        lg: '12px',
        xl: '16px',
      },
      boxShadow: {
        'card':  '0 4px 12px rgba(0, 0, 0, 0.08)',
        'card-hover': '0 8px 24px rgba(0, 97, 255, 0.12)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
