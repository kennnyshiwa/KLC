import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as matchers from '@testing-library/jest-dom/matchers';
import Toolbar from './Toolbar';
import { useKeyboardStore } from '../store/keyboardStoreOptimized';
import type { Key } from '../types';

expect.extend(matchers);

afterEach(cleanup);

vi.mock('../store/keyboardStoreOptimized', () => ({
  useKeyboardStore: vi.fn(),
}));
vi.mock('./ExportMenu', () => ({ default: () => null }));
vi.mock('./AddKeyMenu', () => ({ default: () => null }));
vi.mock('./ColorMenuBar', () => ({
  __esModule: true,
  default: () => null,
  ColorMenuGrid: () => null,
}));
vi.mock('./MirrorModal', () => ({ default: () => null }));

describe('Toolbar automatic labels', () => {
  const updateKeys = vi.fn();
  const applyKeyBatch = vi.fn<(updates: Array<{ id: string; changes: Partial<Key> }>, additions: Key[]) => void>();
  const saveToHistory = vi.fn();
  const updateEditorSettings = vi.fn();
  let state: Record<string, unknown>;

  beforeEach(() => {
    vi.clearAllMocks();
    window.innerWidth = 390;
    state = {
      selectedKeys: new Set(['one-unit']),
      keyboard: {
        meta: { name: 'Toolbar test' },
        keys: [
          { id: 'one-unit', x: 0, y: 0, width: 1, height: 1, labels: [''], profile: 'OEM' },
          { id: 'wide', x: 1, y: 0, width: 2, height: 1, labels: [''], profile: 'OEM' },
          { id: 'second-row', x: 0, y: 1, width: 1, height: 1, labels: [''], profile: 'OEM' },
        ],
      },
      editorSettings: { selectionMode: 'touch', snapToGrid: true, showStabilizerPositions: false },
      hasUnsavedChanges: false,
      multiSelectMode: false,
      undo: vi.fn(),
      redo: vi.fn(),
      deleteKeys: vi.fn(),
      updateEditorSettings,
      clearSelection: vi.fn(),
      selectAll: vi.fn(),
      saveToHistory,
      addKey: vi.fn(),
      insertKeysAfterKey: vi.fn(),
      setMultiSelectMode: vi.fn(),
      updateKeys,
      applyKeyBatch,
    };
    applyKeyBatch.mockImplementation((updates, additions) => {
      const keyboard = state.keyboard as { keys: Key[] };
      const changesById = new Map(updates.map((update) => [update.id, update.changes]));
      keyboard.keys = [
        ...keyboard.keys.map((key) => ({ ...key, ...changesById.get(key.id) })),
        ...additions,
      ];
    });
    const mockedStore = useKeyboardStore as unknown as {
      mockImplementation: (
        implementation: (selector: (value: Record<string, unknown>) => unknown) => unknown,
      ) => void;
    };
    mockedStore.mockImplementation((selector) => selector(state));
  });

  it('shows standalone Rows and Size controls at representative mobile width', () => {
    render(<Toolbar getStage={() => null} />);

    expect(screen.getByRole('button', { name: 'Rows' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Size' })).toBeVisible();
  });

  it('applies each action as one store update without an extra history save', async () => {
    const user = userEvent.setup();
    render(<Toolbar getStage={() => null} />);

    await user.click(screen.getByRole('button', { name: 'Rows' }));
    expect(applyKeyBatch).toHaveBeenCalledTimes(1);
    expect(applyKeyBatch.mock.calls[0][0]).toEqual([
      { id: 'one-unit', changes: { rowPosition: 'K1' } },
      { id: 'wide', changes: { rowPosition: 'K1' } },
      { id: 'second-row', changes: { rowPosition: 'K2' } },
    ]);

    applyKeyBatch.mockClear();
    await user.click(screen.getByRole('button', { name: 'Size' }));
    expect(updateEditorSettings).toHaveBeenCalledWith({ showKeySize: true });
    expect(updateKeys).toHaveBeenCalledTimes(1);
    expect(updateKeys.mock.calls[0][0]).toEqual([
      expect.objectContaining({ id: 'wide', changes: expect.objectContaining({ frontLegends: ['', '2u', ''] }) }),
    ]);
    expect(updateKeys.mock.calls[0][0]).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'one-unit' }),
    ]));
    expect(saveToHistory).not.toHaveBeenCalled();
  });

  it('visibly applies row-label decals and reports the result', async () => {
    const user = userEvent.setup();
    render(<Toolbar getStage={() => null} />);

    const rowsButton = screen.getByRole('button', { name: 'Rows' });
    expect(rowsButton).toHaveAttribute('aria-pressed', 'false');

    await user.click(rowsButton);

    expect(applyKeyBatch).toHaveBeenCalledTimes(1);
    expect(applyKeyBatch.mock.calls[0][1]).toEqual([
      expect.objectContaining({
        x: -0.5,
        y: 0,
        width: 0.5,
        labels: ['R1'],
        color: 'transparent',
        decal: true,
        ghost: true,
      }),
      expect.objectContaining({
        x: -0.5,
        y: 1,
        width: 0.5,
        labels: ['R2'],
        color: 'transparent',
        decal: true,
        ghost: true,
      }),
    ]);
    expect(rowsButton).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Added 2 row labels to 3 keys.');
  });
});
