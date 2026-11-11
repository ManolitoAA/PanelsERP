// Paleta repartida por design-taste-frontend (blue-black-cornflower) + tipografía Instrument Sans / DM Mono.
export default {
  content: ['./src/**/*.{astro,html,js,jsx}'],
  theme: {
    extend: {
      colors: {
        night: { DEFAULT: '#0a0d14', 800: '#131824', 700: '#1c2333', 600: '#2a3346', 400: '#8891a1' },
        accent: { 50: '#eaf5fe', 100: '#d3ebfd', 400: '#7cc8fd', 500: '#5ab9fc', 600: '#3aa2ec', 700: '#1f6fb2', 800: '#17568c' },
        mist: '#e9edf3',
        paper: '#f4f6f9',
      },
      boxShadow: {
        card: '0 1px 2px rgb(10 13 20 / 0.04), 0 8px 24px -12px rgb(10 13 20 / 0.12)',
        lift: '0 2px 4px rgb(10 13 20 / 0.06), 0 16px 32px -12px rgb(10 13 20 / 0.22)',
        glow: '0 0 0 1px rgb(90 185 252 / 0.25), 0 20px 60px -20px rgb(90 185 252 / 0.45)',
      },
      fontFamily: {
        sans: ['"Instrument Sans"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"DM Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      letterSpacing: { display: '-0.028em', hero: '-0.036em' },
    },
  },
  plugins: [],
};
