import { describe, it, expect } from 'vitest';
import { toCss, Gradient, OKLab, contrastAudit, /*GradientStop*/ } from '../src/gradient';
import { hexToOKLab } from '../src/color'; // Need this for setting up test gradients

// Mock oklabToHex for CSS serialization tests only
// Keep the actual color conversions for contrast tests
vi.mock('../src/color', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/color')>();
  return {
    ...original, // Use original implementations for hexToOKLab etc.
    oklabToHex: (c: OKLab) => { // Mock only oklabToHex for predictable CSS output
      const gray = Math.round(c.l * 255);
      const hex = gray.toString(16).padStart(2, '0');
      return `#${hex}${hex}${hex}`;
    },
  };
});

describe('Gradient serialization', () => {
  it('serializes a simple two-stop linear gradient', () => {
    const gradient: Gradient = {
      id: 'g1',
      type: 'linear',
      angle: 90,
      stops: [
        { id: 's1', position: 0, color: { l: 0.0, a: 0, b: 0 } }, // Mocked to #000000
        { id: 's2', position: 1, color: { l: 1.0, a: 0, b: 0 } }, // Mocked to #ffffff
      ],
    };
    const css = toCss(gradient);
    expect(css).toBe('linear-gradient(90deg, #000000 0.00%, #ffffff 100.00%)');
  });

  it('serializes a three-stop gradient with specific positions', () => {
    const gradient: Gradient = {
      id: 'g2',
      type: 'linear',
      angle: 45,
      stops: [
        { id: 's1', position: 0.1, color: { l: 0.2, a: 0, b: 0 } }, // Mocked to #333333
        { id: 's2', position: 0.5, color: { l: 0.5, a: 0, b: 0 } }, // Mocked to #808080
        { id: 's3', position: 0.9, color: { l: 0.8, a: 0, b: 0 } }, // Mocked to #cccccc
      ],
    };
    const css = toCss(gradient);
    expect(css).toBe(
      'linear-gradient(45deg, #333333 10.00%, #808080 50.00%, #cccccc 90.00%)'
    );
  });

  it('sorts stops by position before serialization', () => {
    const gradient: Gradient = {
      id: 'g3',
      type: 'linear',
      angle: 0,
      stops: [
        { id: 's2', position: 1, color: { l: 1.0, a: 0, b: 0 } }, // #ffffff
        { id: 's1', position: 0, color: { l: 0.0, a: 0, b: 0 } }, // #000000
      ],
    };
    const css = toCss(gradient);
    expect(css).toBe('linear-gradient(0deg, #000000 0.00%, #ffffff 100.00%)');
  });

  it('clamps stop positions outside 0-1 range during serialization', () => {
    const gradient: Gradient = {
      id: 'g4',
      type: 'linear',
      angle: 180,
      stops: [
        { id: 's1', position: -0.5, color: { l: 0.0, a: 0, b: 0 } }, // #000000 at 0%
        { id: 's2', position: 1.5, color: { l: 1.0, a: 0, b: 0 } }, // #ffffff at 100%
      ],
    };
    const css = toCss(gradient);
    expect(css).toBe('linear-gradient(180deg, #000000 0.00%, #ffffff 100.00%)');
  });
});

describe('Gradient Contrast Audit', () => {
  const black = hexToOKLab('#000000');
  const white = hexToOKLab('#ffffff');
  const midGray = hexToOKLab('#777777'); // WCAG contrast ~4.55 against white
  const lightGray = hexToOKLab('#d3d3d3'); // WCAG contrast ~1.67 against white
  const darkGray = hexToOKLab('#333333'); // WCAG contrast ~7.0 against white
  const red = hexToOKLab('#ff0000');
  const yellow = hexToOKLab('#ffff00'); // Low contrast against white

  it('passes a high-contrast gradient (black to white)', () => {
    const gradient: Gradient = { id: 'g', type:'linear', angle: 0, stops: [
        { id: 's1', position: 0, color: black },
        { id: 's2', position: 1, color: white },
    ]};
    expect(contrastAudit(gradient)).toEqual([]);
  });

  it('fails a low-contrast gradient (light gray to white)', () => {
    const gradient: Gradient = { id: 'g', type:'linear', angle: 0, stops: [
        { id: 's1', position: 0, color: lightGray },
        { id: 's2', position: 1, color: white },
    ]};
    expect(contrastAudit(gradient)).toEqual([['s1', 's2']]);
  });

   it('fails a low-contrast gradient (yellow to white)', () => {
    const gradient: Gradient = { id: 'g', type:'linear', angle: 0, stops: [
        { id: 's1', position: 0, color: yellow },
        { id: 's2', position: 1, color: white },
    ]};
    expect(contrastAudit(gradient)).toEqual([['s1', 's2']]);
  });

  it('passes a gradient just meeting the AA threshold (mid gray to white)', () => {
    const gradient: Gradient = { id: 'g', type:'linear', angle: 0, stops: [
        { id: 's1', position: 0, color: midGray },
        { id: 's2', position: 1, color: white },
    ]};
    // Default threshold is 4.5
    expect(contrastAudit(gradient)).toEqual([]);
  });

   it('fails a gradient just below the AA threshold if threshold is slightly higher', () => {
    const gradient: Gradient = { id: 'g', type:'linear', angle: 0, stops: [
        { id: 's1', position: 0, color: midGray },
        { id: 's2', position: 1, color: white },
    ]};
    // Test with slightly higher threshold
    expect(contrastAudit(gradient, 4.6)).toEqual([['s1', 's2']]);
  });

  it('passes a multi-stop gradient where all adjacent pairs have sufficient contrast', () => {
      const gradient: Gradient = { id: 'g', type:'linear', angle: 0, stops: [
        { id: 's1', position: 0, color: black },
        { id: 's2', position: 0.5, color: darkGray }, // black-darkGray > 4.5
        { id: 's3', position: 1, color: white },    // darkGray-white > 4.5
    ]};
    expect(contrastAudit(gradient)).toEqual([]);
  });

  it('fails a multi-stop gradient if one adjacent pair has insufficient contrast', () => {
      const gradient: Gradient = { id: 'g', type:'linear', angle: 0, stops: [
        { id: 's1', position: 0, color: black },
        { id: 's2', position: 0.3, color: darkGray }, // OK
        { id: 's3', position: 0.7, color: lightGray },// Fail (darkGray-lightGray)
        { id: 's4', position: 1, color: white },    // OK
    ]};
    expect(contrastAudit(gradient)).toEqual([['s2', 's3']]);
  });

  it('correctly identifies multiple failing pairs in a multi-stop gradient', () => {
      const gradient: Gradient = { id: 'g', type:'linear', angle: 0, stops: [
        { id: 's1', position: 0, color: white },
        { id: 's2', position: 0.3, color: yellow }, // Fail
        { id: 's3', position: 0.7, color: lightGray },// Fail
        { id: 's4', position: 1, color: midGray },    // OK
    ]};
    expect(contrastAudit(gradient)).toEqual([['s1', 's2'], ['s2', 's3']]);
  });

  it('returns empty array for gradients with less than 2 stops', () => {
     const gradient0: Gradient = { id: 'g', type:'linear', angle: 0, stops: [] };
     const gradient1: Gradient = { id: 'g', type:'linear', angle: 0, stops: [
         { id: 's1', position: 0, color: black }
     ]};
     expect(contrastAudit(gradient0)).toEqual([]);
     expect(contrastAudit(gradient1)).toEqual([]);
  });

  it('handles gradients with less than 2 stops for contrast audit', () => {
    const singleStopGradient: Gradient = {
      id: 'single',
      type: 'linear',
      angle: 90,
      stops: [{ id: 's1', position: 0.5, color: hexToOKLab('#ffffff') }]
    };
    expect(contrastAudit(singleStopGradient)).toEqual([]);

    const noStopGradient: Gradient = {
      id: 'none',
      type: 'linear',
      angle: 90,
      stops: []
    };
    expect(contrastAudit(noStopGradient)).toEqual([]);
  });

  // Add a test for the contrast calculation helper if desired
  // it('calculates contrast ratio correctly', () => {
  //     const white = hexToOKLab('#ffffff');
  //     const black = hexToOKLab('#000000');
  //     const _red = hexToOKLab('#ff0000'); // Prefix unused variable
  //     expect(calculateContrastRatio(white, black)).toBeCloseTo(21, 1);
  // });
});

// TODO: Add tests for radial/conic CSS serialization once implemented

// TODO: Add tests for contrastAudit
// TODO: Add tests for radial/conic once implemented