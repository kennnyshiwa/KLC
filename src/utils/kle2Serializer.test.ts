import { describe, expect, it } from 'vitest';
import { Keyboard } from '../types';
import {
  exportToKLE2,
  exportToKLE2String,
  importFromKLE2,
  importFromKLE2String,
  KLE2Format,
} from './kle2Serializer';

const richKeyboard: Keyboard = {
  meta: {
    name: '',
    author: 'KLC QA',
    notes: '',
    background: {
      name: '',
      style: 'background: linear-gradient(#111, #222);',
    },
    radii: '6px 3px',
    switchMount: 'cherry',
    switchBrand: 'Gateron',
    switchType: 'Oil King',
    plate: false,
    pcb: true,
    css: '',
    vialLabels: [
      { name: 'Space', values: ['Split', 'Longbar'] },
      { name: '', values: [] },
    ],
  },
  keys: [
    {
      id: 'rich-key',
      x: 0,
      y: 1.25,
      width: 2.25,
      height: 1.5,
      x2: 0,
      y2: -0.25,
      width2: 1.25,
      height2: 0.75,
      rotation_x: 0,
      rotation_y: 4.5,
      rotation_angle: 0,
      labels: ['Esc', '', 'Fn', 'A\nB'],
      textColor: ['#ffffff', '', '#ff0000', '#00ff00'],
      textSize: [0, 2, 5, 7],
      default: {
        size: [0],
        color: [''],
      },
      color: '',
      profile: 'SA',
      nub: false,
      ghost: false,
      stepped: false,
      steppedCenter: false,
      decal: false,
      frontLegends: ['', 'Front center', 'Front right'],
      sizeLabelProvenance: {
        slot: 0,
        previousValue: '',
        appliedValue: '2.25u',
      },
      centerLegend: '',
      align: 0,
      font: '',
      legendRotation: [0, -15, 30],
      rowPosition: '',
      rowLabelShape: 'convex',
    },
    {
      id: 'true-flags',
      x: 3,
      y: 2,
      width: 1,
      height: 1,
      labels: [],
      nub: true,
      ghost: true,
      stepped: true,
      steppedCenter: true,
      decal: true,
      rowPosition: 'K2',
      rowLabelShape: 'concave',
    },
  ],
};

describe('native KLC 2.0 serialization', () => {
  it('preserves every persisted metadata and key field through an object round trip', () => {
    expect(importFromKLE2(exportToKLE2(richKeyboard))).toEqual(richKeyboard);
  });

  it('preserves every persisted metadata and key field through a string round trip', () => {
    expect(importFromKLE2String(exportToKLE2String(richKeyboard))).toEqual(richKeyboard);
  });

  it('imports a minimal legacy 2.x payload with absent optional fields', () => {
    const legacyPayload: KLE2Format = {
      version: '2.1',
      meta: { name: 'Legacy' },
      settings: { unitSize: 54, keySpacing: 1 },
      keys: [{ id: 'legacy-key', x: 0, y: 0, width: 1, height: 1 }],
    };

    expect(importFromKLE2String(JSON.stringify(legacyPayload))).toEqual({
      meta: { name: 'Legacy' },
      keys: [{ id: 'legacy-key', x: 0, y: 0, width: 1, height: 1, labels: [] }],
    });
  });
});
