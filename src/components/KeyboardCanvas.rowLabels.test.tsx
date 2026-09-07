import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import KeyboardCanvas from './KeyboardCanvasUltraFast';
import { useKeyboardStore } from '../store/keyboardStoreOptimized';
import { planRowLabeling } from '../utils/autoLabeling';
import type { Key } from '../types';

interface DrawRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DrawLabel {
  text: string;
  x: number;
  y: number;
}

const makeContext = (rectangles: DrawRect[], labels: DrawLabel[]) => {
  let offsetX = 0;
  let offsetY = 0;
  let dashed = false;
  const stack: Array<{ offsetX: number; offsetY: number; dashed: boolean }> = [];
  const gradient = { addColorStop: vi.fn() };

  const methods: Record<string, (...args: unknown[]) => unknown> = {
    save: () => stack.push({ offsetX, offsetY, dashed }),
    restore: () => {
      const previous = stack.pop();
      if (previous) {
        ({ offsetX, offsetY, dashed } = previous);
      }
    },
    translate: (x, y) => {
      offsetX += Number(x);
      offsetY += Number(y);
    },
    setTransform: () => {
      offsetX = 0;
      offsetY = 0;
    },
    setLineDash: (segments) => {
      dashed = Array.isArray(segments) && segments.length > 0;
    },
    strokeRect: (x, y, width, height) => {
      if (dashed) {
        rectangles.push({
          x: Number(x) + offsetX,
          y: Number(y) + offsetY,
          width: Number(width),
          height: Number(height),
        });
      }
    },
    fillText: (text, x, y) => {
      if (/^(R[1-5]|SP)$/.test(String(text))) {
        labels.push({ text: String(text), x: Number(x) + offsetX, y: Number(y) + offsetY });
      }
    },
    measureText: (text) => ({ width: String(text).length * 8 }),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
  };

  return new Proxy({}, {
    get: (_target, property) => methods[String(property)] ?? (() => undefined),
    set: () => true,
  });
};

const physicalKeys = Array.from({ length: 5 }, (_, row): Key => ({
  id: `physical-${row}`,
  x: 0,
  y: row,
  width: 1,
  height: 1,
  labels: [''],
  profile: 'OEM',
}));

const applyPlan = (keys: Key[], plan: ReturnType<typeof planRowLabeling>): Key[] => {
  const changesById = new Map(plan.updates.map(({ id, changes }) => [id, changes]));
  return [
    ...keys.map((key) => ({ ...key, ...changesById.get(key.id) })),
    ...plan.additions,
  ];
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe.each([
  ['desktop', 1200, 800],
  ['390px', 390, 600],
])('generated row-label canvas bounds at %s', (_viewport, width, height) => {
  it('renders every decal rectangle and label center fully inside the visible canvas', () => {
    const plan = planRowLabeling(physicalKeys, (() => {
      let nextId = 0;
      return () => `row-label-${nextId++}`;
    })());
    const rectangles: DrawRect[] = [];
    const labels: DrawLabel[] = [];
    const context = makeContext(rectangles, labels);

    vi.spyOn(globalThis.HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as never);
    useKeyboardStore.setState((state) => ({
      ...state,
      keyboard: {
        meta: { name: 'Canvas bounds regression' },
        keys: applyPlan(physicalKeys, plan),
      },
      editorSettings: { ...state.editorSettings, unitSize: 54 },
      selectedKeys: new Set(),
      hoveredKey: null,
    }));

    const { container } = render(<KeyboardCanvas width={width} height={height} />);
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();

    const visibleWidth = Number.parseFloat(canvas?.style.width ?? '0');
    const visibleHeight = Number.parseFloat(canvas?.style.height ?? '0');
    expect(rectangles).toHaveLength(5);
    expect(labels.map(({ text }) => text)).toEqual(['R1', 'R2', 'R3', 'R4', 'R5']);

    rectangles.forEach((rectangle) => {
      expect(rectangle.width).toBe(52);
      expect(rectangle.x).toBeGreaterThanOrEqual(0);
      expect(rectangle.y).toBeGreaterThanOrEqual(0);
      expect(rectangle.x + rectangle.width).toBeLessThanOrEqual(visibleWidth);
      expect(rectangle.y + rectangle.height).toBeLessThanOrEqual(visibleHeight);
    });
    labels.forEach((label) => {
      expect(label.x).toBeGreaterThanOrEqual(0);
      expect(label.y).toBeGreaterThanOrEqual(0);
      expect(label.x).toBeLessThanOrEqual(visibleWidth);
      expect(label.y).toBeLessThanOrEqual(visibleHeight);
    });
  });
});
