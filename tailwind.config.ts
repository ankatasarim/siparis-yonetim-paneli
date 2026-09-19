import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#6c47ff', hover: '#5a36ea', soft: '#efeaff', text: '#5b3ae6' },
        ink: { DEFAULT: '#151517', soft: '#1f1f23', line: '#2a2a30' },
        page: '#f7f7f9',
      },
      boxShadow: { card: '0 1px 2px rgba(16,16,20,.04), 0 1px 3px rgba(16,16,20,.06)' },
      fontFamily: { sans: ['-apple-system', 'BlinkMacSystemFont', 'Inter', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'] },
    },
  },
  plugins: [],
};
export default config;
