import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest'; // Extends expect with jest-dom matchers

// Runs a cleanup after each test case (e.g., clearing jsdom)
afterEach(() => {
  cleanup();
}); 