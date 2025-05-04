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
    if (typeof OffscreenCanvas === 'undefined') global.OffscreenCanvas = class MockOffscreenCanvas {
        width: number;
        height: number;
        constructor(w:number, h:number) { this.width=w; this.height=h; }
        getContext(type: string) {
            if (type === 'webgpu') {
                return mockContext;
            }
            return null;
        }
    } as any; // Keep 'any' here for simplicity in the mock
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