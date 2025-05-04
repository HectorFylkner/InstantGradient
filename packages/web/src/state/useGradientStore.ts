import { create } from 'zustand';
import { produce } from 'immer'; // Use Immer for easier immutable updates
import { Gradient, GradientStop, OKLab, hexToOKLab } from '@gradient-tool/core';
import { nanoid } from 'nanoid';
import { saveGradient, loadLastGradient } from '@/persistence/dexie-gradient'; // Use path alias
import { throttle } from '@/utils/throttle'; // Use path alias

// Initial gradient state (will be potentially overridden by loaded state)
const initialGradient: Gradient = {
  id: nanoid(), // Generate initial ID
  type: 'linear',
  angle: 90,
  stops: [
    { id: nanoid(), position: 0, color: hexToOKLab('#000000') }, // Use hexToOKLab
    { id: nanoid(), position: 1, color: hexToOKLab('#ffffff') }, // Use hexToOKLab
  ],
};

interface GradientState {
  gradient: Gradient;
  isLoading: boolean; // Add loading state
  updateStopPosition: (id: string, pos: number) => void;
  updateStopColor: (id: string, color: OKLab) => void;
  addStop: () => void;
  removeStop: (id: string) => void;
  setGradient: (gradient: Gradient) => void;
  updateAngle: (angle: number) => void;
  updateType: (type: Gradient['type']) => void;
}

// Create the throttled save function once
const throttledSave = throttle((g: Gradient) => void saveGradient(g), 800);

export const useGradientStore = create<GradientState>()((set, get) => {
  
  // Immediately set initial state including loading flag
  set({ gradient: initialGradient, isLoading: true });

  // Asynchronously load the last gradient
  loadLastGradient().then(loadedGradient => {
    if (loadedGradient) {
      // If loaded, merge or replace the state
      set({ gradient: loadedGradient, isLoading: false });
    } else {
      // If nothing loaded (cold start/error), just update loading state
      set({ isLoading: false });
      // Optionally save the initial state on first load?
      // throttledSave(initialGradient);
    }
  });

  return {
    gradient: initialGradient, // Return initial state synchronously
    isLoading: true, // Initial loading state

    updateStopPosition: (id, pos) =>
      set(produce((state: GradientState) => {
        const stop = state.gradient.stops.find(s => s.id === id);
        if (stop) {
          stop.position = Math.max(0, Math.min(1, pos));
          state.gradient.stops.sort((a, b) => a.position - b.position);
          throttledSave(state.gradient); // Save after modification
        }
      })),

    updateStopColor: (id, color) =>
      set(produce((state: GradientState) => {
        const stop = state.gradient.stops.find(s => s.id === id);
        if (stop) {
          stop.color = color;
          throttledSave(state.gradient); // Save after modification
        }
      })),

    addStop: () =>
      set(produce((state: GradientState) => {
        const stops = state.gradient.stops;
        let newPosition = 0.5;
        if (stops.length >= 2) {
            let maxGap = 0;
            let insertIndex = -1;
            for (let i = 0; i < stops.length - 1; i++) {
                const gap = stops[i+1].position - stops[i].position;
                if (gap > maxGap) {
                    maxGap = gap;
                    insertIndex = i;
                }
            }
            if (insertIndex !== -1) {
                newPosition = stops[insertIndex].position + maxGap / 2;
            }
        }
        const newColor: OKLab = { l: 0.5, a: 0, b: 0 };
        const newStop: GradientStop = {
            id: nanoid(),
            position: newPosition,
            color: newColor,
        };
        state.gradient.stops.push(newStop);
        state.gradient.stops.sort((a, b) => a.position - b.position);
        throttledSave(state.gradient); // Save after modification
      })),

    removeStop: (id) =>
      set(produce((state: GradientState) => {
        if (state.gradient.stops.length > 2) {
          state.gradient.stops = state.gradient.stops.filter(s => s.id !== id);
          throttledSave(state.gradient); // Save after modification
        }
      })),
  
    setGradient: (newGradient) => 
      set(produce((state: GradientState) => {
        state.gradient = newGradient;
        throttledSave(state.gradient); // Save after explicit set
      })),

    updateAngle: (angle) => 
      set(produce((state: GradientState) => {
          state.gradient.angle = angle % 360;
          throttledSave(state.gradient); // Save after modification
      })),

    updateType: (type) =>
      set(produce((state: GradientState) => {
          state.gradient.type = type;
          throttledSave(state.gradient); // Save after modification
      })),
  };
});

// TODO: Consider adding middleware (e.g., persist for IndexedDB via Dexie)

// Add this in useGradientStore.ts for testability
// Should be conditional on dev/test environment
if (import.meta.env.DEV || import.meta.env.TEST) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__store = useGradientStore;
}

// --- End of useGradientStore.ts --- 