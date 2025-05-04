import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { GradientCanvas } from '@/components/GradientCanvas';
import { Gradient, OKLab } from '@gradient-tool/core';

// Mock the core functions used by the component
vi.mock('@gradient-tool/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@gradient-tool/core')>();
  return {
    ...original,
    renderGradientGL: vi.fn().mockResolvedValue(undefined), // Mock GPU render
    oklabToHex: (c: OKLab) => { // Mock color conversion for CSS fallback
      const gray = Math.round(c.l * 255);
      const hex = gray.toString(16).padStart(2, '0');
      return `#${hex}${hex}${hex}`;
    },
    toCss: (g: Gradient) => `linear-gradient(${g.angle}deg, #000000 0%, #ffffff 100%)` // Simplified mock CSS
  };
});

// Mock OffscreenCanvas
if (typeof window !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    window.OffscreenCanvas = class { constructor(){} } as any;
    HTMLCanvasElement.prototype.transferControlToOffscreen = function() {
      return new OffscreenCanvas(this.width, this.height);
    };
    // Mock WebGPU context if needed for basic rendering tests
    HTMLCanvasElement.prototype.getContext = function(contextId: string): any {
      if (contextId === 'webgpu') {
        return { 
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            configure: () => {}, 
            getCurrentTexture: () => ({ createView: () => {} }),
        };
      }
      return null;
    };
    // Mock navigator.gpu
    Object.defineProperty(navigator, 'gpu', {
        writable: true,
        value: { 
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            requestAdapter: async () => ({ requestDevice: async () => ({ createCommandEncoder: () => ({ finish: () => {}, beginRenderPass: () => ({ end: () => {} }) }), queue: { submit: () => {} } }) }),
            getPreferredCanvasFormat: () => 'bgra8unorm'
        }
    });
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
  it('mounts and renders a canvas element when GPU is expected', () => {
    render(<GradientCanvas gradient={mockGradient} />);
    const canvas = screen.getByLabelText('Gradient Preview (WebGPU)');
    expect(canvas).toBeInTheDocument();
    expect(canvas.tagName).toBe('CANVAS');
  });

  // TODO: Add test for CSS fallback rendering
  // Need to figure out how to reliably trigger the fallback in test environment
  // (e.g., by mocking transferControlToOffscreen to throw or renderGradientGL to reject)

  // it('renders a div with CSS background on GPU error', async () => {
  //   // Mock renderGradientGL to throw an error
  //   const core = await import('@gradient-tool/core');
  //   (core.renderGradientGL as Mock).mockRejectedValue(new Error('GPU Fail'));

  //   render(<GradientCanvas gradient={mockGradient} />);
    
  //   // Wait for the fallback to render
  //   const fallbackDiv = await screen.findByLabelText('Gradient Preview (CSS Fallback)');
  //   expect(fallbackDiv).toBeInTheDocument();
  //   expect(fallbackDiv.tagName).toBe('DIV');
  //   expect(fallbackDiv).toHaveStyle('background: linear-gradient(90deg, #000000 0%, #ffffff 100%)');
  // });

  it('passes correct dimensions to the canvas/div', () => {
    render(<GradientCanvas gradient={mockGradient} width={300} height={200} />);
    const container = screen.getByLabelText(/Gradient Preview/).parentElement;
    expect(container).toHaveStyle('width: 300px');
    expect(container).toHaveStyle('height: 200px');
  });
}); 