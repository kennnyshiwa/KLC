import { Keyboard } from '../types';

export function debugLayoutIssues(keyboard: Keyboard) {
  const issues: string[] = [];
  
  // Check for duplicate positions
  const positionMap = new Map<string, number>();
  keyboard.keys.forEach((key, index) => {
    const posKey = `${key.x},${key.y}`;
    if (positionMap.has(posKey)) {
      issues.push(`Keys at index ${positionMap.get(posKey)} and ${index} have the same position (${posKey})`);
    }
    positionMap.set(posKey, index);
  });
  
  // Check for duplicate IDs
  const idMap = new Map<string, number>();
  keyboard.keys.forEach((key, index) => {
    if (idMap.has(key.id)) {
      issues.push(`Duplicate key ID "${key.id}" found at indices ${idMap.get(key.id)} and ${index}`);
    }
    idMap.set(key.id, index);
  });
  
  // Check for invalid dimensions
  keyboard.keys.forEach((key, index) => {
    if (key.width <= 0 || key.height <= 0) {
      issues.push(`Key at index ${index} has invalid dimensions: ${key.width}x${key.height}`);
    }
    if (key.x < 0 || key.y < 0) {
      issues.push(`Key at index ${index} has negative position: (${key.x}, ${key.y})`);
    }
  });
  
  // Log rotated keys for debugging
  const rotatedKeys = keyboard.keys.filter(k => k.rotation_angle);
  console.log(`Found ${rotatedKeys.length} rotated keys:`);
  rotatedKeys.forEach((key, index) => {
    console.log(`  Key ${index}: rotation=${key.rotation_angle}°, pos=(${key.x}, ${key.y}), size=${key.width}x${key.height}, labels=${JSON.stringify(key.labels)}`);
    if (key.rotation_x !== undefined || key.rotation_y !== undefined) {
      console.log(`    Custom rotation center: (${key.rotation_x}, ${key.rotation_y})`);
    }
    if (key.x2 !== undefined || key.y2 !== undefined || key.width2 !== undefined || key.height2 !== undefined) {
      console.log(`    Secondary dimensions: x2=${key.x2}, y2=${key.y2}, w2=${key.width2}, h2=${key.height2}`);
    }
  });
  
  return issues;
}