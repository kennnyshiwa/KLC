import { Key, Keyboard, KLEKeyData, KeyProfile } from '../types';
import { generateKeyId } from './keyUtils';
import { processLabelsForIcons } from './iconParser';

interface ParseState {
  x: number;
  y: number;
  width: number;
  height: number;
  x2: number;
  y2: number;
  width2: number;
  height2: number;
  rotation_x: number;
  rotation_y: number;
  rotation_angle: number;
  rotation_center_set: boolean; // Track if rotation center was explicitly set
  color: string;
  textColor: string[];
  textSize: number[];
  default: {
    textColor?: string;
    textSize?: number;
  };
  ghost: boolean;
  profile: KeyProfile;
  nub: boolean;
  stepped: boolean;
  decal: boolean;
  align?: number;
}

const defaultState: ParseState = {
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
  rotation_center_set: false,
  color: '#f9f9f9',
  textColor: [],
  textSize: [],
  default: {},
  ghost: false,
  profile: 'DCS',
  nub: false,
  stepped: false,
  decal: false,
};

export interface ParseKLEOptions {
  homingNubType?: 'scoop' | 'bar' | 'none';
}

// Parse JavaScript object notation (KLE format) to JSON
export function parseKLEString(kleString: string): any {
  try {
    // First try standard JSON parse
    return JSON.parse(kleString);
  } catch (e) {
    // If that fails, convert JavaScript object notation to JSON
    try {
      
      // Add safety check - only allow object/array literals
      const trimmed = kleString.trim();
      if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) {
        throw new Error('Invalid KLE format: must start with [ or {');
      }
      
      // Check for full KLE JSON format: {metadata}, [arrays]
      // This regex checks if we have {}, [], [] pattern
      if (/^\{[\s\S]*\},\s*\[/.test(trimmed)) {
        // This is a full KLE export with metadata
        // Wrap everything in an array to make it valid JSON-like structure
        const wrappedString = '[' + trimmed + ']';
        // eslint-disable-next-line no-eval
        const parsed = eval('(' + wrappedString + ')');
        
        // Reconstruct as a proper object
        if (Array.isArray(parsed) && parsed.length >= 2) {
          const metadata = parsed[0];
          // All remaining elements are keyboard rows
          const keyboardData = parsed.slice(1);
          
          // Merge metadata with keyboard data
          return { ...metadata, keyboardData };
        }
      }
      
      // The issue is that there are multiple array expressions separated by commas
      // We need to wrap the entire thing in an outer array
      let wrappedString = trimmed;
      
      // Check if it's multiple arrays at the top level (KLE format)
      // This regex checks if we have [...], [...], ... pattern
      if (/^\[[\s\S]*\],\s*\[/.test(trimmed)) {
        // Wrap in outer array
        wrappedString = '[' + trimmed + ']';
      }
      
      // Use eval with strict safety checks
      // Only allow if it's clearly an object/array literal
      if (/^[\[\{][\s\S]*[\]\}]$/.test(wrappedString)) {
        // eslint-disable-next-line no-eval
        const result = eval('(' + wrappedString + ')');
        
        // If we wrapped it, return the inner array
        if (wrappedString !== trimmed && Array.isArray(result) && result.length > 0) {
          return result;
        }
        
        return result;
      } else {
        throw new Error('Invalid KLE format: not a valid object/array literal');
      }
    } catch (convertError) {
      throw new Error('Invalid KLE format: ' + (convertError instanceof Error ? convertError.message : 'unknown error'));
    }
  }
}

export function parseKLE(json: any, options?: ParseKLEOptions): Keyboard {
  const keyboard: Keyboard = {
    meta: {},
    keys: []
  };

  // Handle full KLE JSON format with metadata
  let keyboardData = json;
  if (!Array.isArray(json)) {
    // Check if it's a full KLE JSON object
    if (typeof json === 'object' && json !== null) {
      // Extract metadata
      if (json.name) keyboard.meta.name = json.name;
      if (json.author) keyboard.meta.author = json.author;
      if (json.notes) keyboard.meta.notes = json.notes;
      if (json.background) keyboard.meta.background = json.background;
      if (json.radii) keyboard.meta.radii = json.radii;
      if (json.switchMount) keyboard.meta.switchMount = json.switchMount;
      if (json.switchBrand) keyboard.meta.switchBrand = json.switchBrand;
      if (json.switchType) keyboard.meta.switchType = json.switchType;
      if (json.plate) keyboard.meta.plate = json.plate;
      if (json.pcb) keyboard.meta.pcb = json.pcb;
      if (json.css) keyboard.meta.css = json.css;
      
      // Check if we have keyboardData property (from parseKLEString)
      if (json.keyboardData && Array.isArray(json.keyboardData)) {
        keyboardData = json.keyboardData;
      } else {
        // The actual keyboard data should be in the first array property after metadata
        // Find the first property that is an array
        const keys = Object.keys(json);
        for (const key of keys) {
          if (Array.isArray(json[key])) {
            keyboardData = json[key];
            break;
          }
        }
      }
      
      // If no array found, this might be a metadata object followed by arrays
      if (!Array.isArray(keyboardData)) {
        throw new Error('Invalid KLE format: no keyboard data array found');
      }
    } else {
      throw new Error('Invalid KLE format: expected array or object');
    }
  }


  // Create a fresh state copy for safety - ensure arrays are deep copied
  let current = { 
    ...defaultState,
    textColor: [...defaultState.textColor],
    textSize: [...defaultState.textSize],
    default: { ...defaultState.default }
  };
  let cluster = { x: 0, y: 0 };
  let rowY = 0;
  
  
  // Default to 'scoop' if not specified
  const homingNubType = options?.homingNubType || 'scoop';

  for (let rowIndex = 0; rowIndex < keyboardData.length; rowIndex++) {
    const row = keyboardData[rowIndex];
    if (Array.isArray(row)) {
      // Track if this row has explicit y positioning
      let rowHasExplicitY = false;
      let minY = Infinity;
      
      // New row always resets x to cluster origin
      current.x = cluster.x;
      current.y = cluster.y + rowY;
      
      for (let item of row) {
        if (typeof item === 'object') {
          // Process key properties
          const props = item as KLEKeyData;
          
          
          if (props.x !== undefined) current.x += props.x;
          if (props.y !== undefined) {
            // y is relative to the current row position
            current.y = cluster.y + rowY + props.y;
            rowHasExplicitY = true;
            minY = Math.min(minY, props.y);
          }
          if (props.w !== undefined) current.width = props.w;
          if (props.h !== undefined) current.height = props.h;
          if (props.x2 !== undefined) current.x2 = props.x2;
          if (props.y2 !== undefined) current.y2 = props.y2;
          if (props.w2 !== undefined) current.width2 = props.w2;
          if (props.h2 !== undefined) current.height2 = props.h2;
          if (props.rx !== undefined) {
            current.rotation_x = props.rx;
            current.rotation_center_set = true;
            cluster.x = props.rx;
            // Only reset x if it wasn't explicitly set in this object
            if (props.x === undefined) {
              current.x = props.rx;
            }
            // Reset row offset when we enter a rotation cluster
            rowY = 0;
          }
          if (props.ry !== undefined) {
            current.rotation_y = props.ry;
            current.rotation_center_set = true;
            cluster.y = props.ry;
            // Only reset y if it wasn't explicitly set in this object
            if (props.y === undefined) {
              current.y = props.ry;
            }
            // Reset row offset when we enter a rotation cluster
            rowY = 0;
          }
          if (props.r !== undefined) current.rotation_angle = props.r;
          if (props.c !== undefined) current.color = props.c;
          if (props.t !== undefined) {
            if (typeof props.t === 'string') {
              current.default.textColor = props.t;
            } else if (Array.isArray(props.t)) {
              current.textColor = props.t;
            }
          }
          if (props.g !== undefined) current.ghost = props.g;
          if (props.p !== undefined) current.profile = props.p;
          if (props.n !== undefined) current.nub = props.n;
          if (props.l !== undefined) current.stepped = props.l;
          if (props.d !== undefined) current.decal = props.d;
          if (props.a !== undefined) current.align = props.a;
          if (props.f !== undefined) {
            if (typeof props.f === 'number') {
              current.default.textSize = props.f;
            } else if (Array.isArray(props.f)) {
              current.textSize = props.f;
            }
          }
        } else if (typeof item === 'string') {
          // Create key with current state
          const labels = item.split('\\n');
          
          
          const key: Key = {
            id: generateKeyId(),
            x: current.x,
            y: current.y,
            width: current.width,
            height: current.height,
            labels: labels,
            color: current.color,
            profile: current.profile,
          };
          
          // Auto-size icon legends before adding optional properties
          processLabelsForIcons(labels, current);
          

          // Add optional properties
          if (current.x2) key.x2 = current.x2;
          if (current.y2) key.y2 = current.y2;
          if (current.width2) key.width2 = current.width2;
          if (current.height2) key.height2 = current.height2;
          if (current.rotation_angle) {
            // Only set rotation center if it was explicitly set with rx/ry
            // If not set, the key will rotate around its own center
            if (current.rotation_x !== 0 || current.rotation_y !== 0) {
              key.rotation_x = current.rotation_x;
              key.rotation_y = current.rotation_y;
            }
            key.rotation_angle = current.rotation_angle;
          }
          if (current.textColor.length > 0) key.textColor = [...current.textColor];
          if (current.textSize.length > 0) key.textSize = [...current.textSize];
          if (current.ghost) key.ghost = current.ghost;
          if (current.nub) {
            key.nub = current.nub;
            // Check if the labels contain SCOOP or BAR
            let hasHomingLabel = false;
            for (const label of labels) {
              if (label && (label.includes('SCOOP') || label.includes('BAR'))) {
                hasHomingLabel = true;
                // Extract the homing type from the label
                if (label.includes('SCOOP')) {
                  key.frontLegends = ['', 'Scoop', ''];
                } else if (label.includes('BAR')) {
                  key.frontLegends = ['', 'Bar', ''];
                }
                // Remove the SCOOP/BAR text from the label
                const cleanedLabel = label.replace(/\n*(SCOOP|BAR)\s*$/, '').trim();
                const labelIndex = labels.indexOf(label);
                if (labelIndex >= 0 && labelIndex < labels.length) {
                  labels[labelIndex] = cleanedLabel;
                }
                break;
              }
            }
            
            // If no homing label found, use the default from options
            if (!hasHomingLabel && homingNubType !== 'none') {
              key.frontLegends = ['', homingNubType === 'scoop' ? 'Scoop' : 'Bar', ''];
            }
          }
          if (current.stepped) key.stepped = current.stepped;
          if (current.decal) key.decal = current.decal;
          if (current.align !== undefined) key.align = current.align;
          if (current.default.textColor || current.default.textSize) {
            key.default = {
              color: current.default.textColor ? [current.default.textColor] : undefined,
              size: current.default.textSize ? [current.default.textSize] : undefined
            };
          }

          keyboard.keys.push(key);

          // Reset state for next key
          current.x += current.width;
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
          
          // Don't reset Y position - it should maintain its value from property changes
        }
      }
      
      // Move to next row
      // If this row had explicit negative Y positioning, don't add full row height
      if (rowHasExplicitY && minY < 0) {
        // Add the row height adjusted by the negative offset
        rowY += Math.max(0, 1 + minY);
      } else {
        // Normal row increment
        rowY += 1;
      }
      
      // Reset rotation center flag for next row
      current.rotation_center_set = false;
    } else if (typeof row === 'object' && !Array.isArray(row)) {
      // Keyboard metadata
      if ('name' in row) keyboard.meta.name = row.name;
      if ('author' in row) keyboard.meta.author = row.author;
      if ('notes' in row) keyboard.meta.notes = row.notes;
      if ('background' in row) keyboard.meta.background = row.background;
      if ('radii' in row) keyboard.meta.radii = row.radii;
      if ('switchMount' in row) keyboard.meta.switchMount = row.switchMount;
      if ('switchBrand' in row) keyboard.meta.switchBrand = row.switchBrand;
      if ('switchType' in row) keyboard.meta.switchType = row.switchType;
      if ('plate' in row) keyboard.meta.plate = row.plate;
      if ('pcb' in row) keyboard.meta.pcb = row.pcb;
      if ('css' in row) keyboard.meta.css = row.css;
    }
  }

  return keyboard;
}

export function serializeToKLE(keyboard: Keyboard): any[] {
  const output: any[] = [];
  
  // Add metadata if present
  if (Object.keys(keyboard.meta).length > 0) {
    output.push(keyboard.meta);
  }

  // Group keys by rows
  const rows = new Map<number, Key[]>();
  for (const key of keyboard.keys) {
    const row = Math.floor(key.y);
    if (!rows.has(row)) {
      rows.set(row, []);
    }
    rows.get(row)!.push(key);
  }

  // Sort rows and keys within rows
  const sortedRows = Array.from(rows.entries()).sort((a, b) => a[0] - b[0]);

  let lastState = { ...defaultState };

  for (const [, rowKeys] of sortedRows) {
    const row: any[] = [];
    const sortedKeys = rowKeys.sort((a, b) => a.x - b.x);
    
    for (const key of sortedKeys) {
      const props: any = {};
      
      // Position
      if (Math.abs(key.x - lastState.x) > 0.01) {
        props.x = key.x - lastState.x;
      }
      if (Math.abs(key.y - lastState.y) > 0.01) {
        props.y = key.y - lastState.y;
      }
      
      // Size
      if (key.width !== 1) props.w = key.width;
      if (key.height !== 1) props.h = key.height;
      if (key.x2) props.x2 = key.x2;
      if (key.y2) props.y2 = key.y2;
      if (key.width2) props.w2 = key.width2;
      if (key.height2) props.h2 = key.height2;
      
      // Rotation
      if (key.rotation_angle) {
        props.r = key.rotation_angle;
        if (key.rotation_x !== lastState.rotation_x) props.rx = key.rotation_x;
        if (key.rotation_y !== lastState.rotation_y) props.ry = key.rotation_y;
      }
      
      // Appearance
      if (key.color !== lastState.color) props.c = key.color;
      if (key.textColor && key.textColor.length > 0) props.t = key.textColor;
      if (key.textSize && key.textSize.length > 0) props.f = key.textSize;
      if (key.profile !== lastState.profile) props.p = key.profile;
      
      // Flags
      if (key.ghost) props.g = true;
      if (key.nub) props.n = true;
      if (key.stepped) props.l = true;
      if (key.decal) props.d = true;
      
      // Add properties object if not empty
      if (Object.keys(props).length > 0) {
        row.push(props);
      }
      
      // Add key labels
      row.push(key.labels.join('\\n'));
      
      // Update last state
      lastState.x = key.x + key.width;
      lastState.y = key.y;
      if (key.color) lastState.color = key.color;
      if (key.profile) lastState.profile = key.profile;
      if (key.rotation_x !== undefined) lastState.rotation_x = key.rotation_x;
      if (key.rotation_y !== undefined) lastState.rotation_y = key.rotation_y;
      if (key.rotation_angle !== undefined) lastState.rotation_angle = key.rotation_angle;
    }
    
    output.push(row);
  }
  
  return output;
}

// Convert JSON to KLE's JavaScript object notation string
export function serializeToKLEString(keyboard: Keyboard): string {
  const kleData = serializeToKLE(keyboard);
  
  // Convert to JavaScript object notation by removing quotes from property names
  const jsonString = JSON.stringify(kleData, null, 2);
  
  // Only remove quotes from property names, not from string values
  return jsonString.replace(/"([^"]+)":\s*/g, (_, propName) => {
    return `${propName}: `;
  });
}