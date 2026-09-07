import { describe, expect, it } from 'vitest';
import type { Key, Keyboard } from '../types';
import reporterFixture from './__fixtures__/Kastenwagen_BAE_vial_KLC-output.json';
import { exportToVial } from './vialExporter';
import { importFromVial } from './vialImporter';

const makeKeyboard = (keys: Key[]): Keyboard => ({ meta: { name: 'Test' }, keys });

const makeKey = (changes: Partial<Key> = {}): Key => ({
  id: 'key',
  x: 0,
  y: 0,
  width: 1,
  height: 1,
  labels: ['0,0'],
  ...changes,
});

const exportedLabel = (key: Key): string => {
  const item = exportToVial(makeKeyboard([key])).layouts.keymap[0]
    .find(candidate => typeof candidate === 'string');
  return item as string;
};

const cloneFixture = <T>(fixture: T): T => JSON.parse(JSON.stringify(fixture)) as T;

const differingPaths = (before: unknown, after: unknown, path = ''): string[] => {
  if (Object.is(before, after)) return [];
  if (typeof before !== 'object' || before === null ||
      typeof after !== 'object' || after === null) {
    return [path];
  }

  const beforeRecord = before as Record<string, unknown>;
  const afterRecord = after as Record<string, unknown>;
  const keys = new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)]);

  return [...keys].flatMap(key => differingPaths(
    beforeRecord[key],
    afterRecord[key],
    `${path}[${JSON.stringify(key)}]`,
  ));
};

describe('exportToVial encoder labels', () => {
  it('moves a stale encoder marker from slot 8 to the required slot 9', () => {
    const labels = ['2,5', '', '', '3,1', '', '', '', '', 'e', 'stale'];

    const result = exportedLabel(makeKey({ profile: 'ENCODER', labels }));

    expect(result).toBe('2,5\n\n\n3,1\n\n\n\n\n\ne');
    expect(result.split('\n')).toHaveLength(10);
    expect(result.split('\n')[8]).toBe('');
    expect(result.split('\n')[9]).toBe('e');
    expect(labels[8]).toBe('e');
    expect(labels[9]).toBe('stale');
  });

  it('leaves non-encoder labels unchanged', () => {
    const labels = ['2,5', 'top', '', '3,1', '', '', '', '', 'e'];

    expect(exportedLabel(makeKey({ profile: 'OEM', labels })))
      .toBe(labels.join('\n'));
  });
});

describe('reporter Vial fixture regression', () => {
  it('changes only the two encoder strings and preserves all reporter geometry', () => {
    const reporter = cloneFixture(reporterFixture) as Parameters<typeof importFromVial>[0];
    const reporterBeforeImport = cloneFixture(reporter);
    const expected = cloneFixture(reporter);
    let patchedEncoderLabels = 0;

    expected.layouts.keymap.forEach(row => {
      row.forEach((item, index) => {
        if (typeof item === 'string' && /^\d+,\d+\n{8}e$/.test(item)) {
          row[index] = item.replace(/\n{8}e$/, `${'\n'.repeat(9)}e`);
          patchedEncoderLabels += 1;
        }
      });
    });

    expect(patchedEncoderLabels).toBe(2);
    expect(differingPaths(reporter, expected)).toEqual([
      '["layouts"]["keymap"]["2"]["1"]',
      '["layouts"]["keymap"]["2"]["2"]',
    ]);
    expect(expected.layouts.keymap[5][20]).toEqual({ x: 0.25, h: 2 });

    const keyboard = importFromVial(reporter);
    const encoderKeys = keyboard.keys.filter(key => key.labels[8] === 'e');
    expect(encoderKeys).toHaveLength(2);
    encoderKeys.forEach(key => {
      key.profile = 'ENCODER';
    });

    const exported = exportToVial(keyboard);

    expect(exported).toEqual(expected);
    expect(exported.layouts.keymap[5][20]).toEqual(reporter.layouts.keymap[5][20]);
    expect(reporter).toEqual(reporterBeforeImport);
  });
});
