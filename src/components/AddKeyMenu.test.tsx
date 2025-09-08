import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as matchers from '@testing-library/jest-dom/matchers';
import AddKeyMenu from './AddKeyMenu';
import { useKeyboardStore } from '../store/keyboardStoreOptimized';

expect.extend(matchers);

vi.mock('../store/keyboardStoreOptimized', () => ({
  useKeyboardStore: vi.fn()
}));

vi.mock('../utils/keyUtils', () => ({
  generateKeyId: vi.fn(() => 'test-key-id')
}));

describe('AddKeyMenu', () => {
  const mockAddKey = vi.fn();
  const mockSaveToHistory = vi.fn();
  const mockUpdateKeys = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    (useKeyboardStore as any).mockImplementation((selector: any) => {
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

  describe('Row Labels', () => {
    it('should display all row labels including SP label', async () => {
      const user = userEvent.setup();
      const { container } = render(<AddKeyMenu />);
      
      const menuButton = container.querySelector('.toolbar-btn[title="Add Key"]') as HTMLElement;
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
      
      const menuButton = container.querySelector('.toolbar-btn[title="Add Key"]') as HTMLElement;
      await user.click(menuButton);
      
      const menu = container.querySelector('.add-key-menu');
      const spButton = Array.from(menu!.querySelectorAll('.add-key-menu-item'))
        .find(item => item.textContent === 'SP Label') as HTMLElement;
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
      
      expect(mockSaveToHistory).toHaveBeenCalled();
    });

    it('should prevent adding duplicate SP label', async () => {
      const user = userEvent.setup();
      
      (useKeyboardStore as any).mockImplementation((selector: any) => {
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
      
      const menuButton = container.querySelector('.toolbar-btn[title="Add Key"]') as HTMLElement;
      await user.click(menuButton);
      
      const menu = container.querySelector('.add-key-menu');
      const spButton = Array.from(menu!.querySelectorAll('.add-key-menu-item'))
        .find(item => item.textContent === 'SP Label') as HTMLElement;
      await user.click(spButton);
      
      expect(alertSpy).toHaveBeenCalledWith('Row label SP already exists');
      expect(mockAddKey).not.toHaveBeenCalled();
      
      alertSpy.mockRestore();
    });

    it('should shift existing keys when adding first row label', async () => {
      const user = userEvent.setup();
      
      (useKeyboardStore as any).mockImplementation((selector: any) => {
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
      
      const menuButton = container.querySelector('.toolbar-btn[title="Add Key"]') as HTMLElement;
      await user.click(menuButton);
      
      const menu = container.querySelector('.add-key-menu');
      const spButton = Array.from(menu!.querySelectorAll('.add-key-menu-item'))
        .find(item => item.textContent === 'SP Label') as HTMLElement;
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
      
      (useKeyboardStore as any).mockImplementation((selector: any) => {
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
      
      const menuButton = container.querySelector('.toolbar-btn[title="Add Key"]') as HTMLElement;
      await user.click(menuButton);
      
      const menu = container.querySelector('.add-key-menu');
      const spButton = Array.from(menu!.querySelectorAll('.add-key-menu-item'))
        .find(item => item.textContent === 'SP Label') as HTMLElement;
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
      
      const menuButton = container.querySelector('.toolbar-btn[title="Add Key"]') as HTMLElement;
      await user.click(menuButton);
      
      const quantityInput = container.querySelector('.quantity-input') as HTMLInputElement;
      // Use selectOptions approach to properly replace the value
      expect(quantityInput.value).toBe('1'); // Verify initial value
      
      // Select all content and type to replace (more reliable than clear())
      await user.click(quantityInput);
      await user.keyboard('{Control>}a{/Control}3');
      expect(quantityInput.value).toBe('3'); // Verify the value was properly set
      
      const menu = container.querySelector('.add-key-menu');
      const menuItems = menu!.querySelectorAll('.add-key-menu-item');
      // Find the 1u button from Common Sizes category (should be first occurrence)
      const oneUButton = menuItems[0] as HTMLElement; // 1u is the first item in Common Sizes
      expect(oneUButton.textContent).toBe('1u ×3'); // Text changes to show quantity
      await user.click(oneUButton);
      
      expect(mockAddKey).toHaveBeenCalledTimes(3);
    });
  });
});