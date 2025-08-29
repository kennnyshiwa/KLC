import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useKeyboardStore } from '../store/keyboardStoreOptimized';
import { Key } from '../types';
import { getLegendPosition, getStabilizerPositions } from '../utils/keyUtils';
import { parseIconLegend } from '../utils/iconParser';
import { fontManager } from '../utils/fontManager';
import { isPointInRotatedRect } from '../utils/rotationUtils';

interface KeyboardCanvasProps {
  width: number;
  height: number;
}

export interface KeyboardCanvasRef {
  getStage: () => { toDataURL: () => string } | null;
}

interface KeyRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  key: Key;
}

// Canvas padding for easier edge selection
const CANVAS_PADDING_LEFT = 40;
const CANVAS_PADDING_TOP = 40;

const KeyboardCanvas = forwardRef<KeyboardCanvasRef, KeyboardCanvasProps>(({ width, height }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const keyRectsRef = useRef<KeyRect[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  
  // Interaction state
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const isSelectingRef = useRef(false);
  const selectionRectRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const isDuplicatingRef = useRef(false);
  const duplicatedKeysRef = useRef<Set<string>>(new Set());
  const lastSelectedKeyRef = useRef<string | null>(null);
  const isAddingToSelectionRef = useRef(false); // Track if we're adding to selection
  const hoveredStabRef = useRef<{ keyId: string; stabIndex: number; x: number; y: number; keyWidth: number } | null>(null);
  const mousePositionRef = useRef({ x: 0, y: 0 });
  
  // Store state cache
  const stateRef = useRef({
    keyboard: useKeyboardStore.getState().keyboard,
    selectedKeys: useKeyboardStore.getState().selectedKeys,
    hoveredKey: useKeyboardStore.getState().hoveredKey,
    editorSettings: useKeyboardStore.getState().editorSettings,
    isSettingRotationPoint: useKeyboardStore.getState().isSettingRotationPoint,
    isRotationSectionExpanded: useKeyboardStore.getState().isRotationSectionExpanded,
  });

  useImperativeHandle(ref, () => ({
    getStage: () => canvasRef.current ? {
      toDataURL: () => canvasRef.current!.toDataURL()
    } : null
  }));

  // Helper function to adjust color brightness
  const adjustColorBrightness = (color: string, amount: number): string => {
    const normalizedColor = color.startsWith('#') ? color : `#${color}`;
    const rgb = parseInt(normalizedColor.slice(1), 16);
    const r = Math.max(0, Math.min(255, ((rgb >> 16) & 255) + amount));
    const g = Math.max(0, Math.min(255, ((rgb >> 8) & 255) + amount));
    const b = Math.max(0, Math.min(255, (rgb & 255) + amount));
    return `rgb(${r}, ${g}, ${b})`;
  };

  // Cache for loaded SVG images
  const svgImageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  // Cache for colored icon canvases
  const coloredIconCache = useRef<Map<string, HTMLCanvasElement>>(new Map());
  
  // Load SVG icon if needed
  const loadSvgIcon = (iconName: string): HTMLImageElement | null => {
    const cacheKey = iconName;
    
    if (svgImageCache.current.has(cacheKey)) {
      return svgImageCache.current.get(cacheKey) || null;
    }
    
    // Map icon names to their SVG paths
    const svgPaths: Record<string, string> = {
      'icon-40s-logo': '/icons/40s-logo.svg'
    };
    
    const path = svgPaths[iconName];
    if (!path) return null;
    
    const img = new Image();
    img.src = path;
    img.onload = () => {
      // Clear colored cache when base image loads
      coloredIconCache.current.clear();
      requestRender(); // Re-render when image loads
    };
    
    svgImageCache.current.set(cacheKey, img);
    return img;
  };
  
  // Get or create colored version of icon
  const getColoredIcon = (iconName: string, color: string, size: number): HTMLCanvasElement | null => {
    const cacheKey = `${iconName}-${color}-${size}`;
    
    // Check cache first
    if (coloredIconCache.current.has(cacheKey)) {
      return coloredIconCache.current.get(cacheKey) || null;
    }
    
    const svgImage = loadSvgIcon(iconName);
    if (!svgImage || !svgImage.complete) return null;
    
    // Create colored version
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return null;
    
    // Draw the SVG
    ctx.drawImage(svgImage, 0, 0, size, size);
    
    // Apply color by compositing
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, size, size);
    
    // Cache the result
    coloredIconCache.current.set(cacheKey, canvas);
    return canvas;
  };

  // Fast render function
  const render = () => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (!canvas || !ctx) return;
    
    // Debug: confirm render is running

    // Clear canvas with appropriate background for theme
    const isDarkMode = document.documentElement.classList.contains('dark-mode');
    ctx.fillStyle = isDarkMode ? '#1a1a1a' : '#fafafa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const { editorSettings, keyboard, selectedKeys, hoveredKey } = stateRef.current;
    const unitSize = editorSettings.unitSize;
    const keyInset = 1; // 1 pixel inset on all sides = 2 pixel gap between keys

    // Save context and apply padding transform
    ctx.save();
    ctx.translate(CANVAS_PADDING_LEFT, CANVAS_PADDING_TOP);

    // Update key rectangles
    keyRectsRef.current = [];

    // Draw keys
    keyboard.keys.forEach(key => {
      // Calculate exact position and size
      const baseX = key.x * unitSize;
      const baseY = key.y * unitSize;
      const baseWidth = key.width * unitSize;
      const baseHeight = key.height * unitSize;
      
      // Round AFTER applying inset to ensure consistent gaps
      const keyX = Math.round(baseX + keyInset);
      const keyY = Math.round(baseY + keyInset);
      // Calculate width/height directly to preserve fractional key sizes
      const keyWidth = Math.round(baseWidth - keyInset * 2);
      const keyHeight = Math.round(baseHeight - keyInset * 2);
      
      // Apply drag offset to selected keys
      let renderX = keyX;
      let renderY = keyY;
      if (isDraggingRef.current && selectedKeys.has(key.id)) {
        renderX += dragOffsetRef.current.x;
        renderY += dragOffsetRef.current.y;
      }
      
      // Apply rotation if needed
      const hasRotation = key.rotation_angle !== undefined && key.rotation_angle !== 0;
      if (hasRotation) {
        ctx.save();
        
        // Determine rotation center
        let rotationCenterX: number;
        let rotationCenterY: number;
        
        if (key.rotation_x !== undefined && key.rotation_y !== undefined) {
          // Use custom rotation center
          rotationCenterX = key.rotation_x * unitSize;
          rotationCenterY = key.rotation_y * unitSize;
        } else {
          // Default to key center
          rotationCenterX = renderX + keyWidth / 2;
          rotationCenterY = renderY + keyHeight / 2;
        }
        
        // Apply rotation transform
        ctx.translate(rotationCenterX, rotationCenterY);
        ctx.rotate(key.rotation_angle! * Math.PI / 180);
        ctx.translate(-rotationCenterX, -rotationCenterY);
      }
      
      // Store rect for hit testing
      keyRectsRef.current.push({
        id: key.id,
        x: renderX,
        y: renderY,
        width: keyWidth,
        height: keyHeight,
        key: key
      });
      
      // Handle special key types
      if (key.ghost && !(key.decal && key.color === 'transparent')) {
        // Regular ghost keys (not row labels) are rendered as flat, semi-transparent rectangles
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = key.color || '#cccccc';
        ctx.fillRect(renderX, renderY, keyWidth, keyHeight);
        
        // Draw border
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(renderX, renderY, keyWidth, keyHeight);
        
        // Ghost keys should not render any text
        
        ctx.restore();
        
        // Skip the rest of the rendering for regular ghost keys
        return;
      }
      
      // Check if this is a rotary encoder
      if (key.profile === 'ENCODER') {
        // Draw simple encoder circle with position indicator
        ctx.save();
        
        const centerX = renderX + keyWidth / 2;
        const centerY = renderY + keyHeight / 2;
        const radius = Math.min(keyWidth, keyHeight) / 2 - 2; // Slight padding
        
        // Draw outer circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        const baseColor = key.color || '#cccccc';
        ctx.fillStyle = baseColor;
        ctx.fill();
        
        // Draw border
        ctx.strokeStyle = isDarkMode ? '#666666' : '#333333';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw position indicator line (from center to top)
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX, centerY - radius * 0.7);
        ctx.strokeStyle = '#000000';
        // Make line thickness proportional to encoder size
        ctx.lineWidth = Math.max(2, radius * 0.1);
        ctx.lineCap = 'round';
        ctx.stroke();
        
        ctx.restore();
        
        // Skip normal key rendering for encoders
      } else if (key.profile === 'LED') {
        // Draw LED indicator as a circle
        ctx.save();
        
        // LED should be drawn as a circle at the center of the key position
        const centerX = renderX + keyWidth / 2;
        const centerY = renderY + keyHeight / 2;
        const radius = Math.min(keyWidth, keyHeight) / 2;
        
        // Draw outer ring (bezel)
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#333333';
        ctx.fill();
        
        // Draw inner LED
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 0.8, 0, Math.PI * 2);
        
        // Use the key color for the LED
        const ledColor = key.color || '#ff0000';
        
        // Create gradient for LED effect
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius * 0.8);
        gradient.addColorStop(0, ledColor);
        gradient.addColorStop(0.7, ledColor);
        gradient.addColorStop(1, adjustColorBrightness(ledColor, -50));
        
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Add glossy effect
        ctx.beginPath();
        ctx.arc(centerX, centerY - radius * 0.3, radius * 0.3, 0, Math.PI * 2);
        const glossGradient = ctx.createRadialGradient(
          centerX, centerY - radius * 0.3, 0,
          centerX, centerY - radius * 0.3, radius * 0.3
        );
        glossGradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
        glossGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = glossGradient;
        ctx.fill();
        
        ctx.restore();
        
        // Skip normal key rendering for LEDs
      } else if (key.decal) {
        // For decal keys, skip all the key rendering and only draw text
        // No shadow, no key shape, just transparent
        ctx.shadowColor = 'transparent';
      } else {
        // Shadow for the entire key
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 2;
      }
      
      // Get base color - brighten slightly when hovered
      const keyColor = key.color || '#f9f9f9';
      const baseColor = keyColor;
      
      // 3D key rendering with visible edges
      const edgeHeight = key.decal ? 0 : 6; // Height of the visible edge (0 for decals)
      const topOffset = key.decal ? 0 : 3; // How much the top surface is offset (0 for decals)
      
      // Only render the key shape if it's not a decal, LED, or encoder
      if (!key.decal && key.profile !== 'LED' && key.profile !== 'ENCODER') {
        // Parse base color to RGB
        const parseColor = (color: string) => {
          // Ensure color starts with #
          const normalizedColor = color.startsWith('#') ? color : `#${color}`;
          const rgb = parseInt(normalizedColor.slice(1), 16);
          return {
            r: (rgb >> 16) & 255,
            g: (rgb >> 8) & 255,
            b: rgb & 255
          };
        };
        
        const adjustBrightness = (color: { r: number, g: number, b: number }, amount: number) => {
          return {
            r: Math.max(0, Math.min(255, color.r + amount)),
            g: Math.max(0, Math.min(255, color.g + amount)),
            b: Math.max(0, Math.min(255, color.b + amount))
          };
        };
        
        const toRgbString = (color: { r: number, g: number, b: number }) => {
          return `rgb(${color.r}, ${color.g}, ${color.b})`;
        };
        
        let baseRgb = parseColor(baseColor);
        
        // Brighten the key when hovered
        if (hoveredKey === key.id) {
          baseRgb = adjustBrightness(baseRgb, 20);
        }
        
        const sideColor = toRgbString(adjustBrightness(baseRgb, -40));
        const bottomColor = toRgbString(adjustBrightness(baseRgb, -80));
      
        // Check if this is a special shaped key (ISO Enter, Big Ass Enter)
        const hasSecondaryRect = key.x2 !== undefined || key.y2 !== undefined || 
                                key.width2 !== undefined || key.height2 !== undefined;
        
        // Reset shadow for inner elements
        ctx.shadowColor = 'transparent';
        
        if (hasSecondaryRect) {
          // Draw complex shape (like ISO Enter or Big Ass Enter)
          // Calculate secondary rectangle offsets
          const x2 = (key.x2 || 0) * unitSize;
          const y2 = (key.y2 || 0) * unitSize;
          const width2 = (key.width2 || key.width) * unitSize - keyInset * 2;
          const height2 = (key.height2 || key.height) * unitSize - keyInset * 2;
          
          // For Big Ass Enter and ISO Enter, we need to draw it as one unified shape
          // Draw the unified bottom layer first
          ctx.fillStyle = bottomColor;
          ctx.beginPath();
          ctx.roundRect(renderX, renderY + topOffset, keyWidth, keyHeight - topOffset, 5);
          ctx.fill();
          ctx.beginPath();
          ctx.roundRect(renderX + x2, renderY + y2 + topOffset, width2, height2 - topOffset, 5);
          ctx.fill();
          
          // Draw the unified middle layer
          ctx.fillStyle = sideColor;
          ctx.beginPath();
          ctx.roundRect(renderX, renderY, keyWidth, keyHeight - topOffset, 5);
          ctx.fill();
          ctx.beginPath();
          ctx.roundRect(renderX + x2, renderY + y2, width2, height2 - topOffset, 5);
          ctx.fill();
          
          
          // Draw the top surfaces
          ctx.fillStyle = toRgbString(baseRgb);
          ctx.beginPath();
          ctx.roundRect(
            renderX + edgeHeight, 
            renderY + edgeHeight, 
            keyWidth - edgeHeight * 2, 
            keyHeight - edgeHeight * 2 - topOffset, 
            4
          );
          ctx.fill();
          
          ctx.beginPath();
          ctx.roundRect(
            renderX + x2 + edgeHeight, 
            renderY + y2 + edgeHeight, 
            width2 - edgeHeight * 2, 
            height2 - edgeHeight * 2 - topOffset, 
            4
          );
          ctx.fill();
          
          // Add subtle highlight on top surfaces
          const highlightGradient = ctx.createLinearGradient(
            renderX + edgeHeight, 
            renderY + edgeHeight, 
            renderX + edgeHeight, 
            renderY + edgeHeight + 20
          );
          highlightGradient.addColorStop(0, toRgbString(adjustBrightness(baseRgb, 15)));
          highlightGradient.addColorStop(1, toRgbString(baseRgb));
          
          ctx.fillStyle = highlightGradient;
          ctx.beginPath();
          ctx.roundRect(
            renderX + edgeHeight, 
            renderY + edgeHeight, 
            keyWidth - edgeHeight * 2, 
            keyHeight - edgeHeight * 2 - topOffset, 
            4
          );
          ctx.fill();
          
          ctx.beginPath();
          ctx.roundRect(
            renderX + x2 + edgeHeight, 
            renderY + y2 + edgeHeight, 
            width2 - edgeHeight * 2, 
            height2 - edgeHeight * 2 - topOffset, 
            4
          );
          ctx.fill();
        } else {
          // Draw simple rectangular key with all 4 visible edges
          
          // First draw the base (bottom layer) in the darkest color
          ctx.fillStyle = bottomColor;
          ctx.beginPath();
          ctx.roundRect(renderX, renderY + topOffset, keyWidth, keyHeight - topOffset, 5);
          ctx.fill();
          
          // Draw the middle layer (the visible edges) in medium color
          ctx.fillStyle = sideColor;
          ctx.beginPath();
          ctx.roundRect(renderX, renderY, keyWidth, keyHeight - topOffset, 5);
          ctx.fill();
          
          // Draw the top surface
          ctx.fillStyle = toRgbString(baseRgb);
          ctx.beginPath();
          ctx.roundRect(
            renderX + edgeHeight, 
            renderY + edgeHeight, 
            keyWidth - edgeHeight * 2, 
            keyHeight - edgeHeight * 2 - topOffset, 
            4
          );
          ctx.fill();
          
          // Add subtle highlight on top surface
          const highlightGradient = ctx.createLinearGradient(
            renderX + edgeHeight, 
            renderY + edgeHeight, 
            renderX + edgeHeight, 
            renderY + edgeHeight + 20
          );
          highlightGradient.addColorStop(0, toRgbString(adjustBrightness(baseRgb, 15)));
          highlightGradient.addColorStop(1, toRgbString(baseRgb));
          
          ctx.fillStyle = highlightGradient;
          ctx.beginPath();
          ctx.roundRect(
            renderX + edgeHeight, 
            renderY + edgeHeight, 
            keyWidth - edgeHeight * 2, 
            keyHeight - edgeHeight * 2 - topOffset, 
            4
          );
          ctx.fill();
        }
      
        // Draw stepped key indicator
        if (key.stepped) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
          ctx.fillRect(
            renderX + keyWidth * 0.6, 
            renderY + edgeHeight, 
            keyWidth * 0.4 - edgeHeight, 
            keyHeight - edgeHeight * 2 - topOffset
          );
        }
        
        // Draw homing nub indicator
        if (key.nub) {
          // Draw a more pronounced circular depression in the center of the key
          const centerX = renderX + keyWidth / 2;
          const centerY = renderY + keyHeight / 2;
          const radius = Math.min(keyWidth, keyHeight) * 0.25; // Increased from 0.15
          
          // Create radial gradient for depression effect with stronger shading
          const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
          gradient.addColorStop(0, 'rgba(0, 0, 0, 0.3)'); // Increased from 0.15
          gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.15)'); // Added middle stop
          gradient.addColorStop(0.8, 'rgba(0, 0, 0, 0.05)'); // Changed from 0.7
          gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
          
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
          ctx.fill();
        }
      } // End of if (!key.decal)
      
      
      // Draw selection outline if selected (skip for row labels)
      if (selectedKeys.has(key.id) && !(key.decal && key.ghost)) {
        // Check if this is a special shaped key
        const hasSecondaryRect = key.x2 !== undefined || key.y2 !== undefined || 
                                key.width2 !== undefined || key.height2 !== undefined;
        
        // Draw a thick outline with a contrasting color
        // Use green for duplicated keys, blue for regular selection
        if (isDuplicatingRef.current && duplicatedKeysRef.current.has(key.id)) {
          ctx.strokeStyle = '#27ae60'; // Green for duplicates
          ctx.setLineDash([5, 3]); // Dashed line for duplicates
        } else {
          ctx.strokeStyle = '#3498db';
          ctx.setLineDash([]);
        }
        ctx.lineWidth = 3;
        
        if (hasSecondaryRect) {
          // For special keys, we need to draw a path that follows the actual shape
          const x2 = (key.x2 || 0) * unitSize;
          const y2 = (key.y2 || 0) * unitSize;
          const width2 = (key.width2 || key.width) * unitSize - keyInset * 2;
          const height2 = (key.height2 || key.height) * unitSize - keyInset * 2;
          
          // Draw the selection outline as a unified shape
          const outlineOffset = 1;
          const radius = 6;
          
          // Create a path that outlines the L-shaped key
          ctx.beginPath();
          
          // Determine the type of special key and draw appropriate outline
          // Check if this is an L-shaped key (ISO Enter, Big Ass Enter, etc)
          const isLShaped = (x2 !== 0 || y2 !== 0) && (width2 !== key.width || height2 !== key.height);
                    
          if (isLShaped) {
            // Draw a continuous outline for L-shaped keys
            // We'll create a path that traces the outer edge of the combined shape
            
            // Draw the L-shape outline
            if (x2 < 0 && height2 < keyHeight) {
              // ISO Enter type - secondary rect is at top and extends left
              // Typical ISO: x2:-0.25, y2:0, h2:1, h:2
              
              // For ISO Enter, we need to trace the actual L-shape outline
              // Start from top-left of secondary rect
              ctx.moveTo(renderX + x2 - outlineOffset + radius, renderY + y2 - outlineOffset);
              
              // Top-left corner of secondary rect
              ctx.arcTo(renderX + x2 - outlineOffset, renderY + y2 - outlineOffset, renderX + x2 - outlineOffset, renderY + y2 - outlineOffset + radius, radius);
              
              // Left side of secondary rect going down
              ctx.lineTo(renderX + x2 - outlineOffset, renderY + y2 + height2 + outlineOffset);
              
              // Since x2 is negative, this creates the notch - go RIGHT to main rect left edge
              ctx.lineTo(renderX - outlineOffset, renderY + y2 + height2 + outlineOffset);
              
              // Down the left side of main rect (continuing from where secondary rect ends)
              ctx.lineTo(renderX - outlineOffset, renderY + keyHeight + outlineOffset - radius);
              
              // Bottom-left corner of main rect
              ctx.arcTo(renderX - outlineOffset, renderY + keyHeight + outlineOffset, renderX - outlineOffset + radius, renderY + keyHeight + outlineOffset, radius);
              
              // Bottom of main rect
              ctx.lineTo(renderX + keyWidth + outlineOffset - radius, renderY + keyHeight + outlineOffset);
              
              // Bottom-right corner of main rect
              ctx.arcTo(renderX + keyWidth + outlineOffset, renderY + keyHeight + outlineOffset, renderX + keyWidth + outlineOffset, renderY + keyHeight + outlineOffset - radius, radius);
              
              // Right side of main rect going up to top of main rect
              ctx.lineTo(renderX + keyWidth + outlineOffset, renderY + radius);
              
              // Top-right corner of main rect
              ctx.arcTo(renderX + keyWidth + outlineOffset, renderY, renderX + keyWidth + outlineOffset - radius, renderY, radius);
              
              // Top of main rect going left to where secondary rect connects
              ctx.lineTo(renderX + x2 + width2 + outlineOffset - radius, renderY);
              
              // Top-right corner of secondary rect area
              ctx.arcTo(renderX + x2 + width2 + outlineOffset, renderY, renderX + x2 + width2 + outlineOffset, renderY + radius, radius);
              
              // Right side of secondary rect going up
              ctx.lineTo(renderX + x2 + width2 + outlineOffset, renderY + y2 - outlineOffset + radius);
              
              // Top-right corner of secondary rect
              ctx.arcTo(renderX + x2 + width2 + outlineOffset, renderY + y2 - outlineOffset, renderX + x2 + width2 + outlineOffset - radius, renderY + y2 - outlineOffset, radius);
              
              // Top of secondary rect back to start
              ctx.lineTo(renderX + x2 - outlineOffset + radius, renderY + y2 - outlineOffset);
              
              ctx.closePath();
            } else if (y2 < 0) {
              // Original ISO Enter type where y2 is negative
              ctx.moveTo(renderX + x2 - outlineOffset + radius, renderY + y2 - outlineOffset);
              ctx.arcTo(renderX + x2 - outlineOffset, renderY + y2 - outlineOffset, renderX + x2 - outlineOffset, renderY + y2 - outlineOffset + radius, radius);
              ctx.lineTo(renderX + x2 - outlineOffset, renderY - outlineOffset - radius);
              ctx.arcTo(renderX + x2 - outlineOffset, renderY - outlineOffset, renderX + x2 - outlineOffset + radius, renderY - outlineOffset, radius);
              ctx.lineTo(renderX - outlineOffset + radius, renderY - outlineOffset);
              ctx.arcTo(renderX - outlineOffset, renderY - outlineOffset, renderX - outlineOffset, renderY - outlineOffset + radius, radius);
              ctx.lineTo(renderX - outlineOffset, renderY + keyHeight + outlineOffset - radius);
              ctx.arcTo(renderX - outlineOffset, renderY + keyHeight + outlineOffset, renderX - outlineOffset + radius, renderY + keyHeight + outlineOffset, radius);
              ctx.lineTo(renderX + keyWidth + outlineOffset - radius, renderY + keyHeight + outlineOffset);
              ctx.arcTo(renderX + keyWidth + outlineOffset, renderY + keyHeight + outlineOffset, renderX + keyWidth + outlineOffset, renderY + keyHeight + outlineOffset - radius, radius);
              ctx.lineTo(renderX + keyWidth + outlineOffset, renderY + y2 + height2 + outlineOffset - radius);
              ctx.arcTo(renderX + keyWidth + outlineOffset, renderY + y2 + height2 + outlineOffset, renderX + keyWidth + outlineOffset - radius, renderY + y2 + height2 + outlineOffset, radius);
              ctx.lineTo(renderX + x2 + width2 + outlineOffset - radius, renderY + y2 + height2 + outlineOffset);
              ctx.arcTo(renderX + x2 + width2 + outlineOffset, renderY + y2 + height2 + outlineOffset, renderX + x2 + width2 + outlineOffset, renderY + y2 + height2 + outlineOffset - radius, radius);
              ctx.lineTo(renderX + x2 + width2 + outlineOffset, renderY + y2 - outlineOffset + radius);
              ctx.arcTo(renderX + x2 + width2 + outlineOffset, renderY + y2 - outlineOffset, renderX + x2 + width2 + outlineOffset - radius, renderY + y2 - outlineOffset, radius);
              ctx.closePath();
            } else if (x2 > 0) {
              // Big Ass Enter type (secondary rect extends to the right)
              ctx.moveTo(renderX - outlineOffset + radius, renderY - outlineOffset);
              ctx.arcTo(renderX - outlineOffset, renderY - outlineOffset, renderX - outlineOffset, renderY - outlineOffset + radius, radius);
              ctx.lineTo(renderX - outlineOffset, renderY + keyHeight + outlineOffset - radius);
              ctx.arcTo(renderX - outlineOffset, renderY + keyHeight + outlineOffset, renderX - outlineOffset + radius, renderY + keyHeight + outlineOffset, radius);
              ctx.lineTo(renderX + x2 - outlineOffset - radius, renderY + keyHeight + outlineOffset);
              ctx.arcTo(renderX + x2 - outlineOffset, renderY + keyHeight + outlineOffset, renderX + x2 - outlineOffset, renderY + keyHeight + outlineOffset - radius, radius);
              ctx.lineTo(renderX + x2 - outlineOffset, renderY + y2 + height2 + outlineOffset - radius);
              ctx.arcTo(renderX + x2 - outlineOffset, renderY + y2 + height2 + outlineOffset, renderX + x2 - outlineOffset + radius, renderY + y2 + height2 + outlineOffset, radius);
              ctx.lineTo(renderX + x2 + width2 + outlineOffset - radius, renderY + y2 + height2 + outlineOffset);
              ctx.arcTo(renderX + x2 + width2 + outlineOffset, renderY + y2 + height2 + outlineOffset, renderX + x2 + width2 + outlineOffset, renderY + y2 + height2 + outlineOffset - radius, radius);
              ctx.lineTo(renderX + x2 + width2 + outlineOffset, renderY + y2 - outlineOffset + radius);
              ctx.arcTo(renderX + x2 + width2 + outlineOffset, renderY + y2 - outlineOffset, renderX + x2 + width2 + outlineOffset - radius, renderY + y2 - outlineOffset, radius);
              ctx.lineTo(renderX + keyWidth + outlineOffset - radius, renderY + y2 - outlineOffset);
              ctx.arcTo(renderX + keyWidth + outlineOffset, renderY + y2 - outlineOffset, renderX + keyWidth + outlineOffset, renderY + y2 - outlineOffset - radius, radius);
              ctx.lineTo(renderX + keyWidth + outlineOffset, renderY - outlineOffset + radius);
              ctx.arcTo(renderX + keyWidth + outlineOffset, renderY - outlineOffset, renderX + keyWidth + outlineOffset - radius, renderY - outlineOffset, radius);
              ctx.closePath();
            } else {
              // Generic L-shape - for now use the same approach as other ISO variants
              // This ensures all L-shaped keys get a continuous outline
              ctx.moveTo(renderX - outlineOffset + radius, renderY - outlineOffset);
              ctx.arcTo(renderX - outlineOffset, renderY - outlineOffset, renderX - outlineOffset, renderY - outlineOffset + radius, radius);
              ctx.lineTo(renderX - outlineOffset, renderY + keyHeight + outlineOffset - radius);
              ctx.arcTo(renderX - outlineOffset, renderY + keyHeight + outlineOffset, renderX - outlineOffset + radius, renderY + keyHeight + outlineOffset, radius);
              ctx.lineTo(renderX + keyWidth + outlineOffset - radius, renderY + keyHeight + outlineOffset);
              ctx.arcTo(renderX + keyWidth + outlineOffset, renderY + keyHeight + outlineOffset, renderX + keyWidth + outlineOffset, renderY + keyHeight + outlineOffset - radius, radius);
              ctx.lineTo(renderX + keyWidth + outlineOffset, renderY - outlineOffset + radius);
              ctx.arcTo(renderX + keyWidth + outlineOffset, renderY - outlineOffset, renderX + keyWidth + outlineOffset - radius, renderY - outlineOffset, radius);
              ctx.closePath();
            }
          } else {
            // For stepped keys or other special cases, just draw rounded rectangles
            ctx.roundRect(renderX - outlineOffset, renderY - outlineOffset, keyWidth + outlineOffset * 2, keyHeight + outlineOffset * 2, radius);
            if (width2 > 0 || height2 > 0) {
              ctx.roundRect(renderX + x2 - outlineOffset, renderY + y2 - outlineOffset, width2 + outlineOffset * 2, height2 + outlineOffset * 2, radius);
            }
          }
          
          ctx.stroke();
          
          // Add a white inner stroke for better contrast
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.lineWidth = 1;
          const innerOffset = 2;
          
          // Repeat the same path but with larger offset for the inner stroke
          ctx.beginPath();
          if (isLShaped) {
            if (x2 < 0 && height2 < keyHeight) {
              // ISO Enter type - Same path logic but with innerOffset instead of outlineOffset
              // Typical ISO: x2:-0.25, y2:0, h2:1, h:2
              
              // For ISO Enter, we need to trace the actual L-shape outline
              // Start from top-left of secondary rect
              ctx.moveTo(renderX + x2 - innerOffset + radius, renderY + y2 - innerOffset);
              
              // Top-left corner of secondary rect
              ctx.arcTo(renderX + x2 - innerOffset, renderY + y2 - innerOffset, renderX + x2 - innerOffset, renderY + y2 - innerOffset + radius, radius);
              
              // Left side of secondary rect going down
              ctx.lineTo(renderX + x2 - innerOffset, renderY + y2 + height2 + innerOffset);
              
              // Since x2 is negative, this creates the notch - go RIGHT to main rect left edge
              ctx.lineTo(renderX - innerOffset, renderY + y2 + height2 + innerOffset);
              
              // Down the left side of main rect (continuing from where secondary rect ends)
              ctx.lineTo(renderX - innerOffset, renderY + keyHeight + innerOffset - radius);
              
              // Bottom-left corner of main rect
              ctx.arcTo(renderX - innerOffset, renderY + keyHeight + innerOffset, renderX - innerOffset + radius, renderY + keyHeight + innerOffset, radius);
              
              // Bottom of main rect
              ctx.lineTo(renderX + keyWidth + innerOffset - radius, renderY + keyHeight + innerOffset);
              
              // Bottom-right corner of main rect
              ctx.arcTo(renderX + keyWidth + innerOffset, renderY + keyHeight + innerOffset, renderX + keyWidth + innerOffset, renderY + keyHeight + innerOffset - radius, radius);
              
              // Right side of main rect going up to top of main rect
              ctx.lineTo(renderX + keyWidth + innerOffset, renderY + radius);
              
              // Top-right corner of main rect
              ctx.arcTo(renderX + keyWidth + innerOffset, renderY, renderX + keyWidth + innerOffset - radius, renderY, radius);
              
              // Top of main rect going left to where secondary rect connects
              ctx.lineTo(renderX + x2 + width2 + innerOffset - radius, renderY);
              
              // Top-right corner of secondary rect area
              ctx.arcTo(renderX + x2 + width2 + innerOffset, renderY, renderX + x2 + width2 + innerOffset, renderY + radius, radius);
              
              // Right side of secondary rect going up
              ctx.lineTo(renderX + x2 + width2 + innerOffset, renderY + y2 - innerOffset + radius);
              
              // Top-right corner of secondary rect
              ctx.arcTo(renderX + x2 + width2 + innerOffset, renderY + y2 - innerOffset, renderX + x2 + width2 + innerOffset - radius, renderY + y2 - innerOffset, radius);
              
              // Top of secondary rect back to start
              ctx.lineTo(renderX + x2 - innerOffset + radius, renderY + y2 - innerOffset);
              
              ctx.closePath();
            } else if (y2 < 0) {
              // Original ISO Enter type where y2 is negative
              ctx.moveTo(renderX + x2 - innerOffset + radius, renderY + y2 - innerOffset);
              ctx.arcTo(renderX + x2 - innerOffset, renderY + y2 - innerOffset, renderX + x2 - innerOffset, renderY + y2 - innerOffset + radius, radius);
              ctx.lineTo(renderX + x2 - innerOffset, renderY - innerOffset - radius);
              ctx.arcTo(renderX + x2 - innerOffset, renderY - innerOffset, renderX + x2 - innerOffset + radius, renderY - innerOffset, radius);
              ctx.lineTo(renderX - innerOffset + radius, renderY - innerOffset);
              ctx.arcTo(renderX - innerOffset, renderY - innerOffset, renderX - innerOffset, renderY - innerOffset + radius, radius);
              ctx.lineTo(renderX - innerOffset, renderY + keyHeight + innerOffset - radius);
              ctx.arcTo(renderX - innerOffset, renderY + keyHeight + innerOffset, renderX - innerOffset + radius, renderY + keyHeight + innerOffset, radius);
              ctx.lineTo(renderX + keyWidth + innerOffset - radius, renderY + keyHeight + innerOffset);
              ctx.arcTo(renderX + keyWidth + innerOffset, renderY + keyHeight + innerOffset, renderX + keyWidth + innerOffset, renderY + keyHeight + innerOffset - radius, radius);
              ctx.lineTo(renderX + keyWidth + innerOffset, renderY + y2 + height2 + innerOffset - radius);
              ctx.arcTo(renderX + keyWidth + innerOffset, renderY + y2 + height2 + innerOffset, renderX + keyWidth + innerOffset - radius, renderY + y2 + height2 + innerOffset, radius);
              ctx.lineTo(renderX + x2 + width2 + innerOffset - radius, renderY + y2 + height2 + innerOffset);
              ctx.arcTo(renderX + x2 + width2 + innerOffset, renderY + y2 + height2 + innerOffset, renderX + x2 + width2 + innerOffset, renderY + y2 + height2 + innerOffset - radius, radius);
              ctx.lineTo(renderX + x2 + width2 + innerOffset, renderY + y2 - innerOffset + radius);
              ctx.arcTo(renderX + x2 + width2 + innerOffset, renderY + y2 - innerOffset, renderX + x2 + width2 + innerOffset - radius, renderY + y2 - innerOffset, radius);
              ctx.closePath();
            } else {
              // For other L-shaped keys, draw two rounded rectangles
              ctx.roundRect(renderX - innerOffset, renderY - innerOffset, keyWidth + innerOffset * 2, keyHeight + innerOffset * 2, radius);
              ctx.roundRect(renderX + x2 - innerOffset, renderY + y2 - innerOffset, width2 + innerOffset * 2, height2 + innerOffset * 2, radius);
            }
          } else {
            // For stepped keys or other special cases
            ctx.roundRect(renderX - innerOffset, renderY - innerOffset, keyWidth + innerOffset * 2, keyHeight + innerOffset * 2, radius);
            if (width2 > 0 || height2 > 0) {
              ctx.roundRect(renderX + x2 - innerOffset, renderY + y2 - innerOffset, width2 + innerOffset * 2, height2 + innerOffset * 2, radius);
            }
          }
          ctx.stroke();
        } else {
          // Regular key - single outline
          // Draw outline slightly outside the key bounds for better visibility
          ctx.beginPath();
          ctx.roundRect(renderX - 1, renderY - 1, keyWidth + 2, keyHeight + 2, 6);
          ctx.stroke();
          
          // Add a white inner stroke for better contrast
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(renderX - 2, renderY - 2, keyWidth + 4, keyHeight + 4, 7);
          ctx.stroke();
        }
      }
      
      // Draw front legends if present
      if (key.frontLegends && key.frontLegends.some(l => l)) {
        ctx.save();
        // Use white text for decal keys in dark mode, otherwise black
        ctx.fillStyle = (key.decal && isDarkMode) ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)';
        const frontFont = key.font || '';
        ctx.font = frontFont ? fontManager.getRenderFont(frontFont, 10) : '10px Arial';
        ctx.textBaseline = 'middle';
        
        const frontY = renderY + keyHeight - 3;
        const padding = 5;
        
        // Check if side-printed text should be centered (bit 2 of align)
        const centerSidePrinted = key.align !== undefined && (key.align & 0x04) !== 0;
        
        if (centerSidePrinted) {
          // If bit 2 is set, each front legend should still be in its own position
          // but the text within that position should be centered
          
          // Left front legend - centered within left third
          if (key.frontLegends[0]) {
            ctx.textAlign = 'center';
            ctx.fillText(key.frontLegends[0], renderX + keyWidth / 6, frontY);
          }
          
          // Center front legend
          if (key.frontLegends[1]) {
            ctx.textAlign = 'center';
            ctx.fillText(key.frontLegends[1], renderX + keyWidth / 2, frontY);
          }
          
          // Right front legend - centered within right third
          if (key.frontLegends[2]) {
            ctx.textAlign = 'center';
            ctx.fillText(key.frontLegends[2], renderX + keyWidth * 5 / 6, frontY);
          }
        } else {
          // Default positioning for front legends
          // Left front legend
          if (key.frontLegends[0]) {
            ctx.textAlign = 'left';
            ctx.fillText(key.frontLegends[0], renderX + padding, frontY);
          }
          
          // Center front legend
          if (key.frontLegends[1]) {
            ctx.textAlign = 'center';
            ctx.fillText(key.frontLegends[1], renderX + keyWidth / 2, frontY);
          }
          
          // Right front legend
          if (key.frontLegends[2]) {
            ctx.textAlign = 'right';
            ctx.fillText(key.frontLegends[2], renderX + keyWidth - padding, frontY);
          }
        }
        
        ctx.restore();
      }
      
      // Draw labels
      ctx.fillStyle = '#000000';
      
      // Special handling for row labels (decal + ghost keys with transparent color)
      if (key.decal && key.ghost && key.color === 'transparent') {
        // Row labels are fully transparent like ghost keys
        ctx.save();
        
        // Draw a ghost key style border
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = isDarkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(renderX, renderY, keyWidth, keyHeight);
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        
        // Draw the text if there's a label
        if (key.labels && key.labels.length > 0 && key.labels[0]) {
          const label = key.labels[0];
          ctx.font = 'bold 16px system-ui';
          ctx.fillStyle = isDarkMode ? '#888888' : '#666666';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const centerX = renderX + keyWidth / 2;
          const centerY = renderY + keyHeight / 2;
          ctx.fillText(label, centerX, centerY);
        }
        ctx.restore();
      } else {
      
      
      key.labels.forEach((label, index) => {
        if (!label) return;
        
        // Skip positions that should be handled by front legends or center legend
        if ((index === 4 || index === 6) && key.frontLegends && !key.decal) {
          return;
        }
        if (index === 8 && key.centerLegend && !key.decal) {
          return;
        }
        
        // For decal keys, remap certain positions:
        // Position 6 should render as middle-left (position 7)
        // Position 8 should render as top-center (position 10)
        let mappedIndex = index;
        if (key.decal) {
          if (index === 6) {
            mappedIndex = 7; // middle-left
          } else if (index === 8) {
            mappedIndex = 10; // top-center
          }
        }
        
        const position = getLegendPosition(mappedIndex);
        const legendRotation = key.legendRotation?.[index] || 0;
        
        // Override position if key has align property
        let finalPosition = { ...position };
        if (key.align !== undefined && index < 4) {
          // KLE align is a bit field:
          // 0x01 (bit 0) - Center labels horizontally
          // 0x02 (bit 1) - Center labels vertically  
          // 0x04 (bit 2) - Center side-printed text (for indices 4-11)
          // Note: align only affects main labels (indices 0-3), not front/side legends
          
          const centerHorizontally = (key.align & 0x01) !== 0;
          const centerVertically = (key.align & 0x02) !== 0;
          
          // Start with the default position for this index
          finalPosition = { ...position };
          
          // Apply horizontal centering if bit 0 is set
          if (centerHorizontally) {
            finalPosition.x = 0.5;
            finalPosition.align = 'center';
          }
          
          // Apply vertical centering if bit 1 is set
          if (centerVertically) {
            finalPosition.y = 0.5;
            finalPosition.baseline = 'middle';
          }
        }
        // Check for text size in order: specific index, default size, or fallback to 3
        let textSizeValue = 3;
        if (Array.isArray(key.textSize) && key.textSize[index] !== undefined) {
          textSizeValue = key.textSize[index];
        } else if (key.default?.size && Array.isArray(key.default.size) && key.default.size[0] !== undefined) {
          textSizeValue = key.default.size[0];
        }
        
        
        // Convert KLE textSize (1-9) to actual font size using the formula: 6 + 2*textSize
        const fontSize = 6 + 2 * textSizeValue;
        
        // Check for text color similarly
        let textColor = '#000000';
        
        if (Array.isArray(key.textColor) && key.textColor[index]) {
          textColor = key.textColor[index];
        } else if (Array.isArray(key.textColor) && key.textColor[0]) {
          // Use first color as default for all positions if specific position not set
          textColor = key.textColor[0];
        } else if (key.default?.color && Array.isArray(key.default.color) && key.default.color[0]) {
          textColor = key.default.color[0];
          // Override dark colors for decal keys in dark mode
          if (key.decal && isDarkMode) {
            textColor = '#ffffff';
          }
        } else if (key.decal && isDarkMode) {
          // For decal keys in dark mode, use white text for visibility
          textColor = '#ffffff';
        }
        
        
        // Parse the label for icons
        const parsedLabel = parseIconLegend(label);
        
        
        // Calculate starting position based on alignment
        // For complex shaped keys (like little ass enter), only use the primary rectangle
        let effectiveRenderX = renderX;
        let effectiveRenderY = renderY;
        let effectiveWidth = keyWidth;
        let effectiveHeight = keyHeight;
        
        // Check if this is a "little ass enter" or similar complex key
        // Little ass enter: narrow vertical main rect, wider horizontal secondary rect
        const hasSecondaryRect = key.x2 !== undefined || key.y2 !== undefined || 
                                key.width2 !== undefined || key.height2 !== undefined;
        
        if (hasSecondaryRect && key.x2 !== undefined && key.x2 < 0 && key.width2 && key.width2 > key.width) {
          // This is likely a "little ass enter" - use the secondary (horizontal) rectangle for labels
          // Calculate secondary rectangle offsets
          const x2 = (key.x2 || 0) * unitSize;
          const y2 = (key.y2 || 0) * unitSize;
          const width2 = (key.width2 || key.width) * unitSize - keyInset * 2;
          const height2 = (key.height2 || key.height) * unitSize - keyInset * 2;
          
          effectiveRenderX = renderX + x2;
          effectiveRenderY = renderY + y2;
          effectiveWidth = width2;
          effectiveHeight = height2;
        }
        
        // Adjust for the keycap top surface
        const innerX = effectiveRenderX + edgeHeight;
        const innerY = effectiveRenderY + edgeHeight;
        const innerWidth = effectiveWidth - edgeHeight * 2;
        const innerHeight = effectiveHeight - edgeHeight * 2 - topOffset;
        
        // Calculate position based on the position object from getLegendPosition
        let currentX: number;
        let currentY: number;
        
        // Calculate X position using the relative position from getLegendPosition
        currentX = innerX + (innerWidth * finalPosition.x);
        
        // Calculate Y position using the relative position from getLegendPosition
        currentY = innerY + (innerHeight * finalPosition.y);
        
        // Apply rotation if needed
        const needsRotation = legendRotation !== 0;
        if (needsRotation) {
          ctx.save();
          ctx.translate(currentX, currentY);
          ctx.rotate((legendRotation * Math.PI) / 180);
          // Reset position to origin since we've translated
          currentX = 0;
          currentY = 0;
        }
        
        // Measure total width if needed for center/right alignment
        if (finalPosition.align !== 'start') {
          let totalWidth = 0;
          parsedLabel.forEach(part => {
            if (part.type === 'icon') {
              // Check if this is a custom SVG icon
              if (part.className === 'custom-icon icon-40s-logo') {
                totalWidth += fontSize * 1.2; // SVG icons are sized based on font size
              } else {
                // Use font manager for consistent font handling
                ctx.font = fontManager.getRenderFont('trashcons', fontSize);
                totalWidth += ctx.measureText(part.content).width;
              }
            } else {
              const keyFont = key.font || '';
              ctx.font = keyFont ? fontManager.getRenderFont(keyFont, fontSize) : `${fontSize}px Arial`;
              totalWidth += ctx.measureText(part.content).width;
            }
          });
          
          if (finalPosition.align === 'center') {
            currentX -= totalWidth / 2;
          } else if (finalPosition.align === 'end') {
            currentX -= totalWidth;
          }
        }
        
        // Draw each part
        if (parsedLabel.length === 0 && label) {
          // Fallback - draw as plain text
          const keyFont = key.font || '';
          ctx.font = keyFont ? fontManager.getRenderFont(keyFont, fontSize) : `${fontSize}px Arial`;
          ctx.fillStyle = textColor;
          ctx.textAlign = 'left';
          ctx.textBaseline = position.baseline as CanvasTextBaseline;
          ctx.fillText(label, currentX, currentY);
          return;
        }
        
        parsedLabel.forEach(part => {
          if (part.type === 'icon') {
            // Check if this is a custom SVG icon
            if (part.className === 'custom-icon icon-40s-logo') {
              // Calculate icon size based on font size
              const iconSize = Math.round(fontSize * 1.2);
              
              // Get colored version of the icon
              const coloredIcon = getColoredIcon('icon-40s-logo', textColor, iconSize);
              
              if (coloredIcon) {
                // Calculate Y position based on text baseline
                let iconY = currentY;
                if (finalPosition.baseline === 'middle') {
                  iconY = currentY - iconSize / 2;
                } else if (finalPosition.baseline === 'alphabetic') {
                  iconY = currentY - iconSize * 0.8;
                } else if (finalPosition.baseline === 'hanging') {
                  iconY = currentY;
                }
                
                // Draw the colored icon
                ctx.drawImage(coloredIcon, currentX, iconY);
                currentX += iconSize;
              }
            } else {
              // Draw regular font icon using trashcons
              ctx.font = `${fontSize}px trashcons`;
              ctx.fillStyle = textColor;
              ctx.textAlign = 'left';
              ctx.textBaseline = finalPosition.baseline as CanvasTextBaseline;
              
              // Render the icon character
              if (part.content && part.content.length > 0) {
                ctx.fillText(part.content, currentX, currentY);
                currentX += ctx.measureText(part.content).width;
              }
            }
          } else {
            // Draw regular text - handle newlines for dual legend keys
            const keyFont = key.font || '';
            ctx.font = keyFont ? fontManager.getRenderFont(keyFont, fontSize) : `${fontSize}px Arial`;
            ctx.fillStyle = textColor;
            ctx.textAlign = 'left';
            ctx.textBaseline = finalPosition.baseline as CanvasTextBaseline;
            
            // Check if this text contains newlines (for dual legend keys like ":\n;")
            const lines = part.content.split('\n');
            if (lines.length > 1 && index === 0) {
              // This is a dual legend key in the main position
              // Check if alignment is set to center labels
              if (key.align !== undefined && (key.align & 0x01) !== 0) {
                // Horizontal centering is enabled - render as top/bottom centered
                ctx.textAlign = 'center';
                const centerX = renderX + keyWidth / 2;
                
                // First line at top center
                if (lines[0]) {
                  ctx.textBaseline = 'hanging';
                  ctx.fillText(lines[0], centerX, renderY + keyHeight * 0.2);
                }
                
                // Second line at bottom center
                if (lines[1]) {
                  ctx.textBaseline = 'alphabetic';
                  ctx.fillText(lines[1], centerX, renderY + keyHeight * 0.8);
                }
              } else {
                // Default behavior - vertically stacked at the current position
                ctx.textAlign = finalPosition.align as CanvasTextAlign;
                
                // Calculate line height
                const lineHeight = fontSize * 1.2;
                
                // For dual legends, adjust the starting Y position to center both lines
                const totalHeight = lineHeight * (lines.length - 1);
                let lineY = currentY - totalHeight / 2;
                
                lines.forEach((line) => {
                  if (line) {
                    ctx.fillText(line, currentX, lineY);
                  }
                  lineY += lineHeight;
                });
                
                // For horizontal positioning, use the widest line
                const maxWidth = Math.max(...lines.map(line => ctx.measureText(line).width));
                currentX += maxWidth;
              }
            } else if (lines.length > 1) {
              // Multi-line text in other positions - render with line breaks
              ctx.textAlign = finalPosition.align as CanvasTextAlign;
              const lineHeight = fontSize * 1.2;
              let lineY = currentY;
              
              lines.forEach((line, idx) => {
                if (line) {
                  ctx.fillText(line, currentX, lineY);
                }
                if (idx < lines.length - 1) {
                  lineY += lineHeight;
                }
              });
              
              const maxWidth = Math.max(...lines.map(line => ctx.measureText(line).width));
              currentX += maxWidth;
            } else {
              // Single line text
              ctx.fillText(part.content, currentX, currentY);
              currentX += ctx.measureText(part.content).width;
            }
          }
        });
        
        // Restore context if we applied rotation
        if (needsRotation) {
          ctx.restore();
        }
      });
      
      // Draw center legend LAST so it's on top of everything else
      if (key.centerLegend) {
        ctx.save();
        // Use the same font as other labels
        const centerFont = key.font || '';
        ctx.font = centerFont ? fontManager.getRenderFont(centerFont, 12) : '12px Arial';
        // Use the same color as other labels
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Draw in the center of the key
        const centerX = renderX + keyWidth / 2;
        const centerY = renderY + keyHeight / 2;
        ctx.fillText(key.centerLegend, centerX, centerY);
        ctx.restore();
      }
      
      // Draw stabilizer positions if enabled (while rotation is still active)
      // Skip decal keys as they're just labels, not physical keys
      if (editorSettings.showStabilizerPositions && key.width >= 2 && !key.decal) {
        const stabPositions = getStabilizerPositions(key.width);
        
        ctx.save();
        ctx.strokeStyle = isDarkMode ? 'rgba(128, 128, 128, 0.7)' : 'rgba(0, 0, 0, 0.4)';
        ctx.lineWidth = isDarkMode ? 1.5 : 1;
        
        stabPositions.forEach(pos => {
          const stabX = renderX + pos.x * keyWidth;
          const stabY = renderY + pos.y * keyHeight;
          
          // Draw outer circle
          ctx.beginPath();
          ctx.arc(stabX, stabY, 10, 0, Math.PI * 2);
          ctx.stroke();
          
          // Draw crosshair
          ctx.beginPath();
          // Horizontal line
          ctx.moveTo(stabX - 8, stabY);
          ctx.lineTo(stabX + 8, stabY);
          // Vertical line
          ctx.moveTo(stabX, stabY - 8);
          ctx.lineTo(stabX, stabY + 8);
          ctx.stroke();
          
          // Draw small inner circle
          ctx.beginPath();
          ctx.arc(stabX, stabY, 3, 0, Math.PI * 2);
          ctx.stroke();
        });
        
        ctx.restore();
      }
      } // End of else block for non-row-label keys
      
      // Restore canvas state if we applied rotation
      if (hasRotation) {
        ctx.restore();
      }
    });
    
    // Restore transform before drawing selection rectangle
    ctx.restore();
    
    // Draw selection rectangle (in screen coordinates)
    if (isSelectingRef.current) {
      ctx.fillStyle = 'rgba(52, 152, 219, 0.1)';
      ctx.strokeStyle = '#3498db';
      ctx.lineWidth = 1;
      const rect = selectionRectRef.current;
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    }
    
    // Re-apply transform for rotation points
    ctx.save();
    ctx.translate(CANVAS_PADDING_LEFT, CANVAS_PADDING_TOP);
    
    // Draw rotation points for selected keys (only when rotation section is expanded)
    if (stateRef.current.selectedKeys.size > 0 && stateRef.current.isRotationSectionExpanded) {
      ctx.save();
      stateRef.current.selectedKeys.forEach(keyId => {
        const key = keyboard.keys.find(k => k.id === keyId);
        if (key) {
          let rotX: number, rotY: number;
          
          // Determine rotation center position (with canvas padding)
          if (key.rotation_x !== undefined && key.rotation_y !== undefined) {
            // Use existing rotation center
            rotX = key.rotation_x * unitSize;
            rotY = key.rotation_y * unitSize;
          } else {
            // Default to key center
            rotX = (key.x + key.width / 2) * unitSize;
            rotY = (key.y + key.height / 2) * unitSize;
          }
          
          // Apply drag offset if this key is being dragged
          if (isDraggingRef.current && selectedKeys.has(key.id)) {
            // For key-center rotation (undefined rotation_x/y), move with the key
            if (key.rotation_x === undefined || key.rotation_y === undefined) {
              rotX += dragOffsetRef.current.x;
              rotY += dragOffsetRef.current.y;
            }
            // For custom rotation points, don't move them during drag
          }
          
          // Draw crosshair at rotation point
          ctx.strokeStyle = '#e74c3c';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(rotX - 10, rotY);
          ctx.lineTo(rotX + 10, rotY);
          ctx.moveTo(rotX, rotY - 10);
          ctx.lineTo(rotX, rotY + 10);
          ctx.stroke();
          
          // Draw circle at rotation point
          ctx.beginPath();
          ctx.arc(rotX, rotY, 5, 0, Math.PI * 2);
          ctx.fillStyle = '#e74c3c';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      });
      ctx.restore();
    }
    
    // Update cursor if in rotation point setting mode
    if (stateRef.current.isSettingRotationPoint) {
      canvas.style.cursor = 'crosshair';
    }
    
    // Draw stabilizer tooltip if hovering over one
    if (hoveredStabRef.current && stateRef.current.editorSettings.showStabilizerPositions) {
      const { keyId, stabIndex, x, y, keyWidth } = hoveredStabRef.current;
      const key = keyboard.keys.find(k => k.id === keyId);
      if (key) {
        // Determine stabilizer type
        let stabType = '';
        if (stabIndex === 0) {
          stabType = 'Center';
        } else if (stabIndex === 1) {
          stabType = 'Left';
        } else if (stabIndex === 2) {
          stabType = 'Right';
        }
        
        // Calculate coordinates in units (relative to key position)
        const stabPositions = getStabilizerPositions(keyWidth);
        const relativeX = stabPositions[stabIndex].x * keyWidth;
        const relativeY = stabPositions[stabIndex].y * key.height;
        
        // Create tooltip text
        const tooltipLines = [
          `${keyWidth}u ${stabType} Stem`,
          `X: ${relativeX.toFixed(3)}u`,
          `Y: ${relativeY.toFixed(3)}u`
        ];
        
        // Measure tooltip dimensions
        ctx.save();
        ctx.font = '12px Arial';
        const padding = 8;
        const lineHeight = 16;
        const maxWidth = Math.max(...tooltipLines.map(line => ctx.measureText(line).width));
        const tooltipWidth = maxWidth + padding * 2;
        const tooltipHeight = tooltipLines.length * lineHeight + padding * 2;
        
        // Position tooltip (offset from stabilizer position)
        let tooltipX = x + 15;
        let tooltipY = y - tooltipHeight - 10;
        
        // Keep tooltip on screen
        if (tooltipX + tooltipWidth > canvas.width) {
          tooltipX = x - tooltipWidth - 15;
        }
        if (tooltipY < 0) {
          tooltipY = y + 20;
        }
        
        // Draw tooltip background
        ctx.fillStyle = isDarkMode ? 'rgba(50, 50, 50, 0.95)' : 'rgba(255, 255, 255, 0.95)';
        ctx.strokeStyle = isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 4);
        ctx.fill();
        ctx.stroke();
        
        // Draw tooltip text
        ctx.fillStyle = isDarkMode ? '#ffffff' : '#000000';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        
        tooltipLines.forEach((line, index) => {
          const textY = tooltipY + padding + lineHeight / 2 + index * lineHeight;
          ctx.fillText(line, tooltipX + padding, textY);
        });
        
        ctx.restore();
      }
    }
    
    // Final restore of transform
    ctx.restore();
  };

  // Request animation frame render
  const requestRender = () => {
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(() => {
      // Ensure we have the latest state before rendering
      const latestState = useKeyboardStore.getState();
      stateRef.current = {
        keyboard: latestState.keyboard,
        selectedKeys: latestState.selectedKeys,
        hoveredKey: latestState.hoveredKey,
        editorSettings: latestState.editorSettings,
        isSettingRotationPoint: latestState.isSettingRotationPoint,
        isRotationSectionExpanded: latestState.isRotationSectionExpanded,
      };
      render();
    });
  };

  // Get key at position
  const getKeyAtPosition = (x: number, y: number): KeyRect | null => {
    const unitSize = stateRef.current.editorSettings.unitSize;
    
    // Adjust coordinates for canvas padding
    const adjustedX = x - CANVAS_PADDING_LEFT;
    const adjustedY = y - CANVAS_PADDING_TOP;
    
    // Check keys in reverse order (top to bottom) for proper overlap handling
    for (let i = keyRectsRef.current.length - 1; i >= 0; i--) {
      const rect = keyRectsRef.current[i];
      const key = rect.key;
      
      // Use rotation-aware hit testing if the key is rotated
      if (key.rotation_angle) {
        const isInside = isPointInRotatedRect(
          adjustedX,
          adjustedY,
          rect.x,
          rect.y,
          rect.width,
          rect.height,
          key.rotation_angle,
          key.rotation_x !== undefined ? key.rotation_x * unitSize : undefined,
          key.rotation_y !== undefined ? key.rotation_y * unitSize : undefined
        );
        
        if (isInside) {
          return rect;
        }
      } else {
        // Simple bounds check for non-rotated keys
        if (adjustedX >= rect.x && adjustedX <= rect.x + rect.width &&
            adjustedY >= rect.y && adjustedY <= rect.y + rect.height) {
          return rect;
        }
      }
    }
    return null;
  };

  // Mouse event handlers
  const handleMouseDown = (e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const store = useKeyboardStore.getState();
    
    // Handle rotation point setting mode
    if (store.isSettingRotationPoint) {
      const selectedKeys = Array.from(store.selectedKeys);
      if (selectedKeys.length > 0) {
        // Convert canvas coordinates to keyboard units (accounting for padding)
        const unitSize = store.editorSettings.unitSize;
        let rotationX = (x - CANVAS_PADDING_LEFT) / unitSize;
        let rotationY = (y - CANVAS_PADDING_TOP) / unitSize;
        
        // Snap to 0.25 grid
        rotationX = Math.round(rotationX * 4) / 4;
        rotationY = Math.round(rotationY * 4) / 4;
        
        // Update all selected keys with the new rotation point
        const updates = selectedKeys.map(keyId => ({
          id: keyId,
          changes: {
            rotation_x: rotationX,
            rotation_y: rotationY
          }
        }));
        
        store.updateKeys(updates);
        store.saveToHistory();
        store.setIsSettingRotationPoint(false);
        
        // Update canvas cursor
        canvas.style.cursor = 'default';
      }
      return;
    }
    
    const keyRect = getKeyAtPosition(x, y);
    
    if (keyRect) {
      // Key clicked
      const store = useKeyboardStore.getState();
      const isMultiSelect = e.ctrlKey || e.metaKey;
      const isShiftSelect = e.shiftKey;
      const isKeyAlreadySelected = store.selectedKeys.has(keyRect.id);
      
      if (isShiftSelect && lastSelectedKeyRef.current) {
        // Shift-click: select range
        const keysToSelect: string[] = [];
        const lastKeyIndex = keyRectsRef.current.findIndex(k => k.id === lastSelectedKeyRef.current);
        const currentKeyIndex = keyRectsRef.current.findIndex(k => k.id === keyRect.id);
        
        if (lastKeyIndex !== -1 && currentKeyIndex !== -1) {
          const start = Math.min(lastKeyIndex, currentKeyIndex);
          const end = Math.max(lastKeyIndex, currentKeyIndex);
          
          for (let i = start; i <= end; i++) {
            keysToSelect.push(keyRectsRef.current[i].id);
          }
          
          if (isMultiSelect) {
            // Add to existing selection
            const existingSelection = Array.from(store.selectedKeys);
            const combinedSelection = [...new Set([...existingSelection, ...keysToSelect])];
            store.selectKeys(combinedSelection);
          } else {
            // Replace selection
            store.selectKeys(keysToSelect);
          }
        }
      } else if (!isKeyAlreadySelected || isMultiSelect) {
        // Normal click or ctrl-click
        store.selectKey(keyRect.id, isMultiSelect);
        lastSelectedKeyRef.current = keyRect.id;
      } else {
        // Clicking on already selected key without modifiers
        lastSelectedKeyRef.current = keyRect.id;
      }
      
      // Start dragging if key is selected (either was already selected or just got selected)
      if (store.selectedKeys.has(keyRect.id)) {
        isDraggingRef.current = true;
        dragStartRef.current = { x, y };
        dragOffsetRef.current = { x: 0, y: 0 };
        
        // Check if Alt is pressed - if so, we'll duplicate on drag
        if (e.altKey) {
          isDuplicatingRef.current = true;
          duplicatedKeysRef.current.clear();
          
          // Create duplicates of all selected keys
          const selectedKeysList = Array.from(store.selectedKeys)
            .map(id => stateRef.current.keyboard.keys.find(k => k.id === id))
            .filter(Boolean) as Key[];
          
          const newKeys: Key[] = [];
          const newKeyIds: string[] = [];
          
          selectedKeysList.forEach(key => {
            const newKey: Key = {
              ...key,
              id: `key-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
              labels: [...(key.labels || [])],
              textColor: [...(key.textColor || [])],
              textSize: [...(key.textSize || [])],
            };
            newKeys.push(newKey);
            newKeyIds.push(newKey.id);
            duplicatedKeysRef.current.add(newKey.id);
          });
          
          // Add the new keys to the store
          newKeys.forEach(key => store.addKey(key));
          
          // Update selection to the new duplicated keys
          store.selectKeys(newKeyIds);
          
          // Update our cached state
          stateRef.current.selectedKeys = new Set(newKeyIds);
          stateRef.current.keyboard = store.keyboard;
          
          canvas.style.cursor = 'copy';
        } else {
          canvas.style.cursor = 'move';
        }
      }
    } else {
      // Start selection rectangle
      isAddingToSelectionRef.current = e.ctrlKey || e.metaKey;
      
      if (!isAddingToSelectionRef.current) {
        useKeyboardStore.getState().clearSelection();
      }
      
      isSelectingRef.current = true;
      const startX = x;
      const startY = y;
      selectionRectRef.current = { x: startX, y: startY, width: 0, height: 0 };
      dragStartRef.current = { x: startX, y: startY };
    }
    
    stateRef.current.selectedKeys = useKeyboardStore.getState().selectedKeys;
    requestRender();
  };

  const handleMouseMove = (e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (isDraggingRef.current) {
      // Update cursor based on whether Alt is still held
      if (isDuplicatingRef.current) {
        canvas.style.cursor = e.altKey ? 'copy' : 'move';
      }
      // Update drag offset
      dragOffsetRef.current = {
        x: x - dragStartRef.current.x,
        y: y - dragStartRef.current.y
      };
      
      // Snap to grid if enabled
      const { editorSettings } = stateRef.current;
      if (editorSettings.snapToGrid) {
        const gridSize = editorSettings.gridSize * editorSettings.unitSize;
        dragOffsetRef.current.x = Math.round(dragOffsetRef.current.x / gridSize) * gridSize;
        dragOffsetRef.current.y = Math.round(dragOffsetRef.current.y / gridSize) * gridSize;
      }
      
      requestRender();
    } else if (isSelectingRef.current) {
      // Update selection rectangle
      const startX = dragStartRef.current.x;
      const startY = dragStartRef.current.y;
      selectionRectRef.current = {
        x: Math.min(x, startX),
        y: Math.min(y, startY),
        width: Math.abs(x - startX),
        height: Math.abs(y - startY)
      };
      requestRender();
    } else {
      // Store mouse position for tooltip
      mousePositionRef.current = { x, y };
      
      // Hover effect
      const keyRect = getKeyAtPosition(x, y);
      const hoveredId = keyRect?.id || null;
      
      if (stateRef.current.hoveredKey !== hoveredId) {
        useKeyboardStore.getState().setHoveredKey(hoveredId);
        stateRef.current.hoveredKey = hoveredId;
        requestRender();
      }
      
      // Check for stabilizer hover if stabilizers are shown
      if (stateRef.current.editorSettings.showStabilizerPositions) {
        let foundStab = false;
        const { unitSize } = stateRef.current.editorSettings;
        
        // Check each key for stabilizer positions
        for (const keyRect of keyRectsRef.current) {
          const key = stateRef.current.keyboard.keys.find(k => k.id === keyRect.id);
          if (!key || key.width < 2) continue;
          
          const stabPositions = getStabilizerPositions(key.width);
          const keyInset = 1;
          const renderX = Math.round(key.x * unitSize + keyInset);
          const renderY = Math.round(key.y * unitSize + keyInset);
          const keyWidth = Math.round(key.width * unitSize - keyInset * 2);
          const keyHeight = Math.round(key.height * unitSize - keyInset * 2);
          
          // Check each stabilizer position
          for (let i = 0; i < stabPositions.length; i++) {
            const pos = stabPositions[i];
            const stabX = renderX + pos.x * keyWidth;
            const stabY = renderY + pos.y * keyHeight;
            
            // Check if mouse is over this stabilizer (within 12 pixel radius)
            const dist = Math.sqrt(Math.pow(x - stabX, 2) + Math.pow(y - stabY, 2));
            if (dist <= 12) {
              hoveredStabRef.current = {
                keyId: key.id,
                stabIndex: i,
                x: stabX,
                y: stabY,
                keyWidth: key.width
              };
              foundStab = true;
              break;
            }
          }
          
          if (foundStab) break;
        }
        
        // Clear hovered stab if none found
        if (!foundStab && hoveredStabRef.current) {
          hoveredStabRef.current = null;
          requestRender();
        } else if (foundStab && !hoveredStabRef.current) {
          requestRender();
        }
      }
      
      canvas.style.cursor = keyRect ? 'pointer' : 'default';
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    // Cancel rotation point setting mode with Escape
    if (e.key === 'Escape' && stateRef.current.isSettingRotationPoint) {
      useKeyboardStore.getState().setIsSettingRotationPoint(false);
      if (canvasRef.current) {
        canvasRef.current.style.cursor = 'default';
      }
      requestRender();
    }
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    // If Alt is released during duplicate-drag, remove the duplicated keys
    if (e.key === 'Alt' && isDuplicatingRef.current && isDraggingRef.current) {
      const store = useKeyboardStore.getState();
      
      // Get the original keys that were selected before duplication
      const originalKeys: string[] = [];
      stateRef.current.keyboard.keys.forEach(key => {
        if (!duplicatedKeysRef.current.has(key.id) && 
            stateRef.current.selectedKeys.has(key.id)) {
          originalKeys.push(key.id);
        }
      });
      
      // Remove duplicated keys
      const keysToDelete = Array.from(duplicatedKeysRef.current);
      store.deleteKeys(keysToDelete);
      
      // Restore selection to original keys
      store.selectKeys(originalKeys);
      
      // Update state
      isDuplicatingRef.current = false;
      duplicatedKeysRef.current.clear();
      stateRef.current.selectedKeys = new Set(originalKeys);
      stateRef.current.keyboard = store.keyboard;
      
      if (canvasRef.current) {
        canvasRef.current.style.cursor = 'move';
      }
      
      requestRender();
    }
  };

  const handleMouseUp = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    if (isDraggingRef.current) {
      // Apply movement to keys
      const { selectedKeys } = stateRef.current;
      const unitSize = stateRef.current.editorSettings.unitSize;
      const deltaX = dragOffsetRef.current.x / unitSize;
      const deltaY = dragOffsetRef.current.y / unitSize;
      
      if (Math.abs(deltaX) > 0.01 || Math.abs(deltaY) > 0.01) {
        const updates = Array.from(selectedKeys).map(id => {
          const key = stateRef.current.keyboard.keys.find(k => k.id === id);
          if (!key) return null;
          
          const changes: Partial<Key> = {
            x: key.x + deltaX,
            y: key.y + deltaY
          };
          
          // Don't update rotation centers - let them remain undefined for key-center
          // or keep their custom values for custom rotation
          
          return {
            id: id,
            changes
          };
        }).filter(Boolean) as Array<{ id: string; changes: Partial<Key> }>;
        
        useKeyboardStore.getState().updateKeys(updates);
        useKeyboardStore.getState().saveToHistory();
      }
      
      isDraggingRef.current = false;
      isDuplicatingRef.current = false;
      duplicatedKeysRef.current.clear();
      dragOffsetRef.current = { x: 0, y: 0 };
      canvas.style.cursor = 'default';
    } else if (isSelectingRef.current) {
      // Select keys in rectangle
      const rect = selectionRectRef.current;
      const selectedIds: string[] = [];
      const selectionMode = stateRef.current.editorSettings.selectionMode || 'touch';
      
      // Adjust selection rectangle for canvas padding
      const adjustedRect = {
        x: rect.x - CANVAS_PADDING_LEFT,
        y: rect.y - CANVAS_PADDING_TOP,
        width: rect.width,
        height: rect.height
      };
      
      keyRectsRef.current.forEach(keyRect => {
        if (selectionMode === 'touch') {
          // Touch mode: select if any part of the key overlaps with the selection
          if (!(keyRect.x + keyRect.width < adjustedRect.x ||
                keyRect.x > adjustedRect.x + adjustedRect.width ||
                keyRect.y + keyRect.height < adjustedRect.y ||
                keyRect.y > adjustedRect.y + adjustedRect.height)) {
            selectedIds.push(keyRect.id);
          }
        } else {
          // Enclose mode: select only if the key is fully contained within the selection
          if (keyRect.x >= adjustedRect.x &&
              keyRect.x + keyRect.width <= adjustedRect.x + adjustedRect.width &&
              keyRect.y >= adjustedRect.y &&
              keyRect.y + keyRect.height <= adjustedRect.y + adjustedRect.height) {
            selectedIds.push(keyRect.id);
          }
        }
      });
      
      if (selectedIds.length > 0) {
        const store = useKeyboardStore.getState();
        
        if (isAddingToSelectionRef.current) {
          // Add to existing selection
          const existingSelection = Array.from(store.selectedKeys);
          const combinedSelection = [...new Set([...existingSelection, ...selectedIds])];
          store.selectKeys(combinedSelection);
        } else {
          // Replace selection
          store.selectKeys(selectedIds);
        }
      }
      
      isSelectingRef.current = false;
      isAddingToSelectionRef.current = false;
    }
    
    requestRender();
  };

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;
    
    contextRef.current = ctx;
    
    // Set canvas size
    canvas.width = width;
    canvas.height = height;
    
    // Add event listeners
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    
    // Initial render
    render();
    
    // Listen for font load events and re-render
    if (document.fonts) {
      document.fonts.ready.then(() => {
        requestRender();
      });
    }
    
    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseUp);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [width, height]);

  // Subscribe to store changes
  useEffect(() => {
    const unsubscribe = useKeyboardStore.subscribe((state) => {
      stateRef.current = {
        keyboard: state.keyboard,
        selectedKeys: state.selectedKeys,
        hoveredKey: state.hoveredKey,
        editorSettings: state.editorSettings,
        isSettingRotationPoint: state.isSettingRotationPoint,
        isRotationSectionExpanded: state.isRotationSectionExpanded,
      };
      requestRender();
    });
    
    return unsubscribe;
  }, []);
  
  // Get keyboard from store to properly track changes
  const keyboard = useKeyboardStore((state) => state.keyboard);
  
  // Check for font loading and trigger re-render when loaded
  useEffect(() => {
    // Check if any keys have icons
    const hasIcons = keyboard.keys.some(key => 
      key.labels.some(label => label && (label.includes('trashcons') || label.includes('<span')))
    );
    
    if (hasIcons) {
      if (!fontManager.isFontLoaded('trashcons')) {
        // Add listener for when font loads
        fontManager.onFontLoaded('trashcons', () => {
          requestRender();
        });
      } else {
        // Font is already loaded, make sure we render
        requestRender();
      }
    }
    
    // Listen for dark mode toggle
    const handleDarkModeToggle = () => {
      requestRender();
    };
    
    window.addEventListener('darkModeToggled', handleDarkModeToggle);
    
    return () => {
      window.removeEventListener('darkModeToggled', handleDarkModeToggle);
    };
  }, [keyboard]); // Remove requestRender from deps to avoid issues

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        backgroundColor: 'transparent'
      }}
    />
  );
});

KeyboardCanvas.displayName = 'KeyboardCanvas';

export default KeyboardCanvas;