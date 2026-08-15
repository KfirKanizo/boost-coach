/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#121212',
        surface: '#1E1E1E',
        neon: '#00E676',
        ember: {
          DEFAULT: '#FFB300',
          deep: '#FF6D00',
        },
        crimson: '#FF1744',
        paper: '#FFFFFF',
        ash: '#B0B0B0',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        hebrew: ['Rubik', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
        timer: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        card: '24px',
        sheet: '32px',
      },
      boxShadow: {
        'neon-glow': '0 0 30px rgba(0, 230, 118, 0.30)',
        'neon-glow-strong': '0 0 40px rgba(0, 230, 118, 0.50)',
      },
    },
  },
  plugins: [],
};
