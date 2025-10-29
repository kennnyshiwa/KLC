import { Key } from '../types/keyboard';

/**
 * Calculates the new position for a key when changing its rotation center,
 * maintaining its visual appearance in the same location
 * @param key - The key to adjust
 * @param newRotationX - New rotation center X coordinate
 * @param newRotationY - New rotation center Y coordinate
 * @returns New x and y position for the key
 */
export function calculateNewPositionForRotationCenter(
  key: Key,
  newRotationX: number,
  newRotationY: number
): { x: number; y: number } {
  // If key has no rotation angle, position doesn't need to change
  if (!key.rotation_angle || key.rotation_angle === 0) {
    return { x: key.x, y: key.y };
  }

  // Get current rotation center (default to key center if not set)
  const oldRotationX = key.rotation_x !== undefined ? key.rotation_x : key.x + key.width / 2;
  const oldRotationY = key.rotation_y !== undefined ? key.rotation_y : key.y + key.height / 2;

  // If rotation center hasn't actually changed, no position adjustment needed
  if (Math.abs(oldRotationX - newRotationX) < 0.001 && Math.abs(oldRotationY - newRotationY) < 0.001) {
    return { x: key.x, y: key.y };
  }

  // Calculate the key's center point
  const keyCenterX = key.x + key.width / 2;
  const keyCenterY = key.y + key.height / 2;

  // Calculate where the key's center is visually after rotation around old center
  const angleRad = (key.rotation_angle * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);

  // Vector from old rotation center to key center
  const dx = keyCenterX - oldRotationX;
  const dy = keyCenterY - oldRotationY;

  // Rotate this vector by the rotation angle to get visual position
  const visualCenterX = oldRotationX + (dx * cos - dy * sin);
  const visualCenterY = oldRotationY + (dx * sin + dy * cos);

  // Now calculate what position (before rotation) would place the key
  // at the same visual position when rotated around the new center
  // We need to reverse the rotation around the new center
  const dx2 = visualCenterX - newRotationX;
  const dy2 = visualCenterY - newRotationY;

  // Rotate back by negative angle
  const unrotatedCenterX = newRotationX + (dx2 * cos + dy2 * sin);
  const unrotatedCenterY = newRotationY + (-dx2 * sin + dy2 * cos);

  // Convert from center back to top-left position
  const newX = unrotatedCenterX - key.width / 2;
  const newY = unrotatedCenterY - key.height / 2;

  return { x: newX, y: newY };
}

/**
 * Check if a point is inside a rotated rectangle
 * @param px - Point X coordinate
 * @param py - Point Y coordinate
 * @param rectX - Rectangle X position
 * @param rectY - Rectangle Y position
 * @param rectWidth - Rectangle width
 * @param rectHeight - Rectangle height
 * @param rotationAngle - Rotation angle in degrees
 * @param rotationCenterX - X coordinate of rotation center (optional, defaults to rect center)
 * @param rotationCenterY - Y coordinate of rotation center (optional, defaults to rect center)
 */
export function isPointInRotatedRect(
  px: number, 
  py: number,
  rectX: number,
  rectY: number,
  rectWidth: number,
  rectHeight: number,
  rotationAngle: number,
  rotationCenterX?: number,
  rotationCenterY?: number
): boolean {
  // If no rotation, use simple bounds check
  if (!rotationAngle || rotationAngle === 0) {
    return px >= rectX && px <= rectX + rectWidth &&
           py >= rectY && py <= rectY + rectHeight;
  }

  // Default rotation center is the center of the rectangle
  const centerX = rotationCenterX !== undefined ? rotationCenterX : rectX + rectWidth / 2;
  const centerY = rotationCenterY !== undefined ? rotationCenterY : rectY + rectHeight / 2;

  // Convert rotation angle to radians (negative because we're rotating the point backwards)
  const angleRad = -rotationAngle * Math.PI / 180;

  // Translate point to origin (relative to rotation center)
  const translatedX = px - centerX;
  const translatedY = py - centerY;

  // Rotate point backwards (inverse rotation) to get it in the rectangle's local space
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const rotatedX = translatedX * cos - translatedY * sin;
  const rotatedY = translatedX * sin + translatedY * cos;

  // Translate back and check if point is in unrotated rectangle
  const finalX = rotatedX + centerX;
  const finalY = rotatedY + centerY;

  return finalX >= rectX && finalX <= rectX + rectWidth &&
         finalY >= rectY && finalY <= rectY + rectHeight;
}

/**
 * Get the bounding box of a rotated rectangle
 * This is useful for culling - to quickly check if a rotated rect might be visible
 */
export function getRotatedRectBounds(
  rectX: number,
  rectY: number,
  rectWidth: number,
  rectHeight: number,
  rotationAngle: number,
  rotationCenterX?: number,
  rotationCenterY?: number
): { minX: number; minY: number; maxX: number; maxY: number } {
  if (!rotationAngle || rotationAngle === 0) {
    return {
      minX: rectX,
      minY: rectY,
      maxX: rectX + rectWidth,
      maxY: rectY + rectHeight
    };
  }

  const centerX = rotationCenterX !== undefined ? rotationCenterX : rectX + rectWidth / 2;
  const centerY = rotationCenterY !== undefined ? rotationCenterY : rectY + rectHeight / 2;

  // Get all four corners of the rectangle
  const corners = [
    { x: rectX, y: rectY },
    { x: rectX + rectWidth, y: rectY },
    { x: rectX + rectWidth, y: rectY + rectHeight },
    { x: rectX, y: rectY + rectHeight }
  ];

  // Rotate each corner
  const angleRad = rotationAngle * Math.PI / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);

  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  for (const corner of corners) {
    // Translate to origin
    const tx = corner.x - centerX;
    const ty = corner.y - centerY;

    // Rotate
    const rx = tx * cos - ty * sin;
    const ry = tx * sin + ty * cos;

    // Translate back
    const finalX = rx + centerX;
    const finalY = ry + centerY;

    // Update bounds
    minX = Math.min(minX, finalX);
    minY = Math.min(minY, finalY);
    maxX = Math.max(maxX, finalX);
    maxY = Math.max(maxY, finalY);
  }

  return { minX, minY, maxX, maxY };
}