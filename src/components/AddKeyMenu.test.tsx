import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as matchers from '@testing-library/jest-dom/matchers';
import AddKeyMenu from './AddKeyMenu';
import type { Key, Keyboard } from '../types';
import { exportToKLE } from '../utils/kleExporter';
import { parseOriginalKLE } from '../utils/originalKLEParser';
import { exportToVial } from '../utils/vialExporter';
import { importFromVial } from '../utils/vialImporter';
import { exportToKLE2, importFromKLE2 } from '../utils/kle2Serializer';
import { useKeyboardStore } from '../store/keyboardStoreOptimized';

expect.extend(matchers);

vi.mock('../store/keyboardStoreOptimized', () => ({
  useKeyboardStore: vi.fn()
}));

vi.mock('../utils/keyUtils', async (importOriginal) => ({
  ...await importOriginal<typeof import('../utils/keyUtils')>(),
  generateKeyId: vi.fn(() => 'test-key-id')
}));

describe('AddKeyMenu', () => {
  const mockAddKey = vi.fn();
  const mockSaveToHistory = vi.fn();
  const mockUpdateKeys = vi.fn();
  const mockedStore = useKeyboardStore as unknown as {
    mockImplementation: (
      implementation: (selector: (value: Record<string, unknown>) => unknown) => unknown,
    ) => void;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockedStore.mockImplementation((selector) => {
      const state = {
        addKey: mockAddKey,
        keyboard: { keys: [] },
        saveToHistory: mockSaveToHistory,
        lastModifiedKeyId: null,
        selectedKeys: new Set(),
        updateKeys: mockUpdateKeys
      };
      return selector ? selector(state) : state;
    });
  });


  describe('special Enter caps', () => {
    it.each([
      ['mISO', { x: 0.25, y: 0, width: 1, height: 2, x2: -0.25, y2: 0, width2: 1.25, height2: 1 }],
      ['Stepped ISO', { x: 0.25, y: 0, width: 1.25, height: 2, x2: -0.25, y2: 0, width2: 1.5, height2: 1, stepped: true }],
      ['Stepped LAE', { x: 0, y: 1, width: 1.5, height: 1, x2: 0.75, y2: -1, width2: 0.75, height2: 2, stepped: true }],
      ['MiniISO', { x: 0.25, y: 0, width: 0.75, height: 2, x2: -0.25, y2: 0, width2: 1, height2: 1 }],
      ['Medium Ass Enter', { x: 0, y: 1, width: 1.75, height: 1, x2: 0.75, y2: -1, width2: 1, height2: 2 }],
    ] satisfies Array<[string, Partial<Key>]>)('inserts %s with the correct outline and preserves it in all JSON formats', async (name, geometry) => {
      const user = userEvent.setup();
      const { container } = render(<AddKeyMenu />);
      await user.click(container.querySelector('button[title="Add Key"]')!);
      const button = Array.from(container.querySelectorAll('.add-key-menu-item')).find(item => item.textContent === name)!;
      await user.click(button);
      const key = mockAddKey.mock.calls[0][0] as Key;
      expect(key).toMatchObject(geometry);
      key.labels = ['target'];
      // Vial normalizes a lone key to row zero; an anchor verifies absolute placement.
      const keyboard: Keyboard = { meta: { name: 'Special caps' }, keys: [{ id: 'anchor', x: 0, y: 0, width: 1, height: 1, labels: ['anchor'] }, key] };
      for (const roundTrip of [parseOriginalKLE(exportToKLE(keyboard)), importFromVial(exportToVial(keyboard)), importFromKLE2(exportToKLE2(keyboard))]) {
        const restored = roundTrip.keys.find(candidate => candidate.labels[0] === 'target')!;
        expect({ ...restored, x2: restored.x2 ?? 0, y2: restored.y2 ?? 0 }).toMatchObject(geometry);
      }
    });

    it('packs multiple mISO keys by the complete footprint without overlap or a negative left edge', async () => {
      const user = userEvent.setup();
      const { container } = render(<AddKeyMenu />);
      await user.click(container.querySelector('button[title="Add Key"]')!);
      await user.click(container.querySelector('.quantity-input')!);
      await user.keyboard('{Control>}a{/Control}3');
      await user.click(Array.from(container.querySelectorAll('.add-key-menu-item')).find(item => item.textContent?.startsWith('mISO'))!);
      const keys = mockAddKey.mock.calls.map(([key]) => key as Key);
      expect(keys.map(key => key.x + key.x2!)).toEqual([0, 1.25, 2.5]);
      expect(keys.map(key => key.x + key.width)).toEqual([1.25, 2.5, 3.75]);
    });
  });
  describe('Row Labels', () => {
    it('should display all row labels including SP label', async () => {
      const user = userEvent.setup();
      const { container } = render(<AddKeyMenu />);
      
      const menuButton = container.querySelector('.toolbar-btn[title="Add Key"]') as globalThis.HTMLElement;
      expect(menuButton).toBeInTheDocument();
      await user.click(menuButton);
      
      // Use container query to avoid duplicates
      const menu = container.querySelector('.add-key-menu');
      expect(menu).toBeInTheDocument();
      
      const rowLabelsCategory = screen.getByText('Row Labels');
      expect(rowLabelsCategory).toBeInTheDocument();
      
      // Check within the specific menu container
      const menuItems = menu!.querySelectorAll('.add-key-menu-item');
      const labelTexts = Array.from(menuItems).map(item => item.textContent);
      
      expect(labelTexts).toContain('R1 Label');
      expect(labelTexts).toContain('R2 Label');
      expect(labelTexts).toContain('R3 Label');
      expect(labelTexts).toContain('R4 Label');
      expect(labelTexts).toContain('R5 Label');
      expect(labelTexts).toContain('SP Label');
    });

    it('should add SP label with correct properties when clicked', async () => {
      const user = userEvent.setup();
      const { container } = render(<AddKeyMenu />);
      
      const menuButton = container.querySelector('.toolbar-btn[title="Add Key"]') as globalThis.HTMLElement;
      await user.click(menuButton);
      
      const menu = container.querySelector('.add-key-menu');
      const spButton = Array.from(menu!.querySelectorAll('.add-key-menu-item'))
        .find(item => item.textContent === 'SP Label') as globalThis.HTMLElement;
      await user.click(spButton);
      
      expect(mockAddKey).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-key-id',
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          labels: ['SP'],
          color: 'transparent',
          profile: 'OEM',
          decal: true,
          ghost: true
        })
      );
      
      expect(mockSaveToHistory).not.toHaveBeenCalled();
    });

    it('should prevent adding duplicate SP label', async () => {
      const user = userEvent.setup();
      
      mockedStore.mockImplementation((selector) => {
        const state = {
          addKey: mockAddKey,
          keyboard: { 
            keys: [{
              id: 'existing-sp',
              decal: true,
              ghost: true,
              color: 'transparent',
              labels: ['SP']
            }]
          },
          saveToHistory: mockSaveToHistory,
          lastModifiedKeyId: null,
          selectedKeys: new Set(),
          updateKeys: mockUpdateKeys
        };
        return selector ? selector(state) : state;
      });

      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      
      const { container } = render(<AddKeyMenu />);
      
      const menuButton = container.querySelector('.toolbar-btn[title="Add Key"]') as globalThis.HTMLElement;
      await user.click(menuButton);
      
      const menu = container.querySelector('.add-key-menu');
      const spButton = Array.from(menu!.querySelectorAll('.add-key-menu-item'))
        .find(item => item.textContent === 'SP Label') as globalThis.HTMLElement;
      await user.click(spButton);
      
      expect(alertSpy).toHaveBeenCalledWith('Row label SP already exists');
      expect(mockAddKey).not.toHaveBeenCalled();
      
      alertSpy.mockRestore();
    });

    it('should shift existing keys when adding first row label', async () => {
      const user = userEvent.setup();
      
      mockedStore.mockImplementation((selector) => {
        const state = {
          addKey: mockAddKey,
          keyboard: { 
            keys: [
              { id: 'key1', x: 0, y: 0, decal: false, ghost: false },
              { id: 'key2', x: 1, y: 0, decal: false, ghost: false }
            ]
          },
          saveToHistory: mockSaveToHistory,
          lastModifiedKeyId: null,
          selectedKeys: new Set(),
          updateKeys: mockUpdateKeys
        };
        return selector ? selector(state) : state;
      });
      
      const { container } = render(<AddKeyMenu />);
      
      const menuButton = container.querySelector('.toolbar-btn[title="Add Key"]') as globalThis.HTMLElement;
      await user.click(menuButton);
      
      const menu = container.querySelector('.add-key-menu');
      const spButton = Array.from(menu!.querySelectorAll('.add-key-menu-item'))
        .find(item => item.textContent === 'SP Label') as globalThis.HTMLElement;
      await user.click(spButton);
      
      expect(mockUpdateKeys).toHaveBeenCalledWith([
        { id: 'key1', changes: { x: 1.25 } },
        { id: 'key2', changes: { x: 2.25 } }
      ]);
      
      expect(mockAddKey).toHaveBeenCalledWith(
        expect.objectContaining({
          x: 0,
          labels: ['SP']
        })
      );
    });

    it('should not shift keys when adding second row label', async () => {
      const user = userEvent.setup();
      
      mockedStore.mockImplementation((selector) => {
        const state = {
          addKey: mockAddKey,
          keyboard: { 
            keys: [
              { id: 'r1-label', x: 0, y: 0, decal: true, ghost: true, color: 'transparent', labels: ['R1'] },
              { id: 'key1', x: 2, y: 0, decal: false, ghost: false },
              { id: 'key2', x: 3, y: 0, decal: false, ghost: false }
            ]
          },
          saveToHistory: mockSaveToHistory,
          lastModifiedKeyId: null,
          selectedKeys: new Set(),
          updateKeys: mockUpdateKeys
        };
        return selector ? selector(state) : state;
      });
      
      const { container } = render(<AddKeyMenu />);
      
      const menuButton = container.querySelector('.toolbar-btn[title="Add Key"]') as globalThis.HTMLElement;
      await user.click(menuButton);
      
      const menu = container.querySelector('.add-key-menu');
      const spButton = Array.from(menu!.querySelectorAll('.add-key-menu-item'))
        .find(item => item.textContent === 'SP Label') as globalThis.HTMLElement;
      await user.click(spButton);
      
      expect(mockUpdateKeys).not.toHaveBeenCalled();
      
      expect(mockAddKey).toHaveBeenCalledWith(
        expect.objectContaining({
          x: 0,
          labels: ['SP']
        })
      );
    });
  });

  describe('Quantity Input', () => {
    it('should add multiple keys when quantity is set', async () => {
      const user = userEvent.setup();
      const { container } = render(<AddKeyMenu />);
      
      const menuButton = container.querySelector('.toolbar-btn[title="Add Key"]') as globalThis.HTMLElement;
      await user.click(menuButton);
      
      const quantityInput = container.querySelector('.quantity-input') as globalThis.HTMLInputElement;
      // Use selectOptions approach to properly replace the value
      expect(quantityInput.value).toBe('1'); // Verify initial value
      
      // Select all content and type to replace (more reliable than clear())
      await user.click(quantityInput);
      await user.keyboard('{Control>}a{/Control}3');
      expect(quantityInput.value).toBe('3'); // Verify the value was properly set
      
      const menu = container.querySelector('.add-key-menu');
      const menuItems = menu!.querySelectorAll('.add-key-menu-item');
      // Find the 1u button from Common Sizes category (should be first occurrence)
      const oneUButton = menuItems[0] as globalThis.HTMLElement; // 1u is the first item in Common Sizes
      expect(oneUButton.textContent).toBe('1u ×3'); // Text changes to show quantity
      await user.click(oneUButton);
      
      expect(mockAddKey).toHaveBeenCalledTimes(3);
    });
  });
});
