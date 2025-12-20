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
  isLabel?: boolean; // For pure label elements
  label?: string; // Pre-defined label text
  isLED?: boolean; // For LED indicator circles
  isEncoder?: boolean; // For rotary encoder knobs
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
    { name: 'MiniISO', width: 0.75, height: 2, x2: -0.25, y2: 0, width2: 1, height2: 1 },
    { name: 'Big Ass Enter', width: 2.25, height: 1, x2: .75, y2: -1, width2: 1.5, height2: 2 },
    { name: 'Medium Ass Enter', width: 1.75, height: 1, x2: .75, y2: -1, width2: 1, height2: 2},
    { name: 'Little Ass Enter', width: 1.5, height: 1, x2: .75, y2: -1, width2: .75, height2: 2 },
    { name: 'Stepped Caps', width: 1.75, height: 1, stepped: true },
    { name: 'Stepped Shift', width: 2.25, height: 1, stepped: true },
    { name: '1.25 TabLock R2', width: 1.25, height: 2, x2: 0, y2: 1, width2: 1.5, height2: 1},
    { name: '1.5 TabLock R2', width: 1.5, height: 2, x2: 0, y2: 1, width2: 1.75, height2: 1}
  ],
  'Indicators': [
    { name: '3mm LED', width: 0.25, height: 0.25, isLED: true },
    { name: '5mm LED', width: 0.35, height: 0.35, isLED: true },
  ],
  'Encoders': [
    { name: '19mm Encoder', width: 1, height: 1, isEncoder: true },
    { name: '35mm Encoder', width: 1.75, height: 1.75, isEncoder: true },
  ],
  'Row Labels': [
    { name: 'R1 Label', width: 1, height: 1, isLabel: true, label: 'R1' },
    { name: 'R2 Label', width: 1, height: 1, isLabel: true, label: 'R2' },
    { name: 'R3 Label', width: 1, height: 1, isLabel: true, label: 'R3' },
    { name: 'R4 Label', width: 1, height: 1, isLabel: true, label: 'R4' },
    { name: 'R5 Label', width: 1, height: 1, isLabel: true, label: 'R5' },
    { name: 'SP Label', width: 1, height: 1, isLabel: true, label: 'SP' },
  ],
};

const AddKeyMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const addKey = useKeyboardStore((state) => state.addKey);
  const keyboard = useKeyboardStore((state) => state.keyboard);
  const saveToHistory = useKeyboardStore((state) => state.saveToHistory);
  const lastModifiedKeyId = useKeyboardStore((state) => state.lastModifiedKeyId);
  const selectedKeys = useKeyboardStore((state) => state.selectedKeys);
  const updateKeys = useKeyboardStore((state) => state.updateKeys);

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
    
    // For special keys with negative y2, ensure they have enough space at the top
    const needsTopSpace = template.y2 && template.y2 < 0;
    const minRequiredY = needsTopSpace ? Math.abs(template.y2!) : 0;
    
    if (keyboard.keys.length > 0) {
      // Special positioning for row labels - place them at the far left and shift all keys
      if (template.isLabel) {
        // Check if this specific row label already exists
        const existingSpecificRowLabel = keyboard.keys.find(key => 
          key.decal && key.ghost && key.color === 'transparent' && 
          key.labels && key.labels[0] === template.label
        );
        
        if (existingSpecificRowLabel) {
          alert(`Row label ${template.label} already exists`);
          return;
        }
        
        // Check if ANY row labels exist
        const anyRowLabelsExist = keyboard.keys.some(key => 
          key.decal && key.ghost && key.color === 'transparent'
        );
        
        // Only shift keys if this is the FIRST row label being added
        if (!anyRowLabelsExist) {
          const shiftAmount = 1.25; // Reduced from 2 to 1.25 for tighter spacing
          const updates = keyboard.keys
            .filter(key => !(key.decal && key.ghost && key.color === 'transparent')) // Don't shift other row labels
            .map(key => ({
              id: key.id,
              changes: {
                x: key.x + shiftAmount
              }
            }));
          
          // Apply the shift
          if (updates.length > 0) {
            updateKeys(updates);
          }
        }
        
        // Position the row label at the far left (x=0)
        newX = 0;
        
        // Find the appropriate Y position based on the row number
        if (template.label === 'SP') {
          // Spacebar row is typically at y=5
          newY = 5;
        } else {
          const rowNumber = parseInt(template.label?.replace('R', '') || '1');
          // Y positions for typical keyboard rows (R1-R5)
          // R1: Function row, R2: Number row, R3: QWERTY row, R4: ASDF row, R5: ZXCV row
          const rowYPositions = [0, 1, 2, 3, 4];
          newY = rowYPositions[rowNumber - 1] || 0;
        }
      } else {
        // Find the reference key - prioritize selected key, then last modified, then rightmost key
        let referenceKey = null;
        
        if (selectedKeys.size > 0) {
          // Use the first selected key as reference
          const selectedId = Array.from(selectedKeys)[0];
          referenceKey = keyboard.keys.find(k => k.id === selectedId);
        } else if (lastModifiedKeyId) {
          referenceKey = keyboard.keys.find(k => k.id === lastModifiedKeyId);
        }
        
        // If no selected or last modified key, find the rightmost key
        if (!referenceKey) {
          referenceKey = keyboard.keys.reduce((prev, current) => 
            (prev.x + prev.width > current.x + current.width) ? prev : current
          );
        }
        
        // Place new key to the right of the reference key
        newX = referenceKey.x + referenceKey.width;
        newY = referenceKey.y;
        
        // Ensure special keys with negative y2 have enough room at the top
        if (needsTopSpace) {
          newY = Math.max(newY, minRequiredY);
        }
      }
    } else {
      // First key - ensure it has enough space from top if needed
      if (needsTopSpace) {
        newY = minRequiredY;
      }
    }

    // Create the specified number of keys
    for (let i = 0; i < quantity; i++) {
      // Check if the new key would go off screen (assuming 20 units width)
      if (keyboard.keys.length > 0 && newX + template.width > 20) {
        // Move to the next row
        newX = 0;
        // Find the bottom-most key for the new row position
        const bottomKey = keyboard.keys.reduce((prev, current) => 
          (prev.y + prev.height > current.y + current.height) ? prev : current
        );
        newY = bottomKey.y + bottomKey.height + 0.25;
        
        // Ensure special keys with negative y2 have enough room at the top
        if (needsTopSpace) {
          newY = Math.max(newY, minRequiredY);
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
        labels: template.isLabel ? [template.label || ''] : ((template.isLED || template.isEncoder) ? [] : ['']),
        color: template.isLabel ? 'transparent' : (template.isLED ? '#ff0000' : (template.isEncoder ? '#cccccc' : '#f9f9f9')),
        profile: template.isLED ? 'LED' : (template.isEncoder ? 'ENCODER' : 'OEM'),
        stepped: template.stepped,
        decal: template.isLabel || template.isLED || template.isEncoder, // Row labels, LEDs, and encoders are decal keys
        ghost: template.isLabel, // Only row labels are ghost
        // Don't set a default rowLabelShape - let user choose
      } as Key;
      
      addKey(newKey);
      
      // Update position for next key
      newX += template.width;
    }
    
    saveToHistory();
    setIsOpen(false);
    setQuantity(1); // Reset quantity after adding
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
          <div className="add-key-quantity">
            <label>Quantity:</label>
            <input
              type="number"
              min="1"
              max="100"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
              className="quantity-input"
            />
          </div>
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
                  {quantity > 1 && <span className="quantity-badge"> ×{quantity}</span>}
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