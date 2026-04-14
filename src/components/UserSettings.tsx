import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Trash2, AlertTriangle } from 'lucide-react';

interface UserSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const API_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.DEV ? 'http://localhost:3001' : '/api');

const UserSettings: React.FC<UserSettingsProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !user) return null;

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    
    setIsDeleting(true);
    try {
      const response = await fetch(`${API_URL}/users/me`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        // Clear auth and redirect
        localStorage.removeItem('token');
        window.location.href = '/';
      } else {
        alert('Failed to delete account. Please try again.');
      }
    } catch (error) {
      alert('An error occurred while deleting your account.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content user-settings" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>User Settings</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="settings-section danger-zone">
            <h3>Danger Zone</h3>
            <div className="setting-item">
              <div className="setting-info">
                <label>Delete Account</label>
                <p className="setting-description">
                  Permanently delete your account and all associated layouts. This action cannot be undone.
                </p>
              </div>
              <button 
                className="btn btn-danger"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={showDeleteConfirm}
              >
                <Trash2 size={16} />
                <span>Delete Account</span>
              </button>
            </div>
            
            {showDeleteConfirm && (
              <div className="delete-confirm">
                <div className="alert alert-danger">
                  <AlertTriangle size={20} />
                  <div>
                    <strong>Warning!</strong> This will permanently delete:
                    <ul>
                      <li>Your account</li>
                      <li>All your saved layouts</li>
                      <li>All your preferences</li>
                    </ul>
                    <p>Type <strong>DELETE</strong> to confirm:</p>
                  </div>
                </div>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Type DELETE to confirm"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                />
                <div className="delete-actions">
                  <button 
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteConfirmText('');
                    }}
                  >
                    Cancel
                  </button>
                  <button 
                    className="btn btn-danger"
                    onClick={handleDeleteAccount}
                    disabled={deleteConfirmText !== 'DELETE' || isDeleting}
                  >
                    {isDeleting ? 'Deleting...' : 'Delete My Account'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserSettings;