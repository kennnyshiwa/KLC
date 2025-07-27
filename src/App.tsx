import { useEffect, useRef } from 'react';
import { useKeyboardStore } from './store/keyboardStoreOptimized';
import CanvasContainer from './components/CanvasContainer';
import { KeyboardCanvasRef } from './components/KeyboardCanvasUltraFast';
import PropertiesPanel from './components/PropertiesPanel';
import Toolbar from './components/Toolbar';
import MenuBar from './components/MenuBar';
import UserMenu from './components/UserMenu';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useImportedCSS } from './hooks/useImportedCSS';
import { parseKLE } from './utils/kleParser';
import { presetLayouts } from './constants/presetLayouts';
import { initializeFonts } from './utils/fontManager';

function App() {
  const keyboard = useKeyboardStore((state) => state.keyboard);
  const setKeyboard = useKeyboardStore((state) => state.setKeyboard);
  const canvasRef = useRef<KeyboardCanvasRef>(null);
  
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
          <h1>KLE 2.0</h1>
          <div className="header-info">
            {keyboard.meta.name || 'Untitled Layout'}
          </div>
        </div>
        <UserMenu />
      </header>
      
      <div className="app-content">
        <MenuBar />
        <Toolbar getStage={() => canvasRef.current?.getStage() || null} />
        
        <div className="editor-container">
          <div className="sidebar sidebar-left">
            <PropertiesPanel />
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