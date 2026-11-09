export default {
  content: ['./src/**/*.{astro,html,js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#eef4ff', 100: '#dbe7ff', 500: '#3b6df0', 600: '#2b56d4', 700: '#2344ab', 900: '#14275f' },
      },
      boxShadow: { card: '0 1px 2px rgb(15 23 42 / 0.05), 0 4px 16px rgb(15 23 42 / 0.05)' },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'] },
    },
  },
  plugins: [],
};
