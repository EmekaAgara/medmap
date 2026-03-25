/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Montserrat', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Semantic tokens — auto-switch via CSS variables on .dark
        nm: {
          bg:        'var(--nm-bg)',
          surface:   'var(--nm-surface)',
          card:      'var(--nm-card)',
          text:      'var(--nm-text)',
          muted:     'var(--nm-muted)',
          border:    'var(--nm-border)',
          primary:   'var(--nm-primary)',
          pfg:       'var(--nm-pfg)',
          secondary: 'var(--nm-secondary)',
        },
        gold: {
          DEFAULT: '#D4AF37',
          subtle:  'rgba(212,175,55,0.15)',
        },
      },
      borderRadius: {
        token: '4px',
      },
    },
  },
  plugins: [],
};
