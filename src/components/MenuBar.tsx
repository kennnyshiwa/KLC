import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useKeyboardStore } from '../store/keyboardStoreOptimized';
import { useAuth } from '../contexts/AuthContext';
import { parseKLE } from '../utils/kleParser';
import { presetLayouts } from '../constants/presetLayouts';
import RawDataModal from './RawDataModal';
import SaveLayoutModal from './SaveLayoutModal';
import { exportToKLE2String, importFromKLE2String } from '../utils/kle2Serializer';
import { importOriginalKLEFile } from '../utils/originalKLEParser';
import { exportToKLEString } from '../utils/kleExporter';
import { initializeFonts } from '../utils/fontManager';
import { saveAs } from 'file-saver';

const MenuBar: React.FC = () => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showRawDataModal, setShowRawDataModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showSaveAsModal, setShowSaveAsModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const keyboard = useKeyboardStore((state) => state.keyboard);
  const setKeyboard = useKeyboardStore((state) => state.setKeyboard);
  const clearSelection = useKeyboardStore((state) => state.clearSelection);
  const saveToHistory = useKeyboardStore((state) => state.saveToHistory);
  const undo = useKeyboardStore((state) => state.undo);
  const redo = useKeyboardStore((state) => state.redo);
  const currentLayoutId = useKeyboardStore((state) => state.currentLayoutId);
  const setCurrentLayoutId = useKeyboardStore((state) => state.setCurrentLayoutId);
  const selectAll = useKeyboardStore((state) => state.selectAll);
  
  const { user } = useAuth();

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePresetSelect = (presetName: string) => {
    const preset = parseKLE(presetLayouts[presetName as keyof typeof presetLayouts]);
    preset.meta.name = presetName;
    setKeyboard(preset);
    setCurrentLayoutId(null); // Clear current layout ID when loading preset
    clearSelection();
    saveToHistory();
    setActiveMenu(null);
  };

  const handleExportJSON = () => {
    try {
      const jsonString = exportToKLE2String(keyboard);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const filename = `${keyboard.meta.name || 'keyboard'}_kle2.json`;
      saveAs(blob, filename);
      setActiveMenu(null);
    } catch (error) {
      alert('Error exporting keyboard: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleExportOriginalKLE = () => {
    try {
      const jsonString = exportToKLEString(keyboard);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const filename = `${keyboard.meta.name || 'keyboard'}.json`;
      saveAs(blob, filename);
      setActiveMenu(null);
    } catch (error) {
      alert('Error exporting keyboard: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleNew = () => {
    if (useKeyboardStore.getState().checkUnsavedChanges()) {
      if (!window.confirm('You have unsaved changes. Are you sure you want to create a new layout?')) {
        return;
      }
    }
    
    // Create a new empty keyboard
    const newKeyboard = {
      meta: {
        name: 'Untitled Layout'
      },
      keys: []
    };
    
    setKeyboard(newKeyboard);
    setCurrentLayoutId(null); // Clear the current layout ID
    setActiveMenu(null);
  };

  const handleImportJSON = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const imported = importFromKLE2String(text);
        
        setKeyboard(imported);
        setCurrentLayoutId(null); // Clear current layout ID on import
        clearSelection();
        saveToHistory();
        setActiveMenu(null);
        
      } catch (error) {
        alert('Error importing file: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    };
    
    input.click();
  };

  const handleImportOriginalKLE = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      try {
        const imported = await importOriginalKLEFile(file);
        
        // Mark as saved since this is a fresh import
        const { markAsSaved } = useKeyboardStore.getState();
        
        
        setKeyboard(imported);
        setCurrentLayoutId(null); // Clear current layout ID on import
        clearSelection();
        saveToHistory();
        markAsSaved();
        setActiveMenu(null);
        
        
        // Reset debug counters
        (window as any).renderCount = 0;
        (window as any).requestRenderCount = 0;
        (window as any).iconDebugCount = 0;
        (window as any).iconKeyCount = 0;
        (window as any).htmlLabelCount = 0;
        (window as any).parserCheckDone = false;
        (window as any).iconParserDebug = false;
        (window as any).iconMatchDebug = false;
        
        // First ensure fonts are loaded
        await initializeFonts();
        
        
        // Force a complete re-render by updating a key
        setTimeout(() => {
          const store = useKeyboardStore.getState();
          
          // Find a key with an icon and force update it
          const keyWithIcon = imported.keys.find(k => 
            k.labels.some(l => l && l.includes('<span'))
          );
          
          if (keyWithIcon) {
            // Update the key with its own data to trigger re-render
            store.updateKey(keyWithIcon.id, { 
              labels: [...keyWithIcon.labels] 
            });
          }
          
        }, 200);
        
      } catch (error) {
        alert('Error importing original KLE file: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    };
    
    input.click();
  };


  return (
    <>
      <div className="menu-bar" ref={menuRef}>
      <div className="menu-item" onClick={() => setActiveMenu(activeMenu === 'file' ? null : 'file')}>
        <span>File</span>
        <ChevronDown size={14} />
        {activeMenu === 'file' && (
          <div className="menu-dropdown">
            <button className="menu-dropdown-item" onClick={() => { handleNew(); }}>
              New
            </button>
            {user && (
              <>
                <div className="menu-dropdown-separator" />
                <button className="menu-dropdown-item" onClick={() => { setShowSaveModal(true); setActiveMenu(null); }}>
                  Save...
                </button>
                <button className="menu-dropdown-item" onClick={() => { setShowSaveAsModal(true); setActiveMenu(null); }}>
                  Save As...
                </button>
              </>
            )}
            <div className="menu-dropdown-separator" />
            <button className="menu-dropdown-item" onClick={() => { handleImportOriginalKLE(); }}>
              Import from KLE
            </button>
            <button className="menu-dropdown-item" onClick={() => { handleExportOriginalKLE(); }}>
              Export to KLE
            </button>
            <div className="menu-divider" />
            <button className="menu-dropdown-item" onClick={() => { handleImportJSON(); }}>
              Import KLC
            </button>
            <button className="menu-dropdown-item" onClick={() => { handleExportJSON(); }}>
              Export KLC
            </button>
          </div>
        )}
      </div>

      <div className="menu-item" onClick={() => setActiveMenu(activeMenu === 'presets' ? null : 'presets')}>
        <span>Presets</span>
        <ChevronDown size={14} />
        {activeMenu === 'presets' && (
          <div className="menu-dropdown">
            {Object.keys(presetLayouts).map((presetName) => (
              <button
                key={presetName}
                className="menu-dropdown-item"
                onClick={() => handlePresetSelect(presetName)}
              >
                {presetName}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="menu-item" onClick={() => setActiveMenu(activeMenu === 'edit' ? null : 'edit')}>
        <span>Edit</span>
        <ChevronDown size={14} />
        {activeMenu === 'edit' && (
          <div className="menu-dropdown">
            <button className="menu-dropdown-item" onClick={() => { undo(); setActiveMenu(null); }}>
              Undo <span style={{float: 'right', opacity: 0.6}}>Ctrl+Z</span>
            </button>
            <button className="menu-dropdown-item" onClick={() => { redo(); setActiveMenu(null); }}>
              Redo <span style={{float: 'right', opacity: 0.6}}>Ctrl+Y</span>
            </button>
            <div className="menu-dropdown-separator" />
            <button className="menu-dropdown-item" onClick={() => { selectAll(); setActiveMenu(null); }}>
              Select All <span style={{float: 'right', opacity: 0.6}}>Ctrl+A</span>
            </button>
          </div>
        )}
      </div>

      <div className="menu-item" onClick={() => setActiveMenu(activeMenu === 'view' ? null : 'view')}>
        <span>View</span>
        <ChevronDown size={14} />
        {activeMenu === 'view' && (
          <div className="menu-dropdown">
            <button className="menu-dropdown-item" onClick={() => { setShowRawDataModal(true); setActiveMenu(null); }}>
              Raw Data Editor
            </button>
            <div className="menu-dropdown-separator" />
            <button className="menu-dropdown-item" onClick={() => {/* TODO: Zoom In */}}>
              Zoom In
            </button>
            <button className="menu-dropdown-item" onClick={() => {/* TODO: Zoom Out */}}>
              Zoom Out
            </button>
            <button className="menu-dropdown-item" onClick={() => {/* TODO: Fit to Window */}}>
              Fit to Window
            </button>
          </div>
        )}
      </div>
      </div>
      
      <RawDataModal 
        isOpen={showRawDataModal} 
        onClose={() => setShowRawDataModal(false)} 
      />
      
      {showSaveModal && (
        <SaveLayoutModal 
          onClose={() => setShowSaveModal(false)}
          layoutId={(() => {
            return currentLayoutId || undefined;
          })()}
        />
      )}
      
      {showSaveAsModal && (
        <SaveLayoutModal 
          onClose={() => setShowSaveAsModal(false)}
          layoutId={undefined} // Force save as new layout
          isSaveAs={true}
        />
      )}
    </>
  );
};

export default MenuBar;