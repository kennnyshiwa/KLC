import { Keyboard, Key, VialLayoutOption } from '../types';
import { generateKeyId } from './keyUtils';

interface VialConfig {
  name: string;
  vendorId: string;
  productId: string;
  lighting: string;
  matrix: {
    rows: number;
    cols: number;
  };
  layouts: {
    labels: (string | string[])[];  // Can be string (checkbox) or string[] (multi-option)
    keymap: any[][];
  };
}

/**
 * Parse a Vial label string to extract matrix position and layout option
 * Format: "row,col\n\n\noption,value" where option,value is at position 3 (after 3 newlines)
 */
function parseVialLabel(labelString: string): { labels: string[] } {
  if (!labelString || typeof labelString !== 'string') {
    return { labels: new Array(12).fill('') };
  }

  // Split by newlines to get label positions (KLE format)
  const parts = labelString.split('\n');
  const labels = new Array(12).fill('');

  // Map parts to label positions
  // Position 0 = top-left (matrix position in Vial)
  // Position 3 = bottom-left (layout option in Vial)
  parts.forEach((part, index) => {
    if (index < 12 && part) {
      labels[index] = part;
    }
  });

  return { labels };
}

/**
 * Import a Vial JSON and convert to KLC Keyboard format
 */
export function importFromVial(vialData: VialConfig): Keyboard {
  const keys: Key[] = [];

  // Current position tracking
  let currentX = 0;
  let currentY = 0;

  // Current key properties (carry over between keys)
  let currentWidth = 1;
  let currentHeight = 1;
  let currentX2: number | undefined;
  let currentY2: number | undefined;
  let currentWidth2: number | undefined;
  let currentHeight2: number | undefined;
  let currentRotationX: number | undefined;
  let currentRotationY: number | undefined;
  let currentRotationAngle: number | undefined;
  let currentColor = '#f9f9f9';
  let currentTextColor = '#000000';
  let currentDecal = false;
  let currentGhost = false;
  let currentStepped = false;
  let currentNub = false;

  // Process each row in the keymap
  vialData.layouts.keymap.forEach((row) => {
    // Reset X at start of each row
    currentX = 0;

    row.forEach((item) => {
      if (typeof item === 'string') {
        // This is a key label - create the key
        const { labels } = parseVialLabel(item);

        const key: Key = {
          id: generateKeyId(),
          x: currentX,
          y: currentY,
          width: currentWidth,
          height: currentHeight,
          labels,
          color: currentColor,
          textColor: [currentTextColor],
        };

        // Add optional properties if set
        if (currentX2 !== undefined) key.x2 = currentX2;
        if (currentY2 !== undefined) key.y2 = currentY2;
        if (currentWidth2 !== undefined) key.width2 = currentWidth2;
        if (currentHeight2 !== undefined) key.height2 = currentHeight2;
        if (currentRotationX !== undefined) key.rotation_x = currentRotationX;
        if (currentRotationY !== undefined) key.rotation_y = currentRotationY;
        if (currentRotationAngle !== undefined) key.rotation_angle = currentRotationAngle;
        if (currentDecal) key.decal = true;
        if (currentGhost) key.ghost = true;
        if (currentStepped) key.stepped = true;
        if (currentNub) key.nub = true;

        keys.push(key);

        // Advance X position by key width
        currentX += currentWidth;

        // Reset per-key properties to defaults
        currentWidth = 1;
        currentHeight = 1;
        currentX2 = undefined;
        currentY2 = undefined;
        currentWidth2 = undefined;
        currentHeight2 = undefined;
        currentDecal = false;
        currentGhost = false;
        currentStepped = false;
        currentNub = false;
        // Note: rotation and colors carry over until explicitly changed
      } else if (typeof item === 'object' && item !== null) {
        // This is a properties object - update state

        // Position adjustments
        if (item.x !== undefined) currentX += item.x;
        if (item.y !== undefined) currentY += item.y;

        // Dimensions
        if (item.w !== undefined) currentWidth = item.w;
        if (item.h !== undefined) currentHeight = item.h;

        // Secondary rectangle (ISO enter, etc.)
        if (item.x2 !== undefined) currentX2 = item.x2;
        if (item.y2 !== undefined) currentY2 = item.y2;
        if (item.w2 !== undefined) currentWidth2 = item.w2;
        if (item.h2 !== undefined) currentHeight2 = item.h2;

        // Rotation
        if (item.rx !== undefined) {
          currentRotationX = item.rx;
          currentX = item.rx; // rx also sets current X
        }
        if (item.ry !== undefined) {
          currentRotationY = item.ry;
          currentY = item.ry; // ry also sets current Y
        }
        if (item.r !== undefined) currentRotationAngle = item.r;

        // Colors
        if (item.c !== undefined) currentColor = item.c;
        if (item.t !== undefined) {
          if (typeof item.t === 'string') {
            currentTextColor = item.t;
          } else if (Array.isArray(item.t)) {
            currentTextColor = item.t[0] || '#000000';
          }
        }

        // Flags
        if (item.d !== undefined) currentDecal = item.d;
        if (item.g !== undefined) currentGhost = item.g;
        if (item.l !== undefined) currentStepped = item.l;
        if (item.n !== undefined) currentNub = item.n;
      }
    });

    // Move to next row
    currentY += 1;
  });

  // Convert Vial layout labels to VialLayoutOption format
  const vialLabels: VialLayoutOption[] = [];
  if (vialData.layouts.labels && vialData.layouts.labels.length > 0) {
    vialData.layouts.labels.forEach((labelItem) => {
      if (typeof labelItem === 'string') {
        // Single string = checkbox/toggle option (index 0 = off, index 1 = on)
        vialLabels.push({
          name: labelItem,
          values: []  // Empty values array indicates a checkbox option
        });
      } else if (Array.isArray(labelItem) && labelItem.length > 0) {
        // Array of strings = multi-option choice
        // First element is the option name, rest are values
        const [name, ...values] = labelItem;
        vialLabels.push({
          name: name || 'Option',
          values: values.length > 0 ? values : ['Default']
        });
      }
    });
  }

  return {
    meta: {
      name: vialData.name || 'Imported Vial Layout',
      vialLabels: vialLabels.length > 0 ? vialLabels : undefined
    },
    keys
  };
}

/**
 * Import from Vial JSON string
 */
export function importFromVialString(jsonString: string): Keyboard {
  const vialData = JSON.parse(jsonString) as VialConfig;

  // Validate that this looks like a Vial config
  if (!vialData.layouts || !vialData.layouts.keymap) {
    throw new Error('Invalid Vial JSON: missing layouts.keymap');
  }

  return importFromVial(vialData);
}

/**
 * Check if a JSON object looks like a Vial config
 */
export function isVialConfig(data: any): boolean {
  return (
    data &&
    typeof data === 'object' &&
    data.layouts &&
    Array.isArray(data.layouts.keymap) &&
    (data.matrix || data.vendorId !== undefined || data.productId !== undefined)
  );
}
