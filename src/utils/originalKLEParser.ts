import { Key, Keyboard, KLEKeyData, KeyProfile } from '../types';
import { generateKeyId } from './keyUtils';
import { processLabelsForIcons } from './iconParser';

interface OriginalKLEParseState {
  // Current position - absolute coordinates
  x: number;
  y: number;
  
  // Size properties
  width: number;
  height: number;
  x2: number;
  y2: number;
  width2: number;
  height2: number;
  
  // Rotation properties
  rotation_x: number;
  rotation_y: number;
  rotation_angle: number;
  
  // Appearance properties
  color: string;
  textColor: string[];
  textSize: number[];
  default: {
    textColor?: string;
    textSize?: number;
  };
  
  // Key properties
  ghost: boolean;
  profile: KeyProfile;
  nub: boolean;
  stepped: boolean;
  decal: boolean;
  align?: number;
  
  // Tracking for row positioning
  rowStartY: number;  // Y position at the start of current row
  maxRowHeight: number;  // Maximum height seen in current row
}

const defaultState: OriginalKLEParseState = {
  x: 0,
  y: 0,
  width: 1,
  height: 1,
  x2: 0,
  y2: 0,
  width2: 0,
  height2: 0,
  rotation_x: 0,
  rotation_y: 0,
  rotation_angle: 0,
  color: '#f9f9f9',
  textColor: [],
  textSize: [],
  default: {},
  ghost: false,
  profile: 'DCS',
  nub: false,
  stepped: false,
  decal: false,
  rowStartY: 0,
  maxRowHeight: 1,
};

export interface OriginalKLEParseOptions {
  homingNubType?: 'scoop' | 'bar' | 'none';
}

/**
 * Parse original KLE format JSON string
 * In original KLE, each row starts below the previous row based on the max height of keys in that row
 */
export function parseOriginalKLEString(kleString: string): any {
  try {
    // First try standard JSON parse
    return JSON.parse(kleString);
  } catch (e) {
    // If that fails, try JavaScript object notation conversion
    try {
      const trimmed = kleString.trim();
      if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) {
        throw new Error('Invalid KLE format: must start with [ or {');
      }
      
      // Handle KLE format with metadata object followed by arrays
      if (/^\{[\s\S]*\},\s*\[/.test(trimmed)) {
        const wrappedString = '[' + trimmed + ']';
        // eslint-disable-next-line no-eval
        const parsed = eval('(' + wrappedString + ')');
        
        if (Array.isArray(parsed) && parsed.length >= 2) {
          return parsed; // Return the full array with metadata and rows
        }
      }
      
      // Handle multiple arrays (rows only)
      let wrappedString = trimmed;
      if (/^\[[\s\S]*\],\s*\[/.test(trimmed)) {
        wrappedString = '[' + trimmed + ']';
      }
      
      if (/^[\[\{][\s\S]*[\]\}]$/.test(wrappedString)) {
        // eslint-disable-next-line no-eval
        const result = eval('(' + wrappedString + ')');
        return result;
      }
      
      throw new Error('Invalid KLE format');
    } catch (convertError) {
      throw new Error('Failed to parse KLE string: ' + (convertError instanceof Error ? convertError.message : 'unknown error'));
    }
  }
}

export function parseOriginalKLE(json: any, options?: OriginalKLEParseOptions): Keyboard {
  const keyboard: Keyboard = {
    meta: {},
    keys: []
  };
  
  let data: any[] = [];
  
  // Handle different input formats
  if (Array.isArray(json)) {
    // Check if first element is metadata object
    if (json.length > 0 && !Array.isArray(json[0]) && typeof json[0] === 'object') {
      // Extract metadata
      const meta = json[0];
      if (meta.name) keyboard.meta.name = meta.name;
      if (meta.author) keyboard.meta.author = meta.author;
      if (meta.notes) keyboard.meta.notes = meta.notes;
      if (meta.background) keyboard.meta.background = meta.background;
      if (meta.radii) keyboard.meta.radii = meta.radii;
      if (meta.switchMount) keyboard.meta.switchMount = meta.switchMount;
      if (meta.switchBrand) keyboard.meta.switchBrand = meta.switchBrand;
      if (meta.switchType) keyboard.meta.switchType = meta.switchType;
      if (meta.plate) keyboard.meta.plate = meta.plate;
      if (meta.pcb) keyboard.meta.pcb = meta.pcb;
      if (meta.css) keyboard.meta.css = meta.css;
      
      // Rest of array is keyboard data
      data = json.slice(1);
    } else {
      // All elements are keyboard rows
      data = json;
    }
  } else {
    throw new Error('Invalid KLE format: expected array');
  }
  
  // Initialize parse state
  let current = { ...defaultState };
  
  // Track the Y position for rows
  let currentRowY = 0;
  
  // Process each row
  for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
    const row = data[rowIndex];
    
    if (!Array.isArray(row)) continue;
    
    // For a new row, Y advances by 1 from the previous row (not by the height of keys)
    if (rowIndex > 0) {
      currentRowY += 1;
    }
    
    // Start new row
    current.x = 0;
    current.y = currentRowY;
    current.rowStartY = currentRowY;
    current.maxRowHeight = 1;
    
    // Process items in row
    for (let itemIndex = 0; itemIndex < row.length; itemIndex++) {
      const item = row[itemIndex];
      
      if (typeof item === 'object' && !Array.isArray(item)) {
        // Process key properties
        const props = item as KLEKeyData;
        
        // Position adjustments
        if (props.x !== undefined) current.x += props.x;
        if (props.y !== undefined) {
          // y adjustment is relative to current position
          current.y += props.y;
          currentRowY = current.y;
          current.rowStartY = current.y;
        }
        
        // Size properties
        if (props.w !== undefined) current.width = props.w;
        if (props.h !== undefined) {
          current.height = props.h;
          // Track max height for this row
          const keyBottom = current.y - current.rowStartY + props.h;
          current.maxRowHeight = Math.max(current.maxRowHeight, keyBottom);
        }
        if (props.x2 !== undefined) current.x2 = props.x2;
        if (props.y2 !== undefined) current.y2 = props.y2;
        if (props.w2 !== undefined) current.width2 = props.w2;
        if (props.h2 !== undefined) current.height2 = props.h2;
        
        // Rotation properties
        if (props.rx !== undefined) {
          current.rotation_x = props.rx;
          current.x = props.rx; // Reset x to rotation origin
        }
        if (props.ry !== undefined) {
          current.rotation_y = props.ry;
          current.y = props.ry; // Reset y to rotation origin
        }
        if (props.r !== undefined) current.rotation_angle = props.r;
        
        // Appearance properties
        if (props.c !== undefined) current.color = props.c;
        if (props.t !== undefined) {
          if (typeof props.t === 'string') {
            current.default.textColor = props.t;
          } else if (Array.isArray(props.t)) {
            current.textColor = props.t;
          }
        }
        if (props.f !== undefined) {
          if (typeof props.f === 'number') {
            current.default.textSize = props.f;
          } else if (Array.isArray(props.f)) {
            current.textSize = props.f;
          }
        }
        
        // Key properties
        if (props.g !== undefined) current.ghost = props.g;
        if (props.p !== undefined) current.profile = props.p;
        if (props.n !== undefined) current.nub = props.n;
        if (props.l !== undefined) current.stepped = props.l;
        if (props.d !== undefined) current.decal = props.d;
        if (props.a !== undefined) current.align = props.a;
        
      } else if (typeof item === 'string') {
        // Create key with current state
        const labels = item.split('\\n');
        
        // In original KLE, positions 4, 5, 6 are front legends
        // When we detect them, we'll always put them in the left front position
        const frontLegends: string[] = [];
        const processedLabels = [...labels];
        
        // Universal front legend detection: if ANY label string has content in positions 4+,
        // that content is a front legend. This handles icons, decals, and any other case.
        // Split the original string by \n to get actual positions
        const originalParts = item.split('\n');
        // Keep a copy for checking size indicators
        const originalPartsCopy = [...originalParts];
        
        if (originalParts.length > 4) {
          let foundFrontLegend = false;
          
          // Standard front legend positions (4, 5, 6)
          for (let i = 4; i < originalParts.length && i <= 6; i++) {
            if (originalParts[i] && originalParts[i].trim()) {
              // This is a front legend
              const legendText = originalParts[i].trim();
              
              // Special handling for smaller spacebars
              // If position 4 has a size indicator (like "1.25u") and position 5 has text,
              // put position 5 text in the right front legend to avoid overlap
              let frontLegendIndex;
              
              if (i === 5 && originalPartsCopy[4] && originalPartsCopy[4].trim().match(/^\d+(\.\d+)?u$/i)) {
                // This is position 5 with a size indicator in position 4
                // Put it in the right front legend (index 2) instead of center
                frontLegendIndex = 2;
              } else {
                // Standard mapping
                frontLegendIndex = i - 4; // Maps 4->0, 5->1, 6->2
              }
              
              if (!frontLegends[frontLegendIndex]) {
                frontLegends[frontLegendIndex] = legendText;
              } else {
                // If position already taken, append
                frontLegends[frontLegendIndex] += ' ' + legendText;
              }
              
              foundFrontLegend = true;
              // Clear this part from the original
              originalParts[i] = '';
            }
          }
          
          // Extended positions for spacebars (positions 9, 10, 11)
          // These also map to front legends (left, center, right)
          for (let i = 9; i < originalParts.length && i <= 11; i++) {
            if (originalParts[i] && originalParts[i].trim()) {
              // This is a front legend for spacebars
              const legendText = originalParts[i].trim();
              
              // Position 9 (index 9) -> left (index 0)
              // Position 10 (index 10) -> center (index 1)  
              // Position 11 (index 11) -> right (index 2)
              const frontLegendIndex = i - 9; // Maps 9->0, 10->1, 11->2
              
              // Only set if not already set by positions 4-6
              if (!frontLegends[frontLegendIndex]) {
                frontLegends[frontLegendIndex] = legendText;
              }
              
              foundFrontLegend = true;
              // Clear this part from the original
              originalParts[i] = '';
            }
          }
          
          // If we found a front legend, reconstruct the labels without the front legend text
          if (foundFrontLegend) {
            // Reconstruct each label position
            for (let i = 0; i < processedLabels.length; i++) {
              if (i < originalParts.length) {
                processedLabels[i] = originalParts[i];
              }
            }
          }
        }
        
        // Handle homing nubs BEFORE creating the key
        let isHomingKey = false;
        if (current.nub) {
          // First check if SCOOP/BAR is already in the front legends (from position 4/5/6)
          for (let i = 0; i < frontLegends.length; i++) {
            const legend = frontLegends[i];
            if (legend && legend.match(/\b(SCOOP|BAR)\b/i)) {
              isHomingKey = true;
              // Move it to center position if not already there
              if (i !== 1) {
                if (legend.match(/\bSCOOP\b/i)) {
                  frontLegends[1] = 'Scoop';
                } else if (legend.match(/\bBAR\b/i)) {
                  frontLegends[1] = 'Bar';
                }
                // Clear the original position
                frontLegends[i] = frontLegends[i].replace(/\b(SCOOP|BAR)\b/gi, '').replace(/\s+/g, ' ').trim();
              }
              break;
            }
          }
          
          // If not found in front legends, check regular labels
          if (!isHomingKey) {
            for (let i = 0; i < processedLabels.length; i++) {
              const label = processedLabels[i];
              if (label && label.match(/\b(SCOOP|BAR)\b/i)) {
                isHomingKey = true;
                if (label.match(/\bSCOOP\b/i)) {
                  frontLegends[1] = 'Scoop'; // Center position
                } else if (label.match(/\bBAR\b/i)) {
                  frontLegends[1] = 'Bar'; // Center position
                }
                // Clean the label - remove SCOOP/BAR text (case insensitive, word boundary)
                processedLabels[i] = label.replace(/\b(SCOOP|BAR)\b/gi, '').replace(/\s+/g, ' ').trim();
                break;
              }
            }
          }
          
          // If no explicit SCOOP/BAR label, use default
          if (current.nub && !isHomingKey && options?.homingNubType !== 'none') {
            frontLegends[1] = options?.homingNubType === 'scoop' ? 'Scoop' : 'Bar';
          }
        }
        
        const key: Key = {
          id: generateKeyId(),
          x: current.x,
          y: current.y,
          width: current.width,
          height: current.height,
          labels: processedLabels,
          color: current.color,
          profile: current.profile,
        };
        
        // Process icons in labels - this may modify current.textSize
        processLabelsForIcons(labels, current);
        
        
        // Apply default text size to all labels if set
        if (current.default.textSize !== undefined) {
          // If no specific text sizes are set, create an array with default size for all labels
          if (current.textSize.length === 0) {
            current.textSize = new Array(labels.length).fill(current.default.textSize);
          } else {
            // Fill any undefined positions with the default size
            for (let i = 0; i < labels.length; i++) {
              if (current.textSize[i] === undefined) {
                current.textSize[i] = current.default.textSize;
              }
            }
          }
        }
        
        
        // Add optional properties
        if (current.x2) key.x2 = current.x2;
        if (current.y2) key.y2 = current.y2;
        if (current.width2) key.width2 = current.width2;
        if (current.height2) key.height2 = current.height2;
        
        if (current.rotation_angle) {
          key.rotation_x = current.rotation_x;
          key.rotation_y = current.rotation_y;
          key.rotation_angle = current.rotation_angle;
        }
        
        if (current.textColor.length > 0) key.textColor = [...current.textColor];
        // IMPORTANT: Copy textSize AFTER processLabelsForIcons and default size application
        if (current.textSize.length > 0) key.textSize = [...current.textSize];
        
        if (current.ghost) key.ghost = current.ghost;
        if (current.stepped) key.stepped = current.stepped;
        if (current.decal) key.decal = current.decal;
        if (current.align !== undefined) key.align = current.align;
        
        // Set nub property if it exists
        if (current.nub) {
          key.nub = current.nub;
        }
        
        if (current.default.textColor || current.default.textSize) {
          key.default = {
            color: current.default.textColor ? [current.default.textColor] : undefined,
            size: current.default.textSize ? [current.default.textSize] : undefined
          };
        }
        
        // Add front legends if we found any
        if (frontLegends.length > 0 && frontLegends.some(l => l.length > 0)) {
          key.frontLegends = frontLegends;
        }
        
        keyboard.keys.push(key);
        
        // Move x position for next key
        current.x += current.width;
        
        // Reset properties for next key (but keep position)
        current.width = 1;
        current.height = 1;
        current.x2 = 0;
        current.y2 = 0;
        current.width2 = 0;
        current.height2 = 0;
        current.nub = false;
        current.stepped = false;
        current.decal = false;
        current.textColor = [];
        current.textSize = [];
      }
    }
  }
  
  return keyboard;
}

/**
 * Import from original KLE file
 */
export async function importOriginalKLEFile(file: File, options?: OriginalKLEParseOptions): Promise<Keyboard> {
  const text = await file.text();
  const parsed = parseOriginalKLEString(text);
  return parseOriginalKLE(parsed, options);
}