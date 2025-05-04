/**
 * Gradient model & helpers.
 */

import { OKLab, oklabToHex, hexToOKLab } from './color';
import { clamp } from './utils';

export interface GradientStop {
  id: string;
  position: number; // 0–1
  color: OKLab;
}

export type GradientType = 'linear' | 'radial' | 'conic';

export interface Gradient {
  id: string;
  type: GradientType;
  angle: number; // degrees, used for linear
  stops: GradientStop[];
}

/**
 * Serialize to CSS `linear-gradient(...)` string.
 * TODO: Support radial/conic gradients.
 * TODO: Handle color interpolation space (OKLab vs sRGB).
 */
export function toCss(g: Gradient): string {
  if (g.type !== 'linear') {
    console.warn(`CSS serialization for ${g.type} gradients not implemented.`);
    return 'background: gray;'; // Fallback
  }

  // Sort stops by position just in case
  const sortedStops = [...g.stops].sort((a, b) => a.position - b.position);

  const stopsString = sortedStops
    .map((stop) => {
      const hexColor = oklabToHex(stop.color);
      const posPercent = clamp(stop.position * 100, 0, 100);
      return `${hexColor} ${posPercent.toFixed(2)}%`;
    })
    .join(', ');

  return `linear-gradient(${g.angle}deg, ${stopsString})`;
}

/** Calculates relative luminance (L) from linear RGB values (0-1) */
function calculateRelativeLuminance(r_linear: number, g_linear: number, b_linear: number): number {
    // Coefficients from WCAG standard
    return 0.2126 * r_linear + 0.7152 * g_linear + 0.0722 * b_linear;
}

/** Calculates WCAG contrast ratio between two OKLab colors */
function calculateContrastRatio(color1: OKLab, color2: OKLab): number {
    // 1. Convert OKLab back to Hex -> RGB -> Linear RGB to get relative luminance
    // This is inefficient but necessary until luminance calculation directly from OKLab is verified/implemented.
    // Note: Re-uses hexToOKLab internals but stops after linear RGB calculation.
    const getLinearRgb = (oklab: OKLab): [number, number, number] => {
      const [l_mapped, m_mapped, s_mapped] = multiplyMatrix3x3(M_OKLAB_TO_LMS, [oklab.l, oklab.a, oklab.b]);
      const [l_cone, m_cone, s_cone] = unmapLms([l_mapped, m_mapped, s_mapped]);
      const [x, y, z] = multiplyMatrix3x3(M_LMS_TO_XYZ, [l_cone, m_cone, s_cone]);
      let [r_linear, g_linear, b_linear] = multiplyMatrix3x3(M_XYZ_TO_RGB, [x, y, z]);
       // Clamp linear RGB before luminance calculation, as per typical sRGB workflow
      r_linear = clamp(r_linear, 0, 1);
      g_linear = clamp(g_linear, 0, 1);
      b_linear = clamp(b_linear, 0, 1);
      return [r_linear, g_linear, b_linear];
    }

    const [r1, g1, b1] = getLinearRgb(color1);
    const [r2, g2, b2] = getLinearRgb(color2);

    const lum1 = calculateRelativeLuminance(r1, g1, b1);
    const lum2 = calculateRelativeLuminance(r2, g2, b2);

    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);

    return (lighter + 0.05) / (darker + 0.05);
}

// Import necessary matrices and functions from color.ts (or redefine if needed)
// Assume M_OKLAB_TO_LMS, unmapLms, M_LMS_TO_XYZ, M_XYZ_TO_RGB are accessible
// For simplicity in this edit, we might copy/paste the matrix definitions and helpers
// needed specifically for calculateContrastRatio if direct import isn't straightforward.
// --- Constants (Copied from color.ts for calculateContrastRatio helper) ---
const M_OKLAB_TO_LMS: [number, number, number, number, number, number, number, number, number] = [
   1.0000000,  0.3963377774,  0.2158037573,
   1.0000000, -0.1055613458, -0.0638541728,
   1.0000000, -0.0894841775, -1.2914855480
];
const M_LMS_TO_XYZ: [number, number, number, number, number, number, number, number, number] = [
   0.9869929, -0.1470543,  0.1599627,
   0.4323053,  0.5183603,  0.0492912,
  -0.0085287,  0.0400428,  0.9684867
];
const M_XYZ_TO_RGB: [number, number, number, number, number, number, number, number, number] = [
   3.2404542, -1.5371385, -0.4985314,
  -0.9692660,  1.8760108,  0.0415560,
   0.0556434, -0.2040259,  1.0572252
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
// --- End Copied Constants/Helpers ---

/**
 * Validate gradient for WCAG contrast (AA level) between adjacent stop pairs.
 * Checks if contrast ratio is >= 4.5:1 (or 3:1 for large text, not applicable here).
 * @returns list of pairs of failing stop ids `[stopId1, stopId2]`, empty if all pairs pass.
 */
export function contrastAudit(g: Gradient, threshold = 4.5): [string, string][] {
  const failingPairs: [string, string][] = [];
  if (g.stops.length < 2) {
    return [];
  }

  const sortedStops = [...g.stops].sort((a, b) => a.position - b.position);

  for (let i = 0; i < sortedStops.length - 1; i++) {
    const stop1 = sortedStops[i];
    const stop2 = sortedStops[i + 1];

    const ratio = calculateContrastRatio(stop1.color, stop2.color);

    if (ratio < threshold) {
      failingPairs.push([stop1.id, stop2.id]);
    }
  }

  return failingPairs;
}

/**
 * Serialize gradient to an SVG <linearGradient> definition string.
 * 
 * @param g The gradient object.
 * @param id The desired ID for the SVG gradient definition (default: 'gradient-svg').
 * @returns An SVG string containing the <defs> and <linearGradient>.
 */
export function toSvgDefinition(g: Gradient, id = 'gradient-svg'): string {
  if (g.type !== 'linear') {
    console.warn(`SVG serialization for ${g.type} gradients not implemented.`);
    return '<defs></defs>'; // Return empty defs for non-linear
  }

  const sortedStops = [...g.stops].sort((a, b) => a.position - b.position);

  // Convert angle (0=right, 90=down) to SVG gradientTransform rotation
  // SVG rotation is clockwise from the positive x-axis
  const svgAngle = g.angle; // SVG angle matches CSS angle definition

  // Calculate x1, y1, x2, y2 based on angle (simplified - assumes bounding box)
  // More accurate calculation might involve transforming unit vectors
  const rad = g.angle * (Math.PI / 180);
  const x1 = Math.max(0, 0.5 - Math.cos(rad) * 0.5).toFixed(2);
  const y1 = Math.max(0, 0.5 - Math.sin(rad) * 0.5).toFixed(2);
  const x2 = Math.min(1, 0.5 + Math.cos(rad) * 0.5).toFixed(2);
  const y2 = Math.min(1, 0.5 + Math.sin(rad) * 0.5).toFixed(2);
  // Alternative (often sufficient): let gradientTransform rotate the default horizontal gradient

  const stopsString = sortedStops
    .map((stop) => {
      // Use the precise hex color for SVG stops
      const hexColor = oklabToHex(stop.color);
      const offset = clamp(stop.position, 0, 1);
      return `    <stop offset="${(offset * 100).toFixed(1)}%" stop-color="${hexColor}" />`;
    })
    .join('\n');

  return (
`<defs>
  <linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" gradientUnits="objectBoundingBox">
${stopsString}
  </linearGradient>
</defs>`
  );
}

/**
 * Generates a full SVG file string displaying the gradient.
 * 
 * @param g The gradient object.
 * @param width The width of the SVG.
 * @param height The height of the SVG.
 * @returns A string containing the full SVG markup.
 */
export function toSvgFile(g: Gradient, width = 500, height = 500): string {
    const gradientId = 'gradient-fill';
    const definition = toSvgDefinition(g, gradientId);

    return (
`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
${definition}
  <rect x="0" y="0" width="${width}" height="${height}" fill="url(#${gradientId})" />
</svg>`
    );
}

// TODO: Add functions for adding/removing/updating stops
// TODO: Add gradient parsing logic (from CSS string?) 