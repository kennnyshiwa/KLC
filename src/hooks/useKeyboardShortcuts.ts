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
            const duplicated = duplicateKey(key, {
              x: key.x - leftmostSelected.x,
              y: newY - topmostSelected.y
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
      
      // Arrow keys - Move selected keys
      if (selectedKeys.size > 0 && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        
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
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedKeys, keyboard.keys, undo, redo, deleteKeys, addKey, selectAll, clearSelection, saveToHistory, updateKeys, copyKeys, pasteKeys]);
};