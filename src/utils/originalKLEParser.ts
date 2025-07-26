import { Key, Keyboard, KLEKeyData, KeyProfile } from '../types';
import { generateKeyId } from './keyUtils';
import { processLabelsForIcons, parseIconLegend, hasIcons } from './iconParser';

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
  const homingNubType = options?.homingNubType || 'scoop';
  
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
        
        // Check if any of the first 4 positions (0-3) have icons
        let hasIconInTop = false;
        for (let i = 0; i <= 3 && i < labels.length; i++) {
          if (labels[i] && hasIcons(labels[i])) {
            hasIconInTop = true;
            break;
          }
        }
        
        // If we have icons in top positions and text in positions 4-6,
        // that text is a front legend - always put it in the left position
        if (hasIconInTop) {
          for (let i = 4; i <= 6 && i < labels.length; i++) {
            if (labels[i] && labels[i].trim()) {
              // Always put front legend text in position 0 (left)
              if (!frontLegends[0]) {
                frontLegends[0] = labels[i];
              } else {
                // If left is already taken, concatenate
                frontLegends[0] += ' ' + labels[i];
              }
              // Clear this position from the main labels
              processedLabels[i] = '';
            }
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
        // IMPORTANT: Copy textSize AFTER processLabelsForIcons, as it may have been modified
        if (current.textSize.length > 0) key.textSize = [...current.textSize];
        
        if (current.ghost) key.ghost = current.ghost;
        if (current.stepped) key.stepped = current.stepped;
        if (current.decal) key.decal = current.decal;
        if (current.align !== undefined) key.align = current.align;
        
        // Handle homing nubs
        if (current.nub) {
          key.nub = current.nub;
          let hasHomingLabel = false;
          
          for (const label of labels) {
            if (label && (label.includes('SCOOP') || label.includes('BAR'))) {
              hasHomingLabel = true;
              if (label.includes('SCOOP')) {
                key.frontLegends = ['', 'Scoop', ''];
              } else if (label.includes('BAR')) {
                key.frontLegends = ['', 'Bar', ''];
              }
              // Clean the label
              const cleanedLabel = label.replace(/\n*(SCOOP|BAR)\s*$/, '').trim();
              const labelIndex = labels.indexOf(label);
              if (labelIndex >= 0) {
                labels[labelIndex] = cleanedLabel;
              }
              break;
            }
          }
          
          if (!hasHomingLabel && homingNubType !== 'none') {
            key.frontLegends = ['', homingNubType === 'scoop' ? 'Scoop' : 'Bar', ''];
          }
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
        current.ghost = false;
        current.nub = false;
        current.stepped = false;
        current.decal = false;
        current.textColor = [];
        current.textSize = [];
        current.align = undefined;
      }
    }
  }
  
  console.log(`Parsed ${keyboard.keys.length} keys from original KLE format`);
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