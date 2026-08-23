import { describe, expect, it } from 'vitest';
import type { Key } from '../types';
import { getKeyboardRenderBounds, scaleRenderBounds } from './canvasExportBounds';

const key = (changes: Partial<Key> = {}): Key => ({
  id: 'key', x: 1, y: 2, width: 1, height: 1, labels: [], ...changes,
});

describe('getKeyboardRenderBounds', () => {
  const options = { offsetX: 40, offsetY: 40, padding: 20, canvasWidth: 1620, canvasHeight: 726 };

  it('crops geometry instead of returning a noisy full-canvas buffer', () => {
    expect(getKeyboardRenderBounds([key()], 54, options))
      .toEqual({ x: 75, y: 129, width: 92, height: 92 });
  });

  it('includes rotated secondary rectangles', () => {
    const bounds = getKeyboardRenderBounds([
      key({ x: 2, y: 2, width: 1.25, height: 2, x2: -0.25, y2: -1, width2: 1.5, height2: 1, rotation_angle: 90 }),
    ], 40, { ...options, canvasWidth: 800, canvasHeight: 600 });
    expect(bounds).toEqual({ x: 86, y: 106, width: 158, height: 98 });
  });

  it('clamps only when geometry and padding reach a canvas edge', () => {
    expect(getKeyboardRenderBounds([key({ x: -0.5, y: -0.5 })], 40, { ...options, offsetX: 10, offsetY: 10 }))
      .toEqual({ x: 0, y: 0, width: 49, height: 49 });
  });
});

describe('scaleRenderBounds', () => {
  it.each([1, 2, 3])('preserves the 20 CSS px padding at %sx backing scale', scale => {
    const css = getKeyboardRenderBounds([key({ x: 0, y: 0 })], 50, {
      offsetX: 40, offsetY: 40, padding: 20, canvasWidth: 800, canvasHeight: 600,
    })!;
    const physical = scaleRenderBounds(css, scale, 800 * scale, 600 * scale);
    expect(physical).toEqual({ x: 21 * scale, y: 21 * scale, width: 88 * scale, height: 88 * scale });
  });
});
