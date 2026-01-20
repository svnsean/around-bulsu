/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        // BulSU brand colors
        maroon: {
          50: '#fdf2f2',
          100: '#fce4e4',
          200: '#fbcdcd',
          300: '#f7a8a8',
          400: '#f07575',
          500: '#e64848',
          600: '#d32a2a',
          700: '#b12020',
          800: '#800000', // Primary maroon
          900: '#5a0000',
          950: '#3d0000',
        },
        gold: {
          50: '#fffef7',
          100: '#fffbeb',
          200: '#fff3c4',
          300: '#ffe999',
          400: '#ffd700', // Primary gold
          500: '#f5c400',
          600: '#d4a500',
          700: '#a77f00',
          800: '#7a5c00',
          900: '#4d3800',
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
