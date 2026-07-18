import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-base': '#150B1F',
        'bg-surface': '#1F1230',
        'bg-surface-2': '#2A1838',
        'bg-input': '#2D1A3D',
        'border-subtle': '#3A2348',
        'border-strong': '#4F3060',
        'accent-pink': '#E879B9',
        'accent-pink-soft': '#E879B922',
        'accent-pink-glow': '#E879B940',
        'text-primary': '#FFFFFF',
        'text-secondary': '#B8A8C8',
        'text-tertiary': '#7A6A88',
        'text-success': '#A7F3D0',
        'cell-filled': '#E879B9',
        'cell-empty': '#2A1838',
        'cell-disabled': '#1F1230',
        'cell-today': '#4F3060',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '12px',
      },
      // tabular-nums applied via .tabular utility class in globals.css
    },
  },
  plugins: [],
}

export default config
