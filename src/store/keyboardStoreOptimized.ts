import { create } from 'zustand';
import { subscribeWithSelector, persist } from 'zustand/middleware';
import { Key, Keyboard, KeyboardMetadata, EditorSettings } from '../types';

interface KeyboardState {
  keyboard: Keyboard;
  selectedKeys: Set<string>;
  hoveredKey: string | null;
  editorSettings: EditorSettings;
  history: Keyboard[];
  historyIndex: number;
  isDragging: boolean;
  hasUnsavedChanges: boolean;
  lastSavedKeyboard: Keyboard | null;
  currentLayoutId: string | null;
  isSettingRotationPoint: boolean;
  isRotationSectionExpanded: boolean;
  multiSelectMode: boolean;
  lastModifiedKeyId: string | null;
  clipboard: Key[];
  
  // Actions
  setKeyboard: (keyboard: Keyboard) => void;
  updateKey: (keyId: string, updates: Partial<Key>) => void;
  updateKeys: (updates: Array<{ id: string; changes: Partial<Key> }>) => void;
  addKey: (key: Key) => void;
  deleteKey: (keyId: string) => void;
  deleteKeys: (keyIds: string[]) => void;
  
  // Selection
  selectKey: (keyId: string, multiSelect?: boolean) => void;
  selectKeys: (keyIds: string[]) => void;
  clearSelection: () => void;
  selectAll: () => void;
  
  // Hover
  setHoveredKey: (keyId: string | null) => void;
  
  // Metadata
  updateMetadata: (metadata: Partial<KeyboardMetadata>) => void;
  
  // Editor settings
  updateEditorSettings: (settings: Partial<EditorSettings>) => void;
  
  // History
  undo: () => void;
  redo: () => void;
  saveToHistory: () => void;
  
  // Drag state
  setIsDragging: (isDragging: boolean) => void;
  
  // Rotation point setting
  setIsSettingRotationPoint: (isSettingRotationPoint: boolean) => void;
  setIsRotationSectionExpanded: (isRotationSectionExpanded: boolean) => void;
  
  // Unsaved changes
  markAsSaved: () => void;
  checkUnsavedChanges: () => boolean;
  
  // Current layout tracking
  setCurrentLayoutId: (id: string | null) => void;
  
  // Multi-select mode
  setMultiSelectMode: (enabled: boolean) => void;
  
  // Clipboard
  copyKeys: (keyIds: string[]) => void;
  pasteKeys: () => void;
}

export const useKeyboardStore = create<KeyboardState>()(
  persist(
    subscribeWithSelector((set, get) => ({
      keyboard: {
        meta: {
          name: 'Untitled Keyboard',
        },
        keys: [],
      },
      selectedKeys: new Set(),
      hoveredKey: null,
      editorSettings: {
        gridSize: 0.25,
        snapToGrid: true,
        showGrid: true,
        unitSize: 54,
        keySpacing: 1,
        showStabilizerPositions: false,
        selectionMode: 'touch',
      },
      history: [],
      historyIndex: -1,
      isDragging: false,
      hasUnsavedChanges: false,
      lastSavedKeyboard: null,
      currentLayoutId: null,
      isSettingRotationPoint: false,
      isRotationSectionExpanded: true,
      multiSelectMode: false,
      lastModifiedKeyId: null,
      clipboard: [],

      setKeyboard: (keyboard) => {
        set({
          keyboard,
          hasUnsavedChanges: false,
          lastSavedKeyboard: keyboard,
          selectedKeys: new Set(),
          history: [keyboard],
          historyIndex: 0,
          currentLayoutId: null, // Clear the current layout ID when loading a new keyboard
        });
      },

      updateKey: (keyId, updates) => {
        set((state) => ({
          keyboard: {
            ...state.keyboard,
            keys: state.keyboard.keys.map((key) =>
              key.id === keyId ? { ...key, ...updates } : key
            ),
          },
          hasUnsavedChanges: true,
          lastModifiedKeyId: keyId,
        }));
        get().saveToHistory();
      },

      updateKeys: (updates) => {
        const updateMap = new Map(updates.map(({ id, changes }) => [id, changes]));
        
        set((state) => ({
          keyboard: {
            ...state.keyboard,
            keys: state.keyboard.keys.map((key) => {
              const changes = updateMap.get(key.id);
              return changes ? { ...key, ...changes } : key;
            })
          },
          hasUnsavedChanges: true,
          // Track the last modified key (use the last one in the updates array)
          lastModifiedKeyId: updates.length > 0 ? updates[updates.length - 1].id : state.lastModifiedKeyId,
        }));
        get().saveToHistory();
      },

      addKey: (key) => {
        set((state) => ({
          keyboard: {
            ...state.keyboard,
            keys: [...state.keyboard.keys, key],
          },
          hasUnsavedChanges: true,
          lastModifiedKeyId: key.id,
        }));
        get().saveToHistory();
      },

      deleteKey: (keyId) => {
        set((state) => ({
          keyboard: {
            ...state.keyboard,
            keys: state.keyboard.keys.filter((k) => k.id !== keyId),
          },
          hasUnsavedChanges: true,
          selectedKeys: new Set(Array.from(state.selectedKeys).filter(id => id !== keyId)),
        }));
        get().saveToHistory();
      },

      deleteKeys: (keyIds) => {
        const idsToDelete = new Set(keyIds);
        set((state) => ({
          keyboard: {
            ...state.keyboard,
            keys: state.keyboard.keys.filter((k) => !idsToDelete.has(k.id)),
          },
          hasUnsavedChanges: true,
          selectedKeys: new Set(Array.from(state.selectedKeys).filter(id => !idsToDelete.has(id))),
        }));
        get().saveToHistory();
      },

      selectKey: (keyId, multiSelect = false) => {
        set((state) => {
          // Use multi-select if explicitly passed or if multiSelectMode is enabled
          const useMultiSelect = multiSelect || state.multiSelectMode;
          const newSelection = new Set(useMultiSelect ? state.selectedKeys : []);
          
          if (newSelection.has(keyId)) {
            newSelection.delete(keyId);
          } else {
            newSelection.add(keyId);
          }
          
          return { selectedKeys: newSelection };
        });
      },

      selectKeys: (keyIds) => {
        set({ selectedKeys: new Set(keyIds) });
      },

      clearSelection: () => {
        set({ selectedKeys: new Set() });
      },

      selectAll: () => {
        set((state) => ({
          selectedKeys: new Set(state.keyboard.keys.map((k) => k.id)),
        }));
      },

      setHoveredKey: (keyId) => {
        set({ hoveredKey: keyId });
      },

      updateMetadata: (metadata) => {
        set((state) => ({
          keyboard: {
            ...state.keyboard,
            meta: { ...state.keyboard.meta, ...metadata },
          },
          hasUnsavedChanges: true,
        }));
      },

      updateEditorSettings: (settings) => {
        set((state) => ({
          editorSettings: { ...state.editorSettings, ...settings },
        }));
      },

      saveToHistory: () => {
        const { keyboard, history, historyIndex } = get();
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(JSON.parse(JSON.stringify(keyboard)));
        
        if (newHistory.length > 50) {
          newHistory.shift();
        }
        
        set({
          history: newHistory,
          historyIndex: newHistory.length - 1,
        });
      },

      undo: () => {
        const { history, historyIndex } = get();
        if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          set({
            keyboard: JSON.parse(JSON.stringify(history[newIndex])),
            historyIndex: newIndex,
            selectedKeys: new Set(),
            hasUnsavedChanges: true,
          });
        }
      },

      redo: () => {
        const { history, historyIndex } = get();
        if (historyIndex < history.length - 1) {
          const newIndex = historyIndex + 1;
          set({
            keyboard: JSON.parse(JSON.stringify(history[newIndex])),
            historyIndex: newIndex,
            selectedKeys: new Set(),
            hasUnsavedChanges: true,
          });
        }
      },

      setIsDragging: (isDragging) => {
        set({ isDragging });
      },
      
      setIsSettingRotationPoint: (isSettingRotationPoint) => {
        set({ isSettingRotationPoint });
      },
      
      setIsRotationSectionExpanded: (isRotationSectionExpanded) => {
        set({ isRotationSectionExpanded });
      },

      markAsSaved: () => {
        const { keyboard } = get();
        set({
          hasUnsavedChanges: false,
          lastSavedKeyboard: keyboard,
        });
      },

      checkUnsavedChanges: () => {
        return get().hasUnsavedChanges;
      },

      setCurrentLayoutId: (id) => {
        set({ currentLayoutId: id });
      },
      
      setMultiSelectMode: (enabled) => {
        set({ multiSelectMode: enabled });
      },
      
      copyKeys: (keyIds) => {
        const state = get();
        const keysToCopy = keyIds
          .map(id => state.keyboard.keys.find(k => k.id === id))
          .filter(Boolean) as Key[];
        
        if (keysToCopy.length > 0) {
          // Create deep copies of the keys
          const copiedKeys = keysToCopy.map(key => ({
            ...key,
            labels: [...(key.labels || [])],
            textColor: [...(key.textColor || [])],
            textSize: [...(key.textSize || [])],
          }));
          
          set({ clipboard: copiedKeys });
        }
      },
      
      pasteKeys: () => {
        const state = get();
        if (state.clipboard.length === 0) return;
        
        // Find the bottom-most key in the current layout
        let pasteX = 0;
        let pasteY = 0;
        
        if (state.keyboard.keys.length > 0) {
          // Find the bottom-most key
          const bottomKey = state.keyboard.keys.reduce((prev, current) => 
            (prev.y + prev.height > current.y + current.height) ? prev : current
          );
          // Place new keys directly below the bottom-most key
          pasteY = bottomKey.y + bottomKey.height;
        }
        
        // Find the leftmost and topmost positions of clipboard keys
        const leftmostClipboard = state.clipboard.reduce((prev, current) => 
          (prev.x < current.x) ? prev : current
        );
        const topmostClipboard = state.clipboard.reduce((prev, current) => 
          (prev.y < current.y) ? prev : current
        );
        
        // Create new keys with new IDs and positions
        const newKeys = state.clipboard.map(key => ({
          ...key,
          id: `key-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
          x: key.x - leftmostClipboard.x + pasteX,
          y: key.y - topmostClipboard.y + pasteY,
          labels: [...(key.labels || [])],
          textColor: [...(key.textColor || [])],
          textSize: [...(key.textSize || [])],
        }));
        
        // Add the new keys to the keyboard
        set((state) => ({
          keyboard: {
            ...state.keyboard,
            keys: [...state.keyboard.keys, ...newKeys],
          },
          hasUnsavedChanges: true,
          selectedKeys: new Set(newKeys.map(k => k.id)),
        }));
        
        get().saveToHistory();
      },
    })),
    {
      name: 'kle2-storage',
      partialize: (state) => ({
        keyboard: state.keyboard,
        editorSettings: state.editorSettings,
        lastSavedKeyboard: state.lastSavedKeyboard,
        hasUnsavedChanges: state.hasUnsavedChanges,
        currentLayoutId: state.currentLayoutId,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Convert arrays back to Sets for selectedKeys
          state.selectedKeys = new Set();
          
          // If there were unsaved changes, restore to last saved state
          if (state.hasUnsavedChanges && state.lastSavedKeyboard) {
            state.keyboard = state.lastSavedKeyboard;
            state.hasUnsavedChanges = false;
            // Clear history as we're resetting to saved state
            state.history = [];
            state.historyIndex = -1;
          } else if (state.hasUnsavedChanges && !state.lastSavedKeyboard) {
            // If unsaved changes but no saved state, clear the keyboard
            state.keyboard = {
              meta: {
                name: 'Untitled Layout'
              },
              keys: []
            };
            state.hasUnsavedChanges = false;
            state.currentLayoutId = null;
            // Clear history
            state.history = [];
            state.historyIndex = -1;
          }
        }
      },
    }
  )
);