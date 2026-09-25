import { parseKLE, serializeToKLE, parseKLEString, serializeToKLEString } from './kleParser';
import { describe, expect, it, vi } from 'vitest';
import type { Key, Keyboard } from '../types';
import { diagonalEndpoints, diagonalCanvasFill, diagonalProperties } from './diagonalColor';
import { exportToKLE2, importFromKLE2 } from './kle2Serializer';
import { exportToKLE } from './kleExporter';
import { parseOriginalKLE } from './originalKLEParser';
import { exportToVial } from './vialExporter';
import { importFromVial } from './vialImporter';
import { buildKeyboardSVG } from './exportUtils';

const key = (overrides: Partial<Key> = {}): Key => ({ id: 'key', x: 0, y: 0, width: 1, height: 1, labels: ['A'], color: '#ffffff', diagonalColor: '#ff0000', ...overrides });
const side = (p: ReturnType<typeof diagonalEndpoints>, x: number, y: number) => (x - (p.x1 + p.x2) / 2) * (p.x2 - p.x1) + (y - (p.y1 + p.y2) / 2) * (p.y2 - p.y1);

describe('diagonal paint geometry', () => {
  it.each([[1, 1], [6.25, 1], [1, 2]])('splits corner to corner on %su × %su keys in both directions', (width, height) => {
    const w = width * 54 - 1, h = height * 54 - 1;
    for (const direction of ['/', '\\'] as const) {
      const p = diagonalEndpoints(key({ width, height, diagonalDirection: direction }), 0, 0, 54);
      expect(side(p, 0, direction === '/' ? h : 0)).toBeCloseTo(0, 6);
      expect(side(p, w, direction === '/' ? 0 : h)).toBeCloseTo(0, 6);
      expect(side(p, w / 2, 0)).toBeLessThan(0);
      expect(side(p, w / 2, h)).toBeGreaterThan(0);
    }
  });

  it.each([
    { width: 1.25, height: 2, x2: -0.25, y2: 0, width2: 1.5, height2: 1 },
    { width: 1.5, height: 1, x2: 0.75, y2: -1, width2: 0.75, height2: 2 },
  ])('uses the full special key envelope rather than a split per rectangle', shape => {
    const k = key({ ...shape, stepped: true });
    const p = diagonalEndpoints(k, 0, 0, 54);
    const left = Math.min(0, shape.x2 * 54);
    const top = Math.min(0, shape.y2 * 54);
    const right = Math.max(shape.width, shape.x2 + shape.width2) * 54 - 1;
    const bottom = Math.max(shape.height, shape.y2 + shape.height2) * 54 - 1;
    expect(side(p, left, bottom)).toBeCloseTo(0, 6);
    expect(side(p, right, top)).toBeCloseTo(0, 6);
  });

  it('creates a crisp shared midpoint and shades the second color on the sidewalls', () => {
    const addColorStop = vi.fn();
    const ctx = { createLinearGradient: vi.fn(() => ({ addColorStop })) };
    diagonalCanvasFill(ctx as unknown as CanvasRenderingContext2D, key(), 0, 0, 54, 1, '#999999', -40);
    expect(addColorStop.mock.calls).toEqual([[0, '#999999'], [0.5, '#999999'], [0.5, 'rgb(215, 0, 0)'], [1, 'rgb(215, 0, 0)']]);
    expect(diagonalCanvasFill(ctx as unknown as CanvasRenderingContext2D, key({ diagonalColor: undefined }), 0, 0, 54, 1, '#123456')).toBe('#123456');
  });

  it('ignores malformed imported paint and never treats it as SVG markup', () => {
    expect(diagonalProperties({ diagonalColor: 'url(https://example.org)', diagonalDirection: 'bad' })).toEqual({});
    const svg = buildKeyboardSVG({ meta: {}, keys: [key({ diagonalColor: '"><script>bad</script>' })] });
    expect(svg).not.toContain('<script>');
    expect(svg).not.toContain('linearGradient');
  });
});

describe('diagonal color persistence and image export', () => {
  const keyboard: Keyboard = { meta: {}, keys: [
    key({ id: 'rotated', x: 5, diagonalDirection: '\\', rotation_angle: 25 }),
    key({ id: 'plain', x: 2, diagonalColor: undefined }),
    key({ id: 'special', width: 1.25, height: 2, x2: -0.25, y2: 0, width2: 1.5, height2: 1, labels: ['ISO'], stepped: true }),
  ] };
  const expectColors = (result: Keyboard) => {
    const sorted = [...result.keys].sort((a, b) => a.x - b.x);
    expect(sorted.map(k => [k.diagonalColor, k.diagonalDirection])).toEqual([
      ['#ff0000', undefined], [undefined, undefined], ['#ff0000', '\\'],
    ]);
    expect(sorted[0].stepped).toBe(true);
  };
  it('preserves native layout data after JSON serialization', () => expectColors(importFromKLE2(JSON.parse(JSON.stringify(exportToKLE2(keyboard))))));
  it('preserves KLE compatibility metadata in export order without leaking color onto the next key', () => expectColors(parseOriginalKLE(exportToKLE(keyboard))));
  it('preserves Vial compatibility metadata in export order', () => expectColors(importFromVial(exportToVial(keyboard))));
  it('preserves colors through both raw-data editors and the file-import parser', () => {
    const source = { meta: { name: 'raw colors' }, keys: [key({ id: 'a', labels: ['A'], x: 0, diagonalDirection: '\\' }), key({ id: 'b', labels: ['B'], x: 1, diagonalColor: undefined })] };
    const edited = serializeToKLE(source);
    edited[1][1] = 'New legend';
    const viaModal = parseKLE(parseKLEString(serializeToKLEString(source)));
    for (const result of [parseKLE(edited), viaModal, parseOriginalKLE(serializeToKLE(source)), parseKLE(exportToKLE(source))]) {
      expect(result.keys.map(k => [k.diagonalColor, k.diagonalDirection])).toEqual([['#ff0000', '\\'], [undefined, undefined]]);
    }
  });
  it('keeps old solid layouts solid in all formats', () => {
    const plain = { meta: {}, keys: [key({ diagonalColor: undefined })] };
    for (const result of [importFromKLE2(exportToKLE2(plain)), parseOriginalKLE(exportToKLE(plain)), importFromVial(exportToVial(plain))]) {
      expect(result.keys[0].diagonalColor).toBeUndefined();
    }
    expect(exportToKLE(plain)[0]).not.toHaveProperty('_klc');
    expect(exportToVial(plain)).not.toHaveProperty('_klc');
  });
  it('SVG paints all body layers with key-local hard splits while preserving text and rotation', () => {
    const svg = buildKeyboardSVG(keyboard);
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    expect(doc.querySelector('parsererror')).toBeNull();
    const gradients = [...doc.querySelectorAll('linearGradient')];
    expect(gradients).toHaveLength(6);
    expect(new Set(gradients.map(g => g.id)).size).toBe(6);
    for (const gradient of gradients) {
      expect(gradient.getAttribute('gradientUnits')).toBe('userSpaceOnUse');
      expect([...gradient.querySelectorAll('stop')].map(s => s.getAttribute('offset'))).toEqual(['0', '0.5', '0.5', '1']);
    }
    expect(svg).toContain('rotate(25');
    expect(doc.querySelector('text')?.textContent).toBeTruthy();
  });
});
