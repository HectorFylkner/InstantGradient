import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { Gradient } from '../src/gpu';
import { hexToOKLab } from '../src/color';

// Mock the WebGPU API for Node environment
// A more robust solution might involve a dedicated library like 'gpumock'
// or running tests in a browser environment.
let originalGpu: GPU | undefined;

const mockDevice = {
    createShaderModule: vi.fn(() => ({})),
    createRenderPipeline: vi.fn(() => ({ getBindGroupLayout: vi.fn(() => ({})) })),
    createBuffer: vi.fn(() => ({})),
    createBindGroup: vi.fn(() => ({})),
    createCommandEncoder: vi.fn(() => ({
        beginRenderPass: vi.fn(() => ({
            setPipeline: vi.fn(),
            setBindGroup: vi.fn(),
            draw: vi.fn(),
            end: vi.fn(),
        })),
        finish: vi.fn(() => ({})),
    })),
    queue: {
        writeBuffer: vi.fn(),
        submit: vi.fn(),
    },
} as unknown as GPUDevice;

const mockAdapter = {
    requestDevice: vi.fn(async () => mockDevice),
} as unknown as GPUAdapter;

const mockGpu = {
    requestAdapter: vi.fn(async () => mockAdapter),
    getPreferredCanvasFormat: vi.fn(() => 'bgra8unorm'),
} as unknown as GPU;

const mockContext = {
    configure: vi.fn(),
    getCurrentTexture: vi.fn(() => ({ createView: vi.fn(() => ({})) })),
} as unknown as GPUCanvasContext;


beforeAll(() => {
    // @ts-expect-error - Polyfilling navigator
    if (typeof navigator === 'undefined') global.navigator = {};
    originalGpu = navigator.gpu;
    // @ts-expect-error - Assigning mock GPU
    navigator.gpu = mockGpu;

    // Mock OffscreenCanvas if not present (e.g., in Node)
    // @ts-expect-error - Polyfilling OffscreenCanvas
    if (typeof OffscreenCanvas === 'undefined') {
      // Define a minimal interface for the mock
      interface MockOffscreenCanvas extends OffscreenCanvas {
         // Add methods/properties used in the test if necessary
      }
      global.OffscreenCanvas = class MockOffscreenCanvasImpl implements MockOffscreenCanvas {
        width: number;
        height: number;
        // Implement required OffscreenCanvas methods/properties minimally
        // We need getContext for the test.
        // Other methods like transferToImageBitmap, convertToBlob etc. are not called
        // directly in this test setup, so they can be omitted or mocked if needed elsewhere.
        constructor(w: number, h: number) { this.width = w; this.height = h; }
        getContext(contextId: OffscreenRenderingContextId, _options?: unknown): OffscreenRenderingContext | null {
            if (contextId === 'webgpu') {
                return mockContext as unknown as OffscreenRenderingContext; // Cast the mock context
            }
             if (contextId === '2d') { // Handle potential fallback calls
                 // Return a minimal 2D context mock if needed by fallback tests
                 return { fillRect: vi.fn(), fillText: vi.fn(), } as unknown as OffscreenRenderingContext;
             }
            return null;
        }
        // Add dummy implementations for required properties/methods if TS complains
        // Example: transferToImageBitmap = () => new ImageBitmap(); 
        // Example: convertToBlob = () => Promise.resolve(new Blob());
        // Avoid adding unnecessary complexity if not strictly required by TS/ESLint
         transferControlToOffscreen(): OffscreenCanvas { throw new Error('Method not implemented.'); }
         convertToBlob(_options?: ImageEncodeOptions | undefined): Promise<Blob> { throw new Error('Method not implemented.'); }
         addEventListener(_type: string, _listener: EventListenerOrEventListenerObject, _options?: boolean | AddEventListenerOptions | undefined): void { throw new Error('Method not implemented.'); }
         removeEventListener(_type: string, _listener: EventListenerOrEventListenerObject, _options?: boolean | EventListenerOptions | undefined): void { throw new Error('Method not implemented.'); }
         dispatchEvent(_event: Event): boolean { throw new Error('Method not implemented.'); }
      } as unknown as typeof OffscreenCanvas; // Cast the class itself
    }
});

afterAll(() => {
    // Restore original navigator.gpu if it existed
    if (originalGpu) {
         // @ts-expect-error - Assigning mock GPU
         navigator.gpu = originalGpu;
    } else {
        // @ts-expect-error - Deleting polyfill
        delete navigator.gpu;
    }
    // Clean up OffscreenCanvas polyfill if needed
});

describe('GPU Rendering', () => {
    it('renderGradientGL runs without throwing with mocked WebGPU API', async () => {
        const canvas = new OffscreenCanvas(100, 100);
        const gradient: Gradient = {
            id: 'gpu-test',
            type: 'linear',
            angle: 45,
            stops: [
                { id: 's1', position: 0, color: hexToOKLab('#ff0000') },
                { id: 's2', position: 1, color: hexToOKLab('#0000ff') },
            ],
        };

        // Expect the promise to resolve without throwing an error
        await expect(renderGradientGL(canvas, gradient)).resolves.toBeUndefined();

        // Optional: Check if core GPU functions were called
        expect(navigator.gpu.requestAdapter).toHaveBeenCalled();
        // Need to await the promise resolution for the rest
        // await vi.dynamicImportSettled(); // Ensure async operations complete if using dynamic imports
        // expect(mockAdapter.requestDevice).toHaveBeenCalled(); 
        // expect(mockDevice.createShaderModule).toHaveBeenCalled();
        // expect(mockDevice.createRenderPipeline).toHaveBeenCalled();
        // expect(mockDevice.queue.submit).toHaveBeenCalled();
    });

    it('renderGradientGL should throw if WebGPU is not supported and fallback fails', async () => {
        // Temporarily remove navigator.gpu
        const tempGpu = navigator.gpu;
        // @ts-expect-error - Testing unsupported scenario
        delete navigator.gpu;

        const canvas = new OffscreenCanvas(100, 100);
        const gradient: Gradient = { id: 'no-gpu', type:'linear', angle: 0, stops: [] };
        
        await expect(renderGradientGL(canvas, gradient)).rejects.toThrow('WebGPU not supported');

        // Restore navigator.gpu
        // @ts-expect-error - Restoring GPU
        navigator.gpu = tempGpu;
    });

    // TODO: Add tests for uniform buffer content correctness
    // TODO: Add tests for fallback behavior
}); 