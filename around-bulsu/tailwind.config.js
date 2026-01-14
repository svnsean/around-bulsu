/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        maroon: {
          50: '#fdf2f2',
          100: '#fce8e8',
          200: '#fbd5d5',
          300: '#f8b4b4',
          400: '#f27474',
          500: '#e53e3e',
          600: '#c53030',
          700: '#9b2c2c',
          800: '#800000',
          900: '#5a1a1a',
        },
        gold: {
          50: '#fffdf7',
          100: '#fef9e7',
          200: '#fef0c3',
          300: '#fde58a',
          400: '#ffd700',
          500: '#eab308',
          600: '#ca8a04',
          700: '#a16207',
          800: '#854d0e',
          900: '#713f12',
        },
      },
    },
  },
  plugins: [],
}

