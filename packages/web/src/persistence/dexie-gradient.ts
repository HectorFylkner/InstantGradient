import Dexie, { Table } from 'dexie';
import { Gradient } from '@gradient-tool/core'; // Adjusted import path

/** Entity stored in IndexedDB. `id` is always "last" for single-doc v1. */
export interface GradientRecord {
  id: string;
  data: Gradient;
}

class GradientDB extends Dexie {
  gradients!: Table<GradientRecord, string>; // Define the table property

  constructor() {
    super('gradient-tool-db');
    this.version(1).stores({
      gradients: '&id' // Primary key 'id', must be unique
    });
  }
}

// Instantiate the database
const db = new GradientDB();

/** Persist the latest gradient (throttled upstream). */
export async function saveGradient(g: Gradient): Promise<void> {
  try {
    await db.gradients.put({ id: 'last', data: g });
  } catch (error) {
    console.error("Failed to save gradient to IndexedDB:", error);
    // Optional: Add user-facing error handling
  }
}

/** Restore last-edited gradient; returns `null` on cold start or error. */
export async function loadLastGradient(): Promise<Gradient | null> {
  try {
    const rec = await db.gradients.get('last');
    return rec?.data ?? null;
  } catch (error) {
    console.error("Failed to load gradient from IndexedDB:", error);
    return null; // Return null on error
  }
} 