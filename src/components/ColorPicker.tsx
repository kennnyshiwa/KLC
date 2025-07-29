import React, { useState, useMemo } from 'react';
import { colorSwatches } from '../constants/colorSwatches';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ value, onChange }) => {
  const [expandedSwatch, setExpandedSwatch] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const toggleSwatch = (swatchName: string) => {
    setExpandedSwatch(expandedSwatch === swatchName ? null : swatchName);
  };
  
  // Find the friendly name for the current color
  const getColorName = (hexColor: string): { name: string; swatch: string } | null => {
    const normalizedHex = hexColor.toUpperCase();
    for (const swatch of colorSwatches) {
      for (const [name, color] of Object.entries(swatch.colors)) {
        if ((color as string).toUpperCase() === normalizedHex) {
          return { name, swatch: swatch.name };
        }
      }
    }
    return null;
  };
  
  const currentColorInfo = getColorName(value);
  
  // Filter and sort colors based on search term
  const filteredSwatches = useMemo(() => {
    if (!searchTerm) {
      // Sort colors alphabetically within each swatch
      return colorSwatches.map(swatch => ({
        ...swatch,
        colors: Object.entries(swatch.colors)
          .sort(([a], [b]) => a.localeCompare(b))
          .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {})
      }));
    }
    
    const lowerSearch = searchTerm.toLowerCase();
    return colorSwatches.map(swatch => ({
      ...swatch,
      colors: Object.entries(swatch.colors)
        .filter(([name, color]) => 
          name.toLowerCase().includes(lowerSearch) || 
          color.toLowerCase().includes(lowerSearch)
        )
        .sort(([a], [b]) => a.localeCompare(b))
        .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {})
    })).filter(swatch => Object.keys(swatch.colors).length > 0);
  }, [searchTerm]);
  
  return (
    <div className="color-picker">
      <div className="color-picker-header">
        <label>Color</label>
        <div className="color-picker-current">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          <div className="color-info">
            <span className="color-hex">{value}</span>
            {currentColorInfo && (
              <span className="color-name">
                {currentColorInfo.swatch} {currentColorInfo.name}
              </span>
            )}
          </div>
        </div>
      </div>
      
      <div className="color-picker-search">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search color codes or hex values..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
      </div>
      
      <div className="color-swatches">
        {filteredSwatches.map((swatch) => (
          <div key={swatch.name} className="color-swatch-group">
            <div 
              className="swatch-header"
              onClick={() => toggleSwatch(swatch.name)}
            >
              {expandedSwatch === swatch.name ? 
                <ChevronDown size={14} /> : 
                <ChevronRight size={14} />
              }
              <span>{swatch.name}</span>
            </div>
            
            {(expandedSwatch === swatch.name || searchTerm) && (
              <div className="swatch-colors">
                {Object.entries(swatch.colors).map(([name, color]) => (
                  <div
                    key={name}
                    className="swatch-color"
                    onClick={() => onChange(color as string)}
                    title={`${name}: ${color}`}
                  >
                    <div 
                      className="swatch-color-box"
                      style={{ backgroundColor: color as string }}
                    />
                    <span className="swatch-color-name">{name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ColorPicker;