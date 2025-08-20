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
  
  // Track rotation origin for maintaining position in rotated sections
  let rotationOriginX: number | null = null;
  
  // Process each row
  for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
    const row = data[rowIndex];
    
    if (!Array.isArray(row)) continue;
    
    // For a new row, Y advances by 1 from the previous row (not by the height of keys)
    if (rowIndex > 0) {
      currentRowY += 1;
    }
    
    // Start new row
    // If we have a rotation origin, maintain X position relative to it
    if (rotationOriginX !== null) {
      current.x = rotationOriginX;
    } else {
      current.x = 0;
    }
    
    // Always use currentRowY for Y position
    current.y = currentRowY;
    current.rowStartY = currentRowY;
    current.maxRowHeight = 1;
    
    // Process items in row
    for (let itemIndex = 0; itemIndex < row.length; itemIndex++) {
      const item = row[itemIndex];
      
      if (typeof item === 'object' && !Array.isArray(item)) {
        // Process key properties
        const props = item as KLEKeyData;
        
        // Rotation properties MUST be processed FIRST
        if (props.rx !== undefined || props.ry !== undefined) {
          // When setting any rotation origin, check if we have both values
          if (props.rx !== undefined) {
            current.rotation_x = props.rx;
            current.x = props.rx; // Reset x to rotation origin
            rotationOriginX = props.rx; // Track this for new rows
          }
          if (props.ry !== undefined) {
            current.rotation_y = props.ry;
            current.y = props.ry; // Reset y to rotation origin
            currentRowY = props.ry; // Also update currentRowY to start from here
          } else if (props.rx !== undefined) {
            // If only rx is set (common for split keyboards), use the current rotation_y
            // This maintains the Y position from the previous rotation section
            current.y = current.rotation_y;
            currentRowY = current.rotation_y;
          }
        }
        if (props.r !== undefined) {
          current.rotation_angle = props.r;
          // Clear rotation origin when rotation is reset to 0
          if (props.r === 0) {
            rotationOriginX = null;
          }
        }
        
        // Position adjustments (AFTER rotation properties)
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
        const labels = item.split('\n');
        
        // In original KLE:
        // Position 4: Front left legend
        // Position 5: Center legend (NOT front!)
        // Position 6: Front right legend
        const frontLegends: string[] = [];
        let centerLegend = '';
        const processedLabels = [...labels];
        
        // Split the original string by \n to get actual positions
        const originalParts = [...labels];
        // Keep a copy for checking size indicators
        const originalPartsCopy = [...originalParts];
        
        if (originalParts.length > 4) {
          let foundFrontLegend = false;
          let foundCenterLegend = false;
          
          // For decal keys, handle positions differently:
          // - Position 6 should stay as label[6] (middle-left)
          // - Position 8 should stay as label[8] (top-center)  
          // For regular keys, positions 4 and 6 are front legends
          if (!current.decal) {
            // Position 4: Front legend
            if (originalParts[4] && originalParts[4].trim()) {
              frontLegends[0] = originalParts[4].trim();
              foundFrontLegend = true;
              originalParts[4] = '';
            }
            
            // Position 6: Front right legend (rarely used)
            if (originalParts[6] && originalParts[6].trim()) {
              frontLegends[2] = originalParts[6].trim();
              foundFrontLegend = true;
              originalParts[6] = '';
            }
          }
          
          // For decal keys, position 8 should remain as a regular label (top-center)
          // For regular keys, position 8 or 9 can be center legend
          if (!current.decal) {
            // Position 8 or 9 as center legend
            // Some KLE layouts use position 9 for center when position 8 is empty
            if (originalParts.length > 8 && originalParts[8] && originalParts[8].trim()) {
              // Position 8 is the standard center position
              centerLegend = originalParts[8].trim();
              foundCenterLegend = true;
              originalParts[8] = '';
            } else if (originalParts.length > 9 && originalParts[9] && originalParts[9].trim()) {
              // Position 9 is used as center in some layouts when 8 is empty
              centerLegend = originalParts[9].trim();
              foundCenterLegend = true;
              // Move position 9 content to position 8 for proper display
              originalParts[8] = originalParts[9];
              originalParts[9] = '';
            }
          }
          
          // Extended positions for WIDE keys like spacebars (positions 10, 11)
          // Only treat 10-11 as additional front legends for wide keys
          if (current.width >= 2) {
            // For wide keys (like spacebars), positions 10-11 can be front legends
            for (let i = 10; i < originalParts.length && i <= 11; i++) {
              if (originalParts[i] && originalParts[i].trim()) {
                const legendText = originalParts[i].trim();
                
                // Position 10 -> center front (index 1)
                // Position 11 -> right front (index 2)
                const frontLegendIndex = i - 9; // Maps 10->1, 11->2
                
                // Only set if not already set by positions 4-6
                if (!frontLegends[frontLegendIndex]) {
                  frontLegends[frontLegendIndex] = legendText;
                }
                
                foundFrontLegend = true;
                // Clear this part from the original
                originalParts[i] = '';
              }
            }
          }
          
          // If we found a front legend or center legend, reconstruct the labels
          if (foundFrontLegend || foundCenterLegend) {
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
          // First check if SCOOP/BAR is already in the center legend
          if (centerLegend && centerLegend.match(/\b(SCOOP|BAR)\b/i)) {
            isHomingKey = true;
            // Normalize the text
            if (centerLegend.match(/\bSCOOP\b/i)) {
              centerLegend = 'Scoop';
            } else if (centerLegend.match(/\bBAR\b/i)) {
              centerLegend = 'Bar';
            }
          } else {
            // Check front legends
            for (let i = 0; i < frontLegends.length; i++) {
              const legend = frontLegends[i];
              if (legend && legend.match(/\b(SCOOP|BAR)\b/i)) {
                isHomingKey = true;
                // Move it to center legend
                if (legend.match(/\bSCOOP\b/i)) {
                  centerLegend = 'Scoop';
                } else if (legend.match(/\bBAR\b/i)) {
                  centerLegend = 'Bar';
                }
                // Clear the original position
                frontLegends[i] = frontLegends[i].replace(/\b(SCOOP|BAR)\b/gi, '').replace(/\s+/g, ' ').trim();
                break;
              }
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
        
        // Add center legend if we found one
        if (centerLegend) {
          key.centerLegend = centerLegend;
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