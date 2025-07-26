import { saveAs } from 'file-saver';
import { Keyboard } from '../types';

export const exportAsPNG = (stage: { toDataURL: () => string } | null, keyboard: Keyboard) => {
  if (!stage) return;
  const dataURL = stage.toDataURL();
  
  // Convert data URL to blob
  const parts = dataURL.split(';base64,');
  const contentType = parts[0].split(':')[1];
  const raw = window.atob(parts[1]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);
  
  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }
  
  const blob = new Blob([uInt8Array], { type: contentType });
  saveAs(blob, `${keyboard.meta.name || 'keyboard'}.png`);
};

export const exportAsSVG = (_stage: any, keyboard: Keyboard) => {
  // Get canvas dimensions
  const width = 1200;
  const height = 600;
  
  // Create SVG header
  let svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
<defs>
  <style>
    .key { fill: #cccccc; stroke: #7f8c8d; stroke-width: 1; }
    .key-selected { fill: #3498db; stroke: #2980b9; stroke-width: 2; }
    .key-text { font-family: Arial, sans-serif; font-size: 12px; fill: #000; }
  </style>
  <radialGradient id="nub-gradient">
    <stop offset="0%" stop-color="black" stop-opacity="0.3" />
    <stop offset="50%" stop-color="black" stop-opacity="0.15" />
    <stop offset="80%" stop-color="black" stop-opacity="0.05" />
    <stop offset="100%" stop-color="black" stop-opacity="0" />
  </radialGradient>
</defs>`;

  // Add background
  svg += `\n<rect width="${width}" height="${height}" fill="#fafafa" />`;
  
  const unitSize = 54; // Default unit size
  
  // Add keys
  keyboard.keys.forEach(key => {
    const keyX = key.x * unitSize;
    const keyY = key.y * unitSize;
    const keyWidth = key.width * unitSize - 1;
    const keyHeight = key.height * unitSize - 1;
    
    svg += `\n<g transform="${key.rotation_angle ? `rotate(${key.rotation_angle} ${(key.rotation_x || 0) * unitSize} ${(key.rotation_y || 0) * unitSize})` : ''}">`;
    
    // Only render the key shape if it's not a decal
    if (!key.decal) {
      // Calculate colors for 3D effect
      const baseColor = key.color || '#f9f9f9';
      const parseColor = (color: string) => {
        const rgb = parseInt(color.slice(1), 16);
        return {
          r: (rgb >> 16) & 255,
          g: (rgb >> 8) & 255,
          b: rgb & 255
        };
      };
      
      const adjustBrightness = (color: { r: number, g: number, b: number }, amount: number) => {
        return `rgb(${Math.max(0, Math.min(255, color.r + amount))}, ${Math.max(0, Math.min(255, color.g + amount))}, ${Math.max(0, Math.min(255, color.b + amount))})`;
      };
      
      const baseRgb = parseColor(baseColor);
      const bottomColor = adjustBrightness(baseRgb, -80);
      const sideColor = adjustBrightness(baseRgb, -40);
      const edgeHeight = 6;
      const topOffset = 3;
      
      // Check if this is a special shaped key
      const hasSecondaryRect = key.x2 !== undefined || key.y2 !== undefined || 
                              key.width2 !== undefined || key.height2 !== undefined;
      
      if (hasSecondaryRect) {
      // Complex shape (ISO Enter, Big Ass Enter)
      const x2 = (key.x2 || 0) * unitSize;
      const y2 = (key.y2 || 0) * unitSize;
      const width2 = (key.width2 || key.width) * unitSize - 1;
      const height2 = (key.height2 || key.height) * unitSize - 1;
      
      // For complex shapes, we create a unified appearance
      // First rectangle - bottom layer
      svg += `\n  <rect x="${keyX}" y="${keyY + topOffset}" width="${keyWidth}" height="${keyHeight - topOffset}" ` +
             `fill="${bottomColor}" rx="5" ry="5" />`;
      
      // Draw the middle layer (visible edges)
      svg += `\n  <rect x="${keyX}" y="${keyY}" width="${keyWidth}" height="${keyHeight - topOffset}" ` +
             `fill="${sideColor}" rx="5" ry="5" />`;
      
      // Draw the top surface
      svg += `\n  <rect x="${keyX + edgeHeight}" y="${keyY + edgeHeight}" width="${keyWidth - edgeHeight * 2}" height="${keyHeight - edgeHeight * 2 - topOffset}" ` +
             `fill="${baseColor}" rx="4" ry="4" />`;
      
      // Second rectangle
      // Draw the base (bottom layer)
      svg += `\n  <rect x="${keyX + x2}" y="${keyY + y2 + topOffset}" width="${width2}" height="${height2 - topOffset}" ` +
             `fill="${bottomColor}" rx="5" ry="5" />`;
      
      // Draw the middle layer (visible edges)
      svg += `\n  <rect x="${keyX + x2}" y="${keyY + y2}" width="${width2}" height="${height2 - topOffset}" ` +
             `fill="${sideColor}" rx="5" ry="5" />`;
      
      // Draw the top surface
      svg += `\n  <rect x="${keyX + x2 + edgeHeight}" y="${keyY + y2 + edgeHeight}" width="${width2 - edgeHeight * 2}" height="${height2 - edgeHeight * 2 - topOffset}" ` +
             `fill="${baseColor}" rx="4" ry="4" />`;
    } else {
      // Simple rectangular key with all 4 visible edges
      
      // Draw the base (bottom layer)
      svg += `\n  <rect x="${keyX}" y="${keyY + topOffset}" width="${keyWidth}" height="${keyHeight - topOffset}" ` +
             `fill="${bottomColor}" rx="5" ry="5" />`;
      
      // Draw the middle layer (visible edges)
      svg += `\n  <rect x="${keyX}" y="${keyY}" width="${keyWidth}" height="${keyHeight - topOffset}" ` +
             `fill="${sideColor}" rx="5" ry="5" />`;
      
      // Draw the top surface
      svg += `\n  <rect x="${keyX + edgeHeight}" y="${keyY + edgeHeight}" width="${keyWidth - edgeHeight * 2}" height="${keyHeight - edgeHeight * 2 - topOffset}" ` +
             `fill="${baseColor}" rx="4" ry="4" />`;
    }
    
      // Stepped cap shading
      if (key.stepped) {
        svg += `\n  <rect x="${keyX + keyWidth * 0.6}" y="${keyY + edgeHeight}" ` +
               `width="${keyWidth * 0.4 - edgeHeight}" height="${keyHeight - edgeHeight * 2 - topOffset}" ` +
               `fill="rgba(0,0,0,0.1)" rx="2" ry="2" />`;
      }
    
      // Homing nub
      if (key.nub) {
        const centerX = keyX + keyWidth / 2;
        const centerY = keyY + keyHeight / 2;
        const radius = Math.min(keyWidth, keyHeight) * 0.25; // Increased to match canvas
        
        // Draw a circle with the gradient for depression effect
        svg += `\n  <circle cx="${centerX}" cy="${centerY}" r="${radius}" ` +
               `fill="url(#nub-gradient)" />`;
      }
    } // End of if (!key.decal)
    
    // Front legends
    if (key.frontLegends && key.frontLegends.some(l => l)) {
      const frontY = keyY + keyHeight - 4;
      const padding = 5;
      
      // Left front legend
      if (key.frontLegends[0]) {
        svg += `\n  <text x="${keyX + padding}" y="${frontY}" ` +
               `font-size="10" fill="rgba(0,0,0,0.6)" ` +
               `text-anchor="start" dominant-baseline="middle" ` +
               `font-family="Arial, sans-serif">${escapeXml(key.frontLegends[0])}</text>`;
      }
      
      // Center front legend
      if (key.frontLegends[1]) {
        svg += `\n  <text x="${keyX + keyWidth / 2}" y="${frontY}" ` +
               `font-size="10" fill="rgba(0,0,0,0.6)" ` +
               `text-anchor="middle" dominant-baseline="middle" ` +
               `font-family="Arial, sans-serif">${escapeXml(key.frontLegends[1])}</text>`;
      }
      
      // Right front legend
      if (key.frontLegends[2]) {
        svg += `\n  <text x="${keyX + keyWidth - padding}" y="${frontY}" ` +
               `font-size="10" fill="rgba(0,0,0,0.6)" ` +
               `text-anchor="end" dominant-baseline="middle" ` +
               `font-family="Arial, sans-serif">${escapeXml(key.frontLegends[2])}</text>`;
      }
    }
    
    // Key labels
    key.labels.forEach((label, index) => {
      if (!label) return;
      
      const positions = [
        { x: 0.1, y: 0.2, anchor: 'start', baseline: 'top' },
        { x: 0.1, y: 0.8, anchor: 'start', baseline: 'bottom' },
        { x: 0.9, y: 0.2, anchor: 'end', baseline: 'top' },
        { x: 0.9, y: 0.8, anchor: 'end', baseline: 'bottom' },
      ];
      
      const pos = positions[index] || positions[0];
      const textX = keyX + keyWidth * pos.x;
      const textY = keyY + keyHeight * pos.y;
      const fontSize = (key.textSize?.[index] || 12);
      const textColor = key.textColor?.[index] || '#000000';
      
      svg += `\n  <text x="${textX}" y="${textY}" ` +
             `font-size="${fontSize}" fill="${textColor}" ` +
             `text-anchor="${pos.anchor}" dominant-baseline="${pos.baseline}">${escapeXml(label)}</text>`;
    });
    
    svg += '\n</g>';
  });
  
  svg += '\n</svg>';
  
  // Save as file
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  saveAs(blob, `${keyboard.meta.name || 'keyboard'}.svg`);
};

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}