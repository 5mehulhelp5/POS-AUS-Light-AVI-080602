/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Monochrome accent palette — replaces the previous blue scale.
        // Same shade keys so existing class names (text-primary-400 etc)
        // keep working; just resolves to greyscale instead of sky blue.
        // Lower numbers = lighter (highlights), higher = darker (button
        // bases). 400 is the bright "accent" used for prices etc.
        primary: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#e5e5e5', // bright off-white for highlights / prices
          500: '#a1a1aa',
          600: '#52525b', // mid-dark grey — primary button bg
          700: '#3f3f46', // hover / pressed
          800: '#27272a',
          900: '#18181b',
        },
        // Surfaces also go monochrome: near-black backgrounds and dark
        // grey cards. No more blue-purple.
        pos: {
          bg: '#0a0a0a',     // page background — near black
          card: '#18181b',   // panels / modals
          accent: '#27272a', // raised buttons / hover surfaces
          text: '#fafafa',
          success: '#10b981',
          warning: '#f59e0b',
          danger: '#ef4444',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
