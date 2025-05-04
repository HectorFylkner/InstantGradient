/**
 * Pointer-based drag hook with rAF throttling.
 * Abstracts away touch / mouse normalization.
 */
import { useRef, useCallback, useEffect } from 'react';

interface DragOptions {
  onStart?: (event: React.PointerEvent) => void;
  onEnd?: () => void;
}

/**
 * Custom hook to handle drag interactions (pointer events).
 * 
 * @param onMove Callback function triggered on pointer move with delta x and y.
 * @param options Optional configuration for start and end callbacks.
 * @returns An object containing the `onPointerDown` handler to attach to the draggable element.
 */
export function useDrag(
  onMove: (dx: number, dy: number, event: PointerEvent) => void,
  options?: DragOptions
) {
  const isDragging = useRef(false);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const rafId = useRef<number>();

  const handlePointerMove = useCallback((event: PointerEvent) => {
    if (!isDragging.current || !startPos.current) return;

    cancelAnimationFrame(rafId.current!); // Throttle using requestAnimationFrame

    rafId.current = requestAnimationFrame(() => {
      if (!startPos.current) return; // Check again inside rAF
      const dx = event.clientX - startPos.current.x;
      const dy = event.clientY - startPos.current.y;
      onMove(dx, dy, event);
    });
  }, [onMove]);

  const handlePointerUp = useCallback((event: PointerEvent) => {
    if (!isDragging.current) return;

    cancelAnimationFrame(rafId.current!); 
    isDragging.current = false;
    startPos.current = null;

    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    // Set cursor back to default or remove grab cursor
    document.body.style.cursor = ''; 

    options?.onEnd?.();

  }, [handlePointerMove, options]);

  const handlePointerDown = useCallback((event: React.PointerEvent) => {
    // Prevent default only if needed (e.g., text selection)
    // event.preventDefault(); 
    if (isDragging.current) return; // Avoid multi-touch issues if not handled

    isDragging.current = true;
    startPos.current = { x: event.clientX, y: event.clientY };
    // Change cursor to indicate dragging
    document.body.style.cursor = 'grabbing'; 

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    options?.onStart?.(event);

  }, [handlePointerMove, handlePointerUp, options]);

  // Cleanup listeners on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafId.current!); 
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  return { onPointerDown: handlePointerDown };
} 