import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'], // Generate both CommonJS and ESModule
  dts: true, // Generate .d.ts files
  splitting: false,
  sourcemap: true,
  clean: true, // Clean output directory before building
  esbuildOptions(options) {
    // Configure loader for .wgsl files
    options.loader = {
      ...options.loader,
      '.wgsl': 'text',
    };
    return options;
  },
}); 