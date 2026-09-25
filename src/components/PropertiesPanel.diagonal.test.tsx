import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PropertiesPanel from './PropertiesPanel';
import { useKeyboardStore } from '../store/keyboardStoreOptimized';
import type { Key } from '../types';

const key = (id: string, color: string, extra: Partial<Key> = {}): Key => ({ id, color, x: 0, y: 0, width: 1, height: 1, labels: [], ...extra });
const mount = (keys: Key[]) => {
  useKeyboardStore.getState().setKeyboard({ meta: {}, keys });
  useKeyboardStore.setState({ selectedKeys: new Set(keys.map(k => k.id)) });
  return render(<PropertiesPanel />);
};
afterEach(cleanup);

describe('diagonal color controls', () => {
  it('reveals the picker, flips the split, disables it, and undoes each action once', async () => {
    const user = userEvent.setup();
    mount([key('a', '#ffffff')]);
    expect(screen.queryByRole('group', { name: 'Second color' })).toBeNull();
    await user.click(screen.getByLabelText('Diagonal color'));
    const group = screen.getByRole('group', { name: 'Second color' });
    expect(within(group).getByLabelText('Split direction')).toBeTruthy();
    await user.selectOptions(screen.getByLabelText('Split direction'), '\\');
    expect(useKeyboardStore.getState().keyboard.keys[0].diagonalDirection).toBe('\\');
    await user.click(screen.getByLabelText('Diagonal color'));
    expect(useKeyboardStore.getState().keyboard.keys[0].diagonalColor).toBeUndefined();
    useKeyboardStore.getState().undo();
    expect(useKeyboardStore.getState().keyboard.keys[0].diagonalColor).toBe('#808080');
    useKeyboardStore.getState().undo();
    expect(useKeyboardStore.getState().keyboard.keys[0].diagonalDirection).toBeUndefined();
    useKeyboardStore.getState().undo();
    expect(useKeyboardStore.getState().keyboard.keys[0].diagonalColor).toBeUndefined();
  });
  it.each(['LED', 'ENCODER', 'DECAL'])('does not offer paint when mixed selection contains %s', profile => {
    mount([key('a', '#ffffff'), key('b', '#ffffff', profile === 'DECAL' ? { decal: true } : { profile: profile as Key['profile'] })]);
    expect(screen.queryByLabelText('Diagonal color')).toBeNull();
  });
  it('handles mixed selection without replacing primary colors or an existing second color', async () => {
    const user = userEvent.setup();
    mount([key('a', '#112233', { diagonalColor: '#00ff00' }), key('b', '#ffeeff')]);
    expect(screen.getByLabelText('Diagonal color').getAttribute('aria-checked')).toBe('mixed');
    expect((screen.getByLabelText('Diagonal color') as HTMLInputElement).indeterminate).toBe(true);
    await user.click(screen.getByLabelText('Diagonal color'));
    expect(useKeyboardStore.getState().keyboard.keys.map(k => [k.color, k.diagonalColor])).toEqual([
      ['#112233', '#00ff00'], ['#ffeeff', '#808080'],
    ]);
    await user.selectOptions(screen.getByLabelText('Split direction'), '\\');
    expect(useKeyboardStore.getState().keyboard.keys.every(k => k.diagonalDirection === '\\')).toBe(true);
  });
});
