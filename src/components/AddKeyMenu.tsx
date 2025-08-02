import React, { useState, useRef, useEffect } from 'react';
import { Plus, ChevronDown } from 'lucide-react';
import { useKeyboardStore } from '../store/keyboardStoreOptimized';
import { generateKeyId } from '../utils/keyUtils';
import { Key } from '../types';

interface KeyTemplate {
  name: string;
  width: number;
  height: number;
  width2?: number;
  height2?: number;
  x2?: number;
  y2?: number;
  stepped?: boolean;
}

const KEY_TEMPLATES: { [category: string]: KeyTemplate[] } = {
  'Common Sizes': [
    { name: '1u', width: 1, height: 1 },
    { name: '1.25u', width: 1.25, height: 1 },
    { name: '1.5u', width: 1.5, height: 1 },
    { name: '1.75u', width: 1.75, height: 1 },
    { name: '2u', width: 2, height: 1 },
    { name: '2.25u', width: 2.25, height: 1 },
    { name: '2.75u', width: 2.75, height: 1 },
    { name: '6.25u Space', width: 6.25, height: 1 },
    { name: '7u Space', width: 7, height: 1 },
    { name: '8u Space', width: 8, height: 1 },
    { name: '10u Space', width: 10, height: 1 },
    { name: '15u Space', width: 15, height: 1 },
  ],
  'Vertical Keys': [
    { name: '2u Vertical', width: 1, height: 2 },
    { name: 'Numpad +', width: 1, height: 2 },
    { name: 'Numpad Enter', width: 1, height: 2 },
  ],
  'Special Keys': [
    { name: 'ISO Enter', width: 1.25, height: 2, x2: -0.25, y2: 0, width2: 1.5, height2: 1 },
    { name: 'Big Ass Enter', width: 2.25, height: 1, x2: .75, y2: -1, width2: 1.5, height2: 2 },
    { name: 'Little Ass Enter', width: 1.5, height: 1, x2: .75, y2: -1, width2: .75, height2: 2 },
    { name: 'Stepped Caps', width: 1.75, height: 1, stepped: true },
    { name: 'Stepped Shift', width: 2.25, height: 1, stepped: true },
  ],
};

const AddKeyMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const addKey = useKeyboardStore((state) => state.addKey);
  const keyboard = useKeyboardStore((state) => state.keyboard);
  const saveToHistory = useKeyboardStore((state) => state.saveToHistory);
  const lastModifiedKeyId = useKeyboardStore((state) => state.lastModifiedKeyId);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleAddKey = (template: KeyTemplate) => {
    // Find a good position for the new key
    let newX = 0;
    let newY = 0;
    
    if (keyboard.keys.length > 0) {
      // Find the reference key - either the last modified key or the last key in the array
      let referenceKey = null;
      
      if (lastModifiedKeyId) {
        referenceKey = keyboard.keys.find(k => k.id === lastModifiedKeyId);
      }
      
      // If no last modified key or it was deleted, use the last key in array
      if (!referenceKey) {
        referenceKey = keyboard.keys[keyboard.keys.length - 1];
      }
      
      // Place new key to the right of the reference key
      newX = referenceKey.x + referenceKey.width; // 0.25 unit gap between keys
      newY = referenceKey.y;
      
      // Check if the new key would go off screen (assuming 20 units width)
      if (newX + template.width > 20) {
        // Move to the next row
        newX = 0;
        // Find the bottom-most key for the new row position
        const bottomKey = keyboard.keys.reduce((prev, current) => 
          (prev.y + prev.height > current.y + current.height) ? prev : current
        );
        newY = bottomKey.y + bottomKey.height + 0.25;
      }
    }

    const newKey: Key = {
      id: generateKeyId(),
      x: newX,
      y: newY,
      width: template.width,
      height: template.height,
      x2: template.x2,
      y2: template.y2,
      width2: template.width2,
      height2: template.height2,
      labels: [''],
      color: '#f9f9f9',
      profile: 'OEM',
      stepped: template.stepped,
    };
    
    addKey(newKey);
    saveToHistory();
    setIsOpen(false);
  };

  return (
    <div className="add-key-menu-container" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="toolbar-btn"
        title="Add Key"
      >
        <Plus size={18} />
        <ChevronDown size={14} />
      </button>
      
      {isOpen && (
        <div className="add-key-menu">
          {Object.entries(KEY_TEMPLATES).map(([category, templates]) => (
            <div key={category} className="add-key-category">
              <div className="add-key-category-header">{category}</div>
              {templates.map((template) => (
                <button
                  key={template.name}
                  className="add-key-menu-item"
                  onClick={() => handleAddKey(template)}
                >
                  {template.name}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AddKeyMenu;