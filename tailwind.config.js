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
        primary: { DEFAULT: '#5B57E0', soft: '#EEEDFF', dark: '#837FF2', 'soft-dark': '#211F3A' },
        priority: { high: '#E5484D', medium: '#EAB308', low: '#12A150' },
      },
      borderRadius: { sm: '8px', md: '10px', lg: '12px', xl: '16px' },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
