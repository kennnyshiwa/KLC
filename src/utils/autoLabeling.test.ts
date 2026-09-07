import { beforeEach, describe, expect, it } from 'vitest';
import type { Key, Keyboard } from '../types';
import { useKeyboardStore } from '../store/keyboardStoreOptimized';
import {
  getFrontLegendColor,
  getGeneratedSizeLabelColor,
  planRowLabeling,
  planRowPositionUpdates,
  planSizeLabelUpdates,
} from './autoLabeling';
import { exportToKLE } from './kleExporter';
import { exportToVial } from './vialExporter';

const makeKey = (id: string, changes: Partial<Key> = {}): Key => ({
  id,
  x: 0,
  y: 0,
  width: 1,
  height: 1,
  labels: [''],
  profile: 'OEM',
  ...changes,
});

const applyUpdates = (keys: Key[], updates: ReturnType<typeof planSizeLabelUpdates>): Key[] => {
  const changesById = new Map(updates.map((update) => [update.id, update.changes]));
  return keys.map((key) => ({ ...key, ...changesById.get(key.id) }));
};

const cloneKey = (key: Key): Key => ({
  ...key,
  labels: [...key.labels],
  frontLegends: key.frontLegends ? [...key.frontLegends] : undefined,
  textColor: key.textColor ? [...key.textColor] : undefined,
  sizeLabelProvenance: key.sizeLabelProvenance ? { ...key.sizeLabelProvenance } : undefined,
});

describe('size auto-labeling', () => {
  it('leaves every 1u size field byte-for-byte unchanged in both directions', () => {
    const oneUnit = makeKey('one-unit', {
      frontLegends: ['LEFT', 'USER', 'RIGHT'],
      textColor: ['#100000', '#200000', '#300000', '#400000', '#500000', '#600000', '#700000'],
      sizeLabelProvenance: {
        slot: 1,
        previousValue: 'OLDER',
        appliedValue: 'USER',
      },
    });
    const original = cloneKey(oneUnit);

    expect(planSizeLabelUpdates([oneUnit], true)).toEqual([]);
    expect(planSizeLabelUpdates([oneUnit], false)).toEqual([]);
    expect(oneUnit).toEqual(original);
    expect(oneUnit.frontLegends).toEqual(original.frontLegends);
    expect(oneUnit.textColor).toEqual(original.textColor);
    expect(oneUnit.sizeLabelProvenance).toEqual(original.sizeLabelProvenance);
    expect(oneUnit.frontLegends).not.toContain('1u');
  });

  it('labels non-1u keys and restores an existing front legend', () => {
    const keys = [
      makeKey('wide', { width: 2.25, frontLegends: ['', 'WIDE USER', ''] }),
      makeKey('vertical', { height: 2 }),
    ];

    const enabledKeys = applyUpdates(keys, planSizeLabelUpdates(keys, true));

    expect(enabledKeys.map((key) => key.frontLegends?.[1])).toEqual(['2.25u', '1×2']);
    expect(enabledKeys[0].sizeLabelProvenance).toEqual({
      slot: 1,
      previousValue: 'WIDE USER',
      appliedValue: '2.25u',
    });

    const restoredKeys = applyUpdates(enabledKeys, planSizeLabelUpdates(enabledKeys, false));

    expect(restoredKeys.map((key) => key.frontLegends?.[1])).toEqual(['WIDE USER', '']);
    expect(restoredKeys.every((key) => key.sizeLabelProvenance === undefined)).toBe(true);
  });

  it('does not overwrite a user edit made while generated labels are enabled', () => {
    const key = makeKey('edited', { width: 2, frontLegends: ['', 'ORIGINAL', ''] });
    const [enabledKey] = applyUpdates([key], planSizeLabelUpdates([key], true));
    const editedKey = { ...enabledKey, frontLegends: ['', 'EDITED', ''] };

    const [disabledKey] = applyUpdates([editedKey], planSizeLabelUpdates([editedKey], false));

    expect(disabledKey.frontLegends?.[1]).toBe('EDITED');
    expect(disabledKey.sizeLabelProvenance).toBeUndefined();
  });

  it('uses maximum black-or-white contrast from each keycap color, including shorthand hex', () => {
    const keys = [
      makeKey('dark-short', { width: 2, color: '#111' }),
      makeKey('dark', { width: 2, color: '#222222' }),
      makeKey('light', { width: 2, color: '#f5e7c6' }),
    ];
    const enabledKeys = applyUpdates(keys, planSizeLabelUpdates(keys, true));

    expect(getGeneratedSizeLabelColor(enabledKeys[0])).toBe('#ffffff');
    expect(getGeneratedSizeLabelColor(enabledKeys[1])).toBe('#ffffff');
    expect(getGeneratedSizeLabelColor(enabledKeys[2])).toBe('#000000');

    const userEditedKey = { ...enabledKeys[0], frontLegends: ['', 'USER EDIT', ''] };
    expect(getGeneratedSizeLabelColor(userEditedKey)).toBeUndefined();
  });

  it('resolves generated contrast and preserves explicit colors for ordinary front legends', () => {
    const [generatedDark, generatedLight] = applyUpdates([
      makeKey('dark', { width: 2, color: '#222', textColor: ['', '', '', '', '', '#ff00ff'] }),
      makeKey('light', { width: 2, color: '#f5e7c6' }),
    ], planSizeLabelUpdates([
      makeKey('dark', { width: 2, color: '#222', textColor: ['', '', '', '', '', '#ff00ff'] }),
      makeKey('light', { width: 2, color: '#f5e7c6' }),
    ], true));

    expect(getFrontLegendColor(generatedDark, 1)).toBe('#ffffff');
    expect(getFrontLegendColor(generatedLight, 1)).toBe('#000000');
    expect(getFrontLegendColor(makeKey('user', {
      frontLegends: ['LEFT', 'CENTER', ''],
      textColor: ['', '', '', '', '#123456', '#654321'],
    }), 0)).toBe('#123456');
    expect(getFrontLegendColor(makeKey('default', {
      frontLegends: ['', 'CENTER', ''],
      default: { color: ['#abcdef'] },
    }), 1)).toBe('#abcdef');

    expect(generatedDark.textColor?.[5]).toBe('#ff00ff');
    const [restoredDark] = applyUpdates(
      [generatedDark],
      planSizeLabelUpdates([generatedDark], false),
    );
    expect(restoredDark.textColor?.[5]).toBe('#ff00ff');
    expect(getFrontLegendColor(restoredDark, 1)).toBe('#ff00ff');
  });
});

describe('row auto-labeling', () => {
  it('fills safe partial physical rows while preserving existing values and skipping special decals', () => {
    const keys = [
      makeKey('row-one-existing', { y: 0, rowPosition: 'K1' }),
      makeKey('row-one-missing', { x: 1, y: 0 }),
      makeKey('row-two', { y: 1 }),
      makeKey('preserved-custom', { x: 1, y: 1, rowPosition: 'CUSTOM' }),
      makeKey('row-label', { y: 0, decal: true, ghost: true, color: 'transparent', labels: ['R1'] }),
      makeKey('encoder', { y: 1, decal: true, profile: 'ENCODER', labels: [] }),
      makeKey('led', { y: 2, decal: true, profile: 'LED', labels: [] }),
    ];

    expect(planRowPositionUpdates(keys)).toEqual([
      { id: 'row-one-missing', changes: { rowPosition: 'K1' } },
    ]);
    expect(keys[3].rowPosition).toBe('CUSTOM');
  });

  it('assigns K1-K6 by physical row and leaves later rows unassigned', () => {
    const keys = Array.from({ length: 7 }, (_, y) => makeKey(`row-${y + 1}`, { y }));

    expect(planRowPositionUpdates(keys)).toEqual(
      Array.from({ length: 6 }, (_, index) => ({
        id: `row-${index + 1}`,
        changes: { rowPosition: `K${index + 1}` },
      })),
    );
  });

  it('adds separate visible decals without overwriting custom legends or conflicting row data', () => {
    const keys = [
      makeKey('row-one-existing', { y: 0, labels: ['Esc'], frontLegends: ['USER'], rowPosition: 'K1' }),
      makeKey('row-one-missing', { x: 1, y: 0, labels: ['1'] }),
      makeKey('custom-row-label', {
        x: -1.25,
        y: 0,
        labels: ['CUSTOM'],
        color: 'transparent',
        decal: true,
        ghost: true,
      }),
      makeKey('row-two', { y: 1, labels: ['Q'] }),
      makeKey('conflict-a', { y: 2, rowPosition: 'K3' }),
      makeKey('conflict-b', { x: 1, y: 2, rowPosition: 'K4' }),
    ];
    const original = keys.map(cloneKey);
    let nextId = 0;

    const plan = planRowLabeling(keys, () => `generated-${nextId++}`);

    expect(plan.updates).toEqual([
      { id: 'row-one-missing', changes: { rowPosition: 'K1' } },
      { id: 'row-two', changes: { rowPosition: 'K2' } },
    ]);
    expect(plan.additions).toEqual([
      expect.objectContaining({ id: 'generated-0', x: 0, y: 1, width: 1, labels: ['R2'], decal: true, ghost: true }),
    ]);
    expect(keys).toEqual(original);
    expect(plan.additions).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ labels: ['R1'] }),
      expect.objectContaining({ labels: ['R3'] }),
    ]));

    const applied = [...applyUpdates(keys, plan.updates), ...plan.additions];
    expect(planRowLabeling(applied, () => 'duplicate')).toEqual({
      updates: [],
      additions: [],
      labeledKeyCount: 3,
    });
  });

  it('reserves the established 1.25u label gutter once without changing relative key geometry', () => {
    const keys = [
      makeKey('plain', { x: 2, y: 0 }),
      makeKey('rotated', { x: 3, y: 0, rotation_angle: 15, rotation_x: 2.5, rotation_y: 0.5 }),
      makeKey('encoder', { x: 4, y: 0, profile: 'ENCODER', decal: true, labels: [] }),
    ];

    const firstPlan = planRowLabeling(keys, () => 'row-label');

    expect(firstPlan.updates).toEqual([
      { id: 'plain', changes: { x: 3.25, rowPosition: 'K1' } },
      { id: 'rotated', changes: { x: 4.25, rotation_x: 3.75, rowPosition: 'K1' } },
      { id: 'encoder', changes: { x: 5.25 } },
    ]);
    expect(firstPlan.additions).toEqual([
      expect.objectContaining({ x: 0, width: 1, labels: ['R1'] }),
    ]);

    const applied = [...applyUpdates(keys, firstPlan.updates), ...firstPlan.additions];
    expect(planRowLabeling(applied, () => 'duplicate')).toEqual({
      updates: [],
      additions: [],
      labeledKeyCount: 2,
    });
  });

  it('keeps physical legends intact and produces valid KLE, KRK, and Vial exports', () => {
    const keys = [
      makeKey('one', { labels: ['0,0', '', '', '1,0'], frontLegends: ['LEFT', 'CENTER', 'RIGHT'] }),
      makeKey('two', { x: 1, labels: ['0,1'] }),
    ];
    const plan = planRowLabeling(keys, () => 'generated-row-label');
    const labeledKeys = [...applyUpdates(keys, plan.updates), ...plan.additions];
    const keyboard: Keyboard = { meta: { name: 'Export safety' }, keys: labeledKeys };

    expect(labeledKeys[0].labels).toEqual(keys[0].labels);
    expect(labeledKeys[0].frontLegends).toEqual(keys[0].frontLegends);
    expect(JSON.stringify(exportToKLE(keyboard, false))).toContain('R1');
    expect(JSON.stringify(exportToKLE(keyboard, true))).toContain('"p":"K1"');

    const vial = exportToVial(keyboard);
    expect(vial.matrix).toEqual({ rows: 1, cols: 2 });
    expect(JSON.stringify(vial.layouts.keymap)).toContain('R1');
  });
});

describe('auto-label history integration', () => {
  beforeEach(() => {
    const keyboard: Keyboard = {
      meta: { name: 'History test' },
      keys: [makeKey('selected', { width: 2, frontLegends: ['', 'USER', ''] })],
    };
    useKeyboardStore.getState().setKeyboard(keyboard);
    useKeyboardStore.getState().selectKeys(['selected']);
  });

  it('creates one checkpoint, preserves selection, and supports undo and redo', () => {
    const before = useKeyboardStore.getState();
    const updates = planSizeLabelUpdates(before.keyboard.keys, true);

    before.updateKeys(updates);

    expect(useKeyboardStore.getState().historyIndex).toBe(1);
    expect(useKeyboardStore.getState().history).toHaveLength(2);
    expect([...useKeyboardStore.getState().selectedKeys]).toEqual(['selected']);
    expect(useKeyboardStore.getState().keyboard.keys[0].frontLegends?.[1]).toBe('2u');

    useKeyboardStore.getState().undo();
    expect(useKeyboardStore.getState().keyboard.keys[0].frontLegends?.[1]).toBe('USER');
    expect([...useKeyboardStore.getState().selectedKeys]).toEqual([]);

    useKeyboardStore.getState().redo();
    expect(useKeyboardStore.getState().keyboard.keys[0].frontLegends?.[1]).toBe('2u');
    expect([...useKeyboardStore.getState().selectedKeys]).toEqual([]);
  });

  it('commits row metadata and visible decals atomically, preserving selection with working redo', () => {
    const before = useKeyboardStore.getState();
    before.selectKeys(['selected', 'missing']);
    const plan = planRowLabeling(before.keyboard.keys, () => 'generated-row-label');

    before.applyKeyBatch(plan.updates, plan.additions);

    expect(useKeyboardStore.getState().historyIndex).toBe(1);
    expect(useKeyboardStore.getState().history).toHaveLength(2);
    expect([...useKeyboardStore.getState().selectedKeys]).toEqual(['selected']);
    expect(useKeyboardStore.getState().keyboard.keys).toEqual([
      expect.objectContaining({ id: 'selected', x: 1.25, rowPosition: 'K1', frontLegends: ['', 'USER', ''] }),
      expect.objectContaining({ id: 'generated-row-label', x: 0, width: 1, labels: ['R1'] }),
    ]);

    useKeyboardStore.getState().undo();
    expect(useKeyboardStore.getState().keyboard.keys).toHaveLength(1);
    expect(useKeyboardStore.getState().keyboard.keys[0].rowPosition).toBeUndefined();
    expect([...useKeyboardStore.getState().selectedKeys]).toEqual(['selected']);

    useKeyboardStore.getState().redo();
    expect(useKeyboardStore.getState().keyboard.keys).toHaveLength(2);
    expect(useKeyboardStore.getState().keyboard.keys[0]).toEqual(
      expect.objectContaining({ x: 1.25, rowPosition: 'K1' }),
    );
    expect([...useKeyboardStore.getState().selectedKeys]).toEqual(['selected']);
  });
});
