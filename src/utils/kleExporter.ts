import { Keyboard, Key, KLEKeyData } from '../types';

/**
 * Export a keyboard to original KLE JSON format
 */
export function exportToKLE(keyboard: Keyboard): any[] {
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
  
  // Group keys by rows based on Y position
  const rows: Map<number, Key[]> = new Map();
  
  keyboard.keys.forEach(key => {
    const rowY = Math.round(key.y * 4) / 4; // Round to nearest 0.25
    if (!rows.has(rowY)) {
      rows.set(rowY, []);
    }
    rows.get(rowY)!.push(key);
  });
  
  // Sort rows by Y position
  const sortedRowYs = Array.from(rows.keys()).sort((a, b) => a - b);
  
  // Track state between keys
  let currentY = 0;
  let lastKeyInRow: Key | null = null;
  
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
  
  sortedRowYs.forEach((rowY, rowIndex) => {
    const row: any[] = [];
    const keys = rows.get(rowY)!.sort((a, b) => a.x - b.x);
    
    // Handle Y positioning
    if (rowIndex > 0) {
      const yDiff = rowY - currentY;
      if (Math.abs(yDiff - 1) > 0.001) {
        // Non-standard row spacing
        row.push({ y: yDiff - 1 });
      }
    }
    currentY = rowY;
    
    // Reset X position for new row
    current.x = 0;
    lastKeyInRow = null;
    
    keys.forEach((key, keyIndex) => {
      const props: KLEKeyData = {};
      
      // Handle X positioning
      const expectedX = keyIndex === 0 ? 0 : (lastKeyInRow ? lastKeyInRow.x + lastKeyInRow.width : current.x);
      const xDiff = key.x - expectedX;
      if (Math.abs(xDiff) > 0.001) {
        props.x = xDiff;
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
      
      // Rotation properties
      if (key.rotation_angle !== undefined && key.rotation_angle !== 0) {
        if (key.rotation_x !== current.rotation_x) {
          props.rx = key.rotation_x;
          current.rotation_x = key.rotation_x!;
        }
        if (key.rotation_y !== current.rotation_y) {
          props.ry = key.rotation_y;
          current.rotation_y = key.rotation_y!;
        }
        if (key.rotation_angle !== current.rotation_angle) {
          props.r = key.rotation_angle;
          current.rotation_angle = key.rotation_angle;
        }
      }
      
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
      
      // Profile - only output if set and different
      if (key.profile && key.profile !== 'DCS' && key.profile !== current.profile) {
        props.p = key.profile;
        current.profile = key.profile;
      }
      
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
      
      // Other boolean properties work normally (only output on change)
      if (isGhost !== current.ghost) {
        props.g = isGhost;
        current.ghost = isGhost;
      }
      if (isStepped !== current.stepped) {
        props.l = isStepped;
        current.stepped = isStepped;
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
export function exportToKLEString(keyboard: Keyboard): string {
  const kleData = exportToKLE(keyboard);
  return JSON.stringify(kleData, null, 2);
}