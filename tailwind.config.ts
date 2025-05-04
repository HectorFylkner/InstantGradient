import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    // Look in web and docs packages
    './packages/web/src/**/*.{js,ts,jsx,tsx,mdx}',
    './packages/docs/src/**/*.{js,ts,jsx,tsx,mdx}',
    // Include root config files if needed
    // './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // TODO: Add design tokens as CSS variables (--gradient-*)
      colors: {
        // Placeholder for theme colors
        primary: 'blue',
        secondary: 'gray',
      },
    },
  },
  plugins: [],
};

export default config; 