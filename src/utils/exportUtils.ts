import { saveAs } from 'file-saver';
import { Keyboard } from '../types';
import { getLegendPosition } from './keyUtils';
import { parseIconLegend } from './iconParser';
import trashconsFontData from '/fonts/trashcons.woff?inline';
import gortonPerfectedFontData from '/fonts/GortonPerfectedVF.woff?inline';

// Calculate the bounding box of all keys
function getKeyboardBounds(keyboard: Keyboard, unitSize: number = 54): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} {
  if (keyboard.keys.length === 0) {
    return { 
      minX: 0, 
      minY: 0, 
      maxX: 100, 
      maxY: 100,
      width: 100,
      height: 100
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  keyboard.keys.forEach(key => {
    // Calculate key bounds including secondary rectangles
    const keyX = key.x * unitSize;
    const keyY = key.y * unitSize;
    const keyWidth = key.width * unitSize;
    const keyHeight = key.height * unitSize;

    // Main rectangle bounds
    minX = Math.min(minX, keyX);
    minY = Math.min(minY, keyY);
    maxX = Math.max(maxX, keyX + keyWidth);
    maxY = Math.max(maxY, keyY + keyHeight);

    // Check secondary rectangle if exists
    if (key.x2 !== undefined || key.y2 !== undefined) {
      const x2 = (key.x2 || 0) * unitSize;
      const y2 = (key.y2 || 0) * unitSize;
      const width2 = (key.width2 || key.width) * unitSize;
      const height2 = (key.height2 || key.height) * unitSize;

      minX = Math.min(minX, keyX + x2);
      minY = Math.min(minY, keyY + y2);
      maxX = Math.max(maxX, keyX + x2 + width2);
      maxY = Math.max(maxY, keyY + y2 + height2);
    }

    // Account for rotation if present
    if (key.rotation_angle) {
      // This is a simplified calculation - for more accuracy, 
      // we'd need to calculate the rotated corners
      const margin = Math.max(keyWidth, keyHeight) * 0.5;
      minX = Math.min(minX, keyX - margin);
      minY = Math.min(minY, keyY - margin);
      maxX = Math.max(maxX, keyX + keyWidth + margin);
      maxY = Math.max(maxY, keyY + keyHeight + margin);
    }
  });

  // Add some padding
  const padding = 20;
  return {
    minX: Math.max(0, minX - padding),
    minY: Math.max(0, minY - padding),
    maxX: maxX + padding,
    maxY: maxY + padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2
  };
}

export const exportAsPNG = (stage: { toDataURL: () => string } | null, keyboard: Keyboard, editorSettings?: any) => {
  if (!stage) return;

  const svgBlob = new Blob([buildKeyboardSVG(keyboard)], { type: 'image/svg+xml;charset=utf-8' });
  const objectUrl = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.onload = () => {
    const unitSize = editorSettings?.unitSize || 54;
    const bounds = getKeyboardBounds(keyboard, unitSize);
    const hasFooter = keyboard.meta.name || keyboard.meta.author;
    const footerHeight = hasFooter ? 40 : 0;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bounds.width);
    canvas.height = Math.round(bounds.height) + footerHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      URL.revokeObjectURL(objectUrl);
      return;
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Render the full layout export, not the current viewport-sized editor canvas.
    ctx.drawImage(img, 0, 0, Math.round(bounds.width), Math.round(bounds.height));

    if (hasFooter) {
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(20, bounds.height + 5);
      ctx.lineTo(canvas.width - 20, bounds.height + 5);
      ctx.stroke();
      
      // Prepare text
      const footerText = [];
      if (keyboard.meta.name) {
        footerText.push(keyboard.meta.name);
      }
      if (keyboard.meta.author) {
        footerText.push(`by ${keyboard.meta.author}`);
      }
      
      // Draw footer text
      ctx.fillStyle = '#333333';
      ctx.font = '14px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const textY = bounds.height + footerHeight / 2 + 5;
      ctx.fillText(footerText.join(' • '), canvas.width / 2, textY);
    }

    canvas.toBlob((blob) => {
      if (blob) {
        saveAs(blob, `${keyboard.meta.name || 'keyboard'}.png`);
      }
    }, 'image/png');

    URL.revokeObjectURL(objectUrl);
  };

  img.onerror = () => {
    URL.revokeObjectURL(objectUrl);
  };

  img.src = objectUrl;
};

export function buildKeyboardSVG(keyboard: Keyboard) {
  const unitSize = 54; // Default unit size
  const bounds = getKeyboardBounds(keyboard, unitSize);
  
  // Use calculated dimensions
  const width = bounds.width;
  const height = bounds.height;
  
  // Create SVG header with viewBox for proper scaling
  let svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
<defs>
  <style>
    @font-face { font-family: 'trashcons'; src: url('${trashconsFontData}') format('woff'); }
    @font-face { font-family: 'GortonPerfected'; src: url('${gortonPerfectedFontData}') format('woff'); }
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
  svg += `\n<rect width="${width}" height="${height}" fill="#ffffff" />`;
  
  // Add keys with adjusted positions relative to bounds
  keyboard.keys.forEach(key => {
    const keyX = key.x * unitSize - bounds.minX;
    const keyY = key.y * unitSize - bounds.minY;
    const keyWidth = key.width * unitSize - 1;
    const keyHeight = key.height * unitSize - 1;
    
    const legendArea = getLegendArea({
      key,
      keyX,
      keyY,
      keyWidth,
      keyHeight,
      unitSize,
    });
    
    // Apply rotation transform with adjusted center
    const rotX = ((key.rotation_x !== undefined ? key.rotation_x : key.x + key.width / 2) * unitSize) - bounds.minX;
    const rotY = ((key.rotation_y !== undefined ? key.rotation_y : key.y + key.height / 2) * unitSize) - bounds.minY;
    svg += `\n<g transform="${key.rotation_angle ? `rotate(${key.rotation_angle} ${rotX} ${rotY})` : ''}">`;
    
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

      // Center stepped cap shading
      if (key.steppedCenter) {
        const stepWidth = keyWidth * 0.2;
        // Left edge shading
        svg += `\n  <rect x="${keyX + edgeHeight}" y="${keyY + edgeHeight}" ` +
               `width="${stepWidth - edgeHeight}" height="${keyHeight - edgeHeight * 2 - topOffset}" ` +
               `fill="rgba(0,0,0,0.1)" rx="2" ry="2" />`;
        // Right edge shading
        svg += `\n  <rect x="${keyX + keyWidth - stepWidth}" y="${keyY + edgeHeight}" ` +
               `width="${stepWidth - edgeHeight}" height="${keyHeight - edgeHeight * 2 - topOffset}" ` +
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
      // Front legends are at positions 4, 5, 6
      key.frontLegends.forEach((legend, frontIndex) => {
        if (!legend) return;
        
        const index = frontIndex + 4; // Map to label positions 4, 5, 6
        const position = getLegendPosition(index);
        
        const textX = legendArea.x + legendArea.width * position.x;
        const textY = legendArea.y + legendArea.height * position.y;
        
        // Get text size for front legends
        let textSizeValue = 3;
        if (Array.isArray(key.textSize) && key.textSize[index] !== undefined) {
          textSizeValue = key.textSize[index];
        } else if (key.default?.size && Array.isArray(key.default.size) && key.default.size[0] !== undefined) {
          textSizeValue = key.default.size[0];
        }
        
        // Convert KLE textSize to actual font size
        const fontSize = 6 + 2 * textSizeValue;
        
        // Get text color
        let textColor = 'rgba(0,0,0,0.6)'; // Default for front legends
        if (Array.isArray(key.textColor) && key.textColor[index]) {
          textColor = key.textColor[index];
        } else if (key.default?.color?.[0]) {
          textColor = key.default.color[0];
        }
        
        svg += renderLegendTextSvg({
          legend,
          x: textX,
          y: textY,
          fontSize,
          textColor,
          textAnchor: position.align,
          baseline: position.baseline,
          fontFamily: key.font || 'Arial, sans-serif',
        });
      });
    }
    
    // Key labels
    key.labels.forEach((label, index) => {
      if (!label) return;
      
      // Skip positions 4-6 if handled by front legends
      if (index >= 4 && index <= 6 && key.frontLegends && key.frontLegends[index - 4]) {
        return;
      }
      
      const position = getLegendPosition(index);
      
      const textX = legendArea.x + legendArea.width * position.x;
      const textY = legendArea.y + legendArea.height * position.y;
      
      // Get text size - default is 3 in KLE
      let textSizeValue = 3;
      if (Array.isArray(key.textSize) && key.textSize[index] !== undefined) {
        textSizeValue = key.textSize[index];
      } else if (key.default?.size && Array.isArray(key.default.size) && key.default.size[0] !== undefined) {
        textSizeValue = key.default.size[0];
      }
      
      // Convert KLE textSize (1-9) to actual font size using the formula: 6 + 2*textSize
      const fontSize = 6 + 2 * textSizeValue;
      
      // Get text color
      let textColor = '#000000';
      if (Array.isArray(key.textColor) && key.textColor[index]) {
        textColor = key.textColor[index];
      } else if (Array.isArray(key.textColor) && key.textColor[0]) {
        textColor = key.textColor[0];
      } else if (key.default?.color?.[0]) {
        textColor = key.default.color[0];
      }
      
      svg += renderLegendTextSvg({
        legend: label,
        x: textX,
        y: textY,
        fontSize,
        textColor,
        textAnchor: position.align,
        baseline: position.baseline,
        fontFamily: key.font || 'Arial, sans-serif',
      });
    });
    
    svg += '\n</g>';
  });
  
  svg += '\n</svg>';
  
  return svg;
}

function getLegendArea({
  key,
  keyX,
  keyY,
  keyWidth,
  keyHeight,
  unitSize,
}: {
  key: Keyboard['keys'][number];
  keyX: number;
  keyY: number;
  keyWidth: number;
  keyHeight: number;
  unitSize: number;
}) {
  const edgeHeight = 6;
  const topOffset = 3;

  let effectiveX = keyX;
  let effectiveY = keyY;
  let effectiveWidth = keyWidth;
  let effectiveHeight = keyHeight;

  const hasSecondaryRect =
    key.x2 !== undefined ||
    key.y2 !== undefined ||
    key.width2 !== undefined ||
    key.height2 !== undefined;

  if (hasSecondaryRect && key.x2 !== undefined && key.x2 < 0 && key.width2 && key.width2 > key.width) {
    effectiveX = keyX + (key.x2 || 0) * unitSize;
    effectiveY = keyY + (key.y2 || 0) * unitSize;
    effectiveWidth = (key.width2 || key.width) * unitSize - 1;
    effectiveHeight = (key.height2 || key.height) * unitSize - 1;
  }

  return {
    x: effectiveX + edgeHeight,
    y: effectiveY + edgeHeight,
    width: effectiveWidth - edgeHeight * 2,
    height: effectiveHeight - edgeHeight * 2 - topOffset,
  };
}

export const exportAsSVG = (_stage: any, keyboard: Keyboard) => {
  const blob = new Blob([buildKeyboardSVG(keyboard)], { type: 'image/svg+xml' });
  saveAs(blob, `${keyboard.meta.name || 'keyboard'}.svg`);
};

function renderLegendTextSvg({
  legend,
  x,
  y,
  fontSize,
  textColor,
  textAnchor,
  baseline,
  fontFamily,
}: {
  legend: string;
  x: number;
  y: number;
  fontSize: number;
  textColor: string;
  textAnchor: string;
  baseline: string;
  fontFamily: string;
}): string {
  if (!legend) {
    return '';
  }

  const lines = legend.split('\n');
  if (lines.length === 1) {
    return renderLegendLineSvg({
      legend,
      x,
      y,
      fontSize,
      textColor,
      textAnchor,
      baseline,
      fontFamily,
    });
  }

  const lineHeight = fontSize * 1.2;
  const totalHeight = lineHeight * (lines.length - 1);
  const startY = y - totalHeight / 2;

  return lines
    .map((line, index) =>
      renderLegendLineSvg({
        legend: line,
        x,
        y: startY + index * lineHeight,
        fontSize,
        textColor,
        textAnchor,
        baseline: 'middle',
        fontFamily,
      })
    )
    .join('');
}

function renderLegendLineSvg({
  legend,
  x,
  y,
  fontSize,
  textColor,
  textAnchor,
  baseline,
  fontFamily,
}: {
  legend: string;
  x: number;
  y: number;
  fontSize: number;
  textColor: string;
  textAnchor: string;
  baseline: string;
  fontFamily: string;
}): string {
  const parsedLegend = parseIconLegend(legend);
  const svgBaseline = baseline === 'alphabetic' ? 'baseline' : baseline === 'hanging' ? 'hanging' : 'middle';
  const textAttrs =
    `x="${x}" y="${y}" font-size="${fontSize}" fill="${escapeXml(textColor)}" ` +
    `text-anchor="${escapeXml(textAnchor)}" dominant-baseline="${svgBaseline}" xml:space="preserve"`;

  if (parsedLegend.length === 0) {
    return `\n  <text ${textAttrs} font-family="${escapeXml(fontFamily)}">${escapeXml(legend)}</text>`;
  }

  const parts = parsedLegend
    .map((part) => {
      if (part.type === 'icon') {
        if (part.content) {
          return `<tspan font-family="trashcons">${escapeXml(part.content)}</tspan>`;
        }

        return '';
      }

      if (!part.content) {
        return '';
      }

      return `<tspan font-family="${escapeXml(fontFamily)}">${escapeXml(part.content)}</tspan>`;
    })
    .join('');

  if (!parts) {
    return '';
  }

  return `\n  <text ${textAttrs}>${parts}</text>`;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
