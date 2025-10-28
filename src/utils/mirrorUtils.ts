import { Key } from '../types/keyboard';

/**
 * Mirror keys vertically (across a horizontal axis)
 * @param keys - Array of keys to mirror
 * @param centerY - Y coordinate of the horizontal mirror axis
 * @returns Array of partial key objects with mirrored properties
 */
export function mirrorKeysVertically(
  keys: Key[],
  centerY: number
): Partial<Key>[] {
  return keys.map(key => {
    const mirrored: Partial<Key> = {
      // Mirror main position
      y: 2 * centerY - key.y - key.height,

      // Mirror rotation center if it exists
      ...(key.rotation_y !== undefined && {
        rotation_y: 2 * centerY - key.rotation_y
      }),

      // Flip rotation angle vertically
      ...(key.rotation_angle !== undefined && {
        rotation_angle: -key.rotation_angle
      }),

      // Mirror secondary position if it exists
      ...(key.y2 !== undefined && key.height2 !== undefined && {
        y2: 2 * centerY - (key.y + key.y2) - key.height2 - key.y
      })
    };

    return mirrored;
  });
}

/**
 * Mirror keys horizontally (across a vertical axis)
 * @param keys - Array of keys to mirror
 * @param centerX - X coordinate of the vertical mirror axis
 * @returns Array of partial key objects with mirrored properties
 */
export function mirrorKeysHorizontally(
  keys: Key[],
  centerX: number
): Partial<Key>[] {
  return keys.map(key => {
    const mirrored: Partial<Key> = {
      // Mirror main position
      x: 2 * centerX - key.x - key.width,

      // Mirror rotation center if it exists
      ...(key.rotation_x !== undefined && {
        rotation_x: 2 * centerX - key.rotation_x
      }),

      // Negate rotation angle for horizontal flip
      ...(key.rotation_angle !== undefined && {
        rotation_angle: -key.rotation_angle
      }),

      // Mirror secondary position if it exists
      ...(key.x2 !== undefined && key.width2 !== undefined && {
        x2: 2 * centerX - (key.x + key.x2) - key.width2 - key.x
      })
    };

    return mirrored;
  });
}

/**
 * Mirror keys around an arbitrary angled axis
 * @param keys - Array of keys to mirror
 * @param centerX - X coordinate of the mirror axis center
 * @param centerY - Y coordinate of the mirror axis center
 * @param angle - Angle of the mirror axis in degrees (0 = horizontal, 90 = vertical)
 * @returns Array of partial key objects with mirrored properties
 */
export function mirrorKeysAtAngle(
  keys: Key[],
  centerX: number,
  centerY: number,
  angle: number
): Partial<Key>[] {
  // Convert angle to radians
  const angleRad = (angle * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);

  return keys.map(key => {
    // Get key center point
    const keyCenterX = key.x + key.width / 2;
    const keyCenterY = key.y + key.height / 2;

    // Translate point to origin (relative to mirror center)
    const relX = keyCenterX - centerX;
    const relY = keyCenterY - centerY;

    // Rotate point so mirror axis is horizontal
    const rotX = relX * cos + relY * sin;
    const rotY = -relX * sin + relY * cos;

    // Mirror across horizontal axis (flip Y)
    const mirroredRotY = -rotY;

    // Rotate back
    const mirroredRelX = rotX * cos - mirroredRotY * sin;
    const mirroredRelY = rotX * sin + mirroredRotY * cos;

    // Translate back
    const mirroredCenterX = mirroredRelX + centerX;
    const mirroredCenterY = mirroredRelY + centerY;

    // Calculate new position (top-left corner)
    const newX = mirroredCenterX - key.width / 2;
    const newY = mirroredCenterY - key.height / 2;

    const mirrored: Partial<Key> = {
      x: newX,
      y: newY
    };

    // Handle rotation if present
    if (key.rotation_angle !== undefined) {
      // Mirror the rotation center if it exists
      if (key.rotation_x !== undefined && key.rotation_y !== undefined) {
        const rotCenterRelX = key.rotation_x - centerX;
        const rotCenterRelY = key.rotation_y - centerY;

        const rotCenterRotX = rotCenterRelX * cos + rotCenterRelY * sin;
        const rotCenterRotY = -rotCenterRelX * sin + rotCenterRelY * cos;

        const mirroredRotCenterRotY = -rotCenterRotY;

        const mirroredRotCenterRelX = rotCenterRotX * cos - mirroredRotCenterRotY * sin;
        const mirroredRotCenterRelY = rotCenterRotX * sin + mirroredRotCenterRotY * cos;

        mirrored.rotation_x = mirroredRotCenterRelX + centerX;
        mirrored.rotation_y = mirroredRotCenterRelY + centerY;
      }

      // Adjust the rotation angle
      // When mirroring, the angle needs to be reflected across the mirror axis
      mirrored.rotation_angle = 2 * angle - key.rotation_angle;
    }

    // Handle secondary position (simplified - may need refinement)
    if (key.x2 !== undefined && key.y2 !== undefined) {
      // For now, keep secondary positions relative to the key
      // This is a simplification and may need adjustment for complex cases
      mirrored.x2 = key.x2;
      mirrored.y2 = key.y2;
    }

    return mirrored;
  });
}

/**
 * Calculate the center point of a selection of keys
 * @param keys - Array of keys
 * @returns Object with x and y coordinates of the center
 */
export function getSelectionCenter(keys: Key[]): { x: number; y: number } {
  if (keys.length === 0) {
    return { x: 0, y: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  keys.forEach(key => {
    minX = Math.min(minX, key.x);
    minY = Math.min(minY, key.y);
    maxX = Math.max(maxX, key.x + key.width);
    maxY = Math.max(maxY, key.y + key.height);
  });

  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2
  };
}
