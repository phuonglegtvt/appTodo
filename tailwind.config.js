/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Design tokens từ Claude Design (docs/design). Dùng chung cho light + dark.
      colors: {
        bg: { DEFAULT: '#F5F5F6', dark: '#0D0D10' },
        surface: { DEFAULT: '#FFFFFF', 2: '#FAFAFA', dark: '#17171C', '2dark': '#1D1D23' },
        border: { DEFAULT: '#EAEAEC', dark: '#2A2A31' },
        text: { DEFAULT: '#1B1B1F', muted: '#71717A', dark: '#F3F3F5', 'muted-dark': '#9A9AA4' },
        primary: { DEFAULT: '#4F46E5', soft: '#EEEDFF', dark: '#8B87F5', 'soft-dark': '#211F3A' },
        priority: { high: '#E5484D', medium: '#EAB308', low: '#12A150' },
      },
      borderRadius: { sm: '8px', md: '10px', lg: '12px', xl: '16px' },
      boxShadow: {
        soft: '0 1px 2px rgba(0,0,0,.04), 0 1px 3px rgba(0,0,0,.06)',
        md: '0 4px 12px rgba(0,0,0,.08)',
        lg: '0 12px 32px rgba(0,0,0,.12)',
        'soft-dark': '0 1px 2px rgba(0,0,0,.3), 0 1px 3px rgba(0,0,0,.35)',
        'md-dark': '0 4px 12px rgba(0,0,0,.4)',
        'lg-dark': '0 12px 32px rgba(0,0,0,.5)',
      },
      transitionDuration: { DEFAULT: '150ms' },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
