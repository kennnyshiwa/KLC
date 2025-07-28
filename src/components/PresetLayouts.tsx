import React from 'react';
import { useKeyboardStore } from '../store/keyboardStoreOptimized';
import { parseKLE } from '../utils/kleParser';
import { presetLayouts } from '../constants/presetLayouts';
import { Keyboard } from 'lucide-react';

const PresetLayouts: React.FC = () => {
  const setKeyboard = useKeyboardStore((state) => state.setKeyboard);
  
  const handlePresetSelect = (layoutName: string) => {
    const layout = presetLayouts[layoutName as keyof typeof presetLayouts];
    if (layout) {
      try {
        const keyboard = parseKLE(layout);
        keyboard.meta.name = layoutName;
        setKeyboard(keyboard);
      } catch (err) {
      }
    }
  };
  
  return (
    <div className="preset-layouts">
      <h3>Preset Layouts</h3>
      <div className="preset-list">
        {Object.keys(presetLayouts).map(layoutName => (
          <button
            key={layoutName}
            className="preset-item"
            onClick={() => handlePresetSelect(layoutName)}
          >
            <Keyboard size={20} />
            <span>{layoutName}</span>
          </button>
        ))}
      </div>
      <div className="preset-info">
        <p className="hint">
          Click on a preset to load it. You can then customize it to your needs.
        </p>
      </div>
    </div>
  );
};

export default PresetLayouts;