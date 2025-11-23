import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AVAILABLE_ICONS } from '../utils/iconParser';
import { KBD_ICONS } from '../utils/kbdIconsList';

interface SearchableIconPickerProps {
  currentValue: string;
  onChange: (value: string) => void;
  onIconAdded?: () => void;
}

const SearchableIconPicker: React.FC<SearchableIconPickerProps> = ({ currentValue, onChange, onIconAdded }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Combine legacy icons with new kbd icons, removing duplicates
  const allIcons = useMemo(() => {
    const legacy = AVAILABLE_ICONS.map(icon => ({
      ...icon,
      iconName: icon.name,
      category: icon.name.includes('Traditional') || icon.name.includes('trad') ? 'Traditional SVG' :
                icon.name.includes('Trashcons') || icon.value.includes('trashcons') ? 'Trashcons' : 'Other',
      keywords: [icon.name.toLowerCase()]
    }));

    // Combine and deduplicate by icon name
    const combined = [...legacy, ...KBD_ICONS];
    const seen = new Set<string>();
    return combined.filter(icon => {
      if (seen.has(icon.name)) {
        return false;
      }
      seen.add(icon.name);
      return true;
    });
  }, []);

  // Get all categories including legacy
  const allCategories = useMemo(() => {
    const categories = new Set(['All']);
    allIcons.forEach(icon => categories.add(icon.category));
    return Array.from(categories).sort();
  }, [allIcons]);

  // Filter icons based on search and category
  const filteredIcons = useMemo(() => {
    let icons = allIcons;

    // Filter by category
    if (selectedCategory !== 'All') {
      icons = icons.filter(icon => icon.category === selectedCategory);
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      icons = icons.filter(icon =>
        icon.name.toLowerCase().includes(term) ||
        icon.keywords.some(keyword => keyword.includes(term))
      );
    }

    return icons;
  }, [allIcons, searchTerm, selectedCategory]);

  // Find current icon
  const currentIcon = useMemo(() =>
    allIcons.find(icon => currentValue.includes(icon.value) && icon.value !== '') || allIcons[0],
    [currentValue, allIcons]
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Focus search input when opened
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleIconSelect = (iconValue: string) => {
    if (iconValue === '') {
      // Remove icon span from current value
      const cleanValue = currentValue.replace(/<(?:span|i)\s+class=["'][^"']+["'](?:\s*>.*?<\/(?:span|i)>|\s*\/>)/g, '');
      onChange(cleanValue);
    } else {
      // Add or replace icon span
      const cleanValue = currentValue.replace(/<(?:span|i)\s+class=["'][^"']+["'](?:\s*>.*?<\/(?:span|i)>|\s*\/>)/g, '');
      onChange(cleanValue + iconValue);
      if (onIconAdded) {
        onIconAdded();
      }
    }
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className="searchable-icon-picker" ref={dropdownRef}>
      <label>Icon:</label>
      <div className="icon-picker-container">
        <button
          type="button"
          className="icon-picker-button"
          onClick={() => setIsOpen(!isOpen)}
        >
          {currentIcon.name}
          <span className="dropdown-arrow">{isOpen ? '▲' : '▼'}</span>
        </button>

        {isOpen && (
          <div className="icon-picker-dropdown">
            <div className="icon-picker-header">
              <input
                ref={searchInputRef}
                type="text"
                className="icon-search-input"
                placeholder="Search icons..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <select
                className="icon-category-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                {allCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="icon-picker-list">
              {filteredIcons.length === 0 ? (
                <div className="no-icons-message">No icons found</div>
              ) : (
                filteredIcons.map((icon) => (
                  <button
                    key={icon.iconName || icon.name}
                    type="button"
                    className={`icon-picker-item ${currentIcon.name === icon.name ? 'selected' : ''}`}
                    onClick={() => handleIconSelect(icon.value)}
                  >
                    {icon.name}
                  </button>
                ))
              )}
            </div>

            <div className="icon-picker-footer">
              <small>{filteredIcons.length} icon{filteredIcons.length !== 1 ? 's' : ''} available</small>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchableIconPicker;
