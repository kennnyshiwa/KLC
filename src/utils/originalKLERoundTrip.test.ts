import { describe, expect, it } from 'vitest';
import { Keyboard, Key } from '../types';
import { exportToKLE } from './kleExporter';
import { parseOriginalKLE } from './originalKLEParser';

const withoutId = ({ id, ...key }: Key) => {
  void id;
  return key;
};

describe('original KLE compatibility round trips', () => {
  it('preserves KLC-only metadata and per-key row data exactly', () => {
    const keyboard: Keyboard = {
      meta: {
        name: 'Compatibility fixture',
        css: '',
        vialLabels: [
          { name: 'Layout', values: ['ANSI', 'ISO'] },
          { name: '', values: [] },
        ],
        plate: false,
      },
      keys: [
        { id: 'generated-1', x: 0, y: 0, width: 1, height: 1, labels: ['A'], color: '#abcdef', profile: 'DCS', rowPosition: 'K1', rowLabelShape: 'convex' },
        { id: 'generated-2', x: 1, y: 0, width: 1, height: 1, labels: ['B'], color: '#abcdef', profile: 'DCS', rowPosition: 'K1', rowLabelShape: 'concave' },
        { id: 'generated-3', x: 0, y: 1, width: 1, height: 1, labels: ['C'], color: '#abcdef', profile: 'DCS', rowPosition: 'K2' },
      ],
    };

    const exported = exportToKLE(keyboard);
    const restored = parseOriginalKLE(exported);

    expect(exported[0]).toMatchObject({
      plate: false,
      css: '',
      _klc: {
        version: 1,
        keyCount: 3,
        metadata: {
          css: '',
          vialLabels: keyboard.meta.vialLabels,
          plate: false,
        },
        keys: [
          { rowPosition: 'K1', rowLabelShape: 'convex' },
          { rowPosition: 'K1', rowLabelShape: 'concave' },
          { rowPosition: 'K2' },
        ],
      },
    });
    expect(JSON.stringify(exported)).not.toContain('generated-');
    expect(restored.meta).toEqual(keyboard.meta);
    expect(restored.keys.map(withoutId)).toEqual(keyboard.keys.map(withoutId));
    expect(restored.hasKrkData).toBe(true);
  });

  it('does not replace an explicit center front legend when nub is true', () => {
    const keyboard: Keyboard = {
      meta: {},
      keys: [{
        id: 'nub',
        x: 0,
        y: 0,
        width: 2.25,
        height: 1,
        labels: ['Space'],
        frontLegends: ['', '2.25u', ''],
        nub: true,
      }],
    };

    const [restored] = parseOriginalKLE(exportToKLE(keyboard)).keys;

    expect(restored.nub).toBe(true);
    expect(restored.frontLegends?.[1]).toBe('2.25u');
  });

  it('parses legacy original KLE without an extension unchanged', () => {
    const legacy = [
      { name: 'Legacy', plate: false, css: '' },
      [{ c: '#123456', w: 1.5, f: [2, 3], d: true }, 'TL\n\n\n\nFL\nFC'],
    ];

    const restored = parseOriginalKLE(legacy, { homingNubType: 'none' });

    expect(restored.meta).toEqual({ name: 'Legacy', plate: false, css: '' });
    expect(restored.keys).toHaveLength(1);
    expect(restored.keys[0]).toMatchObject({
      x: 0,
      y: 0,
      width: 1.5,
      height: 1,
      color: '#123456',
      labels: ['TL', '', '', '', '', ''],
      frontLegends: ['FL', 'FC'],
      textSize: [2, 3],
      decal: true,
    });
  });

  it('keeps standard labels, geometry, text sizes, and decal behavior intact', () => {
    const key: Key = {
      id: 'standard',
      x: 2,
      y: 1,
      width: 2.25,
      height: 1.5,
      rotation_x: 2.5,
      rotation_y: 1.5,
      rotation_angle: 15,
      labels: ['TL', '', 'TR', '', '', '', '', 'ML', 'MC\nline'],
      frontLegends: ['FL', 'FC', 'FR'],
      textSize: [0, 3, 3, 3, 3, 3, 3, 4, 5],
      decal: true,
    };

    const exported = exportToKLE({ meta: {}, keys: [key] });
    const [restored] = parseOriginalKLE(exported).keys;

    expect(exported.some(item => !Array.isArray(item) && item?._klc)).toBe(false);
    expect(restored).toMatchObject({
      x: key.x,
      y: key.y,
      width: key.width,
      height: key.height,
      rotation_x: key.rotation_x,
      rotation_y: key.rotation_y,
      rotation_angle: key.rotation_angle,
      labels: key.labels,
      frontLegends: key.frontLegends,
      textSize: key.textSize,
      decal: true,
    });
  });

  it.each([
    { version: 2, keyCount: 1, metadata: { css: '' }, keys: [{ rowPosition: 'K9' }] },
    { version: 1, keyCount: 1.5, metadata: { css: '' }, keys: [{ rowPosition: 'K9' }] },
    { version: 1, keyCount: 2, metadata: { css: '' }, keys: [{ rowPosition: 'K9' }] },
    { version: 1, keyCount: 1, metadata: { css: '' }, keys: 'not-an-array' },
    { version: 1, keyCount: 1, metadata: { css: '' }, keys: [] },
    { version: 1, keyCount: 1, metadata: { css: '' }, keys: [null] },
    { version: 1, keyCount: 1, metadata: { css: '' }, keys: [{ rowPosition: 9 }] },
    { version: 1, keyCount: 1, metadata: { css: '' }, keys: [{ rowLabelShape: 'invalid' }] },
    { version: 1, keyCount: 1, metadata: { css: '', plate: 'false' }, keys: [{}] },
  ])('rejects the whole incompatible extension without corrupting import: %j', (_klc) => {
    const restored = parseOriginalKLE([{
      name: 'Safe',
      css: 'ordinary',
      plate: true,
      pcb: true,
      _klc: {
        ..._klc,
        metadata: Object.assign({
          css: '',
          plate: false,
          pcb: false,
          vialLabels: [{ name: '', values: [] }],
        }, _klc.metadata),
      },
    }, ['A']]);

    expect(restored.meta).toEqual({ name: 'Safe', css: 'ordinary', plate: true, pcb: true });
    expect(restored.keys).toHaveLength(1);
    expect(restored.keys[0]).toMatchObject({ x: 0, y: 0, width: 1, height: 1, labels: ['A'] });
    expect(restored.keys[0].rowPosition).toBeUndefined();
    expect(restored.keys[0].rowLabelShape).toBeUndefined();
  });

  it('atomically applies valid false, zero, and empty compatibility values', () => {
    const restored = parseOriginalKLE([{
      radii: 0,
      _klc: {
        version: 1,
        keyCount: 0,
        metadata: {
          css: '',
          plate: false,
          pcb: false,
          vialLabels: [{ name: '', values: ['', '0'] }],
        },
        keys: [],
      },
    }]);

    expect(restored.meta).toEqual({
      radii: 0,
      css: '',
      plate: false,
      pcb: false,
      vialLabels: [{ name: '', values: ['', '0'] }],
    });
    expect(restored.keys).toEqual([]);
  });
});
