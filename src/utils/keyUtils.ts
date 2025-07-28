import { Key } from '../types';

let keyIdCounter = 0;

export function generateKeyId(): string {
  return `key_${Date.now()}_${keyIdCounter++}`;
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
    { x: 0.08, y: 0.2, align: 'start', baseline: 'hanging' },        // 0: top-left
    { x: 0.15, y: 0.8, align: 'start', baseline: 'alphabetic' },     // 1: bottom-left
    { x: 0.85, y: 0.2, align: 'end', baseline: 'hanging' },          // 2: top-right
    { x: 0.85, y: 0.8, align: 'end', baseline: 'alphabetic' },       // 3: bottom-right
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