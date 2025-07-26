import React, { useState } from 'react';
import { FileDown, Image, FileText } from 'lucide-react';
import { useKeyboardStore } from '../store/keyboardStoreOptimized';
import { exportAsPNG, exportAsSVG } from '../utils/exportUtils';

interface ExportMenuProps {
  getStage: () => any;
}

const ExportMenu: React.FC<ExportMenuProps> = ({ getStage }) => {
  const [showMenu, setShowMenu] = useState(false);
  const keyboard = useKeyboardStore((state) => state.keyboard);
  
  const handleExportPNG = () => {
    const stage = getStage();
    if (stage) {
      exportAsPNG(stage, keyboard);
    }
    setShowMenu(false);
  };
  
  const handleExportSVG = () => {
    const stage = getStage();
    if (stage) {
      exportAsSVG(stage, keyboard);
    }
    setShowMenu(false);
  };
  
  return (
    <div className="export-menu-container">
      <button 
        className="toolbar-btn"
        onClick={() => setShowMenu(!showMenu)}
        title="Export"
      >
        <FileDown size={18} />
      </button>
      
      {showMenu && (
        <div className="export-menu">
          <button onClick={handleExportPNG} className="export-menu-item">
            <Image size={16} />
            <span>Export as PNG</span>
          </button>
          <button onClick={handleExportSVG} className="export-menu-item">
            <FileText size={16} />
            <span>Export as SVG</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default ExportMenu;