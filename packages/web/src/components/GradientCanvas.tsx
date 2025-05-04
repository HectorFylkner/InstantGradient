import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { renderGradientGL, Gradient, toCss } from '@gradient-tool/core';

export interface GradientCanvasProps {
  gradient: Gradient;
  width?: number;
  height?: number;
  className?: string;
}

// Define the type for the forwarded ref
export interface GradientCanvasHandle {
    exportToPng: () => Promise<Blob | null>;
}

/**
 * Renders interactive gradient preview, attempting WebGPU first and falling back to CSS.
 */
export const GradientCanvas = forwardRef<GradientCanvasHandle, GradientCanvasProps>((
    { gradient, width = 500, height = 500, className = '' }, 
    ref
) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenCanvasRef = useRef<OffscreenCanvas | null>(null);
  const [useGpu, setUseGpu] = useState(true); // TODO: Make this configurable via flag/prop
  const [gpuError, setGpuError] = useState(false);
  const fallbackRef = useRef<HTMLDivElement>(null);
  const isGpuPath = useGpu && !gpuError;

  useEffect(() => {
    if (isGpuPath && canvasRef.current) {
        // Only transfer control once
        if (!offscreenCanvasRef.current) {
          try {
            offscreenCanvasRef.current = canvasRef.current.transferControlToOffscreen();
          } catch (e) {
            console.error('Failed to transfer canvas control:', e);
            setGpuError(true); // Fallback to CSS
            return;
          }
        }
        if (offscreenCanvasRef.current) {
            let isActive = true;
            renderGradientGL(offscreenCanvasRef.current, gradient)
              .then(() => {
                // console.log('GPU Render successful');
              })
              .catch(err => {
                if (isActive) {
                   console.error('GPU rendering failed:', err);
                   setGpuError(true); // Fallback to CSS on error
                }
              });
            return () => { isActive = false; }
        }
    } else if (fallbackRef.current) {
        // Apply CSS fallback if not using GPU or if GPU error occurred
        fallbackRef.current.style.background = toCss(gradient);
    }
  }, [gradient, isGpuPath]); // Rerun when gradient or GPU path status changes

  // Expose export function via ref
  useImperativeHandle(ref, () => ({
    exportToPng: async (): Promise<Blob | null> => {
      const targetCanvas = offscreenCanvasRef.current; // Prefer offscreen for direct rendering result
      if (!targetCanvas) {
          console.error('Canvas element not available for export.');
          // TODO: Could potentially draw CSS to a temporary canvas here as a fallback
          return null;
      }
      try {
          // convertToBlob is preferred for OffscreenCanvas
          if (typeof targetCanvas.convertToBlob === 'function') {
              return await targetCanvas.convertToBlob({ type: 'image/png' });
          } else {
              // Fallback for environments without convertToBlob (e.g., older Safari)
              return new Promise((resolve) => {
                  // @ts-expect-error - toBlob exists but types might be missing
                  targetCanvas.toBlob(resolve, 'image/png');
              });
          }
      } catch (error) {
          console.error("Failed to export canvas to PNG:", error);
          return null;
      }
    }
  }));

  const combinedClassName = `rounded-lg shadow-lg border border-neutral-200 overflow-hidden ${className}`.trim();

  return (
    <div style={{ width, height }} className={combinedClassName}>
      {/* Conditionally render canvas or div based on isGpuPath */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        aria-label="Gradient Preview"
        style={{ display: isGpuPath ? 'block' : 'none' }} // Hide canvas if using CSS fallback
      />
      {!isGpuPath && (
        <div 
          ref={fallbackRef} 
          style={{ width: '100%', height: '100%', background: toCss(gradient) }}
          aria-label="Gradient Preview (CSS Fallback)"
        />
      )}
    </div>
  );
});

// Add display name for DevTools
GradientCanvas.displayName = 'GradientCanvas'; 