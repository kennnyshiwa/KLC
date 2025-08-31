import { Keyboard, Key, KLEKeyData } from '../types';

/**
 * Export a keyboard to original KLE JSON format
 */
export function exportToKLE(keyboard: Keyboard, krkMode: boolean = false): any[] {
  const result: any[] = [];
  
  // Add metadata if present
  if (keyboard.meta && Object.keys(keyboard.meta).length > 0) {
    const meta: any = {};
    if (keyboard.meta.name) meta.name = keyboard.meta.name;
    if (keyboard.meta.author) meta.author = keyboard.meta.author;
    if (keyboard.meta.notes) meta.notes = keyboard.meta.notes;
    if (keyboard.meta.background) meta.background = keyboard.meta.background;
    if (keyboard.meta.radii) meta.radii = keyboard.meta.radii;
    if (keyboard.meta.switchMount) meta.switchMount = keyboard.meta.switchMount;
    if (keyboard.meta.switchBrand) meta.switchBrand = keyboard.meta.switchBrand;
    if (keyboard.meta.switchType) meta.switchType = keyboard.meta.switchType;
    if (keyboard.meta.plate !== undefined) meta.plate = keyboard.meta.plate;
    if (keyboard.meta.pcb !== undefined) meta.pcb = keyboard.meta.pcb;
    if (keyboard.meta.css) meta.css = keyboard.meta.css;
    
    if (Object.keys(meta).length > 0) {
      result.push(meta);
    }
  }
  
  // Separate keys into non-rotated and rotated
  const nonRotatedKeys: Key[] = [];
  const rotatedKeys: Key[] = [];
  
  keyboard.keys.forEach(key => {
    if (key.rotation_angle && key.rotation_angle !== 0) {
      rotatedKeys.push(key);
    } else {
      nonRotatedKeys.push(key);
    }
  });
  
  // Sort non-rotated keys by Y then X
  nonRotatedKeys.sort((a, b) => {
    if (Math.abs(a.y - b.y) < 0.001) {
      return a.x - b.x;
    }
    return a.y - b.y;
  });
  
  // Sort rotated keys by Y then X
  rotatedKeys.sort((a, b) => {
    if (Math.abs(a.y - b.y) < 0.001) {
      return a.x - b.x;
    }
    return a.y - b.y;
  });
  
  // Group non-rotated keys into rows
  const rows: Key[][] = [];
  let currentRow: Key[] = [];
  let currentY: number | null = null;
  
  nonRotatedKeys.forEach(key => {
    const keyY = Math.round(key.y * 4) / 4;
    
    // Check if we need to start a new row
    const needNewRow = currentY === null || Math.abs(keyY - currentY) > 0.001;
    
    if (needNewRow) {
      if (currentRow.length > 0) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentY = keyY;
    }
    
    currentRow.push(key);
  });
  
  // Don't forget the last non-rotated row
  if (currentRow.length > 0) {
    rows.push(currentRow);
  }
  
  // Add each rotated key as its own row at the end
  rotatedKeys.forEach(key => {
    rows.push([key]);
  });
  
  // Default values to track changes
  const defaults = {
    color: '#cccccc',
    textColor: undefined as string | undefined,
    textSize: undefined as number | undefined,
    profile: '',  // Empty means no profile set
    width: 1,
    height: 1,
    x: 0,
    y: 0,
    x2: 0,
    y2: 0,
    width2: 0,
    height2: 0,
    rotation_angle: 0,
    rotation_x: 0,
    rotation_y: 0,
    ghost: false,
    stepped: false,
    nub: false,
    decal: false,
    align: undefined as number | undefined,
  };
  
  // Track current state
  let current = { ...defaults };
  let lastY = 0;
  
  // Process each row
  rows.forEach((rowKeys, rowIndex) => {
    if (rowKeys.length === 0) return;
    
    const row: any[] = [];
    const firstKey = rowKeys[0];
    const rowY = Math.round(firstKey.y * 4) / 4;
    
    // Check if this row has rotation (only check first key)
    const hasRowRotation = firstKey.rotation_angle !== undefined && firstKey.rotation_angle !== 0;
    
    // Reset X position for new row
    current.x = 0;
    let lastKeyInRow: Key | null = null;
    
    // Handle Y positioning first
    let needsYOffset = false;
    let yOffset = 0;
    if (lastY !== 0 || result.length > 1) {
      const yDiff = rowY - lastY;
      if (Math.abs(yDiff - 1) > 0.001) {
        needsYOffset = true;
        yOffset = yDiff - 1;
      }
    }
    
    lastY = rowY;
    
    // Track the last row position to detect changes
    let lastRowPosition: string | undefined = undefined;
    
    rowKeys.forEach((key, keyIndex) => {
      const props: KLEKeyData = {};
      
      // Handle first key in rotated row specially
      if (keyIndex === 0 && hasRowRotation) {
        // Calculate rotation center
        const rx = key.rotation_x !== undefined ? key.rotation_x : (key.x + key.width / 2);
        const ry = key.rotation_y !== undefined ? key.rotation_y : (key.y + key.height / 2);
        
        // Rotation properties MUST come first
        props.r = key.rotation_angle;
        props.rx = rx;
        props.ry = ry;
        
        // X and Y positions relative to rotation center
        props.x = key.x - rx;
        props.y = key.y - ry;
        
        // Update tracking
        current.rotation_angle = key.rotation_angle!;
        current.rotation_x = rx;
        current.rotation_y = ry;
      } else {
        // Non-rotated first key or any subsequent key
        if (keyIndex === 0 && needsYOffset) {
          props.y = yOffset;
        }
        
        // Handle X positioning
        const expectedX = keyIndex === 0 ? 0 : (lastKeyInRow ? lastKeyInRow.x + lastKeyInRow.width : current.x);
        const xDiff = key.x - expectedX;
        if (Math.abs(xDiff) > 0.001) {
          props.x = xDiff;
        }
      }
      current.x = key.x;
      
      // Size properties - always output if different from 1
      if (key.width !== 1) {
        props.w = key.width;
      }
      if (key.height !== 1) {
        props.h = key.height;
      }
      // Update current tracking
      current.width = key.width;
      current.height = key.height;
      
      // Secondary rectangle properties
      if (key.x2 !== undefined && key.x2 !== 0) props.x2 = key.x2;
      if (key.y2 !== undefined && key.y2 !== 0) props.y2 = key.y2;
      if (key.width2 !== undefined && key.width2 !== 0) props.w2 = key.width2;
      if (key.height2 !== undefined && key.height2 !== 0) props.h2 = key.height2;
      
        // Color properties
        if (key.color && key.color !== current.color) {
          props.c = key.color;
          current.color = key.color;
        }
        
        // Text color
        if (key.textColor && key.textColor.some(c => c !== undefined)) {
          // Filter out undefined values and check if we have multiple colors
          const colors = key.textColor.filter(c => c !== undefined);
          if (colors.length === 1 && colors[0] !== current.textColor) {
            // Single color
            props.t = colors[0];
            current.textColor = colors[0];
          } else if (colors.length > 1) {
            // Multiple colors - output as array
            props.t = colors;
          }
        } else if (key.default?.color?.[0] && key.default.color[0] !== current.textColor) {
          // Default color
          props.t = key.default.color[0];
          current.textColor = key.default.color[0];
        }
        
        // Text size - only output if explicitly set and not default
        if (key.textSize && key.textSize.length > 0) {
          const sizes = key.textSize.filter(s => s !== undefined && s !== 3); // 3 is the default, don't output it
          if (sizes.length > 0) {
            // Check if all sizes are the same
            const allSame = sizes.every(s => s === sizes[0]);
            if (allSame && sizes[0] !== current.textSize) {
              // Single size for all legends
              props.f = sizes[0];
              current.textSize = sizes[0];
            } else if (!allSame || key.textSize.some(s => s === 3)) {
              // Multiple sizes or mix of default and custom - output full array
              props.f = key.textSize;
            }
          }
        } else if (key.default?.size?.[0] && key.default.size[0] !== 3 && key.default.size[0] !== current.textSize) {
          props.f = key.default.size[0];
          current.textSize = key.default.size[0];
        }
        
        // KRK row position - output p value whenever it changes
        if (krkMode && key.rowPosition && key.rowPosition !== lastRowPosition) {
          props.p = key.rowPosition;
          lastRowPosition = key.rowPosition;
        }
        // No profile output when KRK is off - p is only for KRK
        
        // Boolean properties - treat undefined as false
        const isGhost = key.ghost || false;
        const isStepped = key.stepped || false;
        const isNub = key.nub || false;
        const isDecal = key.decal || false;
        
        // For decal keys, ALWAYS output d:true for original KLE compatibility
        if (isDecal) {
          props.d = true;
          current.decal = true;
        } else if (current.decal) {
          // Only output d:false if previous key was a decal
          props.d = false;
          current.decal = false;
        }
        
        // For stepped keys, ALWAYS output l:true (similar to decal)
        if (isStepped) {
          props.l = true;
          current.stepped = true;
        } else if (current.stepped) {
          // Only output l:false if previous key was stepped
          props.l = false;
          current.stepped = false;
        }
        
        // Other boolean properties work normally (only output on change)
        if (isGhost !== current.ghost) {
          props.g = isGhost;
          current.ghost = isGhost;
        }
        if (isNub !== current.nub) {
          props.n = isNub;
          current.nub = isNub;
        }
        
        // Alignment
        if (key.align !== current.align) {
          props.a = key.align;
          current.align = key.align;
        }
        
        // Add properties if any
        if (Object.keys(props).length > 0) {
          row.push(props);
        }
        
        // Build label string
        let labelString = buildLabelString(key);
        row.push(labelString);
        
        // Update for next key
        lastKeyInRow = key;
        current.x = key.x + key.width;
        
        // Reset width/height to defaults after each key (they don't persist in KLE)
        current.width = 1;
        current.height = 1;
        // Note: ghost, stepped, nub, decal DO persist in KLE until explicitly changed
      });
    
      result.push(row);
    });
  
  return result;
}

/**
 * Build the label string for a key, combining regular labels and front legends
 */
function buildLabelString(key: Key): string {
  const parts: string[] = [];
  
  // Start with the regular labels (positions 0-3 and 7-11)
  for (let i = 0; i < 12; i++) {
    if (key.labels[i]) {
      parts[i] = key.labels[i];
    }
  }
  
  // Add front legends if present (positions 4-6)
  if (key.frontLegends) {
    if (key.frontLegends[0]) parts[4] = key.frontLegends[0]; // Left front
    if (key.frontLegends[1]) parts[5] = key.frontLegends[1]; // Center front
    if (key.frontLegends[2]) parts[6] = key.frontLegends[2]; // Right front
  }
  
  // Handle homing nubs - reconstruct the SCOOP/BAR text if needed
  if (key.nub && key.frontLegends?.[1]) {
    // Check if we have a homing nub indicator
    if (key.frontLegends[1] === 'Scoop' || key.frontLegends[1] === 'Bar') {
      // Add the homing text back to the appropriate label position
      // This ensures export compatibility with original KLE
      const homingText = key.frontLegends[1].toUpperCase();
      // If there's already text in position 0, append to it
      if (parts[0]) {
        parts[0] = `${parts[0]} ${homingText}`;
      } else {
        parts[0] = homingText;
      }
      // Clear the front legend since it's now in the main label
      parts[5] = '';
    }
  }
  
  // Find the last non-empty position
  let lastIndex = parts.length - 1;
  while (lastIndex >= 0 && !parts[lastIndex]) {
    lastIndex--;
  }
  
  // Build the final string
  if (lastIndex < 0) {
    return '';
  }
  
  // Join with newlines up to the last non-empty position
  const result: string[] = [];
  for (let i = 0; i <= lastIndex; i++) {
    result.push(parts[i] || '');
  }
  
  return result.join('\n');
}

/**
 * Export keyboard to KLE JSON string
 */
export function exportToKLEString(keyboard: Keyboard, krkMode: boolean = false): string {
  const kleData = exportToKLE(keyboard, krkMode);
  return JSON.stringify(kleData, null, 2);
}