// Font loader utility to ensure fonts are loaded before rendering

let fontLoadPromise: Promise<void> | null = null;

export async function loadFonts(): Promise<void> {
  // Return existing promise if already loading
  if (fontLoadPromise) {
    return fontLoadPromise;
  }
  
  fontLoadPromise = loadFontsInternal();
  return fontLoadPromise;
}

async function loadFontsInternal(): Promise<void> {
  // First check if font is already loaded via CSS @font-face
  if (document.fonts && document.fonts.check('12px trashcons')) {
    console.log('Trashcons font already loaded via CSS');
    return;
  }
  
  // Load trashcons font programmatically
  const trashconsFont = new FontFace('trashcons', 'url(/fonts/trashcons.woff)', {
    display: 'block' // Ensure font renders immediately when loaded
  });
  
  try {
    const loadedFont = await trashconsFont.load();
    document.fonts.add(loadedFont);
    
    // Force layout recalculation to ensure font is ready
    await document.fonts.ready;
    
    // Double-check the font is actually usable
    if (document.fonts.check('12px trashcons')) {
      console.log('Trashcons font loaded and verified');
    } else {
      console.warn('Trashcons font added but not yet available');
      // Try to force font loading by creating a test element
      const testEl = document.createElement('span');
      testEl.style.fontFamily = 'trashcons';
      testEl.style.position = 'absolute';
      testEl.style.visibility = 'hidden';
      testEl.textContent = '\ue90e';
      document.body.appendChild(testEl);
      // Force layout
      testEl.offsetWidth;
      document.body.removeChild(testEl);
    }
  } catch (error) {
    console.error('Failed to load trashcons font:', error);
    // Try with full URL as fallback
    try {
      const baseUrl = window.location.origin;
      const altFont = new FontFace('trashcons', `url(${baseUrl}/fonts/trashcons.woff)`);
      const altLoadedFont = await altFont.load();
      document.fonts.add(altLoadedFont);
      await document.fonts.ready;
      console.log('Trashcons font loaded from full URL');
    } catch (altError) {
      console.error('Failed to load trashcons font from full URL:', altError);
    }
  }
}

export function isFontLoaded(fontFamily: string): boolean {
  return document.fonts.check(`12px ${fontFamily}`);
}