import React from 'react';
import { useKeyboardStore } from '../store/keyboardStoreOptimized';
import { 
  Undo2, 
  Redo2, 
  Copy, 
  Clipboard, 
  Trash2,
  Maximize2,
  MousePointer2
} from 'lucide-react';
import { duplicateKey } from '../utils/keyUtils';
import ExportMenu from './ExportMenu';
import AddKeyMenu from './AddKeyMenu';
import ColorMenuBar, { ColorMenuGrid } from './ColorMenuBar';

interface ToolbarProps {
  getStage: () => any;
}

const Toolbar: React.FC<ToolbarProps> = ({ getStage }) => {
  const [activeColorMenu, setActiveColorMenu] = React.useState<'GMK' | 'ABS' | 'PBT' | null>(null);
  const toolbarContainerRef = React.useRef<HTMLDivElement>(null);
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
  const setMultiSelectMode = useKeyboardStore((state) => state.setMultiSelectMode);
  
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
    
    // Find the leftmost and topmost selected keys to maintain relative positions
    const leftmostSelected = selectedKeysList.reduce((prev, current) => 
      (prev.x < current.x) ? prev : current
    );
    const topmostSelected = selectedKeysList.reduce((prev, current) => 
      (prev.y < current.y) ? prev : current
    );
    
    selectedKeysList.forEach(key => {
      // Calculate the exact position where we want the duplicated key
      const targetX = key.x - leftmostSelected.x;
      const targetY = key.y - topmostSelected.y + newY;
      
      // Since duplicateKey adds offset to key position, we need to subtract key position
      const duplicated = duplicateKey(key, { 
        x: targetX - key.x,
        y: targetY - key.y
      });
      addKey(duplicated);
    });
    
    saveToHistory();
  };
  
  
  const toggleSnap = () => {
    updateEditorSettings({ snapToGrid: !editorSettings.snapToGrid });
  };
  
  // Close color menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (toolbarContainerRef.current && !toolbarContainerRef.current.contains(event.target as Node)) {
        setActiveColorMenu(null);
      }
    };

    if (activeColorMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [activeColorMenu]);

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
    </div>
  );
};

export default Toolbar;