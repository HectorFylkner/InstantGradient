import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { GradientCanvas } from '@/components/GradientCanvas';
import type { GradientCanvasHandle } from '@/components/GradientCanvas';
import type { Gradient, OKLab } from '@gradient-tool/core';
import { renderGradientGL } from '@gradient-tool/core';

// Mock the core functions used by the component
vi.mock('@gradient-tool/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@gradient-tool/core')>();
  return {
    ...original,
    renderGradientGL: vi.fn(() => Promise.resolve()),
    oklabToHex: (c: OKLab) => { // Mock color conversion for CSS fallback
      const gray = Math.round(c.l * 255);
      const hex = gray.toString(16).padStart(2, '0');
      return `#${hex}${hex}${hex}`;
    },
    toCss: vi.fn((g: Gradient) => `linear-gradient(${g.angle}deg, #000000 0%, #ffffff 100%)`), // Simplified CSS
    // Provide other exports if GradientCanvas uses them
  };
});

// Mock OffscreenCanvas
if (typeof window !== 'undefined') {
    // Mock the class itself
    window.OffscreenCanvas = class MockOffscreenCanvas {
        width: number;
        height: number;
        _context: OffscreenCanvasRenderingContext2D | GPUCanvasContext | null = null;
        constructor(width: number, height: number) {
            this.width = width;
            this.height = height;
        }
        getContext(contextId: '2d' | 'webgpu', _options?: unknown): OffscreenCanvasRenderingContext2D | GPUCanvasContext | null {
            if (contextId === 'webgpu') {
                this._context = { configure: () => {}, getCurrentTexture: () => ({ createView: () => ({} as GPUTextureView) }) } as unknown as GPUCanvasContext;
            } else {
                this._context = { getContextAttributes: () => null } as unknown as OffscreenCanvasRenderingContext2D;
            }
            return this._context;
        }
        // Add other necessary OffscreenCanvas methods/props if needed
        convertToBlob(options?: ImageEncodeOptions): Promise<Blob> { 
            return Promise.resolve(new Blob()); // Mock blob
        } 
    } as unknown as typeof OffscreenCanvas;

    // Mock the transfer method to return an instance of our mock class
    HTMLCanvasElement.prototype.transferControlToOffscreen = function(): OffscreenCanvas {
      return new window.OffscreenCanvas(this.width, this.height);
    };
}

// Mock navigator.gpu globally for tests (if needed outside specific describe blocks)
// Ensure this runs before component rendering if it relies on navigator.gpu on mount
if (typeof navigator !== 'undefined') {
    Object.defineProperty(navigator, 'gpu', {
        configurable: true,
        writable: true,
        value: { 
            requestAdapter: async () => ({ requestDevice: async () => ({ /* mock device */ }) }),
            getPreferredCanvasFormat: () => 'bgra8unorm'
        }
    });
} else {
    // Define navigator if it doesn't exist (e.g., in basic JSDOM)
    global.navigator = {
        gpu: { 
            requestAdapter: async () => ({ requestDevice: async () => ({ /* mock device */ }) }),
            getPreferredCanvasFormat: () => 'bgra8unorm'
         }
    } as unknown as Navigator;
}

const mockGradient: Gradient = {
  id: 'g-test',
  type: 'linear',
  angle: 90,
  stops: [
    { id: 's1', position: 0, color: { l: 0, a: 0, b: 0 } },
    { id: 's2', position: 1, color: { l: 1, a: 0, b: 0 } },
  ],
};

describe('<GradientCanvas />', () => {
  beforeEach(() => {
    // Mock console.error to prevent test runner noise from expected errors
    vi.spyOn(console, 'error').mockImplementation((..._args: unknown[]) => {}); 
  });

  afterEach(() => {
    vi.restoreAllMocks(); // Restore mocks after each test
  });

  it('mounts and renders a canvas element when GPU is expected', () => {
    render(<GradientCanvas gradient={mockGradient} />);
    const canvas = screen.getByLabelText('Gradient Preview');
    expect(canvas).toBeInTheDocument();
    expect(canvas.tagName).toBe('CANVAS');
  });

  // TODO: Add test for CSS fallback rendering
  // Need to figure out how to reliably trigger the fallback in test environment
  // (e.g., by mocking transferControlToOffscreen to throw or renderGradientGL to reject)

  // TODO: Add tests for exportToPng functionality if ref is used

  it('renders a div with CSS background on GPU error', async () => {
    // Mock renderGradientGL to throw an error
    vi.mocked(renderGradientGL).mockRejectedValue(new Error('GPU Fail'));
    // Mock console.error in beforeEach

    render(<GradientCanvas gradient={mockGradient} />);
    
    // Wait for the fallback to render
    const fallbackDiv = await screen.findByLabelText('Gradient Preview (CSS Fallback)');
    expect(fallbackDiv).toBeInTheDocument();
    expect(fallbackDiv.tagName).toBe('DIV');
    expect(fallbackDiv).toHaveStyle('background: linear-gradient(90deg, #000000 0%, #ffffff 100%)');
  });

  it('passes correct dimensions to the canvas/div', () => {
    render(<GradientCanvas gradient={mockGradient} width={300} height={200} />);
    const container = screen.getByLabelText(/Gradient Preview/).parentElement;
    expect(container).toHaveStyle('width: 300px');
    expect(container).toHaveStyle('height: 200px');
  });
}); 