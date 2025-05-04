/**
 * Color utilities in OKLab/LCH space.
 * Based on the OKLab color space by Björn Ottosson.
 * Reference: https://bottosson.github.io/posts/oklab/
 * @packageDocumentation
 */

import { clamp } from './utils';

// --- Interfaces ---

/** OKLab coordinates */
export interface OKLab {
  l: number; /** Lightness (0-1) */
  a: number; /** Green-Red axis */
  b: number; /** Blue-Yellow axis */
}

/** Oklch coordinates */
export interface Oklch {
  l: number; // Lightness (0-1)
  c: number; // Chroma
  h: number; // Hue (0-360 degrees)
}

/** RGB coordinates (0-1 range) */
export interface RGB {
  r: number;
  g: number;
  b: number;
}

// --- Constants ---

// sRGB -> Linear RGB constants
const SRGB_ALPHA = 0.055;
const SRGB_GAMMA = 2.4;
const SRGB_THRESHOLD = 0.04045;
const SRGB_LINEAR_FACTOR = 12.92;

// Linear RGB -> XYZ constants (D65 illuminant)
const M_RGB_TO_XYZ: [number, number, number, number, number, number, number, number, number] = [
  0.4124564, 0.3575761, 0.1804375,
  0.2126729, 0.7151522, 0.0721750,
  0.0193339, 0.1191920, 0.9503041
];

// XYZ -> LMS constants (Bradford Cone Fundamentals)
const M_XYZ_TO_LMS: [number, number, number, number, number, number, number, number, number] = [
   0.8951,  0.2664, -0.1614,
  -0.7502,  1.7135,  0.0367,
   0.0389, -0.0685,  1.0296
];

// LMS -> OKLab constants
const M_LMS_TO_OKLAB: [number, number, number, number, number, number, number, number, number] = [
   0.2104542553,  0.7936177850, -0.0040720468,
   1.9779984951, -2.4285922050,  0.4505937099,
   0.0259040371,  0.7827717662, -0.8086757660
];

// Inverse matrices (precomputed or calculated)
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

// --- Helper Functions ---

function srgbToLinear(c: number): number {
  return (c <= SRGB_THRESHOLD) ? c / SRGB_LINEAR_FACTOR : Math.pow((c + SRGB_ALPHA) / (1 + SRGB_ALPHA), SRGB_GAMMA);
}

function linearToSrgb(c: number): number {
    return (c <= 0.0031308) ? SRGB_LINEAR_FACTOR * c : (1 + SRGB_ALPHA) * Math.pow(c, 1 / SRGB_GAMMA) - SRGB_ALPHA;
}

function multiplyMatrix3x3(M: [number, number, number, number, number, number, number, number, number], v: [number, number, number]): [number, number, number] {
    return [
        M[0] * v[0] + M[1] * v[1] + M[2] * v[2],
        M[3] * v[0] + M[4] * v[1] + M[5] * v[2],
        M[6] * v[0] + M[7] * v[1] + M[8] * v[2]
    ];
}

// Non-linear mapping for LMS (cube root approximation)
function mapLms(lms: [number, number, number]): [number, number, number] {
    return [Math.cbrt(lms[0]), Math.cbrt(lms[1]), Math.cbrt(lms[2])];
}

function unmapLms(lms_mapped: [number, number, number]): [number, number, number] {
    return [lms_mapped[0] ** 3, lms_mapped[1] ** 3, lms_mapped[2] ** 3];
}

// --- Core Conversion Functions ---

/**
 * Converts an sRGB Hex color string to OKLab coordinates.
 */
export function hexToOKLab(hex: string): OKLab {
  // 1. Parse Hex to RGB (0-1)
  const bigint = parseInt(hex.slice(1), 16);
  const r_srgb = ((bigint >> 16) & 255) / 255;
  const g_srgb = ((bigint >> 8) & 255) / 255;
  const b_srgb = (bigint & 255) / 255;

  // 2. sRGB to Linear RGB
  const r_linear = srgbToLinear(r_srgb);
  const g_linear = srgbToLinear(g_srgb);
  const b_linear = srgbToLinear(b_srgb);

  // 3. Linear RGB to XYZ
  const [x, y, z] = multiplyMatrix3x3(M_RGB_TO_XYZ, [r_linear, g_linear, b_linear]);

  // 4. XYZ to LMS
  const [l_cone, m_cone, s_cone] = multiplyMatrix3x3(M_XYZ_TO_LMS, [x, y, z]);

  // 5. Map LMS non-linearly
  const [l_mapped, m_mapped, s_mapped] = mapLms([l_cone, m_cone, s_cone]);

  // 6. Mapped LMS to OKLab
  const [l, a, b] = multiplyMatrix3x3(M_LMS_TO_OKLAB, [l_mapped, m_mapped, s_mapped]);

  return { l, a, b };
}

/**
 * Converts OKLab coordinates to an sRGB Hex color string.
 * Includes clamping to the sRGB gamut.
 */
export function oklabToHex(oklab: OKLab): string {
  // 1. OKLab to Mapped LMS
  const [l_mapped, m_mapped, s_mapped] = multiplyMatrix3x3(M_OKLAB_TO_LMS, [oklab.l, oklab.a, oklab.b]);

  // 2. Unmap LMS
  const [l_cone, m_cone, s_cone] = unmapLms([l_mapped, m_mapped, s_mapped]);

  // 3. LMS to XYZ
  const [x, y, z] = multiplyMatrix3x3(M_LMS_TO_XYZ, [l_cone, m_cone, s_cone]);

  // 4. XYZ to Linear RGB
  let [r_linear, g_linear, b_linear] = multiplyMatrix3x3(M_XYZ_TO_RGB, [x, y, z]);

  // 5. Gamut Clamping (simple clamp in linear RGB space)
  // Note: More sophisticated gamut mapping could be applied here.
  r_linear = clamp(r_linear, 0, 1);
  g_linear = clamp(g_linear, 0, 1);
  b_linear = clamp(b_linear, 0, 1);

  // 6. Linear RGB to sRGB
  let r_srgb = linearToSrgb(r_linear);
  let g_srgb = linearToSrgb(g_linear);
  let b_srgb = linearToSrgb(b_linear);

  // 7. Clamp sRGB results (final safeguard)
  r_srgb = clamp(r_srgb, 0, 1);
  g_srgb = clamp(g_srgb, 0, 1);
  b_srgb = clamp(b_srgb, 0, 1);

  // 8. Convert to Hex (0-255)
  const rHex = Math.round(r_srgb * 255).toString(16).padStart(2, '0');
  const gHex = Math.round(g_srgb * 255).toString(16).padStart(2, '0');
  const bHex = Math.round(b_srgb * 255).toString(16).padStart(2, '0');

  return `#${rHex}${gHex}${bHex}`;
}


// --- OKLCH Conversions ---

/** Converts OKLab to Oklch (Lightness, Chroma, Hue) */
export function oklabToOklch(oklab: OKLab): Oklch {
  const { l, a, b } = oklab;
  const c = Math.sqrt(a * a + b * b);
  let h = Math.atan2(b, a) * (180 / Math.PI);
  if (h < 0) {
    h += 360;
  }
  return { l, c, h };
}

/** Converts Oklch to OKLab */
export function oklchToOklab(oklch: Oklch): OKLab {
  const { l, c, h } = oklch;
  const rad = h * (Math.PI / 180);
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);
  return { l, a, b };
}

// --- Interpolation ---

/**
 * Interpolates between two OKLab colors.
 * @param color1 Start color.
 * @param color2 End color.
 * @param t Interpolation factor (0-1).
 * @returns Interpolated OKLab color.
 */
export function interpolateOKLab(color1: OKLab, color2: OKLab, t: number): OKLab {
    t = clamp(t, 0, 1);
    return {
        l: color1.l + (color2.l - color1.l) * t,
        a: color1.a + (color2.a - color1.a) * t,
        b: color1.b + (color2.b - color1.b) * t,
    };
}

/**
 * Interpolates between two Oklch colors.
 * Handles hue interpolation correctly (shortest path).
 * @param color1 Start color.
 * @param color2 End color.
 * @param t Interpolation factor (0-1).
 * @returns Interpolated Oklch color.
 */
export function interpolateOklch(color1: Oklch, color2: Oklch, t: number): Oklch {
    t = clamp(t, 0, 1);

    let hue1 = color1.h;
    let hue2 = color2.h;

    // Handle hue interpolation (shortest path)
    const diff = hue2 - hue1;
    let deltaHue: number;
    if (Math.abs(diff) <= 180) {
        deltaHue = diff;
    } else {
        deltaHue = (diff > 180) ? diff - 360 : diff + 360;
    }
    // eslint-disable-next-line prefer-const -- hue1 might be reassigned implicitly via deltaHue calculation
    const interpolatedHue = (hue1 + deltaHue * t) % 360;

    return {
        l: color1.l + (color2.l - color1.l) * t,
        c: color1.c + (color2.c - color1.c) * t,
        h: interpolatedHue < 0 ? interpolatedHue + 360 : interpolatedHue, // Ensure hue is 0-360
    };
}

// TODO: Consider adding functions for gamut mapping beyond simple clamping if needed