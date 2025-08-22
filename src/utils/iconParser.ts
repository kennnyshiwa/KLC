// Fixed icon parsing utility for KLE icon spans

export interface ParsedIcon {
  type: 'text' | 'icon';
  content: string;
  className?: string;
  iconName?: string;
}

// Map of icon class names to their unicode characters for trashcons font
const ICON_MAP: Record<string, string> = {
  // Custom icons (will be handled differently in rendering)
  'icon-40s-logo': '',  // Custom SVG icon
  // Trashcons mappings
  'icon-left': '\ue900',
  'icon-right': '\ue901',
  'icon-down': '\ue902',
  'icon-up': '\ue903',
  'icon-mult': '\ue904',
  'icon-minus': '\ue905',
  'icon-plus': '\ue906',
  'icon-div': '\ue907',
  'icon-lower': '\ue908',
  'icon-raise': '\ue909',
  'icon-fn': '\ue90a',
  'icon-shift': '\ue90b',
  'icon-delete': '\ue90c',
  'icon-backspace': '\ue90d',
  'icon-enter': '\ue90e',
  'icon-esc': '\ue90f',
  'icon-tab': '\ue910',
  'icon-menu': '\ue911',
  'icon-sys': '\ue912',
  'icon-alt': '\ue913',
  'icon-ctrl': '\ue914',
  'icon-home': '\ue915',
  'icon-end': '\ue916',
  'icon-pgup': '\ue917',
  'icon-pgdn': '\ue918',
  'icon-capslock': '\ue919',
  'icon-numlock': '\ue91a',
  'icon-scrllock': '\ue91b',
  'icon-prntscrn': '\ue91c',
  'icon-pause': '\ue91d',
  'icon-insert': '\ue91e',
};

/**
 * Parse a legend string that may contain icon spans
 * Fixed version that properly handles span tags without leaving residual HTML
 */
export function parseIconLegend(legend: string): ParsedIcon[] {
  
  const result: ParsedIcon[] = [];
  
  // Match span tags - handle both complete tags and unclosed tags (common in imported KLE)
  // This regex captures: opening tag with classes, then either:
  // 1. Self-closing /> 
  // 2. > followed by content and </span>
  // 3. Just > (unclosed tag)
  const iconSpanRegex = /<span\s+class=["']([^"']+)["']\s*(?:\/>|>(?:[^<]*<\/span>)?|>)/gi;
  
  let lastIndex = 0;
  let match;
  
  while ((match = iconSpanRegex.exec(legend)) !== null) {
    
    // Add text before the icon
    if (match.index > lastIndex) {
      const textBefore = legend.substring(lastIndex, match.index);
      if (textBefore) {
        result.push({
          type: 'text',
          content: textBefore,
        });
      }
    }
    
    // Parse the class attribute
    const classes = match[1].split(/\s+/);
    let iconFound = false;
    
    // Look for icon classes
    for (const cls of classes) {
      // Check if this is a known icon (including custom icons)
      if (cls in ICON_MAP) {
        result.push({
          type: 'icon',
          content: ICON_MAP[cls] || '', // Custom icons may have empty content
          className: match[1],
          iconName: cls,
        });
        iconFound = true;
        break;
      }
    }
    
    // If no icon was found, treat the whole match as text
    if (!iconFound) {
      result.push({
        type: 'text',
        content: match[0],
      });
    }
    
    // Update lastIndex to skip the entire matched span
    lastIndex = match.index + match[0].length;
  }
  
  // Add any remaining text after the last match
  if (lastIndex < legend.length) {
    const remainingText = legend.substring(lastIndex);
    if (remainingText) {
      result.push({
        type: 'text',
        content: remainingText,
      });
    }
  }
  
  return result;
}

// Available icons for dropdown
export const AVAILABLE_ICONS = [
  { name: 'None', value: '' },
  { name: '40s Logo', value: '<span class="custom-icon icon-40s-logo"></span>' },
  { name: 'Enter', value: '<span class="trashcons icon-enter"></span>' },
  { name: 'Escape', value: '<span class="trashcons icon-esc"></span>' },
  { name: 'Tab', value: '<span class="trashcons icon-tab"></span>' },
  { name: 'Backspace', value: '<span class="trashcons icon-backspace"></span>' },
  { name: 'Delete', value: '<span class="trashcons icon-delete"></span>' },
  { name: 'Insert', value: '<span class="trashcons icon-insert"></span>' },
  { name: 'Shift', value: '<span class="trashcons icon-shift"></span>' },
  { name: 'Control', value: '<span class="trashcons icon-ctrl"></span>' },
  { name: 'Alt', value: '<span class="trashcons icon-alt"></span>' },
  { name: 'Fn', value: '<span class="trashcons icon-fn"></span>' },
  { name: 'Menu', value: '<span class="trashcons icon-menu"></span>' },
  { name: 'System', value: '<span class="trashcons icon-sys"></span>' },
  { name: 'Home', value: '<span class="trashcons icon-home"></span>' },
  { name: 'End', value: '<span class="trashcons icon-end"></span>' },
  { name: 'Page Up', value: '<span class="trashcons icon-pgup"></span>' },
  { name: 'Page Down', value: '<span class="trashcons icon-pgdn"></span>' },
  { name: 'Left Arrow', value: '<span class="trashcons icon-left"></span>' },
  { name: 'Right Arrow', value: '<span class="trashcons icon-right"></span>' },
  { name: 'Up Arrow', value: '<span class="trashcons icon-up"></span>' },
  { name: 'Down Arrow', value: '<span class="trashcons icon-down"></span>' },
  { name: 'Caps Lock', value: '<span class="trashcons icon-capslock"></span>' },
  { name: 'Num Lock', value: '<span class="trashcons icon-numlock"></span>' },
  { name: 'Scroll Lock', value: '<span class="trashcons icon-scrllock"></span>' },
  { name: 'Print Screen', value: '<span class="trashcons icon-prntscrn"></span>' },
  { name: 'Pause', value: '<span class="trashcons icon-pause"></span>' },
  { name: 'Plus', value: '<span class="trashcons icon-plus"></span>' },
  { name: 'Minus', value: '<span class="trashcons icon-minus"></span>' },
  { name: 'Multiply', value: '<span class="trashcons icon-mult"></span>' },
  { name: 'Divide', value: '<span class="trashcons icon-div"></span>' },
  { name: 'Lower', value: '<span class="trashcons icon-lower"></span>' },
  { name: 'Raise', value: '<span class="trashcons icon-raise"></span>' },
];

/**
 * Convert parsed icons back to HTML string
 */
export function iconPartsToHtml(parts: ParsedIcon[]): string {
  return parts.map(part => {
    if (part.type === 'icon' && part.className) {
      return `<span class="${part.className}"></span>`;
    }
    return part.content;
  }).join('');
}

/**
 * Convert parsed icons to plain text (with icon unicode characters)
 */
export function iconPartsToText(parts: ParsedIcon[]): string {
  return parts.map(part => part.content).join('');
}

/**
 * Check if a legend contains icon spans
 */
export function hasIcons(legend: string): boolean {
  return /<span\s+class=["'][^"']*(?:trashcons|icon-)[^"']*["']/.test(legend);
}

/**
 * Process labels for icons and auto-size them
 */
export function processLabelsForIcons(labels: string[], parentKey: any): void {
  labels.forEach((label, index) => {
    if (label && hasIcons(label)) {
      // Auto-size icon legends to size 9
      if (!parentKey.textSize) {
        parentKey.textSize = [];
      }
      // Ensure array is long enough
      while (parentKey.textSize.length <= index) {
        parentKey.textSize.push(undefined);
      }
      if (!parentKey.textSize[index]) {
        parentKey.textSize[index] = 9;
      }
    }
  });
}

