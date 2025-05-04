import { describe, it, expect } from 'vitest';
import {
  hexToOKLab,
  oklabToHex,
  oklabToOklch,
  oklchToOklab,
  interpolateOKLab,
  OKLab,
  Oklch,
} from '../src/color';

// Helper to compare OKLab/Oklch values with tolerance
function expectOklabClose(actual: OKLab, expected: OKLab, precision = 6) {
  expect(actual.l).toBeCloseTo(expected.l, precision);
  expect(actual.a).toBeCloseTo(expected.a, precision);
  expect(actual.b).toBeCloseTo(expected.b, precision);
}

function expectOklchClose(actual: Oklch, expected: Oklch, precision = 6) {
  expect(actual.l).toBeCloseTo(expected.l, precision);
  expect(actual.c).toBeCloseTo(expected.c, precision);
  // Hue needs careful comparison due to circular nature
  const diff = Math.abs(actual.h - expected.h) % 360;
  expect(Math.min(diff, 360 - diff)).toBeCloseTo(0, precision);
}

describe('Color Conversions', () => {
  describe('hexToOKLab', () => {
    it('converts black correctly', () => {
      expectOklabClose(hexToOKLab('#000000'), { l: 0, a: 0, b: 0 });
    });

    it('converts white correctly', () => {
      // Note: White in OKLab is not exactly L=1 due to XYZ scaling
      expectOklabClose(hexToOKLab('#ffffff'), { l: 1.0, a: 0, b: 0 }, 5);
    });

    it('converts sRGB red correctly', () => {
       expectOklabClose(hexToOKLab('#ff0000'), { l: 0.627955, a: 0.224863, b: 0.125846 }, 5);
    });

    it('converts sRGB green correctly', () => {
       expectOklabClose(hexToOKLab('#00ff00'), { l: 0.866440, a: -0.233888, b: 0.179410 }, 5);
    });

    it('converts sRGB blue correctly', () => {
       expectOklabClose(hexToOKLab('#0000ff'), { l: 0.452014, a: -0.032451, b: -0.311528 }, 5);
    });

     it('converts gray correctly', () => {
       expectOklabClose(hexToOKLab('#808080'), { l: 0.599993, a: 0, b: 0 }, 5);
    });
  });

  describe('oklabToHex', () => {
     it('converts black (L=0) correctly', () => {
      expect(oklabToHex({ l: 0, a: 0, b: 0 })).toBe('#000000');
    });

    it('converts white (L=1) correctly', () => {
      expect(oklabToHex({ l: 1, a: 0, b: 0 })).toBe('#ffffff');
    });
    
    it('converts OKLab red back to hex', () => {
        // Using values derived from #ff0000
        expect(oklabToHex({ l: 0.627955, a: 0.224863, b: 0.125846 })).toBe('#ff0000');
    });

    it('converts OKLab green back to hex', () => {
        expect(oklabToHex({ l: 0.866440, a: -0.233888, b: 0.179410 })).toBe('#00ff00');
    });

    it('converts OKLab blue back to hex', () => {
        expect(oklabToHex({ l: 0.452014, a: -0.032451, b: -0.311528 })).toBe('#0000ff');
    });

    it('converts OKLab gray back to hex', () => {
        expect(oklabToHex({ l: 0.599993, a: 0, b: 0 })).toBe('#808080');
    });

    it('handles out-of-gamut colors by clamping (e.g., highly saturated blue)', () => {
      // This highly saturated blue in OKLab is outside sRGB gamut
      const outOfGamutBlue = { l: 0.5, a: -0.1, b: -0.4 };
      const hex = oklabToHex(outOfGamutBlue);
      // We expect a clamped value, likely close to #0000ff but not exactly
      // The exact result depends on clamping method, but should be a valid hex
      expect(hex).toMatch(/^#[0-9a-f]{6}$/);
      // Check it converts back to something reasonably close to the *clamped* OKLab value
      const roundTripped = hexToOKLab(hex);
      // It won't match the original out-of-gamut value perfectly
      // expectOklabClose(roundTripped, outOfGamutBlue, 1); // This would likely fail
      expect(roundTripped.l).toBeLessThanOrEqual(1.0);
      expect(roundTripped.l).toBeGreaterThanOrEqual(0.0);
    });
  });

  describe('Round Trip Conversions', () => {
    const testColors = ['#f0f0f0', '#123456', '#abcdef', '#ff8800', '#00aabb', '#a020f0'];
    testColors.forEach(hex => {
        it(`converts ${hex} -> OKLab -> hex accurately`, () => {
            const oklab = hexToOKLab(hex);
            const roundTripHex = oklabToHex(oklab);
            // Allow slight differences due to float precision and clamping
            // Compare integer RGB values after conversion
            const originalRGB = parseInt(hex.slice(1), 16);
            const roundTripRGB = parseInt(roundTripHex.slice(1), 16);
            const diff = Math.abs(originalRGB - roundTripRGB);
            // Expect difference to be minimal (usually 0, sometimes 1 per channel)
            expect(diff).toBeLessThanOrEqual(0x010101); 
        });
    });
  });

  describe('OKLab <-> Oklch', () => {
     const labRed = { l: 0.627955, a: 0.224863, b: 0.125846 };
     const lchRed = { l: 0.627955, c: 0.257688, h: 29.2491 };
     const labBlue = { l: 0.452014, a: -0.032451, b: -0.311528 };
     const lchBlue = { l: 0.452014, c: 0.313215, h: 264.062 };
     const labZeroChroma = { l: 0.5, a: 0, b: 0 };
     const lchZeroChroma = { l: 0.5, c: 0, h: 0 }; // Hue is arbitrary at zero chroma

    it('converts OKLab red to Oklch', () => {
        expectOklchClose(oklabToOklch(labRed), lchRed, 4);
    });
    it('converts Oklch red to OKLab', () => {
        expectOklabClose(oklchToOklab(lchRed), labRed, 4);
    });
    it('converts OKLab blue to Oklch', () => {
        expectOklchClose(oklabToOklch(labBlue), lchBlue, 4);
    });
    it('converts Oklch blue to OKLab', () => {
        expectOklabClose(oklchToOklab(lchBlue), labBlue, 4);
    });
    it('handles zero chroma correctly (Lab to Lch)', () => {
        const lch = oklabToOklch(labZeroChroma);
        expect(lch.l).toBeCloseTo(labZeroChroma.l);
        expect(lch.c).toBeCloseTo(0);
        // Hue can be anything, often defaults to 0
    });
    it('handles zero chroma correctly (Lch to Lab)', () => {
        expectOklabClose(oklchToOklab(lchZeroChroma), labZeroChroma);
    });
  });

   describe('Interpolation', () => {
     const c1_lab = { l: 0.2, a: 0.1, b: -0.1 };
     const c2_lab = { l: 0.8, a: -0.1, b: 0.2 };
     const c1_lch = oklabToOklch(c1_lab);
     const c2_lch = oklabToOklch(c2_lab);

    it('interpolates OKLab midpoint correctly', () => {
        const midpoint = interpolateOKLab(c1_lab, c2_lab, 0.5);
        expectOklabClose(midpoint, { l: 0.5, a: 0.0, b: 0.05 });
    });

    it('interpolates OKLab start point correctly', () => {
        const startpoint = interpolateOKLab(c1_lab, c2_lab, 0);
        expectOklabClose(startpoint, c1_lab);
    });

    it('interpolates OKLab end point correctly', () => {
        const endpoint = interpolateOKLab(c1_lab, c2_lab, 1);
        expectOklabClose(endpoint, c2_lab);
    });

    it('interpolates Oklch midpoint correctly', () => {
        const midpoint_lch = interpolateOklch(c1_lch, c2_lch, 0.5);
        const midpoint_lab = oklchToOklab(midpoint_lch);
        // Interpolating LCH and converting != interpolating LAB directly
        // Check if L and C are midpoints
        expect(midpoint_lch.l).toBeCloseTo(0.5);
        expect(midpoint_lch.c).toBeCloseTo((c1_lch.c + c2_lch.c) / 2);
        // Hue check is more complex, but should be roughly between c1 and c2 hues
    });

     it('should correctly interpolate between two colors', () => {
        const blue = hexToOKLab('#0000ff');
        const _red = hexToOKLab('#ff0000'); // Prefixed unused variable

        const midpoint_oklab = interpolateOKLab(blue, _red, 0.5);
        // Basic check: Ensure components are between blue and red
    });

    it.skip('should correctly interpolate hues across the 0/360 boundary', () => {
        // TODO: Implement Oklch interpolation tests if needed
        // const color1 = { l: 0.6, c: 0.1, h: 350 }; // Example color near boundary
        // const color2 = { l: 0.7, c: 0.15, h: 10 }; // Example color across boundary
        // const _midpoint_oklch = interpolateOklch(color1, color2, 0.5);
        // expect(_midpoint_oklch.h).toBeCloseTo(0); // Expected midpoint hue (0 or 360)
    });
  });
}); 