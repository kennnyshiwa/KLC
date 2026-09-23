import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import KeyboardCanvas from './KeyboardCanvasUltraFast';
import { useKeyboardStore } from '../store/keyboardStoreOptimized';
import type { Key } from '../types';

const lae: Key = { id: 'special', x: 2, y: 1, width: 1.5, height: 1, x2: 0.75, y2: -1, width2: 0.75, height2: 2, stepped: true, labels: [], color: '#eeeeee' };
const miso: Key = { id: 'special', x: 2, y: 0, width: 1, height: 2, x2: -0.25, y2: 0, width2: 1.25, height2: 1, labels: [], color: '#eeeeee' };

function fixture(key: Key) {
  const tops: number[][] = [];
  const gradient = { addColorStop: vi.fn() };
  const methods: Record<string, (...args: number[]) => unknown> = {
    roundRect: (...args) => { if (args[4] === 4) tops.push(args); },
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    measureText: () => ({ width: 0 }),
  };
  const context = new Proxy({}, { get: (_, p) => methods[String(p)] ?? (() => undefined), set: () => true });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as never);
  useKeyboardStore.setState(state => ({
    keyboard: { meta: {}, keys: [key] },
    selectedKeys: new Set(), hoveredKey: null, isSettingRotationPoint: false,
    editorSettings: { ...state.editorSettings, unitSize: 54, showStabilizerPositions: false },
  }));
  const { container } = render(<KeyboardCanvas width={800} height={400} />);
  return { tops, canvas: container.querySelector('canvas')! };
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('special cap rendering and picking', () => {
  it('draws a raised surface and highlight only on the lower LAE body', () => {
    const { tops } = fixture(lae);
    expect(tops.length).toBeGreaterThan(0);
    expect(tops.every(([, y]) => y >= 54)).toBe(true);
    expect(tops.some(([,, width]) => width > 54)).toBe(true);
  });

  it.each([
    ['mISO arm', miso, [1.875, 0.5]],
    ['stepped LAE ledge', lae, [3.125, 0.5]],
  ] as const)('selects the visible %s outside the main rectangle', (_name, key, point) => {
    const { canvas } = fixture(key);
    fireEvent.mouseDown(canvas, { clientX: 40 + point[0] * 54, clientY: 40 + point[1] * 54, button: 0 });
    expect(useKeyboardStore.getState().selectedKeys.has(key.id)).toBe(true);
    fireEvent.mouseUp(window);
  });

  it.each([
    ['mISO', miso, [1.875, 1.5]],
    ['stepped LAE', lae, [2.25, 0.5]],
  ] as const)('does not select the empty %s notch', (_name, key, point) => {
    const { canvas } = fixture(key);
    fireEvent.mouseDown(canvas, { clientX: 40 + point[0] * 54, clientY: 40 + point[1] * 54, button: 0 });
    expect(useKeyboardStore.getState().selectedKeys.size).toBe(0);
    fireEvent.mouseUp(window);
  });

  it('uses the primary cap pivot when picking a rotated secondary region', () => {
    const key = { ...miso, rotation_angle: 90 };
    const { canvas } = fixture(key);
    // Rotate arm centre (1.875, .5) 90 degrees around primary centre (2.5, 1).
    fireEvent.mouseDown(canvas, { clientX: 40 + 3 * 54, clientY: 40 + 0.375 * 54, button: 0 });
    expect(useKeyboardStore.getState().selectedKeys.has(key.id)).toBe(true);
    fireEvent.mouseUp(window);
  });
});
