/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          teal: '#0f766e', // Teal-700
          light: '#f0fdfa', // Teal-50
        },
        income: '#10b981', // Emerald-500
        expense: '#ef4444', // Red-500
      },
      fontFamily: {
        // Isso conecta com a variável css exportada no RootLayout
        sans: ['var(--font-poppins)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [require("tailwindcss-animate")], // Útil se você for usar aquele "animate-in" nos modais
}
