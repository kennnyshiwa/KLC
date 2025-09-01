import { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import KeyboardCanvas, { KeyboardCanvasRef } from './KeyboardCanvasUltraFast';
import { useKeyboardStore } from '../store/keyboardStoreOptimized';

const CanvasContainer = forwardRef<KeyboardCanvasRef>((_, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<KeyboardCanvasRef>(null);
  const [containerDimensions, setContainerDimensions] = useState({ width: 800, height: 600 });
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 800, height: 600 });
  
  const keyboard = useKeyboardStore((state) => state.keyboard);
  const editorSettings = useKeyboardStore((state) => state.editorSettings);
  
  useImperativeHandle(ref, () => ({
    getStage: () => canvasRef.current?.getStage() || null
  }));

  // Calculate the bounds of the keyboard layout
  const calculateKeyboardBounds = () => {
    if (keyboard.keys.length === 0) {
      return { minX: 0, minY: 0, maxX: 20, maxY: 10 };
    }
    
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    keyboard.keys.forEach(key => {
      // Consider rotation when calculating bounds
      if (key.rotation_angle) {
        // This is a simplified calculation - for accurate bounds with rotation,
        // we'd need to calculate the rotated corners
        const centerX = key.rotation_x || 0;
        const centerY = key.rotation_y || 0;
        const dist = Math.sqrt(
          Math.pow(key.x + key.width - centerX, 2) + 
          Math.pow(key.y + key.height - centerY, 2)
        );
        minX = Math.min(minX, centerX - dist);
        minY = Math.min(minY, centerY - dist);
        maxX = Math.max(maxX, centerX + dist);
        maxY = Math.max(maxY, centerY + dist);
      } else {
        minX = Math.min(minX, key.x);
        minY = Math.min(minY, key.y);
        maxX = Math.max(maxX, key.x + key.width);
        maxY = Math.max(maxY, key.y + key.height);
        
        // Account for secondary rectangle (like ISO Enter with negative y2)
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
      }
    });
    
    return { minX, minY, maxX, maxY };
  };

  // Update container dimensions
  useEffect(() => {
    const updateContainerDimensions = () => {
      if (containerRef.current) {
        setContainerDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateContainerDimensions();
    window.addEventListener('resize', updateContainerDimensions);
    
    const resizeObserver = new ResizeObserver(updateContainerDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateContainerDimensions);
      resizeObserver.disconnect();
    };
  }, []);
  
  // Update canvas dimensions based on keyboard layout
  useEffect(() => {
    const bounds = calculateKeyboardBounds();
    const unitSize = editorSettings.unitSize;
    const padding = 4; // 4 units of padding on each side
    
    // Calculate required canvas size
    const requiredWidth = (bounds.maxX - bounds.minX + padding * 2) * unitSize;
    const requiredHeight = (bounds.maxY - bounds.minY + padding * 2) * unitSize;
    
    // Use the larger of container size or required size
    setCanvasDimensions({
      width: Math.max(containerDimensions.width, requiredWidth),
      height: Math.max(containerDimensions.height, requiredHeight)
    });
  }, [keyboard.keys, editorSettings.unitSize, containerDimensions]);

  return (
    <div 
      ref={containerRef} 
      style={{ 
        width: '100%', 
        height: '100%', 
        overflow: 'auto',
        position: 'relative'
      }}
    >
      <div style={{ 
        width: canvasDimensions.width, 
        height: canvasDimensions.height,
        position: 'relative'
      }}>
        <KeyboardCanvas 
          ref={canvasRef} 
          width={canvasDimensions.width} 
          height={canvasDimensions.height} 
        />
      </div>
    </div>
  );
});

CanvasContainer.displayName = 'CanvasContainer';

export default CanvasContainer;