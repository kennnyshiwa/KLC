import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useKeyboardStore } from '../store/keyboardStoreOptimized';
import { Key } from '../types';
import { getLegendPosition } from '../utils/keyUtils';
import { parseIconLegend } from '../utils/iconParser';
import { fontManager } from '../utils/fontManager';

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

const KeyboardCanvas = forwardRef<KeyboardCanvasRef, KeyboardCanvasProps>(({ width, height }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const keyRectsRef = useRef<KeyRect[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const fontCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Interaction state
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const isSelectingRef = useRef(false);
  const selectionRectRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
  
  // Store state cache
  const stateRef = useRef({
    keyboard: useKeyboardStore.getState().keyboard,
    selectedKeys: useKeyboardStore.getState().selectedKeys,
    hoveredKey: useKeyboardStore.getState().hoveredKey,
    editorSettings: useKeyboardStore.getState().editorSettings,
  });

  useImperativeHandle(ref, () => ({
    getStage: () => canvasRef.current ? {
      toDataURL: () => canvasRef.current!.toDataURL()
    } : null
  }));

  // Fast render function
  const render = () => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (!canvas || !ctx) return;
    
    // Debug: confirm render is running
    if (!(window as any).renderCount) {
      (window as any).renderCount = 0;
    }
    if ((window as any).renderCount < 3) {
      console.log(`RENDER CALLED #${++(window as any).renderCount}, keys: ${stateRef.current.keyboard.keys.length}`);
      
      // Test icon parsing directly
      const testLabel = '<span class="trashcons icon-enter"></span>';
      const testParsed = parseIconLegend(testLabel);
      console.log('Direct test - parseIconLegend:', testParsed);
    }

    // Clear canvas with off-white background
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const { editorSettings, keyboard, selectedKeys, hoveredKey } = stateRef.current;
    const unitSize = editorSettings.unitSize;
    const keySpacing = editorSettings.keySpacing;


    // Update key rectangles
    keyRectsRef.current = [];

    // Draw keys
    keyboard.keys.forEach(key => {
      const keyX = key.x * unitSize;
      const keyY = key.y * unitSize;
      const keyWidth = key.width * unitSize - keySpacing;
      const keyHeight = key.height * unitSize - keySpacing;
      
      // Apply drag offset to selected keys
      let renderX = keyX;
      let renderY = keyY;
      if (isDraggingRef.current && selectedKeys.has(key.id)) {
        renderX += dragOffsetRef.current.x;
        renderY += dragOffsetRef.current.y;
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
      if (key.ghost) {
        // Ghost keys are rendered as flat, semi-transparent rectangles
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
        
        // Skip the rest of the rendering for ghost keys
        return;
      }
      
      // Check if this is a decal (transparent) key
      if (key.decal) {
        // For decal keys, skip all the key rendering and only draw text
        // No shadow, no key shape, just transparent
        ctx.shadowColor = 'transparent';
      } else {
        // Shadow for the entire key
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 2;
      }
      
      // Get base color (no longer change color when selected)
      const baseColor = hoveredKey === key.id ? '#e0e0e0' : 
                       (key.color || '#f9f9f9');
      
      // 3D key rendering with visible edges
      const edgeHeight = key.decal ? 0 : 6; // Height of the visible edge (0 for decals)
      const topOffset = key.decal ? 0 : 3; // How much the top surface is offset (0 for decals)
      
      // Only render the key shape if it's not a decal
      if (!key.decal) {
        // Parse base color to RGB
        const parseColor = (color: string) => {
          const rgb = parseInt(color.slice(1), 16);
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
        
        const baseRgb = parseColor(baseColor);
        const sideColor = toRgbString(adjustBrightness(baseRgb, -40));
        const bottomColor = toRgbString(adjustBrightness(baseRgb, -80));
      
        // Check if this is a special shaped key (ISO Enter, Big Ass Enter)
        const hasSecondaryRect = key.x2 !== undefined || key.y2 !== undefined || 
                                key.width2 !== undefined || key.height2 !== undefined;
        
        // Reset shadow for inner elements
        ctx.shadowColor = 'transparent';
        
        if (hasSecondaryRect) {
          // Draw complex shape (like ISO Enter or Big Ass Enter)
          const x2 = (key.x2 || 0) * unitSize;
          const y2 = (key.y2 || 0) * unitSize;
          const width2 = (key.width2 || key.width) * unitSize - keySpacing;
          const height2 = (key.height2 || key.height) * unitSize - keySpacing;
          
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
          ctx.fillStyle = baseColor;
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
          highlightGradient.addColorStop(1, baseColor);
          
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
          ctx.fillStyle = baseColor;
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
          highlightGradient.addColorStop(1, baseColor);
          
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
      
      
      // Draw selection outline if selected
      if (selectedKeys.has(key.id)) {
        // Draw a thick outline with a contrasting color
        ctx.strokeStyle = '#3498db';
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
        
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
      
      // Draw front legends if present
      if (key.frontLegends && key.frontLegends.some(l => l)) {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.font = '10px Arial';
        ctx.textBaseline = 'middle';
        
        const frontY = renderY + keyHeight - 3;
        const padding = 5;
        
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
        
        ctx.restore();
      }
      
      // Draw labels
      ctx.fillStyle = '#000000';
      
      // Debug: Check if we're even rendering keys with icons
      if (key.labels.some(l => l && l.includes('<span'))) {
        if (!(window as any).iconKeyCount) {
          (window as any).iconKeyCount = 0;
        }
        if ((window as any).iconKeyCount < 3) {
          (window as any).iconKeyCount++;
          console.log(`Rendering key ${(window as any).iconKeyCount} with icons:`, {
            id: key.id,
            labels: key.labels.filter(l => l && l.includes('<span')),
            decal: key.decal
          });
        }
      }
      
      key.labels.forEach((label, index) => {
        if (!label) return;
        
        // Skip positions that should be handled by front legends
        if (index >= 4 && index <= 6 && key.frontLegends) {
          return;
        }
        
        const position = getLegendPosition(index);
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
        } else if (key.default?.color && Array.isArray(key.default.color) && key.default.color[0]) {
          textColor = key.default.color[0];
        }
        
        // CRITICAL CHECK: If label contains HTML but parser returns empty, something is wrong
        if (label.includes('<span') && !(window as any).parserCheckDone) {
          (window as any).parserCheckDone = true;
          console.log('=== PARSER CHECK ===');
          console.log('Label contains HTML:', label);
          console.log('Label char codes:', Array.from(label).map(c => c.charCodeAt(0)));
          console.log('About to parse...');
        }
        
        // Parse the label for icons
        const parsedLabel = parseIconLegend(label);
        
        // Debug: Log parsing results for labels with HTML
        if (label.includes('<span')) {
          if (!(window as any).htmlLabelCount) {
            (window as any).htmlLabelCount = 0;
          }
          if ((window as any).htmlLabelCount < 3) {
            (window as any).htmlLabelCount++;
            console.log(`\nDEBUG Label ${(window as any).htmlLabelCount}:`);
            console.log('  Raw label:', label);
            console.log('  Parsed parts:', parsedLabel.length);
            parsedLabel.forEach((part, i) => {
              console.log(`  Part ${i}:`, {
                type: part.type,
                content: part.type === 'icon' ? `unicode: \\u${part.content.charCodeAt(0).toString(16)}` : part.content,
                className: part.className
              });
            });
          }
        }
        
        // Calculate starting position based on alignment
        // Adjust for the keycap top surface
        const innerX = renderX + edgeHeight;
        const innerY = renderY + edgeHeight;
        const innerWidth = keyWidth - edgeHeight * 2;
        const innerHeight = keyHeight - edgeHeight * 2 - topOffset;
        
        // Use fixed pixel offsets for consistent positioning across all key sizes
        const legendPadding = 8; // Fixed padding from edges
        let currentX;
        let currentY;
        
        // Calculate X position
        if (position.align === 'start') {
          currentX = innerX + legendPadding;
        } else if (position.align === 'end') {
          currentX = innerX + innerWidth - legendPadding;
        } else { // center
          currentX = innerX + innerWidth / 2;
        }
        
        // Calculate Y position
        if (position.baseline === 'hanging') {
          currentY = innerY + legendPadding;
        } else if (position.baseline === 'alphabetic') {
          currentY = innerY + innerHeight - legendPadding;
        } else { // middle
          currentY = innerY + innerHeight / 2;
        }
        
        // Measure total width if needed for center/right alignment
        if (position.align !== 'start') {
          let totalWidth = 0;
          parsedLabel.forEach(part => {
            if (part.type === 'icon') {
              // Use font manager for consistent font handling
              ctx.font = fontManager.getRenderFont('trashcons', fontSize);
              totalWidth += ctx.measureText(part.content).width;
            } else {
              ctx.font = `${fontSize}px Arial`;
              totalWidth += ctx.measureText(part.content).width;
            }
          });
          
          if (position.align === 'center') {
            currentX -= totalWidth / 2;
          } else if (position.align === 'end') {
            currentX -= totalWidth;
          }
        }
        
        // Draw each part
        if (parsedLabel.length === 0 && label) {
          // This should never happen - parser should always return something
          console.error('PARSER RETURNED EMPTY for label:', label);
          // Fallback - draw as plain text
          ctx.font = `${fontSize}px Arial`;
          ctx.fillStyle = textColor;
          ctx.textAlign = 'left';
          ctx.textBaseline = position.baseline as CanvasTextBaseline;
          ctx.fillText(label, currentX, currentY);
          return;
        }
        
        parsedLabel.forEach(part => {
          if (part.type === 'icon') {
            // Draw icon using font manager
            // Force trashcons font directly to test
            ctx.font = `${fontSize}px trashcons`;
            ctx.fillStyle = textColor;
            ctx.textAlign = 'left';
            ctx.textBaseline = position.baseline as CanvasTextBaseline;
            
            // Debug: Log icon render attempts
            if (!(window as any).iconDebugCount) {
              (window as any).iconDebugCount = 0;
            }
            if ((window as any).iconDebugCount < 5 && part.iconName) {
              const isLoaded = fontManager.isFontLoaded('trashcons');
              const currentFont = ctx.font; // Get the current font setting
              console.log(`Icon render #${(window as any).iconDebugCount++}:`);
              console.log(`  Label: "${label}"`);
              console.log(`  Icon: ${part.iconName}`);
              console.log(`  Font loaded: ${isLoaded}`);
              console.log(`  Font used: ${currentFont}`);
              if (part.content && part.content.length > 0) {
                console.log(`  Unicode: ${part.content.charCodeAt(0).toString(16)}`);
                console.log(`  Content length: ${part.content.length}`);
              } else {
                console.log(`  ERROR: No content for icon!`);
              }
              
              // Save and restore state for font test
              ctx.save();
              
              // Test if font actually renders with different approaches
              ctx.font = `${fontSize}px trashcons`;
              const directWidth = ctx.measureText('\ue90e').width;
              
              ctx.font = `${fontSize}px monospace`;
              const monoWidth = ctx.measureText('\ue90e').width;
              
              console.log(`  Direct font test - trashcons width: ${directWidth}, mono width: ${monoWidth}`);
              console.log(`  Font working: ${Math.abs(directWidth - monoWidth) > 0.1}`);
              
              ctx.restore();
              // Re-apply our font (trashcons)
              ctx.font = `${fontSize}px trashcons`;
            }
            
            // Render the icon character
            if (part.content && part.content.length > 0) {
              ctx.fillText(part.content, currentX, currentY);
              currentX += ctx.measureText(part.content).width;
            } else {
              console.error('Attempted to render icon without content:', part);
            }
          } else {
            // Draw regular text
            ctx.font = `${fontSize}px Arial`;
            ctx.fillStyle = textColor;
            ctx.textAlign = 'left';
            ctx.textBaseline = position.baseline as CanvasTextBaseline;
            ctx.fillText(part.content, currentX, currentY);
            currentX += ctx.measureText(part.content).width;
          }
        });
      });
    });
    
    // Draw selection rectangle
    if (isSelectingRef.current) {
      ctx.fillStyle = 'rgba(52, 152, 219, 0.1)';
      ctx.strokeStyle = '#3498db';
      ctx.lineWidth = 1;
      const rect = selectionRectRef.current;
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    }
  };

  // Request animation frame render
  const requestRender = () => {
    if (!(window as any).requestRenderCount) {
      (window as any).requestRenderCount = 0;
    }
    if ((window as any).requestRenderCount < 5) {
      console.log(`requestRender called #${++(window as any).requestRenderCount}`);
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(render);
  };

  // Get key at position
  const getKeyAtPosition = (x: number, y: number): KeyRect | null => {
    for (let i = keyRectsRef.current.length - 1; i >= 0; i--) {
      const rect = keyRectsRef.current[i];
      if (x >= rect.x && x <= rect.x + rect.width &&
          y >= rect.y && y <= rect.y + rect.height) {
        return rect;
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
    
    const keyRect = getKeyAtPosition(x, y);
    
    if (keyRect) {
      // Key clicked
      const store = useKeyboardStore.getState();
      const isMultiSelect = e.ctrlKey || e.metaKey;
      
      if (!store.selectedKeys.has(keyRect.id)) {
        store.selectKey(keyRect.id, isMultiSelect);
      }
      
      // Start dragging
      isDraggingRef.current = true;
      dragStartRef.current = { x, y };
      dragOffsetRef.current = { x: 0, y: 0 };
      
      canvas.style.cursor = 'move';
    } else {
      // Start selection rectangle
      if (!e.ctrlKey && !e.metaKey) {
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
      // Hover effect
      const keyRect = getKeyAtPosition(x, y);
      const hoveredId = keyRect?.id || null;
      
      if (stateRef.current.hoveredKey !== hoveredId) {
        useKeyboardStore.getState().setHoveredKey(hoveredId);
        stateRef.current.hoveredKey = hoveredId;
        requestRender();
      }
      
      canvas.style.cursor = keyRect ? 'pointer' : 'default';
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
          
          return {
            id: id,
            changes: {
              x: key.x + deltaX,
              y: key.y + deltaY
            }
          };
        }).filter(Boolean) as Array<{ id: string; changes: Partial<Key> }>;
        
        useKeyboardStore.getState().updateKeys(updates);
        useKeyboardStore.getState().saveToHistory();
      }
      
      isDraggingRef.current = false;
      dragOffsetRef.current = { x: 0, y: 0 };
      canvas.style.cursor = 'default';
    } else if (isSelectingRef.current) {
      // Select keys in rectangle
      const rect = selectionRectRef.current;
      const selectedIds: string[] = [];
      
      keyRectsRef.current.forEach(keyRect => {
        if (!(keyRect.x + keyRect.width < rect.x ||
              keyRect.x > rect.x + rect.width ||
              keyRect.y + keyRect.height < rect.y ||
              keyRect.y > rect.y + rect.height)) {
          selectedIds.push(keyRect.id);
        }
      });
      
      if (selectedIds.length > 0) {
        useKeyboardStore.getState().selectKeys(selectedIds);
      }
      
      isSelectingRef.current = false;
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
      console.log('Layout has icons, checking font status...');
      if (!fontManager.isFontLoaded('trashcons')) {
        console.log('Font not loaded, waiting...');
        // Add listener for when font loads
        fontManager.onFontLoaded('trashcons', () => {
          console.log('Trashcons font now available, re-rendering canvas');
          requestRender();
        });
      } else {
        console.log('Font already loaded, triggering render');
        // Font is already loaded, make sure we render
        requestRender();
      }
    }
    
    return () => {
      // Cleanup if needed
    };
  }, [keyboard]); // Remove requestRender from deps to avoid issues

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        backgroundColor: '#fafafa'
      }}
    />
  );
});

KeyboardCanvas.displayName = 'KeyboardCanvas';

export default KeyboardCanvas;