/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: '#D4AF37',
          light: '#FFD700',
          dark: '#A8860C',
        },
        surface: {
          DEFAULT: '#1A1A1A',
          raised: '#242424',
          overlay: '#2E2E2E',
        },
        bg: {
          DEFAULT: '#0A0A0A',
          secondary: '#111111',
        },
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #D4AF37 0%, #FFD700 50%, #D4AF37 100%)',
        'gold-gradient-subtle': 'linear-gradient(135deg, #A8860C 0%, #D4AF37 100%)',
        'card-gradient': 'linear-gradient(180deg, #1A1A1A 0%, #141414 100%)',
      },
      boxShadow: {
        'gold': '0 0 20px rgba(212, 175, 55, 0.3)',
        'gold-sm': '0 0 10px rgba(212, 175, 55, 0.2)',
        'card': '0 4px 24px rgba(0, 0, 0, 0.5)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
