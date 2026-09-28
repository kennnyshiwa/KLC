import { describe, expect, it } from 'vitest';
import { getBAEMountMarkers, getKeyMountMarkers, getMountLayoutPosition } from './keyUtils';
import type { Key } from '../types';
import { exportToKLE } from './kleExporter';
import { parseOriginalKLE } from './originalKLEParser';
import { exportToVial } from './vialExporter';
import { importFromVial } from './vialImporter';

const bae: Key = { id: 'bae', x: 0, y: 1, width: 2.25, height: 1, x2: 0.75, y2: -1, width2: 1.5, height2: 2, labels: ['Enter'] };
const absolute = (key: Key) => getKeyMountMarkers(key).map(m => ({ ...m, x: key.x + m.x, y: key.y + m.y }));

describe('BAE reference mount geometry', () => {
  it('has two lower horizontal stabilizers and two alternate switch locations, not ISO mounts', () => {
    expect(absolute(bae)).toEqual([
      { x: 1.125, y: 1.5, kind: 'switch', label: 'Lower switch' },
      { x: 0.5, y: 1.5, kind: 'stabilizer', label: 'Left stabilizer' },
      { x: 1.75, y: 1.5, kind: 'stabilizer', label: 'Right stabilizer' },
      { x: 1.5, y: 0.5, kind: 'switch', label: 'Upper alternate switch' },
    ]);
  });
  it('recognizes equivalent upper-primary KLE geometry', () => {
    const upper: Key = { ...bae, x: 0.75, y: 0, width: 1.5, height: 2, x2: -0.75, y2: 1, width2: 2.25, height2: 1 };
    expect(absolute(upper)).toEqual(absolute(bae));
  });
  it('supports two adjacent non-overlapping row rectangles', () => {
    expect(absolute({ ...bae, height2: 1 })).toEqual(absolute(bae));
  });
  it.each([
    { ...bae, width: 1.75, width2: 1 },
    { ...bae, width: 1.5, width2: 0.75 },
    { ...bae, width: 1.25, height: 2, x2: -0.25, y2: 0, width2: 1.5, height2: 1 },
    { ...bae, x2: 0.5 },
    { ...bae, height2: 0.75 },
  ])('does not mistake other Enter/custom outlines for BAE: %j', key => {
    expect(getBAEMountMarkers(key)).toBeNull();
  });
  it('does not display mount markers on decals', () => {
    expect(getKeyMountMarkers({ ...bae, decal: true })).toEqual([]);
  });
  it('keeps marker roles/locations after KLE and Vial round trips', () => {
    const anchor: Key = { id: 'anchor', x: 0, y: 0, width: 1, height: 1, labels: ['anchor'] };
    const keyboard = { meta: {}, keys: [anchor, bae] };
    expect(absolute(parseOriginalKLE(exportToKLE(keyboard)).keys.find(k => k.labels[0] === 'Enter')!)).toEqual(absolute(bae));
    expect(absolute(importFromVial(exportToVial(keyboard)).keys.find(k => k.labels[0] === 'Enter')!)).toEqual(absolute(bae));
  });
  it('rotates hover positions around the same origin as the key drawing', () => {
    const rotated = { ...bae, x: 3, y: 4, rotation_angle: 90, rotation_x: 2, rotation_y: 3 };
    const lower = getKeyMountMarkers(rotated)[0];
    const point = getMountLayoutPosition(rotated, lower);
    expect(point.x).toBeCloseTo(0.5);
    expect(point.y).toBeCloseTo(5.125);
  });
  it('defaults rotated hover to the key center when no custom origin is supplied', () => {
    const key = { ...bae, rotation_angle: 180 };
    const point = getMountLayoutPosition(key, getKeyMountMarkers(key)[1]);
    expect(point.x).toBeCloseTo(1.75);
    expect(point.y).toBeCloseTo(1.5);
  });
  it('preserves legacy ISO and MiniISO marker counts', () => {
    const iso = { ...bae, width: 1.25, height: 2, x2: -0.25, y2: 0, width2: 1.5, height2: 1 };
    expect(getKeyMountMarkers(iso)).toHaveLength(3);
    expect(getKeyMountMarkers({ ...iso, width: 0.75, width2: 1 })).toEqual([]);
  });
});
