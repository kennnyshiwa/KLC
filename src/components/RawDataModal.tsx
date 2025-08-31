import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useKeyboardStore } from '../store/keyboardStoreOptimized';
import { parseKLE, serializeToKLEString, ParseKLEOptions, parseKLEString } from '../utils/kleParser';

interface RawDataModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const RawDataModal: React.FC<RawDataModalProps> = ({ isOpen, onClose }) => {
  const keyboard = useKeyboardStore((state) => state.keyboard);
  const setKeyboard = useKeyboardStore((state) => state.setKeyboard);
  const saveToHistory = useKeyboardStore((state) => state.saveToHistory);
  const editorSettings = useKeyboardStore((state) => state.editorSettings);
  
  const [rawData, setRawData] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [homingNubType, setHomingNubType] = useState<'scoop' | 'bar' | 'none'>('scoop');
  const [, setImportedMetadata] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      const serialized = serializeToKLEString(keyboard, editorSettings.krkMode || false);
      setRawData(serialized);
      setHasChanges(false);
      setError(null);
    }
  }, [isOpen, keyboard, editorSettings.krkMode]);

  const handleApply = () => {
    try {
      const parsed = parseKLEString(rawData);
      
      const options: ParseKLEOptions = {
        homingNubType: homingNubType
      };
      const newKeyboard = parseKLE(parsed, options);
      
      if (newKeyboard.keys.length === 0) {
        throw new Error('No keys were parsed from the input data');
      }
      
      setKeyboard(newKeyboard);
      saveToHistory();
      setError(null);
      setHasChanges(false);
      
      // Show metadata if imported
      if (newKeyboard.meta && Object.keys(newKeyboard.meta).length > 0) {
        setImportedMetadata(newKeyboard.meta);
      }
      
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid KLE format');
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      const confirm = window.confirm('You have unsaved changes. Are you sure you want to close?');
      if (!confirm) return;
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal-content raw-data-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Raw Data Editor</h2>
          <button className="close-btn" onClick={handleCancel}>
            <X size={20} />
          </button>
        </div>
        
        <div className="modal-body">
          <div className="import-options">
            <label>
              Homing Nub Type:
              <select 
                value={homingNubType} 
                onChange={(e) => setHomingNubType(e.target.value as 'scoop' | 'bar' | 'none')}
              >
                <option value="scoop">Scoop</option>
                <option value="bar">Bar</option>
                <option value="none">None (Don't add front legends)</option>
              </select>
            </label>
          </div>
          
          <textarea
            value={rawData}
            onChange={(e) => {
              setRawData(e.target.value);
              setHasChanges(true);
              setError(null);
            }}
            placeholder="Enter KLE JSON data..."
            spellCheck={false}
          />
          
          {error && (
            <div className="alert alert-error">
              <span>Error: {error}</span>
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          <button className="btn" onClick={handleCancel}>
            Cancel
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleApply}
            disabled={!hasChanges}
          >
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default RawDataModal;