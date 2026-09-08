import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import KeyboardCanvas from './KeyboardCanvasUltraFast';
import { useKeyboardStore } from '../store/keyboardStoreOptimized';
import type { Key } from '../types';
import { exportToKLE2, importFromKLE2 } from '../utils/kle2Serializer';
import { exportToKLE } from '../utils/kleExporter';
import { parseOriginalKLE } from '../utils/originalKLEParser';

interface DrawnLegend {
  text: string;
  x: number;
  y: number;
}

const makeContext = (drawnLegends: DrawnLegend[]) => {
  let offsetX = 0;
  let offsetY = 0;
  const stack: Array<{ offsetX: number; offsetY: number }> = [];
  const gradient = { addColorStop: vi.fn() };

  const methods: Record<string, (...args: unknown[]) => unknown> = {
    save: () => stack.push({ offsetX, offsetY }),
    restore: () => {
      const previous = stack.pop();
      if (previous) ({ offsetX, offsetY } = previous);
    },
    translate: (x, y) => {
      offsetX += Number(x);
      offsetY += Number(y);
    },
    setTransform: () => {
      offsetX = 0;
      offsetY = 0;
    },
    fillText: (text, x, y) => {
      if (/^(TL|TC|TR|ML|MC|MR|BL|BC|BR|MM-PROBE|LINE 1|LINE 2)$/.test(String(text))) {
        drawnLegends.push({
          text: String(text),
          x: Number(x) + offsetX,
          y: Number(y) + offsetY,
        });
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

const renderKey = (key: Key): DrawnLegend[] => {
  const drawnLegends: DrawnLegend[] = [];
  const context = makeContext(drawnLegends);

  vi.spyOn(globalThis.HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as never);
  useKeyboardStore.setState((state) => ({
    ...state,
    keyboard: { meta: { name: 'Legend geometry regression' }, keys: [key] },
    editorSettings: { ...state.editorSettings, unitSize: 54 },
    selectedKeys: new Set(),
    hoveredKey: null,
  }));

  render(<KeyboardCanvas width={800} height={500} />);
  return drawnLegends;
};

const makeKey = (changes: Partial<Key> = {}): Key => ({
  id: 'legend-key',
  x: 0,
  y: 0,
  width: 1,
  height: 1,
  labels: [],
  color: '#cccccc',
  profile: 'DCS',
  ...changes,
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('canvas legend slot geometry', () => {
  it.each([
    ['1u', {}],
    ['wide', { width: 2.25 }],
    ['rotated', { x: 2, y: 1, rotation_x: 2.5, rotation_y: 1.5, rotation_angle: 30 }],
  ] satisfies Array<[string, Partial<Key>]>)('uses the same nine-position grid for decal and non-decal %s keys', (_name, geometry) => {
    const labels: string[] = [];
    [
      [0, 'TL'], [10, 'TC'], [2, 'TR'],
      [7, 'ML'], [8, 'MC'], [9, 'MR'],
      [1, 'BL'], [11, 'BC'], [3, 'BR'],
    ].forEach(([index, label]) => { labels[Number(index)] = String(label); });

    const normal = renderKey(makeKey({ ...geometry, labels }));
    cleanup();
    vi.restoreAllMocks();
    const decal = renderKey(makeKey({ ...geometry, labels, decal: true }));

    expect(normal.map(({ text }) => text)).toEqual(['TL', 'BL', 'TR', 'BR', 'ML', 'MC', 'MR', 'TC', 'BC']);
    expect(decal.map(({ text }) => text)).toEqual(normal.map(({ text }) => text));

    const normalByText = new Map(normal.map(legend => [legend.text, legend]));
    const decalByText = new Map(decal.map(legend => [legend.text, legend]));
    expect(decalByText.get('MC')?.y).toBeCloseTo(decalByText.get('ML')?.y ?? Number.NaN);
    expect(decalByText.get('MC')?.y).toBeCloseTo(decalByText.get('MR')?.y ?? Number.NaN);
    expect(decalByText.get('MC')?.y).toBeGreaterThan(decalByText.get('TC')?.y ?? Number.NaN);
    expect(normalByText.get('MC')?.y).toBeGreaterThan(normalByText.get('TC')?.y ?? Number.NaN);
  });

  it('keeps a multiline decal legend in the middle-center slot', () => {
    const labels: string[] = [];
    labels[8] = 'LINE 1\nLINE 2';

    const [firstLine, secondLine] = renderKey(makeKey({ width: 2.25, labels, decal: true }));

    expect(firstLine.text).toBe('LINE 1');
    expect(secondLine.text).toBe('LINE 2');
    expect(firstLine.y).toBeGreaterThan(20);
    expect(secondLine.y).toBeGreaterThan(firstLine.y);
  });

  it('renders the reproduced labels[8] value at decal middle-center', () => {
    const labels: string[] = [];
    labels[8] = 'MM-PROBE';

    const [legend] = renderKey(makeKey({ labels, decal: true }));

    expect(legend.text).toBe('MM-PROBE');
    expect(legend.y).toBeGreaterThan(20);
  });
});

describe('decal legend data stability', () => {
  const labels = [
    'TL', 'BL', 'TR', 'BR', '', '', '', 'ML', 'MC', 'MR', 'TC', 'BC',
  ];

  it('toggles decal through undo and redo without changing legend arrays or custom data', () => {
    const key = makeKey({
      labels: [...labels],
      textColor: labels.map((_, index) => `#${String(index).padStart(6, '0')}`),
      textSize: labels.map((_, index) => (index % 9) + 1),
      legendRotation: labels.map((_, index) => index * 15),
      frontLegends: ['CUSTOM LEFT', 'CUSTOM CENTER', 'CUSTOM RIGHT'],
      rowPosition: 'K1',
    });
    useKeyboardStore.getState().setKeyboard({ meta: { name: 'Toggle stability' }, keys: [key] });

    useKeyboardStore.getState().updateKey(key.id, { decal: true });
    const toggled = useKeyboardStore.getState().keyboard.keys[0];
    expect(toggled).toMatchObject({
      decal: true,
      labels: key.labels,
      textColor: key.textColor,
      textSize: key.textSize,
      legendRotation: key.legendRotation,
      frontLegends: key.frontLegends,
      rowPosition: 'K1',
    });

    useKeyboardStore.getState().undo();
    expect(useKeyboardStore.getState().keyboard.keys[0]).toEqual(key);

    useKeyboardStore.getState().redo();
    expect(useKeyboardStore.getState().keyboard.keys[0]).toEqual(toggled);
  });

  it('preserves all nine UI slots through KLC serialization', () => {
    const key = makeKey({ labels: [...labels], decal: true, frontLegends: ['F1', 'F2', 'F3'] });
    const serialized = exportToKLE2({ meta: { name: 'KLC round trip' }, keys: [key] });
    const [restored] = importFromKLE2(serialized).keys;

    expect(restored.labels).toEqual(labels);
    expect(restored.frontLegends).toEqual(key.frontLegends);
    expect(restored.decal).toBe(true);
  });

  it('preserves all nine UI slots through original KLE export and reimport for a rotated decal', () => {
    const key = makeKey({
      x: 2,
      y: 1,
      rotation_x: 2.5,
      rotation_y: 1.5,
      rotation_angle: 30,
      labels: [...labels],
      decal: true,
    });
    const [restored] = parseOriginalKLE(exportToKLE({ meta: { name: 'KLE round trip' }, keys: [key] })).keys;

    expect(restored.labels).toEqual(labels);
    expect(restored.decal).toBe(true);
    expect(restored.rotation_angle).toBe(30);
  });
});
