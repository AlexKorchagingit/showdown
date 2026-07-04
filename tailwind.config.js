/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Rose-gold / dark-wood palette
        rg: {
          cream:  '#F2D8A7',   // lightest — highlight labels, active text
          amber:  '#D99962',   // primary accent — icons, secondary text
          sand:   '#c8a38e',   // rose-gold accent — icon tints
          warm:   '#985c3a',   // list markers, secondary accents
          mid:    '#8C4C27',   // gradient start for CTAs
          dark:   '#94543c',   // deep rose accent
        },
        wood: {
          DEFAULT: '#463129',  // card / surface background
          deep:    '#3a2720',  // card gradient dark end
          muted:   '#69584f',  // subdued text / inactive icons
        },
        surface: {
          raised:  '#514f4c',  // progress tracks, raised elements
          nav:     '#50444c',  // bottom navigation
          text:    '#8c8c88',  // primary muted text
          sub:     '#858484',  // secondary muted text
        },
        obsidian: '#110b09',   // main background
      },
      backgroundImage: {
        // CTA gradient (Участвовать, Регистрация)
        'cta-gradient':    'linear-gradient(to right, #8C4C27, #D99962)',
        // Badge / highlight gradient
        'badge-gradient':  'linear-gradient(to right, #D99962, #F2D8A7)',
        // Accent for subtle elements
        'rg-gradient':     'linear-gradient(135deg, #94543c 0%, #c8a38e 100%)',
        // Card background
        'card-gradient':   'linear-gradient(180deg, #463129 0%, #3a2720 100%)',
      },
      boxShadow: {
        'rg':     '0 0 22px rgba(200,163,142,0.4)',
        'amber':  '0 0 22px rgba(217,153,98,0.4)',
        'card':   '0 4px 24px rgba(0,0,0,0.6)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
