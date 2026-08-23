import type { Key } from '../types';

export interface PixelBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface BoundsOptions {
  offsetX: number;
  offsetY: number;
  padding: number;
  canvasWidth: number;
  canvasHeight: number;
}

function rotatedPoint(x: number, y: number, centerX: number, centerY: number, angle: number) {
  const radians = angle * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const dx = x - centerX;
  const dy = y - centerY;
  return {
    x: centerX + dx * cosine - dy * sine,
    y: centerY + dx * sine + dy * cosine,
  };
}

/**
 * Reproduces the live renderer's key geometry in CSS-pixel coordinates.
 * Content is bounded from geometry rather than canvas colors, which can contain
 * harmless one-channel noise across an otherwise solid background.
 */
export function getKeyboardRenderBounds(
  keys: readonly Key[],
  unitSize: number,
  options: BoundsOptions,
): PixelBounds | null {
  if (keys.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const keyInset = 1;

  for (const key of keys) {
    const x = Math.round(key.x * unitSize + keyInset);
    const y = Math.round(key.y * unitSize + keyInset);
    const width = Math.round(key.width * unitSize - keyInset * 2);
    const height = Math.round(key.height * unitSize - keyInset * 2);
    const rects = [{ x, y, width, height }];

    if (
      key.x2 !== undefined || key.y2 !== undefined
      || key.width2 !== undefined || key.height2 !== undefined
    ) {
      rects.push({
        x: x + (key.x2 ?? 0) * unitSize,
        y: y + (key.y2 ?? 0) * unitSize,
        width: (key.width2 ?? key.width) * unitSize - keyInset * 2,
        height: (key.height2 ?? key.height) * unitSize - keyInset * 2,
      });
    }

    const angle = key.rotation_angle ?? 0;
    const hasCustomCenter = key.rotation_x !== undefined && key.rotation_y !== undefined;
    const centerX = hasCustomCenter ? key.rotation_x! * unitSize : x + width / 2;
    const centerY = hasCustomCenter ? key.rotation_y! * unitSize : y + height / 2;

    for (const rect of rects) {
      const corners = [
        [rect.x, rect.y],
        [rect.x + rect.width, rect.y],
        [rect.x + rect.width, rect.y + rect.height],
        [rect.x, rect.y + rect.height],
      ] as const;
      for (const [cornerX, cornerY] of corners) {
        const point = angle
          ? rotatedPoint(cornerX, cornerY, centerX, centerY, angle)
          : { x: cornerX, y: cornerY };
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      }
    }
  }

  const left = Math.max(0, Math.floor(minX + options.offsetX - options.padding));
  const top = Math.max(0, Math.floor(minY + options.offsetY - options.padding));
  const right = Math.min(options.canvasWidth, Math.ceil(maxX + options.offsetX + options.padding));
  const bottom = Math.min(options.canvasHeight, Math.ceil(maxY + options.offsetY + options.padding));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** Convert CSS-pixel bounds to the canvas backing-store coordinate space. */
export function scaleRenderBounds(
  bounds: PixelBounds,
  scale: number,
  canvasWidth: number,
  canvasHeight: number,
): PixelBounds {
  const x = Math.max(0, Math.floor(bounds.x * scale));
  const y = Math.max(0, Math.floor(bounds.y * scale));
  const right = Math.min(canvasWidth, Math.ceil((bounds.x + bounds.width) * scale));
  const bottom = Math.min(canvasHeight, Math.ceil((bounds.y + bounds.height) * scale));
  return { x, y, width: right - x, height: bottom - y };
}
