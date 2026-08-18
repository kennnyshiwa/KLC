import { useEffect, useRef, useState } from 'react';
import { useKeyboardStore } from './store/keyboardStoreOptimized';
import CanvasContainer from './components/CanvasContainer';
import { KeyboardCanvasRef } from './components/KeyboardCanvasUltraFast';
import PropertiesPanel from './components/PropertiesPanel';
import Toolbar from './components/Toolbar';
import MenuBar from './components/MenuBar';
import UserMenu from './components/UserMenu';
import LayoutCounter from './components/LayoutCounter';
import PlayTimeCounter from './components/PlayTimeCounter';
import ThemeToggle from './components/ThemeToggle';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useImportedCSS } from './hooks/useImportedCSS';
import { parseKLE } from './utils/kleParser';
import { presetLayouts } from './constants/presetLayouts';
import { initializeFonts } from './utils/fontManager';
import { Code2, Monitor, PanelBottom, Smartphone, Wrench, X } from 'lucide-react';

type MobileUiPreference = 'auto' | 'mobile' | 'desktop';

const MOBILE_UI_PREFERENCE_KEY = 'klc-ui-mode';

function getInitialMobileUiPreference(): MobileUiPreference {
  if (typeof window === 'undefined') return 'auto';

  const stored = window.localStorage.getItem(MOBILE_UI_PREFERENCE_KEY);
  if (stored === 'mobile' || stored === 'desktop' || stored === 'auto') {
    return stored;
  }

  return 'auto';
}

function shouldUseMobileUi() {
  if (typeof window === 'undefined') return false;

  const narrowViewport = window.innerWidth <= 900;
  const shortViewport = window.innerHeight <= 720;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const noHover = window.matchMedia('(hover: none)').matches;

  return narrowViewport || (coarsePointer && (window.innerWidth <= 1180 || shortViewport || noHover));
}

function App() {
  const keyboard = useKeyboardStore((state) => state.keyboard);
  const setKeyboard = useKeyboardStore((state) => state.setKeyboard);
  const canvasRef = useRef<KeyboardCanvasRef>(null);
  const [isPropertiesPanelCollapsed, setIsPropertiesPanelCollapsed] = useState(false);
  const [mobileUiPreference, setMobileUiPreference] = useState<MobileUiPreference>(() => getInitialMobileUiPreference());
  const [autoMobileUi, setAutoMobileUi] = useState(() => shouldUseMobileUi());
  const [isMobileToolsOpen, setIsMobileToolsOpen] = useState(false);
  const [isMobileInspectorOpen, setIsMobileInspectorOpen] = useState(false);
  
  useKeyboardShortcuts();
  useImportedCSS();

  const isMobileMode = mobileUiPreference === 'mobile' || (mobileUiPreference === 'auto' && autoMobileUi);
  const isForcedDesktopPreference = mobileUiPreference === 'desktop';
  const mobileModeLabel =
    mobileUiPreference === 'auto'
      ? autoMobileUi
        ? 'Auto (mobile)'
        : 'Auto (desktop)'
      : mobileUiPreference === 'mobile'
        ? 'Forced mobile'
        : 'Forced desktop';

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

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateMode = () => setAutoMobileUi(shouldUseMobileUi());
    const coarseQuery = window.matchMedia('(pointer: coarse)');
    const hoverQuery = window.matchMedia('(hover: none)');

    updateMode();
    window.addEventListener('resize', updateMode);
    coarseQuery.addEventListener('change', updateMode);
    hoverQuery.addEventListener('change', updateMode);

    return () => {
      window.removeEventListener('resize', updateMode);
      coarseQuery.removeEventListener('change', updateMode);
      hoverQuery.removeEventListener('change', updateMode);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(MOBILE_UI_PREFERENCE_KEY, mobileUiPreference);
  }, [mobileUiPreference]);

  useEffect(() => {
    if (!isMobileMode) {
      setIsMobileToolsOpen(false);
      setIsMobileInspectorOpen(false);
    }
  }, [isMobileMode]);

  const cycleMobileUiPreference = () => {
    setMobileUiPreference((current) => {
      if (current === 'auto') return 'mobile';
      if (current === 'mobile') return 'desktop';
      return 'auto';
    });
  };

  return (
    <div className={`app ${isMobileMode ? 'mobile-mode' : 'desktop-mode'}`}>
      <header className="app-header">
        <div className="header-left">
          <h1>KLC</h1>
          <div className="header-info">
            {keyboard?.meta?.name || 'Untitled Layout'}
          </div>
        </div>
        <div className="header-right">
          {!isMobileMode && <LayoutCounter />}
          {!isMobileMode && <PlayTimeCounter />}
          {!isMobileMode && (
            <a 
              href="https://github.com/kennnyshiwa/KLE2.0" 
              target="_blank" 
              rel="noopener noreferrer"
              className="github-button"
              title="View on GitHub"
            >
              <Code2 size={20} />
            </a>
          )}
          {!isMobileMode && (
            <a 
              href="https://discord.gg/reXAH2tYCN" 
              target="_blank" 
              rel="noopener noreferrer"
              className="discord-button"
              title="Join our Discord"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.369a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.369a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.182 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
            </a>
          )}
          {isMobileMode && (
            <>
              <button
                type="button"
                className={`mobile-header-button ${isMobileToolsOpen ? 'active' : ''}`}
                onClick={() => {
                  setIsMobileToolsOpen((open) => !open);
                  setIsMobileInspectorOpen(false);
                }}
                title="Open tools"
              >
                {isMobileToolsOpen ? <X size={18} /> : <Wrench size={18} />}
              </button>
              <button
                type="button"
                className={`mobile-header-button ${isMobileInspectorOpen ? 'active' : ''}`}
                onClick={() => {
                  setIsMobileInspectorOpen((open) => !open);
                  setIsMobileToolsOpen(false);
                }}
                title="Open inspector"
              >
                {isMobileInspectorOpen ? <X size={18} /> : <PanelBottom size={18} />}
              </button>
              <button
                type="button"
                className="mobile-header-button"
                onClick={cycleMobileUiPreference}
                title={`Switch UI mode. Current: ${mobileModeLabel}`}
              >
                {isForcedDesktopPreference ? <Monitor size={18} /> : <Smartphone size={18} />}
              </button>
            </>
          )}
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>
      
      <div className="app-content">
        {!isMobileMode && <MenuBar />}
        {!isMobileMode && <Toolbar getStage={() => canvasRef.current?.getStage() || null} />}
        
        <div className="editor-container">
          {!isMobileMode && (
            <div className={`sidebar sidebar-left ${isPropertiesPanelCollapsed ? 'collapsed' : ''}`}>
              <PropertiesPanel 
                isCollapsed={isPropertiesPanelCollapsed}
                onToggleCollapse={() => setIsPropertiesPanelCollapsed(!isPropertiesPanelCollapsed)}
              />
            </div>
          )}
          
          <div className="canvas-container">
            <CanvasContainer ref={canvasRef} />
          </div>
        </div>

        {isMobileMode && (
          <>
            {(isMobileToolsOpen || isMobileInspectorOpen) && (
              <button
                type="button"
                className="mobile-sheet-backdrop"
                onClick={() => {
                  setIsMobileToolsOpen(false);
                  setIsMobileInspectorOpen(false);
                }}
                aria-label="Close mobile panel"
              />
            )}

            <div className={`mobile-sheet mobile-tools-sheet ${isMobileToolsOpen ? 'open' : ''}`}>
              <div className="mobile-sheet-grabber" />
              <div className="mobile-sheet-header">
                <div>
                  <h2>Tools</h2>
                  <p>{mobileModeLabel}</p>
                </div>
                <button
                  type="button"
                  className="mobile-sheet-close"
                  onClick={() => setIsMobileToolsOpen(false)}
                  aria-label="Close tools"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="mobile-sheet-content mobile-tools-content">
                <div className="mobile-mode-switcher">
                  <button
                    type="button"
                    className={`mobile-mode-option ${mobileUiPreference === 'auto' ? 'active' : ''}`}
                    onClick={() => setMobileUiPreference('auto')}
                  >
                    Auto
                  </button>
                  <button
                    type="button"
                    className={`mobile-mode-option ${mobileUiPreference === 'mobile' ? 'active' : ''}`}
                    onClick={() => setMobileUiPreference('mobile')}
                  >
                    Mobile
                  </button>
                  <button
                    type="button"
                    className={`mobile-mode-option ${isForcedDesktopPreference ? 'active' : ''}`}
                    onClick={() => setMobileUiPreference('desktop')}
                  >
                    Desktop
                  </button>
                </div>
                <MenuBar />
                <Toolbar getStage={() => canvasRef.current?.getStage() || null} />
              </div>
            </div>

            <div className={`mobile-sheet mobile-inspector-sheet ${isMobileInspectorOpen ? 'open' : ''}`}>
              <div className="mobile-sheet-grabber" />
              <div className="mobile-sheet-header">
                <div>
                  <h2>Inspector</h2>
                  <p>Edit the selected keys and layout metadata.</p>
                </div>
                <button
                  type="button"
                  className="mobile-sheet-close"
                  onClick={() => setIsMobileInspectorOpen(false)}
                  aria-label="Close inspector"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="mobile-sheet-content mobile-inspector-content">
                <PropertiesPanel />
              </div>
            </div>

            <div className="mobile-bottom-bar">
              <button
                type="button"
                className={`mobile-bottom-button ${isMobileToolsOpen ? 'active' : ''}`}
                onClick={() => {
                  setIsMobileToolsOpen((open) => !open);
                  setIsMobileInspectorOpen(false);
                }}
              >
                <Wrench size={18} />
                <span>Tools</span>
              </button>
              <button
                type="button"
                className={`mobile-bottom-button ${isMobileInspectorOpen ? 'active' : ''}`}
                onClick={() => {
                  setIsMobileInspectorOpen((open) => !open);
                  setIsMobileToolsOpen(false);
                }}
              >
                <PanelBottom size={18} />
                <span>Inspector</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
