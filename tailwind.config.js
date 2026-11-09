/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.html', './scripts/**/*.mjs'],
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: '#FDFBF7', // Fundo principal
          100: '#F5F2E9',     // Fundo secundário (seções)
          200: '#EBE5D5',
        },
        green: {
          DEFAULT: '#1A3626', // Texto principal e botões
          light: '#2C5C40',   // Hover
          accent: '#A3B899',  // Detalhes sutis
        },
      },
      fontFamily: {
        heading: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Outfit"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
