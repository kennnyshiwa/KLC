import React from 'react';
import { AVAILABLE_ICONS } from '../utils/iconParser';

interface IconDropdownProps {
  currentValue: string;
  onChange: (value: string) => void;
  onIconAdded?: () => void;
}

const IconDropdown: React.FC<IconDropdownProps> = ({ currentValue, onChange, onIconAdded }) => {
  // Find if current value contains an icon
  const currentIcon = AVAILABLE_ICONS.find(icon => 
    currentValue.includes(icon.value) && icon.value !== ''
  ) || AVAILABLE_ICONS[0];

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newIcon = e.target.value;
    if (newIcon === '') {
      // Remove icon span from current value
      const cleanValue = currentValue.replace(/<span\s+class=["'][^"']+["'](?:\s*>.*?<\/span>|\s*\/>)/g, '');
      onChange(cleanValue);
    } else {
      // Add or replace icon span
      const cleanValue = currentValue.replace(/<span\s+class=["'][^"']+["'](?:\s*>.*?<\/span>|\s*\/>)/g, '');
      onChange(cleanValue + newIcon);
      // Notify parent that an icon was added
      if (onIconAdded) {
        onIconAdded();
      }
    }
  };

  return (
    <div className="icon-dropdown">
      <label>Icon:</label>
      <select value={currentIcon.value} onChange={handleChange}>
        {AVAILABLE_ICONS.map((icon) => (
          <option key={icon.name} value={icon.value}>
            {icon.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default IconDropdown;