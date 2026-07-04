/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Rose gold / obsidian palette
        rg: {
          light:   '#c8a38e',  // rose gold highlight
          mid:     '#985c3a',  // rose gold medium
          dark:    '#94543c',  // rose gold dark
        },
        wood: {
          DEFAULT: '#463129',  // dark brown wood — card bg
          mid:     '#69584f',  // medium warm gray-brown — surface
          shadow:  '#50444c',  // dark purple-gray — nav bg
          stone:   '#514f4c',  // dark gray-brown — raised surface
        },
        obsidian: {
          DEFAULT: '#110b09',  // near-black — main bg
        },
        muted: {
          DEFAULT: '#8c8c88',  // warm gray text
          sub:     '#858484',  // neutral gray text
          faint:   '#69584f',  // very subdued
        },
      },
      backgroundImage: {
        'rg-gradient':        'linear-gradient(135deg, #94543c 0%, #c8a38e 60%, #985c3a 100%)',
        'rg-gradient-subtle': 'linear-gradient(135deg, #94543c 0%, #c8a38e 100%)',
        'card-gradient':      'linear-gradient(180deg, #463129 0%, #3d2a22 100%)',
      },
      boxShadow: {
        'rg':    '0 0 22px rgba(200,163,142,0.4)',
        'rg-sm': '0 0 10px rgba(200,163,142,0.25)',
        'card':  '0 4px 24px rgba(0,0,0,0.6)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
