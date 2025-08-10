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
    isSettingRotationPoint: useKeyboardStore.getState().isSettingRotationPoint,
    isRotationSectionExpanded: useKeyboardStore.getState().isRotationSectionExpanded,
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

    // Clear canvas with appropriate background for theme
    const isDarkMode = document.documentElement.classList.contains('dark-mode');
    ctx.fillStyle = isDarkMode ? '#1a1a1a' : '#fafafa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const { editorSettings, keyboard, selectedKeys, hoveredKey } = stateRef.current;
    const unitSize = editorSettings.unitSize;
    const keyInset = 1; // 1 pixel inset on all sides = 2 pixel gap between keys


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
      // Round the end position, then calculate width from that
      const keyEndX = Math.round(baseX + baseWidth - keyInset);
      const keyEndY = Math.round(baseY + baseHeight - keyInset);
      const keyWidth = keyEndX - keyX;
      const keyHeight = keyEndY - keyY;
      
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
      
      // Get base color - brighten slightly when hovered
      const keyColor = key.color || '#f9f9f9';
      const baseColor = keyColor;
      
      // 3D key rendering with visible edges
      const edgeHeight = key.decal ? 0 : 6; // Height of the visible edge (0 for decals)
      const topOffset = key.decal ? 0 : 3; // How much the top surface is offset (0 for decals)
      
      // Only render the key shape if it's not a decal
      if (!key.decal) {
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
      
      
      key.labels.forEach((label, index) => {
        if (!label) return;
        
        // Skip positions that should be handled by front legends
        if (index >= 4 && index <= 6 && key.frontLegends) {
          return;
        }
        
        const position = getLegendPosition(index);
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
              // Use font manager for consistent font handling
              ctx.font = fontManager.getRenderFont('trashcons', fontSize);
              totalWidth += ctx.measureText(part.content).width;
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
            // Draw icon using font manager
            // Force trashcons font directly to test
            ctx.font = `${fontSize}px trashcons`;
            ctx.fillStyle = textColor;
            ctx.textAlign = 'left';
            ctx.textBaseline = finalPosition.baseline as CanvasTextBaseline;
            
            
            // Render the icon character
            if (part.content && part.content.length > 0) {
              ctx.fillText(part.content, currentX, currentY);
              currentX += ctx.measureText(part.content).width;
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
      
      // Restore canvas state if we applied rotation
      if (hasRotation) {
        ctx.restore();
      }
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
    
    // Draw rotation points for selected keys (only when rotation section is expanded)
    if (stateRef.current.selectedKeys.size > 0 && stateRef.current.isRotationSectionExpanded) {
      ctx.save();
      stateRef.current.selectedKeys.forEach(keyId => {
        const key = keyboard.keys.find(k => k.id === keyId);
        if (key) {
          let rotX: number, rotY: number;
          
          // Determine rotation center position
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
    
    const store = useKeyboardStore.getState();
    
    // Handle rotation point setting mode
    if (store.isSettingRotationPoint) {
      const selectedKeys = Array.from(store.selectedKeys);
      if (selectedKeys.length > 0) {
        // Convert canvas coordinates to keyboard units
        const unitSize = store.editorSettings.unitSize;
        const rotationX = x / unitSize;
        const rotationY = y / unitSize;
        
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
      const isKeyAlreadySelected = store.selectedKeys.has(keyRect.id);
      
      // If clicking on an already selected key without Ctrl/Cmd, don't change selection
      // This allows dragging the group
      if (!isKeyAlreadySelected || isMultiSelect) {
        // selectKey handles toggle logic when multiSelect is true
        store.selectKey(keyRect.id, isMultiSelect);
      }
      
      // Start dragging if key is selected (either was already selected or just got selected)
      if (store.selectedKeys.has(keyRect.id)) {
        isDraggingRef.current = true;
        dragStartRef.current = { x, y };
        dragOffsetRef.current = { x: 0, y: 0 };
        canvas.style.cursor = 'move';
      }
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
    document.addEventListener('keydown', handleKeyDown);
    
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