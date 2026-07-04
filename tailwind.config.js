/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ember: {
          light:   '#F2D8A7',  // cream — highlights, active labels
          DEFAULT: '#D99962',  // amber — primary accent, icons
          dark:    '#8C4C27',  // brown — secondary accent, borders
        },
        coal: {
          DEFAULT: '#400904',  // deep red-brown — card surfaces
          deep:    '#0D0000',  // near-black — main background
        },
      },
      backgroundImage: {
        'ember-gradient':      'linear-gradient(135deg, #8C4C27 0%, #D99962 55%, #F2D8A7 100%)',
        'ember-gradient-soft': 'linear-gradient(135deg, #8C4C27 0%, #D99962 100%)',
        'card-gradient':       'linear-gradient(180deg, #400904 0%, #360703 100%)',
      },
      boxShadow: {
        'ember':    '0 0 22px rgba(217,153,98,0.45)',
        'ember-sm': '0 0 10px rgba(217,153,98,0.25)',
        'card':     '0 4px 28px rgba(0,0,0,0.7)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
