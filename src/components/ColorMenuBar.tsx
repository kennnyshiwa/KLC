import React, { useState } from 'react';
import { useKeyboardStore } from '../store/keyboardStoreOptimized';
import { colorSwatches } from '../constants/colorSwatches';
import { Palette } from 'lucide-react';

interface ColorMenuBarProps {
  activeMenu: 'GMK' | 'ABS' | 'PBT' | null;
  setActiveMenu: (menu: 'GMK' | 'ABS' | 'PBT' | null) => void;
}

interface TooltipPosition {
  x: number;
  y: number;
}

const ColorMenuBar: React.FC<ColorMenuBarProps> = ({ activeMenu, setActiveMenu }) => {
  const selectedKeys = useKeyboardStore((state) => state.selectedKeys);


  return (
    <>
      <div className="color-menu-buttons">
        <button
          className={`toolbar-btn color-menu-btn ${activeMenu === 'GMK' ? 'active' : ''}`}
          onClick={() => setActiveMenu(activeMenu === 'GMK' ? null : 'GMK')}
          disabled={selectedKeys.size === 0}
          title="GMK Colors"
        >
          <Palette size={16} />
          <span>GMK</span>
        </button>
        <button
          className={`toolbar-btn color-menu-btn ${activeMenu === 'ABS' ? 'active' : ''}`}
          onClick={() => setActiveMenu(activeMenu === 'ABS' ? null : 'ABS')}
          disabled={selectedKeys.size === 0}
          title="Signature Plastics ABS Colors"
        >
          <Palette size={16} />
          <span>ABS</span>
        </button>
        <button
          className={`toolbar-btn color-menu-btn ${activeMenu === 'PBT' ? 'active' : ''}`}
          onClick={() => setActiveMenu(activeMenu === 'PBT' ? null : 'PBT')}
          disabled={selectedKeys.size === 0}
          title="Signature Plastics PBT Colors"
        >
          <Palette size={16} />
          <span>PBT</span>
        </button>
      </div>
    </>
  );
};

export const ColorMenuGrid: React.FC<{ activeMenu: 'GMK' | 'ABS' | 'PBT' | null }> = ({ activeMenu }) => {
  const [hoveredColor, setHoveredColor] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition>({ x: 0, y: 0 });
  const selectedKeys = useKeyboardStore((state) => state.selectedKeys);
  const updateKeys = useKeyboardStore((state) => state.updateKeys);
  const saveToHistory = useKeyboardStore((state) => state.saveToHistory);

  const handleColorClick = (color: string, isRightClick: boolean = false) => {
    if (selectedKeys.size === 0) return;

    const updates = Array.from(selectedKeys).map(keyId => ({
      id: keyId,
      changes: isRightClick 
        ? { textColor: [color] } // Set legend color
        : { color } // Set keycap color
    }));

    updateKeys(updates);
    saveToHistory();
  };

  const getColorSwatches = (type: 'GMK' | 'ABS' | 'PBT') => {
    switch (type) {
      case 'GMK':
        return colorSwatches.find(s => s.name.includes('GMK'))?.colors || {};
      case 'ABS':
        return colorSwatches.find(s => s.name.includes('ABS'))?.colors || {};
      case 'PBT':
        return colorSwatches.find(s => s.name.includes('PBT'))?.colors || {};
      default:
        return {};
    }
  };

  if (!activeMenu) return null;

  const colors = getColorSwatches(activeMenu);
  const colorEntries = Object.entries(colors).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <>
      <div className="color-menu-expanded">
        <div className="color-menu-header">
          <h4>{activeMenu} Colors</h4>
          <p className="color-menu-hint">
            Left click: Keycap color • Right click: Legend color
          </p>
        </div>
        <div className="color-menu-grid">
          {colorEntries.map(([name, color]) => (
            <div
              key={name}
              className="color-menu-item"
              style={{ backgroundColor: color }}
              title={name}
              onClick={() => handleColorClick(color)}
              onContextMenu={(e) => {
                e.preventDefault();
                handleColorClick(color, true);
              }}
              onMouseEnter={(e) => {
                setHoveredColor(name);
                const rect = e.currentTarget.getBoundingClientRect();
                setTooltipPosition({
                  x: rect.left + rect.width / 2,
                  y: rect.top
                });
              }}
              onMouseLeave={() => setHoveredColor(null)}
            />
          ))}
        </div>
      </div>
      
      {hoveredColor && (
        <div 
          className="color-tooltip"
          style={{
            position: 'fixed',
            left: tooltipPosition.x,
            top: tooltipPosition.y - 30,
            transform: 'translateX(-50%)',
          }}
        >
          {hoveredColor}
        </div>
      )}
    </>
  );
};

export default ColorMenuBar;