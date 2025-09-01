import React, { useEffect, useRef } from 'react';
import { Keyboard } from '../types';

interface LayoutPreviewProps {
  keyboard: Keyboard;
  width?: number;
  height?: number;
  className?: string;
}

const LayoutPreview: React.FC<LayoutPreviewProps> = ({ 
  keyboard, 
  width = 300, 
  height = 150,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !keyboard.keys || keyboard.keys.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calculate keyboard bounds
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    keyboard.keys.forEach(key => {
      minX = Math.min(minX, key.x);
      minY = Math.min(minY, key.y);
      maxX = Math.max(maxX, key.x + key.width);
      maxY = Math.max(maxY, key.y + key.height);
      
      // Account for secondary rectangle (like ISO Enter)
      if (key.y2 !== undefined && key.height2 !== undefined) {
        const y2 = key.y2 || 0;
        const height2 = key.height2 || 0;
        minY = Math.min(minY, key.y + y2);
        maxY = Math.max(maxY, key.y + y2 + height2);
      }
      if (key.x2 !== undefined && key.width2 !== undefined) {
        const x2 = key.x2 || 0;
        const width2 = key.width2 || 0;
        minX = Math.min(minX, key.x + x2);
        maxX = Math.max(maxX, key.x + x2 + width2);
      }
    });

    // Add padding
    const padding = 0.5;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    const keyboardWidth = maxX - minX;
    const keyboardHeight = maxY - minY;

    // Calculate scale to fit the canvas
    const scaleX = width / keyboardWidth;
    const scaleY = height / keyboardHeight;
    const scale = Math.min(scaleX, scaleY) * 0.9; // 90% to leave some margin

    // Set canvas size
    canvas.width = width;
    canvas.height = height;

    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    // Center the keyboard in the canvas
    const offsetX = (width - keyboardWidth * scale) / 2;
    const offsetY = (height - keyboardHeight * scale) / 2;

    // Draw keys
    keyboard.keys.forEach(key => {
      const x = (key.x - minX) * scale + offsetX;
      const y = (key.y - minY) * scale + offsetY;
      const w = key.width * scale - 2;
      const h = key.height * scale - 2;

      // Skip ghost keys and decals in preview
      if (key.ghost || key.decal) return;

      // Draw main key rectangle
      ctx.fillStyle = key.color || '#f9f9f9';
      ctx.fillRect(x, y, w, h);

      // Draw secondary rectangle for special keys (like ISO Enter)
      if (key.x2 !== undefined && key.y2 !== undefined && 
          key.width2 !== undefined && key.height2 !== undefined) {
        const x2 = (key.x + (key.x2 || 0) - minX) * scale + offsetX;
        const y2 = (key.y + (key.y2 || 0) - minY) * scale + offsetY;
        const w2 = (key.width2 || 0) * scale - 2;
        const h2 = (key.height2 || 0) * scale - 2;
        
        ctx.fillStyle = key.color || '#f9f9f9';
        ctx.fillRect(x2, y2, w2, h2);
      }

      // Draw a simple border
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);
    });
  }, [keyboard, width, height]);

  return (
    <canvas 
      ref={canvasRef} 
      className={`layout-preview-canvas ${className}`}
      style={{ width: `${width}px`, height: `${height}px` }}
    />
  );
};

export default LayoutPreview;