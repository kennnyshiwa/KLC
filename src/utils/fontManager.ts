// Centralized font management with proper loading and fallback handling

interface FontStatus {
  loaded: boolean;
  loading: boolean;
  error: Error | null;
  listeners: Set<() => void>;
}

class FontManager {
  private fonts: Map<string, FontStatus> = new Map();
  private renderCache: Map<string, CanvasRenderingContext2D> = new Map();
  
  constructor() {
    // Initialize font statuses
    this.fonts.set('trashcons', {
      loaded: false,
      loading: false,
      error: null,
      listeners: new Set()
    });
    
    this.fonts.set('GortonPerfected', {
      loaded: false,
      loading: false,
      error: null,
      listeners: new Set()
    });
  }
  
  /**
   * Load a font and notify listeners when ready
   */
  async loadFont(name: string, url: string): Promise<void> {
    const status = this.fonts.get(name);
    if (!status) return;
    
    // Already loaded
    if (status.loaded) return;
    
    // Already loading
    if (status.loading) {
      return new Promise((resolve) => {
        status.listeners.add(() => resolve());
      });
    }
    
    status.loading = true;
    
    try {
      // Method 1: Check if already loaded via CSS
      if (document.fonts && document.fonts.check(`12px ${name}`)) {
        this.markFontLoaded(name);
        return;
      }
      
      // Method 2: Load via FontFace API
      const fontFace = new FontFace(name, `url(${url})`, {
        display: 'block'
      });
      
      const loadedFont = await fontFace.load();
      document.fonts.add(loadedFont);
      
      // Wait for font to be ready
      await document.fonts.ready;
      
      // Verify font is actually usable by measuring text
      if (this.verifyFontLoaded(name)) {
        this.markFontLoaded(name);
      } else {
        // Force font activation with invisible element
        const testEl = document.createElement('div');
        testEl.style.cssText = `
          position: absolute;
          visibility: hidden;
          font-family: ${name};
          font-size: 20px;
          pointer-events: none;
        `;
        testEl.textContent = 'Test \\ue90e ABC';
        document.body.appendChild(testEl);
        
        // Force layout and wait a frame
        testEl.offsetWidth;
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        document.body.removeChild(testEl);
        
        if (this.verifyFontLoaded(name)) {
          this.markFontLoaded(name);
        } else {
          throw new Error(`Font ${name} loaded but not rendering correctly`);
        }
      }
    } catch (error) {
      console.error(`Failed to load font ${name}:`, error);
      status.error = error as Error;
      status.loading = false;
      
      // Notify listeners even on error
      status.listeners.forEach(listener => listener());
      status.listeners.clear();
    }
  }
  
  /**
   * Verify font is loaded by comparing text measurements
   */
  private verifyFontLoaded(name: string): boolean {
    // Create canvas for measurement if not exists
    if (!this.renderCache.has('measure')) {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        this.renderCache.set('measure', ctx);
      }
    }
    
    const ctx = this.renderCache.get('measure');
    if (!ctx) return false;
    
    // Measure with target font
    ctx.font = `20px ${name}`;
    const targetWidth = ctx.measureText('\\ue90e').width;
    
    // Measure with fallback font
    ctx.font = '20px monospace';
    const fallbackWidth = ctx.measureText('\\ue90e').width;
    
    // Font is loaded if measurements differ
    return Math.abs(targetWidth - fallbackWidth) > 0.1;
  }
  
  /**
   * Mark font as loaded and notify listeners
   */
  private markFontLoaded(name: string): void {
    const status = this.fonts.get(name);
    if (!status) return;
    
    status.loaded = true;
    status.loading = false;
    
    // Notify all listeners
    status.listeners.forEach(listener => listener());
    status.listeners.clear();
  }
  
  /**
   * Check if font is loaded
   */
  isFontLoaded(name: string): boolean {
    const status = this.fonts.get(name);
    return status?.loaded || false;
  }
  
  /**
   * Add listener for when font is loaded
   */
  onFontLoaded(name: string, callback: () => void): void {
    const status = this.fonts.get(name);
    if (!status) return;
    
    if (status.loaded) {
      callback();
    } else {
      status.listeners.add(callback);
    }
  }
  
  /**
   * Get font for rendering with fallback
   */
  getRenderFont(name: string, size: number): string {
    const isLoaded = this.isFontLoaded(name);
    // Font string without quotes - Canvas API handles font-family correctly
    const fontString = `${size}px ${isLoaded ? name : 'monospace'}`;
    
    
    return fontString;
  }
}

// Singleton instance
export const fontManager = new FontManager();

// Load fonts on initialization
export async function initializeFonts(): Promise<void> {
  // Load both fonts in parallel
  await Promise.all([
    fontManager.loadFont('trashcons', '/fonts/trashcons.woff'),
    fontManager.loadFont('GortonPerfected', '/fonts/GortonPerfectedVF.woff')
  ]);
  
  // Also wait for document fonts to be ready
  if (document.fonts) {
    await document.fonts.ready;
  }
}