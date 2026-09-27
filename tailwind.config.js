/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./login.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#011e3e",
          hover: "#0b345d",
        },
      },
    },
  },
  plugins: [],
}