/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        asc: {
          blue: '#0a1f44',
          lightblue: '#1e3a8a',
          red: '#e11d48',
          gray: '#64748b'
        }
      }
    },
  },
  plugins: [],
}