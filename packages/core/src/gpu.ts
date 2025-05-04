/// <reference types="@webgpu/types" />

/**
 * GPU path: compile WGSL shader & draw gradient to an OffscreenCanvas.
 * Opt-in via `enableGpu` flag.
 */

import type { Gradient } from './gradient';
import { clamp } from './utils';
import wgslSource from './shader.wgsl?raw'; // Import shader source

// Re-define necessary helpers from color.ts for conversion within this module
// Avoids potential circular dependency issues and keeps GPU logic somewhat self-contained
// Constants (Matrices)
const M_OKLAB_TO_LMS: [number, number, number, number, number, number, number, number, number] = [
  1.0000000, 0.3963377774, 0.2158037573,
  1.0000000, -0.1055613458, -0.0638541728,
  1.0000000, -0.0894841775, -1.2914855480
];
const M_LMS_TO_XYZ: [number, number, number, number, number, number, number, number, number] = [
  0.9869929, -0.1470543, 0.1599627,
  0.4323053, 0.5183603, 0.0492912,
  -0.0085287, 0.0400428, 0.9684867
];
const M_XYZ_TO_RGB: [number, number, number, number, number, number, number, number, number] = [
  3.2404542, -1.5371385, -0.4985314,
  -0.9692660, 1.8760108, 0.0415560,
  0.0556434, -0.2040259, 1.0572252
];
function multiplyMatrix3x3(M: [number, number, number, number, number, number, number, number, number], v: [number, number, number]): [number, number, number] {
  return [
    M[0] * v[0] + M[1] * v[1] + M[2] * v[2],
    M[3] * v[0] + M[4] * v[1] + M[5] * v[2],
    M[6] * v[0] + M[7] * v[1] + M[8] * v[2]
  ];
}
function unmapLms(lms_mapped: [number, number, number]): [number, number, number] {
  return [lms_mapped[0] ** 3, lms_mapped[1] ** 3, lms_mapped[2] ** 3];
}

/** Converts OKLab to Linear RGB (0-1 range) */
function oklabToLinearRgb(oklab: { l: number, a: number, b: number }): [number, number, number] {
  const [l_mapped, m_mapped, s_mapped] = multiplyMatrix3x3(M_OKLAB_TO_LMS, [oklab.l, oklab.a, oklab.b]);
  const [l_cone, m_cone, s_cone] = unmapLms([l_mapped, m_mapped, s_mapped]);
  const [x, y, z] = multiplyMatrix3x3(M_LMS_TO_XYZ, [l_cone, m_cone, s_cone]);
  let [r_linear, g_linear, b_linear] = multiplyMatrix3x3(M_XYZ_TO_RGB, [x, y, z]);
  // Clamp linear RGB
  r_linear = clamp(r_linear, 0, 1);
  g_linear = clamp(g_linear, 0, 1);
  b_linear = clamp(b_linear, 0, 1);
  return [r_linear, g_linear, b_linear];
}
// --- End Re-defined Helpers ---

// Module-level cache for GPU objects
let gpuDevice: GPUDevice | null = null;
const gpuContextMap = new WeakMap<OffscreenCanvas, GPUCanvasContext>();
let gpuPipeline: GPURenderPipeline | null = null;

// CPU fallback (keep as is)
function cpuFallback(canvas: OffscreenCanvas, _gradient: Gradient) {
    console.warn("WebGPU not available, CPU fallback not implemented yet.");
    // Explicitly get the 2D context for fallback rendering
    const ctx = canvas.getContext('2d'); 
    if (ctx instanceof OffscreenCanvasRenderingContext2D) { // Type guard
      ctx.fillStyle = '#cccccc'; // Simple gray fallback
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#333333';
      ctx.textAlign = 'center';
      ctx.fillText('WebGPU Unavailable', canvas.width / 2, canvas.height / 2);
    } else {
        console.error("Failed to get 2D context for CPU fallback.");
    }
}

// --- Constants ---
const MAX_STOPS = 8; // Must match shader constant

/**
 * Renders a gradient to an OffscreenCanvas using WebGPU (N-stop linear).
 *
 * @param canvas The target OffscreenCanvas.
 * @param gradient The gradient object.
 */
export async function renderGradientGL(
  canvas: OffscreenCanvas,
  gradient: Gradient
): Promise<void> {

  // 1. Get Device and Context (cache or request)
  if (!gpuDevice) {
    if (!navigator.gpu) {
      console.error('WebGPU not supported.');
      cpuFallback(canvas, gradient); // Use fallback
      throw new Error('WebGPU not supported'); // Throw to signal error to caller
    }
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) throw new Error('No GPU adapter found');
      gpuDevice = await adapter.requestDevice();
      
      // Add check for null device after request
      if (!gpuDevice) {
          throw new Error('WebGPU device acquisition failed'); // Throw specific error
      }

    } catch (e) {
      console.error('Failed to initialize WebGPU:', e);
       cpuFallback(canvas, gradient); // Fallback on exception too
      // Decide whether to re-throw or return after fallback
      // Throwing makes the test fail unless caught, returning lets it pass silently
      // Let's re-throw for now, matching original behavior
      throw e; 
    }
  }

  let context = gpuContextMap.get(canvas);
  if (!context) {
    context = canvas.getContext('webgpu') as GPUCanvasContext;
    if (!context) {
        console.error('Failed to get WebGPU context from OffscreenCanvas.');
        throw new Error('Failed to get WebGPU context');
    }
    const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
      device: gpuDevice,
      format: presentationFormat,
      alphaMode: 'premultiplied', // Or 'opaque'
    });
    gpuContextMap.set(canvas, context);
  }

  // Ensure device is available before proceeding (it should be after the init block)
  if (!gpuDevice) {
      console.error('GPU device not available after initialization attempt.');
      throw new Error('GPU device unavailable');
  }

  // 2. Create Pipeline (cache or create)
  if (!gpuPipeline) {
      const shaderModule = gpuDevice.createShaderModule({ code: wgslSource });
      gpuPipeline = gpuDevice.createRenderPipeline({
        layout: 'auto', // Let WGSL define layout
        vertex: {
          module: shaderModule,
          entryPoint: 'vs_main', // Vertex shader entry point
        },
        fragment: {
          module: shaderModule,
          entryPoint: 'fs_main', // Fragment shader entry point
          targets: [{
             format: navigator.gpu.getPreferredCanvasFormat()
           }],
        },
        primitive: {
            topology: 'triangle-list', // Draw fullscreen triangle
        },
      });
  }

  // 3. Prepare Uniform Buffer Data (N-Stops)
  const sortedStops = [...gradient.stops]
    .sort((a, b) => a.position - b.position)
    .slice(0, MAX_STOPS); // Take up to MAX_STOPS

  const numStops = sortedStops.length;
  const angleRad = gradient.angle * (Math.PI / 180);

  // Calculate buffer size: Header (16 bytes) + Stops array (MAX_STOPS * 16 bytes)
  const stopStructSizeBytes = 4 * 4; // pos(f32), r(f32), g(f32), b(f32)
  const uniformBufferSize = (4 * 4) + (MAX_STOPS * stopStructSizeBytes);
  const uniformData = new ArrayBuffer(uniformBufferSize);
  const uniformDataView = new DataView(uniformData);
  
  // Write header: angle (f32), num_stops (u32), padding (f32, f32)
  let offset = 0;
  uniformDataView.setFloat32(offset, angleRad, true); // angle_rad (little-endian)
  offset += 4;
  uniformDataView.setUint32(offset, numStops, true);   // num_stops (little-endian)
  offset += 4;
  uniformDataView.setFloat32(offset, 0.0, true);      // padding1 (little-endian)
  offset += 4;
  uniformDataView.setFloat32(offset, 0.0, true);      // padding2 (little-endian)
  offset += 4;

  // Write stops array data
  for (let i = 0; i < MAX_STOPS; i++) {
      const stop = sortedStops[i]; // Will be undefined if i >= numStops
      let pos = 0.0;
      let r = 0.0, g = 0.0, b = 0.0;

      if (stop) {
          pos = stop.position;
          [r, g, b] = oklabToLinearRgb(stop.color);
      }
      
      uniformDataView.setFloat32(offset, pos, true); offset += 4;
      uniformDataView.setFloat32(offset, r, true);   offset += 4;
      uniformDataView.setFloat32(offset, g, true);   offset += 4;
      uniformDataView.setFloat32(offset, b, true);   offset += 4;
  }

  // 4. Create / Write Uniform Buffer
  // TODO: Consider reusing/updating the buffer instead of creating every time
  const uniformBuffer = gpuDevice.createBuffer({
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  gpuDevice.queue.writeBuffer(uniformBuffer, 0, uniformData);

  // 5. Create Bind Group
  const bindGroup = gpuDevice.createBindGroup({
    layout: gpuPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } }
    ],
  });

  // 6. Encode and Submit Render Pass
  const commandEncoder = gpuDevice.createCommandEncoder();
  const textureView = context.getCurrentTexture().createView();

  const renderPassDescriptor: GPURenderPassDescriptor = {
    colorAttachments: [
      {
        view: textureView,
        // Optional: clear color if needed, otherwise load existing
        // clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 }, 
        loadOp: 'clear', // Clear or load? Clear is simpler for fullscreen draw
        storeOp: 'store',
      },
    ],
  };

  const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
  passEncoder.setPipeline(gpuPipeline);
  passEncoder.setBindGroup(0, bindGroup);
  passEncoder.draw(3, 1, 0, 0); // Draw the fullscreen triangle (3 vertices)
  passEncoder.end();

  gpuDevice.queue.submit([commandEncoder.finish()]);

  // console.log('GPU render executed.');
} 