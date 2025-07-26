import React, { useState } from 'react';
import { useKeyboardStore } from '../store/keyboardStoreOptimized';
import { Key, KeyProfile } from '../types';
import { ChevronDown, ChevronRight, Type } from 'lucide-react';
import ColorPicker from './ColorPicker';
import CharacterPicker from './CharacterPicker';
import IconDropdown from './IconDropdown';

const PROFILES: KeyProfile[] = ['DCS', 'DSA', 'SA', 'OEM', 'CHICKLET', 'FLAT', 'XDA', 'MA'];

// Helper to determine if a key has dual legends that should be shown as top/bottom
const hasDualLegendAlignment = (key: Key): boolean => {
  // Check if the key has horizontal centering enabled and a dual legend in position 0
  return key.align !== undefined && 
         (key.align & 0x01) !== 0 && 
         key.labels[0] && 
         key.labels[0].includes('\n');
};

// Helper to get the dual legend parts
const getDualLegendParts = (label: string): [string, string] => {
  const parts = label.split('\n');
  return [parts[0] || '', parts[1] || ''];
};

const PropertiesPanel: React.FC = () => {
  const selectedKeys = useKeyboardStore((state) => state.selectedKeys);
  const keyboard = useKeyboardStore((state) => state.keyboard);
  const updateKeys = useKeyboardStore((state) => state.updateKeys);
  const updateMetadata = useKeyboardStore((state) => state.updateMetadata);
  const saveToHistory = useKeyboardStore((state) => state.saveToHistory);
  
  const [expandedSections, setExpandedSections] = useState({
    keyboard: true,
    position: true,
    size: true,
    legends: true,
    appearance: true,
    advanced: false,
  });
  const [showCharPicker, setShowCharPicker] = useState(false);
  const [charPickerTarget, setCharPickerTarget] = useState<number | null>(null);

  const selectedKeysList = Array.from(selectedKeys)
    .map(id => keyboard.keys.find(k => k.id === id))
    .filter(Boolean) as Key[];

  const firstKey = selectedKeysList[0];

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleKeyUpdate = (field: keyof Key, value: any) => {
    const updates = selectedKeysList.map(key => ({
      id: key.id,
      changes: { [field]: value }
    }));
    updateKeys(updates);
    saveToHistory();
  };

  const handleLegendUpdate = (index: number, value: string) => {
    const updates = selectedKeysList.map(key => {
      const newLabels = [...key.labels];
      newLabels[index] = value;
      return {
        id: key.id,
        changes: { labels: newLabels }
      };
    });
    updateKeys(updates);
    saveToHistory();
  };

  const handleIconAdded = (index: number) => {
    // When an icon is added, automatically set text size to 9 for that legend
    const updates = selectedKeysList.map(key => {
      const newSizes = [...(key.textSize || [])];
      newSizes[index] = 9;
      return {
        id: key.id,
        changes: { textSize: newSizes }
      };
    });
    updateKeys(updates);
  };

  const handleTextColorUpdate = (index: number, value: string) => {
    const updates = selectedKeysList.map(key => {
      const newColors = [...(key.textColor || [])];
      newColors[index] = value;
      return {
        id: key.id,
        changes: { textColor: newColors }
      };
    });
    updateKeys(updates);
    saveToHistory();
  };

  const handleTextSizeUpdate = (index: number, value: number) => {
    const updates = selectedKeysList.map(key => {
      const newSizes = [...(key.textSize || [])];
      newSizes[index] = value;
      return {
        id: key.id,
        changes: { textSize: newSizes }
      };
    });
    updateKeys(updates);
    saveToHistory();
  };

  return (
    <div className="properties-panel">
      <h3>Properties</h3>
      
      {/* Keyboard Properties */}
      <div className="property-section">
        <div className="section-header" onClick={() => toggleSection('keyboard')}>
          {expandedSections.keyboard ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span>Keyboard</span>
        </div>
        {expandedSections.keyboard && (
          <div className="section-content">
            <div className="property-row">
              <label>Name</label>
              <input
                type="text"
                value={keyboard.meta.name || ''}
                onChange={(e) => updateMetadata({ name: e.target.value })}
                placeholder="Keyboard name"
              />
            </div>
            <div className="property-row">
              <label>Author</label>
              <input
                type="text"
                value={keyboard.meta.author || ''}
                onChange={(e) => updateMetadata({ author: e.target.value })}
                placeholder="Author name"
              />
            </div>
            <div className="property-row">
              <label>Notes</label>
              <textarea
                value={keyboard.meta.notes || ''}
                onChange={(e) => updateMetadata({ notes: e.target.value })}
                placeholder="Additional notes"
                rows={3}
              />
            </div>
          </div>
        )}
      </div>

      {selectedKeysList.length === 0 ? (
        <div className="no-selection">
          <p>No keys selected</p>
          <p className="hint">Click on a key to select it</p>
        </div>
      ) : (
        <>
          <div className="selection-info">
            {selectedKeysList.length} key{selectedKeysList.length > 1 ? 's' : ''} selected
          </div>

          {/* Position Properties */}
          <div className="property-section">
            <div className="section-header" onClick={() => toggleSection('position')}>
              {expandedSections.position ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <span>Position</span>
            </div>
            {expandedSections.position && firstKey && (
              <div className="section-content">
                <div className="property-row-dual">
                  <div className="property-field">
                    <label>X</label>
                    <input
                      type="number"
                      value={firstKey.x}
                      onChange={(e) => handleKeyUpdate('x', parseFloat(e.target.value))}
                      step="0.25"
                    />
                  </div>
                  <div className="property-field">
                    <label>Y</label>
                    <input
                      type="number"
                      value={firstKey.y}
                      onChange={(e) => handleKeyUpdate('y', parseFloat(e.target.value))}
                      step="0.25"
                    />
                  </div>
                </div>
                {firstKey.rotation_angle && (
                  <>
                    <div className="property-row">
                      <label>Rotation</label>
                      <input
                        type="number"
                        value={firstKey.rotation_angle}
                        onChange={(e) => handleKeyUpdate('rotation_angle', parseFloat(e.target.value))}
                        step="1"
                      />
                    </div>
                    <div className="property-row-dual">
                      <div className="property-field">
                        <label>Rot X</label>
                        <input
                          type="number"
                          value={firstKey.rotation_x || 0}
                          onChange={(e) => handleKeyUpdate('rotation_x', parseFloat(e.target.value))}
                          step="0.25"
                        />
                      </div>
                      <div className="property-field">
                        <label>Rot Y</label>
                        <input
                          type="number"
                          value={firstKey.rotation_y || 0}
                          onChange={(e) => handleKeyUpdate('rotation_y', parseFloat(e.target.value))}
                          step="0.25"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Size Properties */}
          <div className="property-section">
            <div className="section-header" onClick={() => toggleSection('size')}>
              {expandedSections.size ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <span>Size</span>
            </div>
            {expandedSections.size && firstKey && (
              <div className="section-content">
                {/* Check if this is a complex key shape */}
                {(firstKey.x2 !== undefined || firstKey.y2 !== undefined || 
                  firstKey.width2 !== undefined || firstKey.height2 !== undefined) ? (
                  <div className="property-row">
                    <p className="hint">Complex key shapes (ISO Enter, Big Ass Enter) have fixed dimensions and cannot be resized.</p>
                  </div>
                ) : (
                  <div className="property-row-dual">
                    <div className="property-field">
                      <label>Width</label>
                      <input
                        type="number"
                        value={firstKey.width}
                        onChange={(e) => handleKeyUpdate('width', parseFloat(e.target.value))}
                        step="0.25"
                        min="0.25"
                      />
                    </div>
                    <div className="property-field">
                      <label>Height</label>
                      <input
                        type="number"
                        value={firstKey.height}
                        onChange={(e) => handleKeyUpdate('height', parseFloat(e.target.value))}
                        step="0.25"
                        min="0.25"
                      />
                    </div>
                  </div>
                )}
                {false && (firstKey.x2 !== undefined || firstKey.y2 !== undefined) && (
                  <>
                    <div className="property-row-dual">
                      <div className="property-field">
                        <label>X2</label>
                        <input
                          type="number"
                          value={firstKey.x2 || 0}
                          onChange={(e) => handleKeyUpdate('x2', parseFloat(e.target.value))}
                          step="0.25"
                        />
                      </div>
                      <div className="property-field">
                        <label>Y2</label>
                        <input
                          type="number"
                          value={firstKey.y2 || 0}
                          onChange={(e) => handleKeyUpdate('y2', parseFloat(e.target.value))}
                          step="0.25"
                        />
                      </div>
                    </div>
                    <div className="property-row-dual">
                      <div className="property-field">
                        <label>Width2</label>
                        <input
                          type="number"
                          value={firstKey.width2 || 0}
                          onChange={(e) => handleKeyUpdate('width2', parseFloat(e.target.value))}
                          step="0.25"
                        />
                      </div>
                      <div className="property-field">
                        <label>Height2</label>
                        <input
                          type="number"
                          value={firstKey.height2 || 0}
                          onChange={(e) => handleKeyUpdate('height2', parseFloat(e.target.value))}
                          step="0.25"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Legend Properties */}
          <div className="property-section">
            <div className="section-header" onClick={() => toggleSection('legends')}>
              {expandedSections.legends ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <span>Legends</span>
            </div>
            {expandedSections.legends && firstKey && (
              <div className="section-content">
                <div className="legends-controls">
                  <button 
                    className="btn btn-sm"
                    onClick={() => setShowCharPicker(true)}
                  >
                    <Type size={14} />
                    <span>Character Picker</span>
                  </button>
                </div>
                <div className="legends-grid">
                  {[
                    { index: 0, label: 'TL' },  // Top Left
                    { index: 10, label: 'TC' }, // Top Center  
                    { index: 2, label: 'TR' },  // Top Right
                    { index: 7, label: 'ML' },  // Middle Left
                    { index: 8, label: 'MC' },  // Middle Center
                    { index: 9, label: 'MR' },  // Middle Right
                    { index: 1, label: 'BL' },  // Bottom Left
                    { index: 11, label: 'BC' }, // Bottom Center
                    { index: 3, label: 'BR' },  // Bottom Right
                  ].map(({ index, label }) => {
                    // Special handling for dual legend keys with alignment
                    if (hasDualLegendAlignment(firstKey)) {
                      // For top center (index 10) show the first part of the dual legend
                      if (index === 10) {
                        const [topPart] = getDualLegendParts(firstKey.labels[0]);
                        return (
                          <div key={index} className="legend-field">
                            <input
                              type="text"
                              value={topPart}
                              onChange={(e) => {
                                const [, bottomPart] = getDualLegendParts(firstKey.labels[0]);
                                handleLegendUpdate(0, `${e.target.value}\n${bottomPart}`);
                              }}
                              onFocus={() => setCharPickerTarget(index)}
                              placeholder={label}
                            />
                            {charPickerTarget === index && (
                              <IconDropdown 
                                currentValue={topPart}
                                onChange={(value) => {
                                  const [, bottomPart] = getDualLegendParts(firstKey.labels[0]);
                                  handleLegendUpdate(0, `${value}\n${bottomPart}`);
                                }}
                                onIconAdded={() => handleIconAdded(0)}
                              />
                            )}
                          </div>
                        );
                      }
                      // For bottom center (index 11) show the second part of the dual legend
                      else if (index === 11) {
                        const [, bottomPart] = getDualLegendParts(firstKey.labels[0]);
                        return (
                          <div key={index} className="legend-field">
                            <input
                              type="text"
                              value={bottomPart}
                              onChange={(e) => {
                                const [topPart] = getDualLegendParts(firstKey.labels[0]);
                                handleLegendUpdate(0, `${topPart}\n${e.target.value}`);
                              }}
                              onFocus={() => setCharPickerTarget(index)}
                              placeholder={label}
                            />
                            {charPickerTarget === index && (
                              <IconDropdown 
                                currentValue={bottomPart}
                                onChange={(value) => {
                                  const [topPart] = getDualLegendParts(firstKey.labels[0]);
                                  handleLegendUpdate(0, `${topPart}\n${value}`);
                                }}
                                onIconAdded={() => handleIconAdded(0)}
                              />
                            )}
                          </div>
                        );
                      }
                      // Hide the original position 0 (top left) for dual legend aligned keys
                      else if (index === 0) {
                        return (
                          <div key={index} className="legend-field">
                            <input
                              type="text"
                              value=""
                              disabled
                              placeholder="-"
                              style={{ opacity: 0.5 }}
                            />
                          </div>
                        );
                      }
                    }
                    
                    // Normal rendering for all other cases
                    return (
                    <div key={index} className="legend-field">
                      <input
                        type="text"
                        value={firstKey.labels[index] || ''}
                        onChange={(e) => handleLegendUpdate(index, e.target.value)}
                        onFocus={() => setCharPickerTarget(index)}
                        placeholder={label}
                      />
                      {charPickerTarget === index && (
                        <IconDropdown 
                          currentValue={firstKey.labels[index] || ''}
                          onChange={(value) => handleLegendUpdate(index, value)}
                          onIconAdded={() => handleIconAdded(index)}
                        />
                      )}
                    </div>
                  );
                  })}
                </div>
                <div className="legend-help">
                  <p className="help-text">
                    Select a legend field to add icons from the dropdown
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Appearance Properties */}
          <div className="property-section">
            <div className="section-header" onClick={() => toggleSection('appearance')}>
              {expandedSections.appearance ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <span>Appearance</span>
            </div>
            {expandedSections.appearance && firstKey && (
              <div className="section-content">
                <ColorPicker
                  value={firstKey.color || '#f9f9f9'}
                  onChange={(color) => handleKeyUpdate('color', color)}
                />
                <div className="property-row">
                  <label>Profile</label>
                  <select
                    value={firstKey.profile || 'DCS'}
                    onChange={(e) => handleKeyUpdate('profile', e.target.value as KeyProfile)}
                  >
                    {PROFILES.map(profile => (
                      <option key={profile} value={profile}>{profile}</option>
                    ))}
                  </select>
                </div>
                <div className="property-row">
                  <label>Front Legends</label>
                  <div className="legends-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                    <input
                      type="text"
                      value={firstKey.frontLegends?.[0] || ''}
                      onChange={(e) => {
                        const newFrontLegends = [...(firstKey.frontLegends || ['', '', ''])];
                        newFrontLegends[0] = e.target.value;
                        handleKeyUpdate('frontLegends', newFrontLegends);
                      }}
                      placeholder="Left"
                      style={{ textAlign: 'left' }}
                    />
                    <input
                      type="text"
                      value={firstKey.frontLegends?.[1] || ''}
                      onChange={(e) => {
                        const newFrontLegends = [...(firstKey.frontLegends || ['', '', ''])];
                        newFrontLegends[1] = e.target.value;
                        handleKeyUpdate('frontLegends', newFrontLegends);
                      }}
                      placeholder="Center"
                      style={{ textAlign: 'center' }}
                    />
                    <input
                      type="text"
                      value={firstKey.frontLegends?.[2] || ''}
                      onChange={(e) => {
                        const newFrontLegends = [...(firstKey.frontLegends || ['', '', ''])];
                        newFrontLegends[2] = e.target.value;
                        handleKeyUpdate('frontLegends', newFrontLegends);
                      }}
                      placeholder="Right"
                      style={{ textAlign: 'right' }}
                    />
                  </div>
                </div>
                <div className="property-row checkbox-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={firstKey.stepped || false}
                      onChange={(e) => handleKeyUpdate('stepped', e.target.checked)}
                    />
                    Stepped
                  </label>
                </div>
                <div className="property-row">
                  <label>Homing Nub</label>
                  <select 
                    value={firstKey.nub ? (firstKey.frontLegends?.[1] === 'Bar' ? 'bar' : 'scoop') : 'none'}
                    onChange={(e) => {
                      const value = e.target.value;
                      const updates = selectedKeysList.map(key => {
                        if (value === 'none') {
                          // Clear center front legend
                          const newFrontLegends = [...(key.frontLegends || ['', '', ''])];
                          newFrontLegends[1] = '';
                          return {
                            id: key.id,
                            changes: { nub: false, frontLegends: newFrontLegends }
                          };
                        } else {
                          // Set center front legend based on selection
                          const newFrontLegends = [...(key.frontLegends || ['', '', ''])];
                          newFrontLegends[1] = value === 'scoop' ? 'Scoop' : 'Bar';
                          return {
                            id: key.id,
                            changes: { nub: true, frontLegends: newFrontLegends }
                          };
                        }
                      });
                      updateKeys(updates);
                      saveToHistory();
                    }}
                  >
                    <option value="none">None</option>
                    <option value="scoop">Scoop</option>
                    <option value="bar">Bar</option>
                  </select>
                </div>
                <div className="property-row checkbox-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={firstKey.ghost || false}
                      onChange={(e) => handleKeyUpdate('ghost', e.target.checked)}
                    />
                    Ghost Key
                  </label>
                </div>
                <div className="property-row checkbox-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={firstKey.decal || false}
                      onChange={(e) => handleKeyUpdate('decal', e.target.checked)}
                    />
                    Decal
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Advanced Properties */}
          <div className="property-section">
            <div className="section-header" onClick={() => toggleSection('advanced')}>
              {expandedSections.advanced ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <span>Advanced</span>
            </div>
            {expandedSections.advanced && firstKey && (
              <div className="section-content">
                <p className="hint">Text colors and sizes per legend position</p>
                <div className="advanced-legends">
                  {firstKey.labels.map((label, index) => {
                    if (!label) return null;
                    return (
                      <div key={index} className="advanced-legend-row">
                        <span className="legend-index">{index}:</span>
                        <input
                          type="color"
                          value={firstKey.textColor?.[index] || '#000000'}
                          onChange={(e) => handleTextColorUpdate(index, e.target.value)}
                        />
                        <input
                          type="number"
                          value={firstKey.textSize?.[index] || 3}
                          onChange={(e) => handleTextSizeUpdate(index, parseInt(e.target.value))}
                          min="1"
                          max="9"
                          title="Text size (1-9)"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}
      
      {showCharPicker && (
        <CharacterPicker
          onSelect={(char) => {
            if (charPickerTarget !== null) {
              handleLegendUpdate(charPickerTarget, firstKey?.labels[charPickerTarget] + char);
            }
          }}
          onClose={() => setShowCharPicker(false)}
        />
      )}
    </div>
  );
};

export default PropertiesPanel;