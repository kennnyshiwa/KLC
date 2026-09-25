import type { Key } from '../types';

/** Restrict optional imported paint to a literal color, never an SVG URL or markup. */
export function diagonalProperties(value: unknown): Pick<Key, 'diagonalColor' | 'diagonalDirection'> {
  if (!value || typeof value !== 'object') return {};
  const { diagonalColor, diagonalDirection } = value as Partial<Key>;
  return {
    ...(typeof diagonalColor === 'string' && /^#[0-9a-f]{6}$/i.test(diagonalColor) && { diagonalColor }),
    ...((diagonalDirection === '/' || diagonalDirection === '\\') && { diagonalDirection }),
  };
}

/** The two rectangles share ONE diagonal, including negative ISO/LAE offsets. */
export function diagonalEndpoints(key: Key, x: number, y: number, unit: number, inset = 1) {
  const x2 = (key.x2 ?? 0) * unit;
  const y2 = (key.y2 ?? 0) * unit;
  const left = x + Math.min(0, x2);
  const top = y + Math.min(0, y2);
  const width = Math.max(key.width * unit, x2 + (key.width2 ?? key.width) * unit) - Math.min(0, x2) - inset;
  const height = Math.max(key.height * unit, y2 + (key.height2 ?? key.height) * unit) - Math.min(0, y2) - inset;
  const cx = left + width / 2;
  const cy = top + height / 2;
  // Use the normal to the corner-to-corner line, not the opposite diagonal.
  // Those are only the same for square keys.
  const lengthSquared = width * width + height * height;
  const dx = width * height * height / lengthSquared * (key.diagonalDirection === '\\' ? -1 : 1);
  const dy = height * width * width / lengthSquared;
  return { x1: cx - dx, y1: cy - dy, x2: cx + dx, y2: cy + dy };
}

export function shadeColor(color: string, amount: number): string {
  const hex = color.replace(/^#/, '');
  const expanded = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
  const rgb = parseInt(expanded, 16);
  return `rgb(${[16, 8, 0].map(shift => Math.max(0, Math.min(255, ((rgb >> shift) & 255) + amount))).join(', ')})`;
}

export function diagonalCanvasFill(
  ctx: CanvasRenderingContext2D, key: Key, x: number, y: number,
  unit: number, inset: number, primary: string, shade = 0,
): string | CanvasGradient {
  const { diagonalColor } = diagonalProperties(key);
  if (!diagonalColor) return primary;
  const p = diagonalEndpoints(key, x, y, unit, inset);
  const gradient = ctx.createLinearGradient(p.x1, p.y1, p.x2, p.y2);
  gradient.addColorStop(0, primary);
  gradient.addColorStop(0.5, primary);
  gradient.addColorStop(0.5, shadeColor(diagonalColor, shade));
  gradient.addColorStop(1, shadeColor(diagonalColor, shade));
  return gradient;
}
