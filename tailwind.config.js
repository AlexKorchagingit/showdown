/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Montserrat', 'system-ui', 'sans-serif'],
      },
      colors: {
        obsidian: '#0A0908',
        card:     '#2A211D',
        'card-deep': '#231A16',
        muted:    '#A39B98',
        subdued:  '#6B6360',
        // accent palette
        rg: {
          amber: '#D99962',
          cream: '#F2D8A7',
          warm:  '#c8a38e',
          mid:   '#8C4C27',
          dark:  '#94543c',
          mark:  '#985c3a',
        },
      },
      backgroundImage: {
        'cta-gradient':   'linear-gradient(to right, #8C4C27, #D99962)',
        'badge-gradient': 'linear-gradient(to right, #D99962, #F2D8A7)',
        'rg-gradient':    'linear-gradient(135deg, #94543c, #c8a38e)',
        'card-gradient':  'linear-gradient(180deg, #2A211D 0%, #1E1612 100%)',
      },
      boxShadow: {
        'amber': '0 0 20px rgba(217,153,98,0.35)',
        'card':  '0 2px 20px rgba(0,0,0,0.5)',
        'glow':  '0 0 30px rgba(242,216,167,0.2)',
      },
    },
  },
  plugins: [],
}
