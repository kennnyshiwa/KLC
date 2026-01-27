import { Keyboard, Key } from '../types';

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
 * Parse matrix position from a label like "0,0" or "2,5"
 * Returns null if not a valid matrix position
 */
function parseMatrixPosition(label: string): { row: number; col: number } | null {
  if (!label) return null;
  const match = label.match(/^(\d+),(\d+)$/);
  if (!match) return null;
  return {
    row: parseInt(match[1], 10),
    col: parseInt(match[2], 10)
  };
}

/**
 * Parse layout option from a label like "1,0" or "2,1"
 * Returns null if not a valid layout option
 */
function parseLayoutOption(label: string): { option: number; value: number } | null {
  if (!label) return null;
  const match = label.match(/^(\d+),(\d+)$/);
  if (!match) return null;
  return {
    option: parseInt(match[1], 10),
    value: parseInt(match[2], 10)
  };
}

/**
 * Build the Vial label string for a key
 * KLE label positions: 0-11 separated by newlines
 * Position 0: matrix position (row,col)
 * Position 3: layout option (option,value)
 * Position 9: encoder flag ("e")
 */
function buildVialLabelString(key: Key): string {
  // Find the highest non-empty label position
  let maxPosition = 0;
  for (let i = 0; i < 12; i++) {
    if (key.labels[i]) {
      maxPosition = i;
    }
  }

  // If no labels, return empty string
  if (maxPosition === 0 && !key.labels[0]) {
    return '';
  }

  // Build the label string with all positions up to maxPosition
  const parts: string[] = [];
  for (let i = 0; i <= maxPosition; i++) {
    parts.push(key.labels[i] || '');
  }

  return parts.join('\n');
}

/**
 * Export keyboard to Vial JSON format
 */
export function exportToVial(keyboard: Keyboard): VialConfig {
  // Analyze keys to determine matrix size and layout options
  let maxRow = 0;
  let maxCol = 0;
  const layoutOptions = new Map<number, Set<number>>(); // option index -> set of values

  keyboard.keys.forEach(key => {
    // Parse matrix position from labels[0]
    const matrixPos = parseMatrixPosition(key.labels[0]);
    if (matrixPos) {
      maxRow = Math.max(maxRow, matrixPos.row);
      maxCol = Math.max(maxCol, matrixPos.col);
    }

    // Parse layout option from labels[3]
    const layoutOpt = parseLayoutOption(key.labels[3]);
    if (layoutOpt) {
      if (!layoutOptions.has(layoutOpt.option)) {
        layoutOptions.set(layoutOpt.option, new Set());
      }
      layoutOptions.get(layoutOpt.option)!.add(layoutOpt.value);
    }
  });

  // Build layout labels array from metadata if available, otherwise generate from key data
  let labels: (string | string[])[] = [];

  if (keyboard.meta?.vialLabels && keyboard.meta.vialLabels.length > 0) {
    // Use user-defined labels from metadata
    labels = keyboard.meta.vialLabels.map(option => {
      // Checkbox options (empty values) are exported as single strings
      if (option.values.length === 0) {
        return option.name;
      }
      // Multi-option choices are exported as arrays
      return [option.name, ...option.values];
    });
  } else {
    // Fall back to auto-generated labels from key data
    const sortedOptions = Array.from(layoutOptions.keys()).sort((a, b) => a - b);
    sortedOptions.forEach(optionIndex => {
      const values = Array.from(layoutOptions.get(optionIndex)!).sort((a, b) => a - b);
      // Create labels like ["Option 0", "Value 0", "Value 1", ...]
      const optionLabels = [`Option ${optionIndex}`];
      values.forEach(v => optionLabels.push(`Value ${v}`));
      labels.push(optionLabels);
    });
  }

  // Sort keys by Y then X for proper row grouping
  const sortedKeys = [...keyboard.keys].sort((a, b) => {
    const yDiff = a.y - b.y;
    if (Math.abs(yDiff) < 0.001) {
      return a.x - b.x;
    }
    return yDiff;
  });

  // Group keys into rows
  const rows: Key[][] = [];
  let currentRow: Key[] = [];
  let currentY: number | null = null;

  sortedKeys.forEach(key => {
    const keyY = Math.round(key.y * 4) / 4; // Round to nearest 0.25

    if (currentY === null || Math.abs(keyY - currentY) > 0.001) {
      if (currentRow.length > 0) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentY = keyY;
    }

    currentRow.push(key);
  });

  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  // Build keymap in Vial/KLE format
  const keymap: any[][] = [];
  let lastY = 0;

  rows.forEach((rowKeys, rowIndex) => {
    if (rowKeys.length === 0) return;

    const row: any[] = [];
    const firstKey = rowKeys[0];
    const rowY = Math.round(firstKey.y * 4) / 4;

    let expectedX = 0;

    rowKeys.forEach((key, keyIndex) => {
      const props: any = {};

      // Handle Y offset for first key in row (except first row)
      if (keyIndex === 0 && rowIndex > 0) {
        const yDiff = rowY - lastY;
        if (Math.abs(yDiff - 1) > 0.001) {
          props.y = yDiff - 1;
        }
      }

      // Handle X offset
      const xDiff = key.x - expectedX;
      if (Math.abs(xDiff) > 0.001) {
        props.x = xDiff;
      }

      // Width
      if (key.width !== 1) {
        props.w = key.width;
      }

      // Height
      if (key.height !== 1) {
        props.h = key.height;
      }

      // Secondary rectangle properties
      if (key.x2 !== undefined && key.x2 !== 0) props.x2 = key.x2;
      if (key.y2 !== undefined && key.y2 !== 0) props.y2 = key.y2;
      if (key.width2 !== undefined && key.width2 !== 0) props.w2 = key.width2;
      if (key.height2 !== undefined && key.height2 !== 0) props.h2 = key.height2;

      // Decal (non-functional key for display)
      if (key.decal) {
        props.d = true;
      }

      // Add properties object if we have any
      if (Object.keys(props).length > 0) {
        row.push(props);
      }

      // Add the key label string
      row.push(buildVialLabelString(key));

      // Update expected X for next key
      expectedX = key.x + key.width;
    });

    lastY = rowY;
    keymap.push(row);
  });

  return {
    name: keyboard.meta?.name || 'Untitled Keyboard',
    vendorId: '0x0000',
    productId: '0x0000',
    lighting: 'none',
    matrix: {
      rows: maxRow + 1,
      cols: maxCol + 1
    },
    layouts: {
      labels,
      keymap
    }
  };
}

/**
 * Export keyboard to Vial JSON string
 */
export function exportToVialString(keyboard: Keyboard): string {
  const vialData = exportToVial(keyboard);
  return JSON.stringify(vialData, null, 2);
}
