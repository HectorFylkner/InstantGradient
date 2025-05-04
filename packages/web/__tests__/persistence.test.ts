import 'fake-indexeddb/auto'; // Polyfills IndexedDB for Node testing
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { saveGradient, loadLastGradient } from '../src/persistence/dexie-gradient';
import { Gradient, hexToOKLab } from '@gradient-tool/core';
import Dexie from 'dexie';

// Helper to clear the database between tests
async function clearDatabase() {
    const db = new Dexie('gradient-tool-db');
    // Check if db exists and is open before trying to delete/reopen
    // Simple approach: just delete it
    try {
        await db.open(); // Need to open before deleting
        if (db.isOpen()) {
             await db.delete();
        }
    } catch (e) {
        // Ignore errors during cleanup
        // console.warn("Cleanup error:", e);
    }
}

describe('Dexie Persistence', () => {

    beforeEach(async () => {
        // Ensure a clean slate before each test
        await clearDatabase();
    });

    afterEach(async () => {
        // Clean up after each test
        await clearDatabase();
    });

    it('loadLastGradient returns null on cold start', async () => {
        const loaded = await loadLastGradient();
        expect(loaded).toBeNull();
    });

    it('saves and loads a simple gradient', async () => {
        const gradientToSave: Gradient = {
            id: 'test-1',
            type: 'linear',
            angle: 45,
            stops: [
                { id: 's1', position: 0, color: hexToOKLab('#ff0000') },
                { id: 's2', position: 1, color: hexToOKLab('#00ff00') },
            ],
        };

        await saveGradient(gradientToSave);
        const loaded = await loadLastGradient();

        expect(loaded).not.toBeNull();
        expect(loaded).toEqual(gradientToSave);
    });

    it('overwrites the previous gradient when saving again', async () => {
        const gradient1: Gradient = {
            id: 'g1', type: 'linear', angle: 0, stops: [
                { id: 's1a', position: 0, color: hexToOKLab('#000000') },
                { id: 's1b', position: 1, color: hexToOKLab('#ffffff') },
            ]
        };
        const gradient2: Gradient = {
            id: 'g2', type: 'linear', angle: 180, stops: [
                { id: 's2a', position: 0.2, color: hexToOKLab('#ff00ff') },
                { id: 's2b', position: 0.8, color: hexToOKLab('#00ffff') },
            ]
        };

        await saveGradient(gradient1);
        const loaded1 = await loadLastGradient();
        expect(loaded1?.id).toBe('g1');

        await saveGradient(gradient2); // Should overwrite using id='last'
        const loaded2 = await loadLastGradient();
        expect(loaded2).not.toBeNull();
        expect(loaded2?.id).toBe('g2');
        expect(loaded2?.angle).toBe(180);
        expect(loaded2).toEqual(gradient2);
    });
}); 