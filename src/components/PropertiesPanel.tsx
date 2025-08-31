import React, { useState, useEffect } from 'react';
import { useKeyboardStore } from '../store/keyboardStoreOptimized';
import { Key, KeyProfile } from '../types';
import { ChevronDown, ChevronRight, ChevronLeft, Type } from 'lucide-react';
import ColorPicker from './ColorPicker';
import CharacterPicker from './CharacterPicker';
import IconDropdown from './IconDropdown';

const PROFILES: KeyProfile[] = ['DCS', 'DSA', 'SA', 'OEM', 'CHICKLET', 'FLAT', 'XDA', 'MA'];

// Available fonts for legends
const AVAILABLE_FONTS = [
  { value: '', label: 'Default (Arial)' },
  { value: 'trashcons', label: 'Icons (Trashcons)' },
  { value: 'GortonPerfected', label: 'Gorton Perfected' }
];

// Helper to determine if a key has dual legends that should be shown as top/bottom
const hasDualLegendAlignment = (key: Key): boolean => {
  // Check if the key has horizontal centering enabled and a dual legend in position 0
  return key.align !== undefined && 
         (key.align & 0x01) !== 0 && 
         !!key.labels[0] && 
         key.labels[0].includes('\n');
};

// Helper to get the dual legend parts
const getDualLegendParts = (label: string): [string, string] => {
  const parts = label.split('\n');
  return [parts[0] || '', parts[1] || ''];
};

interface PropertiesPanelProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ isCollapsed = false, onToggleCollapse }) => {
  const selectedKeys = useKeyboardStore((state) => state.selectedKeys);
  const keyboard = useKeyboardStore((state) => state.keyboard);
  const updateKeys = useKeyboardStore((state) => state.updateKeys);
  const updateMetadata = useKeyboardStore((state) => state.updateMetadata);
  const saveToHistory = useKeyboardStore((state) => state.saveToHistory);
  const editorSettings = useKeyboardStore((state) => state.editorSettings);
  
  const [expandedSections, setExpandedSections] = useState({
    keyboard: true,
    position: true,
    rotation: true,
    size: true,
    sizeAdvanced: false,
    legends: true,
    legendStyle: true,
    appearance: true,
    advanced: false,
  });
  const [showCharPicker, setShowCharPicker] = useState(false);
  const [charPickerTarget, setCharPickerTarget] = useState<number | null>(null);
  const [activeLegendField, setActiveLegendField] = useState<number | null>(null);
  const setIsSettingRotationPoint = useKeyboardStore((state) => state.setIsSettingRotationPoint);
  const isRotationSectionExpanded = useKeyboardStore((state) => state.isRotationSectionExpanded);
  const setIsRotationSectionExpanded = useKeyboardStore((state) => state.setIsRotationSectionExpanded);
  
  // Local state for position inputs to allow temporary empty values
  const [localX, setLocalX] = useState<string>('');
  const [localY, setLocalY] = useState<string>('');

  const selectedKeysList = Array.from(selectedKeys)
    .map(id => keyboard.keys.find(k => k.id === id))
    .filter(Boolean) as Key[];

  const firstKey = selectedKeysList[0];
  
  // Check if the selected key is a row label (decal + ghost + transparent)
  const isRowLabel = firstKey && firstKey.decal && firstKey.ghost && firstKey.color === 'transparent';
  
  // Check if the selected key is an LED indicator
  const isLED = firstKey && firstKey.profile === 'LED';
  
  // Check if the selected key is an encoder
  const isEncoder = firstKey && firstKey.profile === 'ENCODER';
  
  // Sync local state with key values when selection changes
  useEffect(() => {
    if (firstKey) {
      setLocalX(firstKey.x.toString());
      setLocalY(firstKey.y.toString());
    }
    // Reset active legend field when selection changes
    setActiveLegendField(null);
  }, [firstKey?.id, firstKey?.x, firstKey?.y]);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleKeyUpdate = (field: keyof Key, value: any, allowEmpty: boolean = false) => {
    // Skip update if value is invalid (unless explicitly allowed)
    if (!allowEmpty && (value === '' || (typeof value === 'number' && isNaN(value)))) {
      return;
    }
    
    // Special handling for position changes when multiple keys are selected
    if ((field === 'x' || field === 'y') && typeof value === 'number' && selectedKeysList.length > 1) {
      // Calculate the offset from the first selected key
      const referenceKey = selectedKeysList[0];
      const offset = value - referenceKey[field];
      
      // Apply the same offset to all selected keys to maintain relative positions
      const updates = selectedKeysList.map(key => ({
        id: key.id,
        changes: { [field]: key[field] + offset }
      }));
      
      updateKeys(updates);
      saveToHistory();
    }
    // Special handling for width changes to prevent collisions
    else if (field === 'width' && typeof value === 'number') {
      const allUpdates: Array<{ id: string; changes: Partial<Key> }> = [];
      
      // First, add the width updates for selected keys
      selectedKeysList.forEach(key => {
        allUpdates.push({
          id: key.id,
          changes: { width: value }
        });
      });
      
      // For each selected key, check if we need to move keys to the right
      selectedKeysList.forEach(selectedKey => {
        const widthDiff = value - selectedKey.width;
        if (widthDiff > 0) {
          // Key is getting wider, need to shift the entire row
          const selectedKeyRow = selectedKey.y;
          const selectedKeyOriginalRight = selectedKey.x + selectedKey.width;
          
          // Find all keys in the same row that are to the right of this key
          const keysToMove = keyboard.keys.filter(key => {
            // Don't move selected keys
            if (selectedKeys.has(key.id)) return false;
            
            // Check if key is in the same row (within 0.1 units tolerance)
            const sameRow = Math.abs(key.y - selectedKeyRow) < 0.1;
            
            // Check if key starts at or after the right edge of the selected key
            const toTheRight = key.x >= selectedKeyOriginalRight - 0.1;
            
            return sameRow && toTheRight;
          });
          
          // Move all keys to the right of the selected key by the width difference
          keysToMove.forEach(key => {
            allUpdates.push({
              id: key.id,
              changes: { x: key.x + widthDiff }
            });
          });
        }
      });
      
      updateKeys(allUpdates);
      saveToHistory();
    } else {
      // Normal update for other fields
      const updates = selectedKeysList.map(key => ({
        id: key.id,
        changes: { [field]: value }
      }));
      updateKeys(updates);
      saveToHistory();
    }
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


  const getRotationMode = () => {
    if (!firstKey) return 'key-center';
    
    // If rotation center is not set, it's key-center mode
    if (firstKey.rotation_x === undefined || firstKey.rotation_y === undefined) {
      return 'key-center';
    }
    
    // Check if it's at group center
    if (selectedKeysList.length > 1) {
      const bounds = getSelectionBounds(selectedKeysList);
      const groupCenterX = bounds.x + bounds.width / 2;
      const groupCenterY = bounds.y + bounds.height / 2;
      
      if (Math.abs(firstKey.rotation_x - groupCenterX) < 0.01 && 
          Math.abs(firstKey.rotation_y - groupCenterY) < 0.01) {
        return 'group-center';
      }
    }
    
    // Otherwise it's custom
    return 'custom';
  };

  const getSelectionBounds = (keys: Key[]) => {
    if (keys.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    keys.forEach(key => {
      minX = Math.min(minX, key.x);
      minY = Math.min(minY, key.y);
      maxX = Math.max(maxX, key.x + key.width);
      maxY = Math.max(maxY, key.y + key.height);
    });
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  };

  const handleRotationModeChange = (mode: string) => {
    let updates: { id: string; changes: Partial<Key> }[] = [];
    
    if (mode === 'key-center') {
      // Clear rotation center to use key center by default
      updates = selectedKeysList.map(key => ({
        id: key.id,
        changes: {
          rotation_x: undefined,
          rotation_y: undefined
        }
      }));
    } else if (mode === 'group-center') {
      // Set rotation center to group center
      const bounds = getSelectionBounds(selectedKeysList);
      const centerX = bounds.x + bounds.width / 2;
      const centerY = bounds.y + bounds.height / 2;
      
      updates = selectedKeysList.map(key => ({
        id: key.id,
        changes: {
          rotation_x: centerX,
          rotation_y: centerY
        }
      }));
    } else if (mode === 'custom') {
      // For custom mode, set the rotation point to current key center if not already set
      updates = selectedKeysList.map(key => ({
        id: key.id,
        changes: {
          rotation_x: key.rotation_x !== undefined ? key.rotation_x : key.x + key.width / 2,
          rotation_y: key.rotation_y !== undefined ? key.rotation_y : key.y + key.height / 2
        }
      }));
    }
    
    if (updates.length > 0) {
      updateKeys(updates);
      saveToHistory();
    }
  };

  const handleSetRotationPoint = () => {
    // This triggers a visual mode where user can click to set rotation point
    setIsSettingRotationPoint(true);
  };

  if (isCollapsed) {
    return (
      <div className="properties-panel collapsed">
        <button 
          className="expand-button"
          onClick={onToggleCollapse}
          title="Expand panel"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    );
  }

  return (
    <div className="properties-panel">
      <div className="properties-panel-header">
        <h3>Properties</h3>
        {onToggleCollapse && (
          <button 
            className="collapse-button"
            onClick={onToggleCollapse}
            title="Collapse panel"
          >
            <ChevronLeft size={18} />
          </button>
        )}
      </div>
      
      
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
                value={keyboard?.meta?.name || ''}
                onChange={(e) => updateMetadata({ name: e.target.value })}
                placeholder="Keyboard name"
              />
            </div>
            <div className="property-row">
              <label>Author</label>
              <input
                type="text"
                value={keyboard?.meta?.author || ''}
                onChange={(e) => updateMetadata({ author: e.target.value })}
                placeholder="Author name"
              />
            </div>
            <div className="property-row">
              <label>Notes</label>
              <textarea
                value={keyboard?.meta?.notes || ''}
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
            {isRowLabel && <span className="row-label-indicator"> (Row Label)</span>}
            {isLED && <span className="led-indicator"> (LED Indicator)</span>}
            {isEncoder && <span className="encoder-indicator"> (Rotary Encoder)</span>}
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
                      value={localX}
                      onChange={(e) => {
                        const value = e.target.value;
                        setLocalX(value);
                        if (value !== '' && !isNaN(parseFloat(value))) {
                          handleKeyUpdate('x', parseFloat(value));
                        }
                      }}
                      onBlur={(e) => {
                        const value = e.target.value;
                        if (value === '' || isNaN(parseFloat(value))) {
                          alert('X position must be a valid number.');
                          setLocalX(firstKey.x.toString());
                        }
                      }}
                      step="0.25"
                    />
                  </div>
                  <div className="property-field">
                    <label>Y</label>
                    <input
                      type="number"
                      value={localY}
                      onChange={(e) => {
                        const value = e.target.value;
                        setLocalY(value);
                        if (value !== '' && !isNaN(parseFloat(value))) {
                          handleKeyUpdate('y', parseFloat(value));
                        }
                      }}
                      onBlur={(e) => {
                        const value = e.target.value;
                        if (value === '' || isNaN(parseFloat(value))) {
                          alert('Y position must be a valid number.');
                          setLocalY(firstKey.y.toString());
                        }
                      }}
                      step="0.25"
                    />
                  </div>
                </div>
                {/* Rotation properties moved to dedicated section */}
              </div>
            )}
          </div>

          {/* Rotation Properties - Hidden for row labels, LEDs, and encoders */}
          {!isRowLabel && !isLED && !isEncoder && (
          <div className="property-section">
            <div className="section-header" onClick={() => setIsRotationSectionExpanded(!isRotationSectionExpanded)}>
              {isRotationSectionExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <span>Rotation</span>
            </div>
            {isRotationSectionExpanded && firstKey && (
              <div className="section-content">
                <div className="property-row">
                  <label>Angle (degrees)</label>
                  <input
                    type="number"
                    value={firstKey.rotation_angle || 0}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value !== '') {
                        handleKeyUpdate('rotation_angle', parseFloat(value));
                      }
                    }}
                    step="15"
                    min="-180"
                    max="180"
                  />
                </div>
                
                <div className="property-row">
                  <label>Rotation Center</label>
                  <select
                    value={getRotationMode()}
                    onChange={(e) => handleRotationModeChange(e.target.value)}
                  >
                    <option value="key-center">Key Center</option>
                    {selectedKeysList.length > 1 && (
                      <option value="group-center">Selection Center</option>
                    )}
                    <option value="custom">Custom Point</option>
                  </select>
                </div>
                
                {getRotationMode() === 'custom' && (
                  <div className="property-row-dual">
                    <div className="property-field">
                      <label>Center X</label>
                      <input
                        type="number"
                        value={firstKey.rotation_x !== undefined ? firstKey.rotation_x : ''}
                        placeholder={(firstKey.x + firstKey.width / 2).toFixed(2)}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '') {
                            // Allow clearing to 0
                            handleKeyUpdate('rotation_x', 0);
                          } else {
                            const numValue = parseFloat(value);
                            if (!isNaN(numValue)) {
                              handleKeyUpdate('rotation_x', numValue);
                            }
                          }
                        }}
                        step="0.25"
                      />
                    </div>
                    <div className="property-field">
                      <label>Center Y</label>
                      <input
                        type="number"
                        value={firstKey.rotation_y !== undefined ? firstKey.rotation_y : ''}
                        placeholder={(firstKey.y + firstKey.height / 2).toFixed(2)}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '') {
                            // Allow clearing to 0
                            handleKeyUpdate('rotation_y', 0);
                          } else {
                            const numValue = parseFloat(value);
                            if (!isNaN(numValue)) {
                              handleKeyUpdate('rotation_y', numValue);
                            }
                          }
                        }}
                        step="0.25"
                      />
                    </div>
                  </div>
                )}
                
                <div className="property-row">
                  <button 
                    className="btn btn-sm btn-secondary"
                    onClick={() => handleSetRotationPoint()}
                  >
                    Set Rotation Point Visually
                  </button>
                </div>
                
                {firstKey.rotation_angle !== undefined && firstKey.rotation_angle !== 0 && (
                  <div className="property-row">
                    <button 
                      className="btn btn-sm btn-danger"
                      onClick={() => {
                        const updates = selectedKeysList.map(key => ({
                          id: key.id,
                          changes: { 
                            rotation_angle: undefined,
                            rotation_x: undefined,
                            rotation_y: undefined
                          }
                        }));
                        updateKeys(updates);
                        saveToHistory();
                      }}
                    >
                      Clear Rotation
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          )}

          {/* Size Properties - Hidden for row labels, LEDs, and encoders */}
          {!isRowLabel && !isLED && !isEncoder && (
          <div className="property-section">
            <div className="section-header" onClick={() => toggleSection('size')}>
              {expandedSections.size ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <span>Size</span>
            </div>
            {expandedSections.size && firstKey && (
              <div className="section-content">
                <div className="property-row-dual">
                  <div className="property-field">
                    <label>Width</label>
                    <input
                      type="number"
                      value={firstKey.width}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value !== '') {
                          handleKeyUpdate('width', parseFloat(value));
                        }
                      }}
                      onBlur={(e) => {
                        const value = e.target.value;
                        if (value === '' || parseFloat(value) <= 0) {
                          alert('Width must be greater than 0. Reverting to previous value.');
                          e.target.value = firstKey.width.toString();
                        }
                      }}
                      step="0.25"
                      min="0.25"
                    />
                  </div>
                  <div className="property-field">
                    <label>Height</label>
                    <input
                      type="number"
                      value={firstKey.height}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value !== '') {
                          handleKeyUpdate('height', parseFloat(value));
                        }
                      }}
                      onBlur={(e) => {
                        const value = e.target.value;
                        if (value === '' || parseFloat(value) <= 0) {
                          alert('Height must be greater than 0. Reverting to previous value.');
                          e.target.value = firstKey.height.toString();
                        }
                      }}
                      step="0.25"
                      min="0.25"
                    />
                  </div>
                </div>
                
                {/* Advanced Size Options - Special Keys */}
                <div className="property-subsection" style={{ marginTop: '12px' }}>
                  <div 
                    className="subsection-header" 
                    onClick={() => toggleSection('sizeAdvanced')}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '4px', 
                      cursor: 'pointer',
                      padding: '4px 0',
                      userSelect: 'none'
                    }}
                  >
                    {expandedSections.sizeAdvanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <span style={{ fontSize: '12px', color: '#888' }}>Advanced (Special Keys)</span>
                  </div>
                  {expandedSections.sizeAdvanced && (
                    <>
                      <div className="property-row">
                        <p className="hint" style={{ fontSize: '11px', marginBottom: '8px' }}>
                          Create custom special keys like ISO Enter or Big Ass Enter by defining a secondary rectangle.
                        </p>
                      </div>
                      <div className="property-row-dual">
                        <div className="property-field">
                          <label>X2 Offset</label>
                          <input
                            type="number"
                            value={firstKey.x2 || 0}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value !== '') {
                                handleKeyUpdate('x2', parseFloat(value));
                              }
                            }}
                            step="0.25"
                          />
                        </div>
                        <div className="property-field">
                          <label>Y2 Offset</label>
                          <input
                            type="number"
                            value={firstKey.y2 || 0}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value !== '') {
                                handleKeyUpdate('y2', parseFloat(value));
                              }
                            }}
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
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value !== '') {
                                handleKeyUpdate('width2', parseFloat(value));
                              }
                            }}
                            step="0.25"
                          />
                        </div>
                        <div className="property-field">
                          <label>Height2</label>
                          <input
                            type="number"
                            value={firstKey.height2 || 0}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value !== '') {
                                handleKeyUpdate('height2', parseFloat(value));
                              }
                            }}
                            step="0.25"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
          )}

          {/* Legend Properties - Hidden for row labels, LEDs, and encoders */}
          {!isRowLabel && !isLED && !isEncoder && (
          <div className="property-section">
            <div className="section-header" onClick={() => toggleSection('legends')}>
              {expandedSections.legends ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <span>Legends</span>
            </div>
            {expandedSections.legends && firstKey && (
              <div className="section-content" onClick={(e) => {
                // Clear active legend field if clicking outside a legend field
                if ((e.target as HTMLElement).closest('.legend-field') === null) {
                  setActiveLegendField(null);
                }
              }}>
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
                          <div 
                            key={index} 
                            className="legend-field"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveLegendField(index);
                            }}
                          >
                            <input
                              type="text"
                              value={topPart}
                              onChange={(e) => {
                                const [, bottomPart] = getDualLegendParts(firstKey.labels[0]);
                                handleLegendUpdate(0, `${e.target.value}\n${bottomPart}`);
                              }}
                              onFocus={() => {
                                setCharPickerTarget(index);
                                setActiveLegendField(index);
                              }}
                              placeholder={label}
                            />
                            {charPickerTarget === index && (
                              <IconDropdown 
                                currentValue={topPart}
                                onChange={(value) => {
                                  const [, bottomPart] = getDualLegendParts(firstKey.labels[0]);
                                  handleLegendUpdate(0, `${value}\n${bottomPart}`);
                                }}
                                onIconAdded={() => handleIconAdded(10)}
                              />
                            )}
                            {activeLegendField === index && topPart && (
                              <div className="legend-size-selector">
                                <label>Size:</label>
                                <input
                                  type="number"
                                  value={firstKey.textSize?.[10] || firstKey.default?.size?.[0] || 3}
                                  onChange={(e) => {
                                    const size = parseInt(e.target.value) || 3;
                                    const updates = selectedKeysList.map(key => {
                                      const newSizes = [...(key.textSize || [])];
                                      // Ensure array is long enough
                                      while (newSizes.length <= 10) {
                                        newSizes.push(key.default?.size?.[0] || 3);
                                      }
                                      newSizes[10] = size;
                                      return {
                                        id: key.id,
                                        changes: { textSize: newSizes }
                                      };
                                    });
                                    updateKeys(updates);
                                    saveToHistory();
                                  }}
                                  min="1"
                                  max="9"
                                  step="1"
                                />
                              </div>
                            )}
                          </div>
                        );
                      }
                      // For bottom center (index 11) show the second part of the dual legend
                      else if (index === 11) {
                        const [, bottomPart] = getDualLegendParts(firstKey.labels[0]);
                        return (
                          <div 
                            key={index} 
                            className="legend-field"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveLegendField(index);
                            }}
                          >
                            <input
                              type="text"
                              value={bottomPart}
                              onChange={(e) => {
                                const [topPart] = getDualLegendParts(firstKey.labels[0]);
                                handleLegendUpdate(0, `${topPart}\n${e.target.value}`);
                              }}
                              onFocus={() => {
                                setCharPickerTarget(index);
                                setActiveLegendField(index);
                              }}
                              placeholder={label}
                            />
                            {charPickerTarget === index && (
                              <IconDropdown 
                                currentValue={bottomPart}
                                onChange={(value) => {
                                  const [topPart] = getDualLegendParts(firstKey.labels[0]);
                                  handleLegendUpdate(0, `${topPart}\n${value}`);
                                }}
                                onIconAdded={() => handleIconAdded(11)}
                              />
                            )}
                            {activeLegendField === index && bottomPart && (
                              <div className="legend-size-selector">
                                <label>Size:</label>
                                <input
                                  type="number"
                                  value={firstKey.textSize?.[11] || firstKey.default?.size?.[0] || 3}
                                  onChange={(e) => {
                                    const size = parseInt(e.target.value) || 3;
                                    const updates = selectedKeysList.map(key => {
                                      const newSizes = [...(key.textSize || [])];
                                      // Ensure array is long enough
                                      while (newSizes.length <= 11) {
                                        newSizes.push(key.default?.size?.[0] || 3);
                                      }
                                      newSizes[11] = size;
                                      return {
                                        id: key.id,
                                        changes: { textSize: newSizes }
                                      };
                                    });
                                    updateKeys(updates);
                                    saveToHistory();
                                  }}
                                  min="1"
                                  max="9"
                                  step="1"
                                />
                              </div>
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
                    <div 
                      key={index} 
                      className="legend-field"
                      onClick={() => setActiveLegendField(index)}
                    >
                      <input
                        type="text"
                        value={firstKey.labels[index] || ''}
                        onChange={(e) => handleLegendUpdate(index, e.target.value)}
                        onFocus={() => {
                          setCharPickerTarget(index);
                          setActiveLegendField(index);
                        }}
                        placeholder={label}
                      />
                      {charPickerTarget === index && (
                        <>
                          <IconDropdown 
                            currentValue={firstKey.labels[index] || ''}
                            onChange={(value) => handleLegendUpdate(index, value)}
                            onIconAdded={() => handleIconAdded(index)}
                          />
                        </>
                      )}
                      {/* Show size selector when this field is active and has content */}
                      {activeLegendField === index && firstKey.labels[index] && (
                        <div className="legend-size-selector">
                          <label>Size:</label>
                          <input
                            type="number"
                            value={firstKey.textSize?.[index] || firstKey.default?.size?.[0] || 3}
                            onChange={(e) => {
                              const size = parseInt(e.target.value) || 3;
                              const updates = selectedKeysList.map(key => {
                                const newSizes = [...(key.textSize || [])];
                                // Ensure array is long enough
                                while (newSizes.length <= index) {
                                  newSizes.push(key.default?.size?.[0] || 3);
                                }
                                newSizes[index] = size;
                                return {
                                  id: key.id,
                                  changes: { textSize: newSizes }
                                };
                              });
                              updateKeys(updates);
                              saveToHistory();
                            }}
                            min="1"
                            max="9"
                            step="1"
                          />
                        </div>
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
          )}

          {/* Appearance Properties - Hidden for row labels, shown for LEDs for color */}
          {!isRowLabel && (
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
                  <label>{editorSettings.krkMode ? 'Row Position' : 'Profile'}</label>
                  {editorSettings.krkMode ? (
                    <input
                      type="text"
                      value={firstKey.rowPosition || ''}
                      onChange={(e) => handleKeyUpdate('rowPosition', e.target.value)}
                      placeholder="e.g., K1, K2, K3..."
                    />
                  ) : (
                    <select
                      value={firstKey.profile || 'DCS'}
                      onChange={(e) => handleKeyUpdate('profile', e.target.value as KeyProfile)}
                    >
                      {PROFILES.map(profile => (
                        <option key={profile} value={profile}>{profile}</option>
                      ))}
                    </select>
                  )}
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
                    value={(() => {
                      if (!firstKey.nub) return 'none';
                      const frontLegend = firstKey.frontLegends?.[1]?.toLowerCase();
                      if (frontLegend === 'bar') return 'bar';
                      if (frontLegend === 'scoop') return 'scoop';
                      return 'none';
                    })()}
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
          )}

          {/* Legend Style Properties - Hidden for row labels */}
          {!isRowLabel && (
          <div className="property-section">
            <div className="section-header" onClick={() => toggleSection('legendStyle')}>
              {expandedSections.legendStyle ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <span>Legend Style</span>
            </div>
            {expandedSections.legendStyle && firstKey && (
              <div className="section-content">
                {/* Font selection */}
                <div className="property-row">
                  <label>Font</label>
                  <select
                    value={firstKey.font || ''}
                    onChange={(e) => handleKeyUpdate('font', e.target.value)}
                  >
                    {AVAILABLE_FONTS.map(font => (
                      <option key={font.value} value={font.value}>
                        {font.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Default text size */}
                <div className="property-row">
                  <label>Default Size</label>
                  <input
                    type="number"
                    value={firstKey.default?.size?.[0] || 3}
                    onChange={(e) => {
                      const size = parseInt(e.target.value);
                      const updates = selectedKeysList.map(key => ({
                        id: key.id,
                        changes: { 
                          default: {
                            ...key.default,
                            size: [size]
                          }
                        }
                      }));
                      updateKeys(updates);
                      saveToHistory();
                    }}
                    min="1"
                    max="9"
                    title="Default text size (1-9)"
                  />
                </div>
                
                {/* Default text color with color picker */}
                <div className="property-row">
                  <label>Default Color</label>
                  <ColorPicker
                    value={firstKey.textColor?.[0] || '#000000'}
                    onChange={(color) => {
                      const updates = selectedKeysList.map(key => ({
                        id: key.id,
                        changes: { 
                          textColor: [color]
                        }
                      }));
                      updateKeys(updates);
                      saveToHistory();
                    }}
                  />
                </div>
                
                {/* Legend rotation */}
                <div className="property-row">
                  <label>Legend Rotation</label>
                  <p className="hint">Set rotation angle for each legend position (in degrees)</p>
                </div>
                
                {/* Show rotation inputs for each legend that has text */}
                {firstKey.labels.map((label, index) => {
                  if (!label) return null;
                  const positionMap: { [key: number]: string } = {
                    0: 'TL', 10: 'TC', 2: 'TR',
                    7: 'ML', 8: 'MC', 9: 'MR',
                    1: 'BL', 11: 'BC', 3: 'BR',
                    4: 'FL', 5: 'FC', 6: 'FR'
                  };
                  
                  return (
                    <div key={index} className="property-row-dual">
                      <div className="property-field">
                        <label>{positionMap[index] || `Pos ${index}`}: {label.substring(0, 10)}{label.length > 10 ? '...' : ''}</label>
                        <input
                          type="number"
                          value={firstKey.legendRotation?.[index] || 0}
                          onChange={(e) => {
                            const rotation = parseFloat(e.target.value) || 0;
                            const updates = selectedKeysList.map(key => {
                              const newRotation = [...(key.legendRotation || [])];
                              // Ensure array is long enough
                              while (newRotation.length <= index) {
                                newRotation.push(0);
                              }
                              newRotation[index] = rotation;
                              return {
                                id: key.id,
                                changes: { legendRotation: newRotation }
                              };
                            });
                            updateKeys(updates);
                            saveToHistory();
                          }}
                          step="15"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          )}
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