import React from 'react';
import { X } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { category: 'Selection', items: [
      { keys: 'Click', description: 'Select key' },
      { keys: 'Ctrl/Cmd + Click', description: 'Add/remove key from selection' },
      { keys: 'Shift + Click', description: 'Select range of keys' },
      { keys: 'Drag', description: 'Box select multiple keys' },
      { keys: 'Ctrl/Cmd + Drag', description: 'Box select and add to selection' },
      { keys: 'Ctrl/Cmd + A', description: 'Select all keys' },
      { keys: 'Escape', description: 'Clear selection' },
    ]},
    { category: 'Movement & Manipulation', items: [
      { keys: 'Arrow Keys', description: 'Move selected keys (0.25u)' },
      { keys: 'Shift + Arrow Keys', description: 'Move selected keys (1u)' },
      { keys: 'Alt + Arrow Keys', description: 'Move selected keys (0.125u - fine control)' },
      { keys: 'Drag Selected Keys', description: 'Move keys with mouse' },
      { keys: 'Alt + Drag', description: 'Duplicate and drag keys' },
    ]},
    { category: 'Resize', items: [
      { keys: 'Ctrl/Cmd + Arrow Keys', description: 'Resize selected keys (0.25u)' },
      { keys: 'Ctrl/Cmd + Shift + Arrow Keys', description: 'Resize selected keys (0.5u)' },
      { keys: 'Ctrl/Cmd + ↑/↓', description: 'Increase/decrease height' },
      { keys: 'Ctrl/Cmd + ←/→', description: 'Decrease/increase width' },
    ]},
    { category: 'Edit', items: [
      { keys: 'Ctrl/Cmd + C', description: 'Copy selected keys' },
      { keys: 'Ctrl/Cmd + V', description: 'Paste keys' },
      { keys: 'Ctrl/Cmd + D', description: 'Duplicate selected keys below' },
      { keys: 'Delete/Backspace', description: 'Delete selected keys' },
      { keys: 'Ctrl/Cmd + Z', description: 'Undo' },
      { keys: 'Ctrl/Cmd + Y', description: 'Redo' },
      { keys: 'Ctrl/Cmd + Shift + Z', description: 'Redo (alternative)' },
    ]},
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content shortcuts-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Keyboard Shortcuts</h2>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <div className="modal-body">
          <div className="shortcuts-grid">
            {shortcuts.map((section) => (
              <div key={section.category} className="shortcuts-section">
                <h3>{section.category}</h3>
                <div className="shortcuts-list">
                  {section.items.map((shortcut, index) => (
                    <div key={index} className="shortcut-item">
                      <span className="shortcut-keys">{shortcut.keys}</span>
                      <span className="shortcut-description">{shortcut.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default KeyboardShortcutsModal;