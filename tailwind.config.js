/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // 深色运动风主题
        primary: '#FF6B35',      // 主色：活力橙
        primarydim: '#D9572820',
        bg: '#1A1A2E',           // 背景
        card: '#16213E',         // 卡片
        card2: '#1F2A4D',        // 次级卡片
        ink: '#EAEAEA',          // 主文字
        muted: '#9AA3B8',        // 次要文字
        line: '#2A3354',         // 分割线
        green: '#22C55E',
        yellow: '#FACC15',
        red: '#EF4444',
        gray: '#6B7280',
      },
      borderRadius: {
        xl: '16px',
        '2xl': '20px',
      },
      boxShadow: {
        card: '0 6px 20px rgba(0,0,0,0.35)',
        glow: '0 0 0 1px rgba(255,107,53,0.35), 0 8px 24px rgba(255,107,53,0.25)',
      },
      keyframes: {
        fadein: { '0%': { opacity: 0, transform: 'translateY(6px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        pop: { '0%': { transform: 'scale(0.96)', opacity: 0 }, '100%': { transform: 'scale(1)', opacity: 1 } },
        slideup: { '0%': { transform: 'translateY(100%)' }, '100%': { transform: 'translateY(0)' } },
        pulse2: { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.5 } },
      },
      animation: {
        fadein: 'fadein 0.35s ease both',
        pop: 'pop 0.25s ease both',
        slideup: 'slideup 0.3s ease both',
        pulse2: 'pulse2 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
