import React from 'react';
import { useKeyboardStore } from '../store/keyboardStoreOptimized';
import { 
  Undo2, 
  Redo2, 
  Copy, 
  Clipboard, 
  Trash2,
  Maximize2
} from 'lucide-react';
import { duplicateKey } from '../utils/keyUtils';
import ExportMenu from './ExportMenu';
import AddKeyMenu from './AddKeyMenu';

interface ToolbarProps {
  getStage: () => any;
}

const Toolbar: React.FC<ToolbarProps> = ({ getStage }) => {
  const selectedKeys = useKeyboardStore((state) => state.selectedKeys);
  const keyboard = useKeyboardStore((state) => state.keyboard);
  const editorSettings = useKeyboardStore((state) => state.editorSettings);
  const hasUnsavedChanges = useKeyboardStore((state) => state.hasUnsavedChanges);
  const undo = useKeyboardStore((state) => state.undo);
  const redo = useKeyboardStore((state) => state.redo);
  const deleteKeys = useKeyboardStore((state) => state.deleteKeys);
  const updateEditorSettings = useKeyboardStore((state) => state.updateEditorSettings);
  const clearSelection = useKeyboardStore((state) => state.clearSelection);
  const selectAll = useKeyboardStore((state) => state.selectAll);
  const saveToHistory = useKeyboardStore((state) => state.saveToHistory);
  const addKey = useKeyboardStore((state) => state.addKey);
  
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
      
    selectedKeysList.forEach(key => {
      const duplicated = duplicateKey(key);
      addKey(duplicated);
    });
    
    if (selectedKeysList.length > 0) {
      saveToHistory();
    }
  };
  
  
  const toggleSnap = () => {
    updateEditorSettings({ snapToGrid: !editorSettings.snapToGrid });
  };

  return (
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
      </div>
      
      <div className="toolbar-separator" />
      
      <ExportMenu getStage={getStage} />
      
      <div className="toolbar-spacer" />
      
      <div className="toolbar-info">
        {hasUnsavedChanges && <span style={{ color: '#ff6b6b', marginRight: '8px' }}>• Unsaved changes</span>}
        {selectedKeys.size > 0 ? `${selectedKeys.size} selected` : 'Ready'}
      </div>
    </div>
  );
};

export default Toolbar;