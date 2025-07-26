import React, { useState, useEffect } from 'react';
import { fontManager } from '../utils/fontManager';

export const FontDebugger: React.FC = () => {
  const [fontStatus, setFontStatus] = useState({
    loaded: false,
    canRender: false,
    cssLoaded: false
  });

  useEffect(() => {
    const checkFontStatus = () => {
      // Check if font is loaded via font manager
      const loaded = fontManager.isFontLoaded('trashcons');
      
      // Check if font can actually render
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.font = '16px trashcons';
        const width1 = ctx.measureText('\ue90e').width;
        ctx.font = '16px monospace';
        const width2 = ctx.measureText('\ue90e').width;
        const canRender = width1 !== width2;
        
        // Check if CSS is loaded
        const testSpan = document.createElement('span');
        testSpan.className = 'trashcons icon-enter';
        testSpan.style.position = 'absolute';
        testSpan.style.visibility = 'hidden';
        document.body.appendChild(testSpan);
        const computed = window.getComputedStyle(testSpan, ':before');
        const content = computed.content;
        const fontFamily = computed.fontFamily;
        document.body.removeChild(testSpan);
        
        setFontStatus({
          loaded,
          canRender,
          cssLoaded: content === '"\ue90e"' && fontFamily.includes('trashcons')
        });
      }
    };

    // Check immediately
    checkFontStatus();
    
    // Check periodically for a few seconds
    const interval = setInterval(checkFontStatus, 500);
    
    // Stop checking after 5 seconds
    setTimeout(() => clearInterval(interval), 5000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      position: 'fixed',
      bottom: 10,
      right: 10,
      background: 'white',
      border: '1px solid #ccc',
      padding: '10px',
      borderRadius: '5px',
      fontSize: '12px',
      fontFamily: 'monospace',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      zIndex: 9999
    }}>
      <h4 style={{ margin: '0 0 10px 0' }}>Font Debug Info</h4>
      <div>Font Loaded: {fontStatus.loaded ? '✅' : '❌'}</div>
      <div>Can Render: {fontStatus.canRender ? '✅' : '❌'}</div>
      <div>CSS Loaded: {fontStatus.cssLoaded ? '✅' : '❌'}</div>
      <div style={{ marginTop: '10px' }}>
        Test Icons:
        <span className="trashcons icon-enter" style={{ marginLeft: '5px' }}></span>
        <span className="trashcons icon-shift" style={{ marginLeft: '5px' }}></span>
        <span className="trashcons icon-ctrl" style={{ marginLeft: '5px' }}></span>
      </div>
      <div style={{ marginTop: '5px' }}>
        Direct Unicode: <span className="trashcons">&#xe90e; &#xe90b; &#xe914;</span>
      </div>
    </div>
  );
};