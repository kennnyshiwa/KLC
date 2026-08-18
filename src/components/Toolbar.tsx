import React from 'react';
import { useKeyboardStore } from '../store/keyboardStoreOptimized';
import {
  Undo2,
  Redo2,
  Copy,
  Clipboard,
  Trash2,
  Maximize2,
  MousePointer2,
  FlipVertical,
  ChevronDown,
} from 'lucide-react';
import { duplicateKey } from '../utils/keyUtils';
import ExportMenu from './ExportMenu';
import AddKeyMenu from './AddKeyMenu';
import ColorMenuBar, { ColorMenuGrid } from './ColorMenuBar';
import MirrorModal from './MirrorModal';
import { Key } from '../types';
import { detectBottomRowTarget, planBottomRowSplitVariant, type BottomRowTargetDetection } from '../utils/bottomRowVariants';
import { getSuggestedSplitOptions, type SplitSuggestionBucket } from '../utils/splitKeySuggestions';

interface ToolbarProps {
  getStage: () => any;
}

const SPLIT_BUCKET_LABELS: Record<SplitSuggestionBucket, string> = {
  common: 'Common',
  reasonable: 'Reasonable',
  cursed: 'Cursed',
};

// Custom selection mode icons
const SelectionModeIcon: React.FC<{ mode: 'touch' | 'enclose' }> = ({ mode }) => {
  if (mode === 'touch') {
    // Icon showing partial overlap selection
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        {/* Selection box */}
        <rect x="2" y="2" width="10" height="10" strokeDasharray="2 2" />
        {/* Key partially inside */}
        <rect x="8" y="8" width="8" height="8" fill="currentColor" opacity="0.3" />
      </svg>
    );
  } else {
    // Icon showing fully enclosed selection
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        {/* Selection box */}
        <rect x="2" y="2" width="14" height="14" strokeDasharray="2 2" />
        {/* Key fully inside */}
        <rect x="5" y="5" width="8" height="8" fill="currentColor" opacity="0.3" />
      </svg>
    );
  }
};

const Toolbar: React.FC<ToolbarProps> = ({ getStage }) => {
  const [activeColorMenu, setActiveColorMenu] = React.useState<'GMK' | 'ABS' | 'PBT' | null>(null);
  const [showMirrorModal, setShowMirrorModal] = React.useState(false);
  const [showBottomRowMenu, setShowBottomRowMenu] = React.useState(false);
  const [pinnedBottomRowTarget, setPinnedBottomRowTarget] = React.useState<BottomRowTargetDetection | null>(null);
  const toolbarContainerRef = React.useRef<HTMLDivElement>(null);
  // Store original labels when Vial mode is enabled
  const originalLabelsRef = React.useRef<Map<string, string[]>>(new Map());
  const selectedKeys = useKeyboardStore((state) => state.selectedKeys);
  const keyboard = useKeyboardStore((state) => state.keyboard);
  const editorSettings = useKeyboardStore((state) => state.editorSettings);
  const hasUnsavedChanges = useKeyboardStore((state) => state.hasUnsavedChanges);
  const multiSelectMode = useKeyboardStore((state) => state.multiSelectMode);
  const undo = useKeyboardStore((state) => state.undo);
  const redo = useKeyboardStore((state) => state.redo);
  const deleteKeys = useKeyboardStore((state) => state.deleteKeys);
  const updateEditorSettings = useKeyboardStore((state) => state.updateEditorSettings);
  const clearSelection = useKeyboardStore((state) => state.clearSelection);
  const selectAll = useKeyboardStore((state) => state.selectAll);
  const saveToHistory = useKeyboardStore((state) => state.saveToHistory);
  const addKey = useKeyboardStore((state) => state.addKey);
  const insertKeysAfterKey = useKeyboardStore((state) => state.insertKeysAfterKey);
  const setMultiSelectMode = useKeyboardStore((state) => state.setMultiSelectMode);
  const updateKeys = useKeyboardStore((state) => state.updateKeys);

  const detectedBottomRowTarget = React.useMemo(() => detectBottomRowTarget(keyboard.keys), [keyboard.keys]);
  const pinnedBottomRowTargetIsValid = React.useMemo(() => {
    if (!pinnedBottomRowTarget) {
      return false;
    }

    return pinnedBottomRowTarget.keys.every((pinnedKey) =>
      keyboard.keys.some((key) => key.id === pinnedKey.id),
    );
  }, [keyboard.keys, pinnedBottomRowTarget]);

  const bottomRowTarget = pinnedBottomRowTargetIsValid ? pinnedBottomRowTarget : detectedBottomRowTarget;

  const bottomRowSuggestions = React.useMemo(
    () => (bottomRowTarget ? getSuggestedSplitOptions(bottomRowTarget.width) : []),
    [bottomRowTarget],
  );

  const bottomRowSuggestionsByBucket = React.useMemo(() => ({
    common: bottomRowSuggestions.filter((suggestion) => suggestion.bucket === 'common'),
    reasonable: bottomRowSuggestions.filter((suggestion) => suggestion.bucket === 'reasonable'),
    cursed: bottomRowSuggestions.filter((suggestion) => suggestion.bucket === 'cursed'),
  }), [bottomRowSuggestions]);

  const handleDelete = () => {
    if (selectedKeys.size > 0) {
      deleteKeys(Array.from(selectedKeys));
      saveToHistory();
    }
  };
  
  const handleDuplicate = () => {
    const selectedKeysList = Array.from(selectedKeys)
      .map(id => keyboard.keys.find(k => k.id === id))
      .filter(Boolean) as any[];
    
    if (selectedKeysList.length === 0) return;
    
    // Find the bottom-most key in the entire layout
    const bottomKey = keyboard.keys.reduce((prev, current) => 
      (prev.y + prev.height > current.y + current.height) ? prev : current
    );
    
    // Calculate new Y position (directly below bottom-most key)
    const newY = bottomKey.y + bottomKey.height;
    
    // Find the topmost selected key to calculate Y offset
    const topmostSelected = selectedKeysList.reduce((prev, current) =>
      (prev.y < current.y) ? prev : current
    );

    selectedKeysList.forEach(key => {
      // Maintain original X position and shift Y position to below the layout
      const targetX = key.x;
      const targetY = key.y - topmostSelected.y + newY;
      const yOffset = targetY - key.y;

      // Since duplicateKey adds offset to key position, we need to subtract key position
      const duplicated = duplicateKey(key, {
        x: targetX - key.x,
        y: yOffset
      });

      // Adjust rotation point if it exists
      if (duplicated.rotation_y !== undefined) {
        duplicated.rotation_y += yOffset;
      }

      addKey(duplicated);
    });
    
    saveToHistory();
  };

  const handleToggleKeySize = () => {
    const newShowKeySize = !editorSettings.showKeySize;
    updateEditorSettings({ showKeySize: newShowKeySize });

    const updates: Array<{ id: string; changes: Partial<Key> }> = [];

    keyboard.keys.forEach(key => {
      // Skip decal keys (LEDs, encoders, row labels)
      if (key.decal) return;

      // Check if key is longer than 1u in either dimension
      if (key.width > 1 || key.height > 1) {
        if (newShowKeySize) {
          // Add size label
          let sizeLabel = '';

          // Determine the label based on key dimensions
          if (key.height > 1 && key.width === 1) {
            // Vertical key (e.g., 1x2)
            sizeLabel = `${key.width}×${key.height}`;
          } else if (key.width > 1 && key.height === 1) {
            // Horizontal key (e.g., 2u, 2.25u)
            sizeLabel = `${key.width}u`;
          } else if (key.width > 1 && key.height > 1) {
            // Both dimensions > 1
            sizeLabel = `${key.width}×${key.height}`;
          }

          if (sizeLabel) {
            // Update the front-center legend (index 1 in frontLegends array)
            const newFrontLegends = [...(key.frontLegends || ['', '', ''])];
            newFrontLegends[1] = sizeLabel;

            updates.push({
              id: key.id,
              changes: {
                frontLegends: newFrontLegends
              }
            });
          }
        } else {
          // Remove size label from front-center position
          if (key.frontLegends?.[1]) {
            const newFrontLegends = [...(key.frontLegends || ['', '', ''])];
            newFrontLegends[1] = '';
            updates.push({
              id: key.id,
              changes: { frontLegends: newFrontLegends }
            });
          }
        }
      }
    });

    if (updates.length > 0) {
      updateKeys(updates);
      saveToHistory();
    }
  };

  const toggleSnap = () => {
    updateEditorSettings({ snapToGrid: !editorSettings.snapToGrid });
  };

  const handleToggleVialMode = () => {
    const newVialMode = !editorSettings.vialMode;
    updateEditorSettings({ vialMode: newVialMode });

    if (newVialMode) {
      // Enabling Vial mode - store original labels and assign matrix positions

      // First, store original labels for all keys
      keyboard.keys.forEach(key => {
        originalLabelsRef.current.set(key.id, [...key.labels]);
      });

      // Group keys by Y position to determine rows
      const rowGroups = new Map<number, Key[]>();
      keyboard.keys.forEach(key => {
        // Round Y to nearest 0.25 for grouping
        const rowY = Math.round(key.y * 4) / 4;
        if (!rowGroups.has(rowY)) {
          rowGroups.set(rowY, []);
        }
        rowGroups.get(rowY)!.push(key);
      });

      // Sort rows by Y position
      const sortedRows = Array.from(rowGroups.entries())
        .sort((a, b) => a[0] - b[0]);

      // Assign matrix positions
      const updates: Array<{ id: string; changes: Partial<Key> }> = [];

      sortedRows.forEach(([, rowKeys], rowIndex) => {
        // Sort keys within row by X position
        const sortedKeys = [...rowKeys].sort((a, b) => a.x - b.x);

        sortedKeys.forEach((key, colIndex) => {
          // Create new labels array with matrix position
          const newLabels = new Array(12).fill('');
          newLabels[0] = `${rowIndex},${colIndex}`; // Matrix position in top-left
          // Note: We don't auto-assign layout options (labels[3]) to avoid overlap on wide keys
          // Users can set these manually per-key if needed for alternative layouts

          updates.push({
            id: key.id,
            changes: { labels: newLabels }
          });
        });
      });

      if (updates.length > 0) {
        updateKeys(updates);
        saveToHistory();
      }
    } else {
      // Disabling Vial mode - restore original labels
      const updates: Array<{ id: string; changes: Partial<Key> }> = [];

      keyboard.keys.forEach(key => {
        const originalLabels = originalLabelsRef.current.get(key.id);
        if (originalLabels) {
          updates.push({
            id: key.id,
            changes: { labels: originalLabels }
          });
        }
      });

      if (updates.length > 0) {
        updateKeys(updates);
        saveToHistory();
      }

      // Clear the stored labels
      originalLabelsRef.current.clear();
    }
  };
  
  // Close color menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (toolbarContainerRef.current && !toolbarContainerRef.current.contains(event.target as Node)) {
        setActiveColorMenu(null);
        setShowBottomRowMenu(false);
      }
    };

    if (activeColorMenu || showBottomRowMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [activeColorMenu, showBottomRowMenu]);

  React.useEffect(() => {
    if (!showBottomRowMenu) {
      if (pinnedBottomRowTarget) {
        setPinnedBottomRowTarget(null);
      }
      return;
    }

    if (!pinnedBottomRowTarget) {
      if (detectedBottomRowTarget) {
        setPinnedBottomRowTarget(detectedBottomRowTarget);
      }
      return;
    }

    if (!pinnedBottomRowTargetIsValid) {
      setPinnedBottomRowTarget(detectedBottomRowTarget ?? null);
    }
  }, [detectedBottomRowTarget, pinnedBottomRowTarget, pinnedBottomRowTargetIsValid, showBottomRowMenu]);

  const handleApplyBottomRowSuggestion = (widths: number[]) => {
    if (!bottomRowTarget) {
      return;
    }

    setPinnedBottomRowTarget(bottomRowTarget);
    const plan = planBottomRowSplitVariant(keyboard, bottomRowTarget, widths);
    insertKeysAfterKey(plan.insertAfterKeyId, plan.appendedKeys);
  };

  return (
    <div className="toolbar-container" ref={toolbarContainerRef}>
      <div className="toolbar">
        <div className="toolbar-group">
          <button onClick={undo} className="toolbar-btn" title="Undo (Ctrl+Z)">
            <Undo2 size={18} />
          </button>
          <button onClick={redo} className="toolbar-btn" title="Redo (Ctrl+Y)">
            <Redo2 size={18} />
          </button>
        </div>
        
        <div className="toolbar-separator" />
        
        <div className="toolbar-group">
          <AddKeyMenu />
          <button
            onClick={handleDuplicate}
            className="toolbar-btn"
            disabled={selectedKeys.size === 0}
            title="Duplicate Selected"
          >
            <Copy size={18} />
          </button>
          <button
            onClick={handleDelete}
            className="toolbar-btn"
            disabled={selectedKeys.size === 0}
            title="Delete Selected"
          >
            <Trash2 size={18} />
          </button>
        </div>
        
        <div className="toolbar-separator" />
        
        <div className="toolbar-group">
          <button onClick={clearSelection} className="toolbar-btn" title="Clear Selection">
            <Maximize2 size={18} />
          </button>
          <button onClick={selectAll} className="toolbar-btn" title="Select All (Ctrl+A)">
            <Clipboard size={18} />
          </button>
          <button 
            onClick={() => setMultiSelectMode(!multiSelectMode)} 
            className={`toolbar-btn ${multiSelectMode ? 'active' : ''}`}
            title="Multi-select Mode (for touch devices)"
          >
            <MousePointer2 size={18} />
          </button>
          <button 
            onClick={() => updateEditorSettings({ 
              selectionMode: editorSettings.selectionMode === 'touch' ? 'enclose' : 'touch' 
            })} 
            className="toolbar-btn toolbar-btn-with-text"
            title={editorSettings.selectionMode === 'touch' 
              ? "Touch Mode: Select keys that touch selection box (Click for Enclose mode)" 
              : "Enclose Mode: Select only fully enclosed keys (Click for Touch mode)"}
            style={{ minWidth: '80px', gap: '4px' }}
          >
            <SelectionModeIcon mode={editorSettings.selectionMode || 'touch'} />
            <span style={{ fontSize: '11px' }}>
              {editorSettings.selectionMode === 'touch' ? 'Touch' : 'Enclose'}
            </span>
          </button>
        </div>
        
        <div className="toolbar-separator" />
        
        <div className="toolbar-group">
          <button 
            onClick={toggleSnap} 
            className={`toolbar-btn ${editorSettings.snapToGrid ? 'active' : ''}`}
            title="Toggle Snap to Grid"
          >
            Snap
          </button>
          <button 
            onClick={() => updateEditorSettings({ showStabilizerPositions: !editorSettings.showStabilizerPositions })} 
            className={`toolbar-btn ${editorSettings.showStabilizerPositions ? 'active' : ''}`}
            title="Show Stabilizer Positions"
          >
            Stabs
          </button>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowBottomRowMenu((current) => !current)}
              className={`toolbar-btn toolbar-btn-with-text toolbar-dropdown-btn ${showBottomRowMenu ? 'active' : ''}`}
              title="Suggest bottom-row split variants"
              style={{ minWidth: '98px' }}
            >
              <span>Bottom Row</span>
              <ChevronDown size={12} />
            </button>

            {showBottomRowMenu && (
              <div className="menu-dropdown" onClick={(event) => event.stopPropagation()}>
                <div style={{ padding: '10px 12px', minWidth: '320px', maxWidth: '360px' }}>
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                      marginBottom: '6px',
                      opacity: 0.8,
                      textTransform: 'uppercase',
                    }}
                  >
                    Detected target
                  </div>

                  {bottomRowTarget ? (
                    <>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>{bottomRowTarget.summary}</div>
                      <div style={{ fontSize: '11px', lineHeight: 1.4, opacity: 0.75, marginTop: '4px' }}>
                        {bottomRowTarget.reason}
                      </div>

                      {(['common', 'reasonable', 'cursed'] as SplitSuggestionBucket[]).map((bucket) => {
                        const suggestions = bottomRowSuggestionsByBucket[bucket];

                        if (suggestions.length === 0) {
                          return null;
                        }

                        return (
                          <div key={bucket} style={{ marginTop: '14px' }}>
                            <div
                              style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                letterSpacing: '0.04em',
                                marginBottom: '6px',
                                opacity: 0.8,
                                textTransform: 'uppercase',
                              }}
                            >
                              {SPLIT_BUCKET_LABELS[bucket]}
                            </div>

                            <div style={{ display: 'grid', gap: '6px' }}>
                              {suggestions.map((suggestion) => (
                                <button
                                  key={suggestion.id}
                                  className="menu-dropdown-item"
                                  onClick={() => handleApplyBottomRowSuggestion(suggestion.widths)}
                                  title={suggestion.reason}
                                  style={{
                                    width: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'flex-start',
                                    gap: '2px',
                                    whiteSpace: 'normal',
                                  }}
                                >
                                  <span>{suggestion.label}</span>
                                  <span style={{ fontSize: '11px', opacity: 0.7, textAlign: 'left' }}>
                                    {suggestion.reason}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    <div style={{ fontSize: '12px', lineHeight: 1.4, opacity: 0.75 }}>
                      No compatible bottom-row anchor detected yet. Add a wide horizontal key first.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => {
              const newKrkMode = !editorSettings.krkMode;
              updateEditorSettings({ krkMode: newKrkMode });

              // Auto-populate row positions when enabling KRK mode
              if (newKrkMode && keyboard.keys.length > 0) {
                // Check if any keys already have row positions (imported KRK data)
                const hasExistingRowPositions = keyboard.keys.some(key => key.rowPosition);

                if (!hasExistingRowPositions) {
                  // Only auto-populate if no row positions exist
                  // Group keys by Y position
                  const rows = new Map<number, typeof keyboard.keys>();
                  keyboard.keys.forEach(key => {
                    const row = Math.floor(key.y);
                    if (!rows.has(row)) {
                      rows.set(row, []);
                    }
                    rows.get(row)!.push(key);
                  });

                  // Sort rows and assign row positions
                  const sortedRows = Array.from(rows.entries()).sort((a, b) => a[0] - b[0]);
                  const updates: Array<{ id: string; changes: Partial<Key> }> = [];

                  sortedRows.forEach(([, rowKeys], index) => {
                    // Only assign K1-K6, leave anything beyond row 6 blank
                    if (index < 6) {
                      const rowPosition = `K${index + 1}`;
                      rowKeys.forEach(key => {
                        // Only set if not already set
                        if (!key.rowPosition) {
                          updates.push({
                            id: key.id,
                            changes: { rowPosition }
                          });
                        }
                      });
                    }
                    // Keys in row 7+ are left blank for user to decide (alternative keys)
                  });

                  if (updates.length > 0) {
                    const updateKeys = useKeyboardStore.getState().updateKeys;
                    updateKeys(updates);
                    saveToHistory();
                  }
                }
              }
            }}
            className={`toolbar-btn ${editorSettings.krkMode ? 'active' : ''}`}
            title="Enable KRK mode (adds row position data)"
          >
            KRK
          </button>
          <button
            onClick={handleToggleKeySize}
            className={`toolbar-btn ${editorSettings.showKeySize ? 'active' : ''}`}
            title="Toggle size labels on keys > 1u (front legend)"
          >
            Size
          </button>
          <button
            onClick={handleToggleVialMode}
            className={`toolbar-btn ${editorSettings.vialMode ? 'active' : ''}`}
            title="Toggle Vial matrix position labels (replaces all legends)"
          >
            Vial
          </button>
          <button
            onClick={() => setShowMirrorModal(true)}
            className="toolbar-btn"
            disabled={selectedKeys.size === 0}
            title="Mirror Selected Keys"
          >
            <FlipVertical size={18} />
          </button>
        </div>
        
        <div className="toolbar-separator" />
        
        <ColorMenuBar activeMenu={activeColorMenu} setActiveMenu={setActiveColorMenu} />
        
        <div className="toolbar-separator" />
        
        <ExportMenu getStage={getStage} />
        
        <div className="toolbar-spacer" />
        
        <div className="toolbar-info">
          {hasUnsavedChanges && <span style={{ color: '#ff6b6b', marginRight: '8px' }}>• Unsaved changes</span>}
          {selectedKeys.size > 0 ? `${selectedKeys.size} selected` : 'Ready'}
        </div>
      </div>
      <ColorMenuGrid activeMenu={activeColorMenu} />
      {showMirrorModal && <MirrorModal onClose={() => setShowMirrorModal(false)} />}
    </div>
  );
};

export default Toolbar;
