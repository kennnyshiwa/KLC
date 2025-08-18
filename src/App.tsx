import { useEffect, useRef, useState } from 'react';
import { useKeyboardStore } from './store/keyboardStoreOptimized';
import CanvasContainer from './components/CanvasContainer';
import { KeyboardCanvasRef } from './components/KeyboardCanvasUltraFast';
import PropertiesPanel from './components/PropertiesPanel';
import Toolbar from './components/Toolbar';
import MenuBar from './components/MenuBar';
import UserMenu from './components/UserMenu';
import LayoutCounter from './components/LayoutCounter';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useImportedCSS } from './hooks/useImportedCSS';
import { parseKLE } from './utils/kleParser';
import { presetLayouts } from './constants/presetLayouts';
import { initializeFonts } from './utils/fontManager';
import { Code2 } from 'lucide-react';

function App() {
  const keyboard = useKeyboardStore((state) => state.keyboard);
  const setKeyboard = useKeyboardStore((state) => state.setKeyboard);
  const canvasRef = useRef<KeyboardCanvasRef>(null);
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

  // Check for dark mode preference on load
  useEffect(() => {
    const darkMode = localStorage.getItem('darkMode') === 'true';
    if (darkMode) {
      document.documentElement.classList.add('dark-mode');
    }
  }, []);

  // Load fonts and default layout
  useEffect(() => {
    // Load fonts first
    initializeFonts().then(() => {
      // Only load default layout if this is truly the first load (no persisted state)
      const state = useKeyboardStore.getState();
      if (keyboard.keys.length === 0 && !state.lastSavedKeyboard) {
        // Use the Minivan Layout as the default
        const preset = parseKLE(presetLayouts['Minivan']);
        preset.meta.name = 'Minivan';
        setKeyboard(preset);
      }
    });
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1>KLC</h1>
          <div className="header-info">
            {keyboard.meta.name || 'Untitled Layout'}
          </div>
        </div>
        <div className="header-right">
          <LayoutCounter />
          <a 
            href="https://github.com/kennnyshiwa/KLE2.0" 
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
}

export default App;