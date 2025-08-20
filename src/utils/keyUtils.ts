import { Key } from '../types';

let keyIdCounter = 0;

export function generateKeyId(): string {
  // Use a combination of timestamp, counter, and random value to ensure uniqueness
  const timestamp = Date.now();
  const counter = keyIdCounter++;
  const random = Math.random().toString(36).substring(2, 9);
  return `key_${timestamp}_${counter}_${random}`;
}

export function getKeyBounds(key: Key): { x: number; y: number; width: number; height: number } {
  const bounds = {
    x: key.x,
    y: key.y,
    width: key.width,
    height: key.height
  };

  if (key.rotation_angle) {
    // TODO: Calculate rotated bounds
  }

  return bounds;
}

export function isKeyInSelection(key: Key, selectionRect: { x: number; y: number; width: number; height: number }): boolean {
  const keyBounds = getKeyBounds(key);
  
  return !(
    keyBounds.x + keyBounds.width < selectionRect.x ||
    keyBounds.x > selectionRect.x + selectionRect.width ||
    keyBounds.y + keyBounds.height < selectionRect.y ||
    keyBounds.y > selectionRect.y + selectionRect.height
  );
}

export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

export function getKeyCenter(key: Key): { x: number; y: number } {
  return {
    x: key.x + key.width / 2,
    y: key.y + key.height / 2
  };
}

export function duplicateKey(key: Key, offset: { x: number; y: number } = { x: 0.25, y: 0.25 }): Key {
  return {
    ...key,
    id: generateKeyId(),
    x: key.x + offset.x,
    y: key.y + offset.y,
    labels: [...key.labels],
    textColor: key.textColor ? [...key.textColor] : undefined,
    textSize: key.textSize ? [...key.textSize] : undefined,
  };
}

export function getLegendPosition(index: number): { x: number; y: number; align: string; baseline: string } {
  // KLE legend positions:
  // 0: top-left     1: bottom-left   2: top-right      3: bottom-right
  // 4: front-left   5: front-center  6: front-right
  // 7: center-left  8: center        9: center-right
  // 10: top-center  11: bottom-center
  
  const positions = [
    { x: 0.02, y: 0.05, align: 'start', baseline: 'hanging' },       // 0: top-left (left and up)
    { x: 0.1, y: 0.9, align: 'start', baseline: 'alphabetic' },      // 1: bottom-left
    { x: 0.98, y: 0.05, align: 'end', baseline: 'hanging' },         // 2: top-right (right and up)
    { x: 0.98, y: 0.95, align: 'end', baseline: 'alphabetic' },      // 3: bottom-right (right and down)
    { x: 0.15, y: 1.05, align: 'start', baseline: 'hanging' },       // 4: front-left
    { x: 0.5, y: 1.05, align: 'center', baseline: 'hanging' },      // 5: front-center
    { x: 0.85, y: 1.05, align: 'end', baseline: 'hanging' },         // 6: front-right
    { x: 0.10, y: 0.5, align: 'start', baseline: 'middle' },         // 7: center-left (middle-left)
    { x: 0.5, y: 0.5, align: 'center', baseline: 'middle' },        // 8: center (middle-center)
    { x: 0.85, y: 0.5, align: 'end', baseline: 'middle' },           // 9: center-right (middle-right)
    { x: 0.5, y: 0.2, align: 'center', baseline: 'hanging' },       // 10: top-center
    { x: 0.5, y: 0.8, align: 'center', baseline: 'alphabetic' },    // 11: bottom-center
  ];
  
  return positions[index] || positions[0];
}

export function getStabilizerPositions(keyWidth: number): { x: number; y: number }[] {
  // Stabilizer positions are relative to the key (0-1 range)
  // Standard stabilizer spacing for different key sizes
  
  if (keyWidth >= 2) {
    const positions: { x: number; y: number }[] = [];
    
    // Center stabilizer
    positions.push({ x: 0.5, y: 0.5 });
    
    // Standard stabilizer positions based on key width
    // The outer stabilizers should be positioned based on standard spacing:
    // - 2u: 23.8mm total span (11.9mm from center each side)
    // - 2.25u-2.75u: 23.8mm total span 
    // - 3u+: Wider spacing
    // - 6.25u: 100mm total span (50mm from center each side)
    // - 7u: 114.3mm total span (57.15mm from center each side)
    
    if (keyWidth >= 7) {
      // 7u spacebar - stabilizers near the edges
      const edgeOffset = 0.5 / keyWidth; // ~0.5u from each edge
      positions.push({ x: edgeOffset, y: 0.5 });
      positions.push({ x: 1 - edgeOffset, y: 0.5 });
    } else if (keyWidth >= 6.25) {
      // 6.25u spacebar - stabilizers closer to edges
      const edgeOffset = 0.625 / keyWidth; // ~0.625u from each edge
      positions.push({ x: edgeOffset, y: 0.5 });
      positions.push({ x: 1 - edgeOffset, y: 0.5 });
    } else if (keyWidth >= 2) {
      // 2u to 6u keys
      if (keyWidth === 2 || keyWidth === 2.75) {
        // 2u and 2.75u keys use the same stabilizer positions
        // 2.75u is special - it uses 2u stabilizer spacing (23.8mm total span)
        const stabSpan = 1.25; // Total span between stabilizers in units
        const offset = stabSpan / 2; // Distance from center to each stabilizer
        positions.push({ x: 0.5 - offset / keyWidth, y: 0.5 });
        positions.push({ x: 0.5 + offset / keyWidth, y: 0.5 });
      } else if (keyWidth <= 2.5) {
        // 2.25u keys - slightly different spacing
        const edgeOffset = 0.4 / keyWidth; // Slightly more inset
        positions.push({ x: edgeOffset, y: 0.5 });
        positions.push({ x: 1 - edgeOffset, y: 0.5 });
      } else if (keyWidth <= 3) {
        // 3u keys - a bit more inset
        const edgeOffset = 0.45 / keyWidth;
        positions.push({ x: edgeOffset, y: 0.5 });
        positions.push({ x: 1 - edgeOffset, y: 0.5 });
      } else {
        // 3u+ to 6u keys - stabilizers closer to edges
        const edgeOffset = 0.5 / keyWidth;
        positions.push({ x: edgeOffset, y: 0.5 });
        positions.push({ x: 1 - edgeOffset, y: 0.5 });
      }
    }
    
    return positions;
  }
  
  // No stabilizers for keys smaller than 2u
  return [];
}