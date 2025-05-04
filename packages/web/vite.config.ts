import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Add plugin or configure assetsInclude for WGSL if needed, 
    // but Vite 5+ might handle ?raw imports automatically.
    // For clarity, we can explicitly include it.
  ],
  assetsInclude: ['**/*.wgsl'], // Ensure .wgsl files are treated as assets
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Server options if needed (e.g., for proxying)
  // server: {
  //   port: 3000,
  // },
  // Build options if needed (e.g., output directory)
  // build: {
  //   outDir: 'build',
  // },
  // Vitest configuration
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts', // Optional setup file
    css: true, // Enable CSS processing if needed for tests
  },
}); 