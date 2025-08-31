import React, { useState, useEffect } from 'react';
import { useKeyboardStore } from '../store/keyboardStoreOptimized';
import { parseKLE, serializeToKLE } from '../utils/kleParser';
import { AlertCircle, Check } from 'lucide-react';

const RawDataEditor: React.FC = () => {
  const keyboard = useKeyboardStore((state) => state.keyboard);
  const setKeyboard = useKeyboardStore((state) => state.setKeyboard);
  const editorSettings = useKeyboardStore((state) => state.editorSettings);
  
  const [rawData, setRawData] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Update raw data when keyboard changes or KRK mode changes
  useEffect(() => {
    if (!isDirty) {
      try {
        const serialized = serializeToKLE(keyboard, editorSettings.krkMode || false);
        setRawData(JSON.stringify(serialized, null, 2));
      } catch (err) {
        console.error('Failed to serialize keyboard:', err);
      }
    }
  }, [keyboard, isDirty, editorSettings.krkMode]);

  const handleDataChange = (value: string) => {
    setRawData(value);
    setIsDirty(true);
    setError(null);
    setSuccess(false);
  };

  const handleApply = () => {
    try {
      const parsed = JSON.parse(rawData);
      const newKeyboard = parseKLE(parsed);
      
      // Check if KRK data was detected and enable KRK mode
      if ((newKeyboard as any).hasKrkData) {
        console.log('KRK data detected in RawDataEditor, enabling KRK mode');
        const updateEditorSettings = useKeyboardStore.getState().updateEditorSettings;
        updateEditorSettings({ krkMode: true });
      } else {
        console.log('No KRK data flag found');
      }
      
      setKeyboard(newKeyboard);
      setError(null);
      setSuccess(true);
      setIsDirty(false);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON format');
      setSuccess(false);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([rawData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${keyboard.meta.name || 'keyboard'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        handleDataChange(content);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="raw-data-editor">
      <div className="editor-header">
        <h3>Raw Data</h3>
        <div className="editor-actions">
          <input
            type="file"
            accept=".json"
            onChange={handleFileImport}
            style={{ display: 'none' }}
            id="file-import"
          />
          <label htmlFor="file-import" className="btn btn-sm">
            Import
          </label>
          <button onClick={handleDownload} className="btn btn-sm">
            Export
          </button>
          <button 
            onClick={handleApply} 
            className={`btn btn-sm btn-primary ${isDirty ? 'btn-highlight' : ''}`}
            disabled={!isDirty}
          >
            Apply
          </button>
        </div>
      </div>
      
      {error && (
        <div className="alert alert-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}
      
      {success && (
        <div className="alert alert-success">
          <Check size={16} />
          <span>Layout updated successfully!</span>
        </div>
      )}
      
      <div className="editor-content">
        <textarea
          value={rawData}
          onChange={(e) => handleDataChange(e.target.value)}
          placeholder="Paste KLE JSON data here..."
          spellCheck={false}
        />
      </div>
      
      <div className="editor-footer">
        <p className="hint">
          Paste KLE JSON data or import from a file. The editor supports the standard KLE format.
        </p>
      </div>
    </div>
  );
};

export default RawDataEditor;