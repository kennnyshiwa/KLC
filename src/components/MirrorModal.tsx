import React, { useState, useEffect } from 'react';
import { X, FlipVertical, FlipHorizontal } from 'lucide-react';
import { useKeyboardStore } from '../store/keyboardStoreOptimized';
import { mirrorKeysVertically, mirrorKeysHorizontally, mirrorKeysAtAngle, getSelectionCenter } from '../utils/mirrorUtils';
import { Key } from '../types/keyboard';

interface MirrorModalProps {
  onClose: () => void;
}

type MirrorDirection = 'vertical' | 'horizontal';

const MirrorModal: React.FC<MirrorModalProps> = ({ onClose }) => {
  const selectedKeys = useKeyboardStore((state) => state.selectedKeys);
  const keyboard = useKeyboardStore((state) => state.keyboard);
  const updateKeys = useKeyboardStore((state) => state.updateKeys);
  const saveToHistory = useKeyboardStore((state) => state.saveToHistory);

  const [direction, setDirection] = useState<MirrorDirection>('vertical');
  const [position, setPosition] = useState<string>('');
  const [angle, setAngle] = useState<string>('0');
  const [useCenter, setUseCenter] = useState(false);

  // Get selected keys
  const selectedKeysList = Array.from(selectedKeys)
    .map(id => keyboard.keys.find(k => k.id === id))
    .filter(Boolean) as Key[];

  // Calculate center on mount
  useEffect(() => {
    if (selectedKeysList.length > 0 && useCenter) {
      const center = getSelectionCenter(selectedKeysList);
      if (direction === 'vertical') {
        setPosition(center.y.toFixed(2));
      } else {
        setPosition(center.x.toFixed(2));
      }
    }
  }, [direction, useCenter, selectedKeysList.length]);

  const handleDirectionChange = (newDirection: MirrorDirection) => {
    setDirection(newDirection);
    // Update default angle when switching directions
    if (angle === '0' || angle === '90') {
      setAngle(newDirection === 'vertical' ? '0' : '90');
    }
    if (useCenter && selectedKeysList.length > 0) {
      const center = getSelectionCenter(selectedKeysList);
      if (newDirection === 'vertical') {
        setPosition(center.y.toFixed(2));
      } else {
        setPosition(center.x.toFixed(2));
      }
    }
  };

  const handleUseCenterToggle = (checked: boolean) => {
    setUseCenter(checked);
    if (checked && selectedKeysList.length > 0) {
      const center = getSelectionCenter(selectedKeysList);
      if (direction === 'vertical') {
        setPosition(center.y.toFixed(2));
      } else {
        setPosition(center.x.toFixed(2));
      }
    }
  };

  const handleApply = () => {
    if (selectedKeysList.length === 0) {
      onClose();
      return;
    }

    const posValue = parseFloat(position);
    if (isNaN(posValue)) {
      alert('Please enter a valid position value');
      return;
    }

    const angleValue = parseFloat(angle);
    if (isNaN(angleValue)) {
      alert('Please enter a valid angle value');
      return;
    }

    let updates: Array<{ id: string; changes: Partial<Key> }>;

    // If angle is 0 (vertical) or 90 (horizontal), use simple mirror functions
    // Otherwise use angle-based mirroring
    if (angleValue === 0 && direction === 'vertical') {
      const mirroredKeys = mirrorKeysVertically(selectedKeysList, posValue);
      updates = selectedKeysList.map((key, index) => ({
        id: key.id,
        changes: mirroredKeys[index]
      }));
    } else if (angleValue === 90 && direction === 'horizontal') {
      const mirroredKeys = mirrorKeysHorizontally(selectedKeysList, posValue);
      updates = selectedKeysList.map((key, index) => ({
        id: key.id,
        changes: mirroredKeys[index]
      }));
    } else {
      // Use angle-based mirroring for any custom angle
      const center = getSelectionCenter(selectedKeysList);
      const mirroredKeys = mirrorKeysAtAngle(
        selectedKeysList,
        center.x,
        center.y,
        angleValue
      );
      updates = selectedKeysList.map((key, index) => ({
        id: key.id,
        changes: mirroredKeys[index]
      }));
    }

    updateKeys(updates);
    saveToHistory();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ width: '450px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Mirror Keys</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {selectedKeysList.length === 0 ? (
            <div className="alert alert-error">
              No keys selected. Please select keys to mirror.
            </div>
          ) : (
            <>
              <div className="property-row">
                <label>Mirror Direction</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className={`btn ${direction === 'vertical' ? 'btn-primary' : ''}`}
                    onClick={() => handleDirectionChange('vertical')}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  >
                    <FlipVertical size={16} />
                    Vertical
                  </button>
                  <button
                    className={`btn ${direction === 'horizontal' ? 'btn-primary' : ''}`}
                    onClick={() => handleDirectionChange('horizontal')}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  >
                    <FlipHorizontal size={16} />
                    Horizontal
                  </button>
                </div>
              </div>

              <div className="property-row">
                <label>Mirror Angle (degrees)</label>
                <input
                  type="number"
                  step="15"
                  value={angle}
                  onChange={(e) => setAngle(e.target.value)}
                  placeholder={direction === 'vertical' ? '0 = horizontal' : '90 = vertical'}
                />
                <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>
                  {direction === 'vertical'
                    ? '0° = horizontal axis (vertical flip), custom angle tilts the axis'
                    : '90° = vertical axis (horizontal flip), custom angle tilts the axis'}
                </small>
              </div>

              <div className="checkbox-row" style={{ marginTop: '12px' }}>
                <label>
                  <input
                    type="checkbox"
                    checked={useCenter}
                    onChange={(e) => handleUseCenterToggle(e.target.checked)}
                  />
                  Use selection center for mirror axis
                </label>
              </div>

              <div className="property-row">
                <label>
                  Mirror Axis Center ({direction === 'vertical' ? 'Y' : 'X'} coordinate)
                </label>
                <input
                  type="number"
                  step="0.25"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder={`${direction === 'vertical' ? 'Y' : 'X'} coordinate of mirror axis center`}
                  disabled={useCenter}
                />
                <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>
                  {direction === 'vertical'
                    ? 'Y position of horizontal mirror axis (keys flip up/down across this line)'
                    : 'X position of vertical mirror axis (keys flip left/right across this line)'}
                </small>
              </div>

              <div style={{
                marginTop: '16px',
                padding: '12px',
                background: '#f5f5f5',
                borderRadius: '4px',
                fontSize: '13px',
                color: '#666'
              }}>
                <strong>{selectedKeysList.length}</strong> key{selectedKeysList.length !== 1 ? 's' : ''} will be mirrored
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleApply}
            disabled={selectedKeysList.length === 0 || !position}
          >
            Apply Mirror
          </button>
        </div>
      </div>
    </div>
  );
};

export default MirrorModal;
