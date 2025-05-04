import type { Preview } from '@storybook/react';
import '../../web/src/index.css'; // Import Tailwind entry point from web package

const preview: Preview = {
  parameters: {
    // Optional parameters
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    // backgrounds: { ... },
    // viewport: { ... },
  },
  // Global decorators if needed
  // decorators: [
  //   (Story) => (
  //     <div style={{ margin: '3em' }}>
  //       <Story />
  //     </div>
  //   ),
  // ],
};

export default preview; 