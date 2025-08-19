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