/**
 * Generic utility functions.
 */

/** Clamps a number between a minimum and maximum value. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Linear interpolation between two numbers. */
export function lerp(a: number, b: number, t: number): number {
  return a * (1 - t) + b * t;
} 