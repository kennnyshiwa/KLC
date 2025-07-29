import { useEffect } from 'react';
import { useKeyboardStore } from '../store/keyboardStoreOptimized';

export function useImportedCSS() {
  const keyboard = useKeyboardStore((state) => state.keyboard);
  
  useEffect(() => {
    // Check if we have imported CSS
    if (keyboard.meta.css) {
      // Create or update a style element for imported CSS
      let styleElement = document.getElementById('kle-imported-css');
      
      if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = 'kle-imported-css';
        document.head.appendChild(styleElement);
      }
      
      // Sanitize the CSS to only allow font-face rules for security
      const sanitizedCSS = sanitizeImportedCSS(keyboard.meta.css);
      styleElement.textContent = sanitizedCSS;
      
    }
  }, [keyboard.meta.css]);
}

function sanitizeImportedCSS(css: string): string {
  // Extract only @font-face rules for security
  const fontFaceRegex = /@font-face\s*{[^}]+}/g;
  const fontFaceRules = css.match(fontFaceRegex) || [];
  
  // Additional validation: ensure font-face rules only contain safe properties
  const safeFontFaceRules = fontFaceRules.filter(rule => {
    // Check for potentially malicious content
    const hasJavaScript = /javascript:/i.test(rule);
    const hasExpression = /expression\s*\(/i.test(rule);
    const hasImport = /@import/i.test(rule);
    
    // Skip trashcons font definitions from imported CSS
    // We use our own local trashcons font
    const isTrashcons = /font-family:\s*['"]?trashcons['"]?/i.test(rule);
    
    return !hasJavaScript && !hasExpression && !hasImport && !isTrashcons;
  });
  
  return safeFontFaceRules.join('\n');
}