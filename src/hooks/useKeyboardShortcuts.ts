import { useEffect } from 'react';
import { useKeyboardStore } from '../store/keyboardStoreOptimized';
import { duplicateKey } from '../utils/keyUtils';

export const useKeyboardShortcuts = () => {
  const selectedKeys = useKeyboardStore((state) => state.selectedKeys);
  const keyboard = useKeyboardStore((state) => state.keyboard);
  const undo = useKeyboardStore((state) => state.undo);
  const redo = useKeyboardStore((state) => state.redo);
  const deleteKeys = useKeyboardStore((state) => state.deleteKeys);
  const addKey = useKeyboardStore((state) => state.addKey);
  const selectAll = useKeyboardStore((state) => state.selectAll);
  const clearSelection = useKeyboardStore((state) => state.clearSelection);
  const saveToHistory = useKeyboardStore((state) => state.saveToHistory);
  const updateKeys = useKeyboardStore((state) => state.updateKeys);
  const copyKeys = useKeyboardStore((state) => state.copyKeys);
  const pasteKeys = useKeyboardStore((state) => state.pasteKeys);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      
      // Don't handle shortcuts when typing in input fields
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      // Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      
      // Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
      
      // Select All
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        selectAll();
      }
      
      // Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (selectedKeys.size > 0) {
          deleteKeys(Array.from(selectedKeys));
          saveToHistory();
        }
      }
      
      // Duplicate
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        const selectedKeysList = Array.from(selectedKeys)
          .map(id => keyboard.keys.find(k => k.id === id))
          .filter(Boolean) as any[];
          
        if (selectedKeysList.length > 0) {
          // Find the bottom-most key in the entire layout
          const bottomKey = keyboard.keys.reduce((prev, current) => 
            (prev.y + prev.height > current.y + current.height) ? prev : current
          );
          
          // Calculate new Y position (directly below bottom-most key)
          const newY = bottomKey.y + bottomKey.height;
          
          // Find the leftmost selected key to maintain relative positions
          const leftmostSelected = selectedKeysList.reduce((prev, current) => 
            (prev.x < current.x) ? prev : current
          );
          
          // Find the topmost selected key to maintain relative positions
          const topmostSelected = selectedKeysList.reduce((prev, current) => 
            (prev.y < current.y) ? prev : current
          );
          
          selectedKeysList.forEach(key => {
            // Calculate the exact position where we want the duplicated key
            const targetX = key.x - leftmostSelected.x;
            const targetY = key.y - topmostSelected.y + newY;
            
            // Since duplicateKey adds offset to key position, we need to subtract key position
            const duplicated = duplicateKey(key, {
              x: targetX - key.x,
              y: targetY - key.y
            });
            addKey(duplicated);
          });
          
          saveToHistory();
        }
      }
      
      // Copy
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        if (selectedKeys.size > 0) {
          copyKeys(Array.from(selectedKeys));
        }
      }
      
      // Paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        pasteKeys();
      }
      
      // Escape - Clear selection
      if (e.key === 'Escape') {
        clearSelection();
      }
      
      // Arrow keys - Move or resize selected keys
      if (selectedKeys.size > 0 && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        
        if (e.ctrlKey || e.metaKey) {
          // Ctrl+Arrow: Resize keys
          const delta = e.shiftKey ? 0.5 : 0.25; // Larger steps with Shift
          let dw = 0, dh = 0;
          
          switch (e.key) {
            case 'ArrowUp': dh = delta; break;      // Increase height
            case 'ArrowDown': dh = -delta; break;   // Decrease height
            case 'ArrowLeft': dw = -delta; break;   // Decrease width
            case 'ArrowRight': dw = delta; break;   // Increase width
          }
          
          const updates = Array.from(selectedKeys).map(keyId => {
            const key = keyboard.keys.find(k => k.id === keyId);
            if (!key) return null;
            
            // Ensure minimum size of 0.25 units
            const newWidth = Math.max(0.25, key.width + dw);
            const newHeight = Math.max(0.25, key.height + dh);
            
            return {
              id: keyId,
              changes: { 
                width: newWidth,
                height: newHeight
              }
            };
          }).filter(Boolean) as Array<{ id: string; changes: any }>;
          
          updateKeys(updates);
          saveToHistory();
        } else {
          // Normal arrow keys: Move keys
          const delta = e.shiftKey ? 1 : 0.25;
          let dx = 0, dy = 0;
          
          switch (e.key) {
            case 'ArrowUp': dy = -delta; break;
            case 'ArrowDown': dy = delta; break;
            case 'ArrowLeft': dx = -delta; break;
            case 'ArrowRight': dx = delta; break;
          }
          
          const updates = Array.from(selectedKeys).map(keyId => {
            const key = keyboard.keys.find(k => k.id === keyId);
            if (!key) return null;
            
            return {
              id: keyId,
              changes: { 
                x: key.x + dx, 
                y: key.y + dy 
              }
            };
          }).filter(Boolean) as Array<{ id: string; changes: any }>;
          
          updateKeys(updates);
          saveToHistory();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedKeys, keyboard.keys, undo, redo, deleteKeys, addKey, selectAll, clearSelection, saveToHistory, updateKeys, copyKeys, pasteKeys]);
};