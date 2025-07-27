import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useKeyboardStore } from '../store/keyboardStoreOptimized';
import { Loader, Edit2, Trash2, Download, Eye, Lock, Copy, ExternalLink } from 'lucide-react';
import SaveLayoutModal from '../components/SaveLayoutModal';

interface Layout {
  id: string;
  name: string;
  description: string;
  data: any;
  isPublic: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

const API_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.DEV ? 'http://localhost:3001' : '/api');

const MyLayouts: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const setKeyboard = useKeyboardStore((state) => state.setKeyboard);
  const setCurrentLayoutId = useKeyboardStore((state) => state.setCurrentLayoutId);
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    fetchLayouts();
  }, [user, navigate]);

  const fetchLayouts = async () => {
    try {
      console.log('Fetching layouts from:', `${API_URL}/layouts`);
      const response = await fetch(`${API_URL}/layouts`, {
        credentials: 'include'
      });
      
      console.log('Layouts response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Layouts data:', data);
        setLayouts(data);
        setError(null); // Clear any previous errors
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch layouts:', response.status, errorText);
        setError('Failed to fetch layouts');
      }
    } catch (error) {
      console.error('Error fetching layouts:', error);
      setError('Failed to fetch layouts');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadLayout = (layout: Layout) => {
    console.log('MyLayouts: Loading layout with ID:', layout.id);
    // Load the layout into the editor
    setKeyboard(layout.data);
    // Set the current layout ID so saves update this layout
    setCurrentLayoutId(layout.id);
    console.log('MyLayouts: Set currentLayoutId to:', layout.id);
    // Navigate back to the editor
    navigate('/');
  };

  const handleDeleteLayout = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this layout?')) {
      return;
    }

    setDeletingId(id);
    try {
      const response = await fetch(`${API_URL}/layouts/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (response.ok) {
        setLayouts(layouts.filter(l => l.id !== id));
      } else {
        setError('Failed to delete layout');
      }
    } catch (error) {
      console.error('Error deleting layout:', error);
      setError('Failed to delete layout');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleCopyLink = (layoutId: string) => {
    const url = `${window.location.origin}/layout/${layoutId}`;
    navigator.clipboard.writeText(url);
  };

  const handleOpenInNewTab = (layoutId: string) => {
    const url = `${window.location.origin}/layout/${layoutId}`;
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="my-layouts-page">
        <div className="loading-container">
          <Loader size={48} className="spin" />
          <p>Loading your layouts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="my-layouts-page">
      <div className="layouts-header">
        <h1>My Layouts</h1>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          Back to Editor
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {layouts.length === 0 ? (
        <div className="empty-state">
          <h2>No layouts saved yet</h2>
          <p>Start creating layouts and save them to your account!</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            Create a Layout
          </button>
        </div>
      ) : (
        <div className="layouts-grid">
          {layouts.map(layout => (
            <div key={layout.id} className="layout-card">
              <div className="layout-card-header">
                <h3>{layout.name}</h3>
                <div className="layout-visibility">
                  {layout.isPublic ? <Eye size={16} /> : <Lock size={16} />}
                </div>
              </div>
              
              {layout.description && (
                <p className="layout-description">{layout.description}</p>
              )}
              
              {layout.tags.length > 0 && (
                <div className="layout-tags">
                  {layout.tags.map(tag => (
                    <span key={tag} className="tag">{tag}</span>
                  ))}
                </div>
              )}
              
              <div className="layout-meta">
                <span>Created: {formatDate(layout.createdAt)}</span>
                <span>Updated: {formatDate(layout.updatedAt)}</span>
              </div>
              
              <div className="layout-actions">
                <button 
                  className="btn btn-sm btn-primary"
                  onClick={() => handleLoadLayout(layout)}
                  title="Load in Editor"
                >
                  <Download size={16} />
                  Load
                </button>
                {layout.isPublic && (
                  <>
                    <button 
                      className="btn btn-sm"
                      onClick={() => handleCopyLink(layout.id)}
                      title="Copy Public Link"
                    >
                      <Copy size={16} />
                      Copy Link
                    </button>
                    <button 
                      className="btn btn-sm"
                      onClick={() => handleOpenInNewTab(layout.id)}
                      title="Open in New Tab"
                    >
                      <ExternalLink size={16} />
                    </button>
                  </>
                )}
                <button 
                  className="btn btn-sm"
                  onClick={() => setEditingId(layout.id)}
                  title="Edit Details"
                >
                  <Edit2 size={16} />
                  Edit
                </button>
                <button 
                  className="btn btn-sm"
                  onClick={() => handleDeleteLayout(layout.id)}
                  disabled={deletingId === layout.id}
                  title="Delete Layout"
                >
                  {deletingId === layout.id ? (
                    <Loader size={16} className="spin" />
                  ) : (
                    <Trash2 size={16} />
                  )}
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingId && (
        <SaveLayoutModal
          layoutId={editingId}
          onClose={() => {
            setEditingId(null);
            fetchLayouts(); // Refresh the list
          }}
        />
      )}
    </div>
  );
};

export default MyLayouts;