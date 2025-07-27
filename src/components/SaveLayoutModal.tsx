import React, { useState, useEffect } from 'react';
import { X, Save, Loader, Copy, ExternalLink } from 'lucide-react';
import { useKeyboardStore } from '../store/keyboardStoreOptimized';
import { useAuth } from '../contexts/AuthContext';

interface SaveLayoutModalProps {
  onClose: () => void;
  layoutId?: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const SaveLayoutModal: React.FC<SaveLayoutModalProps> = ({ onClose, layoutId }) => {
  const keyboard = useKeyboardStore((state) => state.keyboard);
  const [name, setName] = useState(keyboard.meta.name || '');
  const [description, setDescription] = useState(keyboard.meta.notes || '');
  const [isPublic, setIsPublic] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedLayoutId, setSavedLayoutId] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    // If we have a layout ID, fetch the existing layout data
    if (layoutId) {
      fetchLayout();
    }
  }, [layoutId]);

  const fetchLayout = async () => {
    try {
      const response = await fetch(`${API_URL}/api/layouts/${layoutId}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const layout = await response.json();
        setName(layout.name);
        setDescription(layout.description);
        setIsPublic(layout.isPublic);
        setTags(layout.tags);
      }
    } catch (error) {
      console.error('Error fetching layout:', error);
    }
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!tags.includes(tagInput.trim())) {
        setTags([...tags, tagInput.trim()]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Layout name is required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      // Prepare the layout data
      const layoutData = {
        name: name.trim(),
        description: description.trim(),
        data: keyboard,
        isPublic,
        tags
      };

      const url = layoutId 
        ? `${API_URL}/api/layouts/${layoutId}`
        : `${API_URL}/api/layouts`;
      
      const method = layoutId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(layoutData)
      });

      if (response.ok) {
        const savedLayout = await response.json();
        
        // Update the keyboard name in the store and mark as saved
        const { updateMetadata, markAsSaved, setCurrentLayoutId } = useKeyboardStore.getState();
        updateMetadata({ name: name.trim(), notes: description.trim() });
        markAsSaved();
        
        // Set the current layout ID so future saves update this layout
        setCurrentLayoutId(savedLayout.id || layoutId || null);
        
        if (isPublic && savedLayout.id) {
          setSavedLayoutId(savedLayout.id);
          setShowSuccess(true);
        } else {
          onClose();
        }
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to save layout');
      }
    } catch (error) {
      console.error('Error saving layout:', error);
      setError('Failed to save layout. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/layout/${savedLayoutId}`;
    navigator.clipboard.writeText(url);
  };

  const handleOpenInNewTab = () => {
    const url = `${window.location.origin}/layout/${savedLayoutId}`;
    window.open(url, '_blank');
  };

  if (showSuccess && savedLayoutId) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" style={{ width: '500px' }} onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Layout Saved Successfully!</h2>
            <button className="close-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>

          <div className="modal-body">
            <div className="alert alert-success">
              Your layout has been saved and is publicly accessible!
            </div>

            <div className="property-row">
              <label>Public URL</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={`${window.location.origin}/layout/${savedLayoutId}`}
                  readOnly
                  onClick={(e) => e.currentTarget.select()}
                  style={{ flex: 1 }}
                />
                <button 
                  className="btn btn-sm"
                  onClick={handleCopyLink}
                  title="Copy Link"
                >
                  <Copy size={16} />
                </button>
                <button 
                  className="btn btn-sm"
                  onClick={handleOpenInNewTab}
                  title="Open in New Tab"
                >
                  <ExternalLink size={16} />
                </button>
              </div>
            </div>

            <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '1rem' }}>
              Anyone with this link can view and modify this layout. If they save it, it will be saved to their own account.
            </p>
          </div>

          <div className="modal-footer">
            <button className="btn btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ width: '500px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{layoutId ? 'Update Layout' : 'Save Layout'}</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}

          <div className="property-row">
            <label>Layout Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Custom Layout"
              autoFocus
            />
          </div>

          <div className="property-row">
            <label>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description for your layout..."
              rows={3}
            />
          </div>

          <div className="property-row">
            <label>Tags</label>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder="Press Enter to add tags"
            />
            {tags.length > 0 && (
              <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {tags.map(tag => (
                  <span 
                    key={tag} 
                    style={{
                      padding: '4px 8px',
                      background: '#e0e0e0',
                      borderRadius: '4px',
                      fontSize: '12px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {tag}
                    <button 
                      onClick={() => handleRemoveTag(tag)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        color: '#666'
                      }}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="checkbox-row">
            <label>
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
              Make this layout public
            </label>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleSave}
            disabled={saving || !name.trim()}
          >
            {saving ? (
              <>
                <Loader size={16} className="spin" />
                <span style={{ marginLeft: '4px' }}>Saving...</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span style={{ marginLeft: '4px' }}>{layoutId ? 'Update' : 'Save'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SaveLayoutModal;