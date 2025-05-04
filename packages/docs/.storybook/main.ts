import type { StorybookConfig } from '@storybook/react-vite';
import path from 'path';
import { mergeConfig } from 'vite';

const config: StorybookConfig = {
  stories: [
    '../stories/**/*.mdx',
    '../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)',
    // You might want to include stories directly from the web package:
    // '../../web/src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
  ],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials', // Includes Controls, Actions, Viewport, etc.
    '@storybook/addon-interactions', // For play functions
    '@storybook/addon-docs', // Add addon for MDX support
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  docs: {
    autodocs: 'tag', // Auto-generate documentation pages for tagged stories
  },
  // Custom Vite configuration for Storybook
  async viteFinal(config) {
    // Merge custom configuration into the default Vite config
    return mergeConfig(config, {
      // Add dependencies to pre-bundle
      optimizeDeps: {
        include: ['@storybook/theming'],
      },
      // Resolve aliases (mirroring web package)
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '../../web/src'), // Alias to web package src
          '@gradient-tool/core': path.resolve(__dirname, '../../core/src') // Direct alias to core src
        },
      },
      // Ensure PostCSS/Tailwind runs
      css: {
         postcss: path.resolve(__dirname, '../../../postcss.config.js') // Point to root PostCSS config
      }
    });
  },
};
export default config; 