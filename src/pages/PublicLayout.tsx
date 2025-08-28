import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useKeyboardStore } from '../store/keyboardStoreOptimized';
import { useAuth } from '../contexts/AuthContext';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useImportedCSS } from '../hooks/useImportedCSS';
import { initializeFonts } from '../utils/fontManager';
import { Loader, Home, Code2 } from 'lucide-react';
import CanvasContainer from '../components/CanvasContainer';
import { KeyboardCanvasRef } from '../components/KeyboardCanvasUltraFast';
import PropertiesPanel from '../components/PropertiesPanel';
import Toolbar from '../components/Toolbar';
import MenuBar from '../components/MenuBar';
import UserMenu from '../components/UserMenu';
import LayoutCounter from '../components/LayoutCounter';

const API_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.DEV ? 'http://localhost:3001' : '/api');

const PublicLayout: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const keyboard = useKeyboardStore((state) => state.keyboard);
  const setKeyboard = useKeyboardStore((state) => state.setKeyboard);
  const setCurrentLayoutId = useKeyboardStore((state) => state.setCurrentLayoutId);
  const canvasRef = useRef<KeyboardCanvasRef>(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [layoutOwner, setLayoutOwner] = useState<any>(null);
  const [isPropertiesPanelCollapsed, setIsPropertiesPanelCollapsed] = useState(false);

  useKeyboardShortcuts();
  useImportedCSS();

  // Warn user about unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const hasUnsavedChanges = useKeyboardStore.getState().checkUnsavedChanges();
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  useEffect(() => {
    // Load fonts first
    initializeFonts().then(() => {
      if (id) {
        fetchPublicLayout();
      }
    });
  }, [id]);

  const fetchPublicLayout = async () => {
    try {
      const response = await fetch(`${API_URL}/layouts/public/${id}`);
      
      if (response.ok) {
        const data = await response.json();
        setLayoutOwner(data.owner);
        
        // Ensure we have the full keyboard data with metadata
        const keyboardData = data.data;
        
        // Make sure we have a meta object
        if (!keyboardData.meta) {
          keyboardData.meta = {};
        }
        
        // Preserve all existing metadata and ensure name/notes are set
        keyboardData.meta = {
          ...keyboardData.meta,
          name: data.name || keyboardData.meta.name || 'Untitled Layout',
          notes: data.description || keyboardData.meta.notes || ''
        };
        
        setKeyboard(keyboardData);
        
        // If the user owns this layout, set it as the current layout for saving
        if (user && data.owner && user.id === data.owner.id) {
          setCurrentLayoutId(id || null);
        } else {
          // Not the owner, clear any current layout ID
          setCurrentLayoutId(null);
        }
      } else {
        setError('Layout not found or not public');
      }
    } catch (error) {
      setError('Failed to load layout');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="app">
        <div className="loading-container" style={{ height: '100vh' }}>
          <Loader size={48} className="spin" />
          <p>Loading layout...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app">
        <div className="error-container" style={{ height: '100vh' }}>
          <h2>Error</h2>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={() => window.location.href = '/'}>
            <Home size={16} />
            <span style={{ marginLeft: '8px' }}>Go to Editor</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1>KLC</h1>
          <div className="header-info">
            {keyboard.meta.name || 'Untitled Layout'}
            {layoutOwner && (
              <span style={{ marginLeft: '8px', opacity: 0.7 }}>
                by {layoutOwner.username}#{layoutOwner.discriminator}
              </span>
            )}
          </div>
        </div>
        <div className="header-right">
          <LayoutCounter />
          <a 
            href="https://github.com/kennnyshiwa/KLC" 
            target="_blank" 
            rel="noopener noreferrer"
            className="github-button"
            title="View on GitHub"
          >
            <Code2 size={20} />
          </a>
          <UserMenu />
        </div>
      </header>
      
      <div className="app-content">
        <MenuBar />
        <Toolbar getStage={() => canvasRef.current?.getStage() || null} />
        
        <div className="editor-container">
          <div className={`sidebar sidebar-left ${isPropertiesPanelCollapsed ? 'collapsed' : ''}`}>
            <PropertiesPanel 
              isCollapsed={isPropertiesPanelCollapsed}
              onToggleCollapse={() => setIsPropertiesPanelCollapsed(!isPropertiesPanelCollapsed)}
            />
          </div>
          
          <div className="canvas-container">
            <CanvasContainer ref={canvasRef} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicLayout;