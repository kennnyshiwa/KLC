import React, { useState, useEffect } from 'react';
import { X, FlipVertical, FlipHorizontal, Copy } from 'lucide-react';
import { useKeyboardStore } from '../store/keyboardStoreOptimized';
import {
  mirrorKeysVertically,
  mirrorKeysHorizontally,
  mirrorKeysAtAngle,
  getSelectionCenter,
  duplicateAndMirrorKeysVertically,
  duplicateAndMirrorKeysHorizontally,
  duplicateAndMirrorKeysAtAngle
} from '../utils/mirrorUtils';
import { Key } from '../types/keyboard';

interface MirrorModalProps {
  onClose: () => void;
}

type MirrorDirection = 'vertical' | 'horizontal';

const MirrorModal: React.FC<MirrorModalProps> = ({ onClose }) => {
  const selectedKeys = useKeyboardStore((state) => state.selectedKeys);
  const keyboard = useKeyboardStore((state) => state.keyboard);
  const updateKeys = useKeyboardStore((state) => state.updateKeys);
  const addKey = useKeyboardStore((state) => state.addKey);
  const saveToHistory = useKeyboardStore((state) => state.saveToHistory);

  const [direction, setDirection] = useState<MirrorDirection>('vertical');
  const [position, setPosition] = useState<string>('');
  const [angle, setAngle] = useState<string>('0');
  const [useCenter, setUseCenter] = useState(false);
  const [duplicateMode, setDuplicateMode] = useState(false);

  // Get selected keys
  const selectedKeysList = Array.from(selectedKeys)
    .map(id => keyboard.keys.find(k => k.id === id))
    .filter(Boolean) as Key[];

  // Parse angle for condition checks
  const angleValue = parseFloat(angle) || 0;

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

    const parsedAngle = parseFloat(angle);
    if (isNaN(parsedAngle)) {
      alert('Please enter a valid angle value');
      return;
    }

    // Position is required for non-duplicate mode or custom angles in duplicate mode
    const needsPosition = !duplicateMode ||
      !((parsedAngle === 0 && direction === 'vertical') || (parsedAngle === 90 && direction === 'horizontal'));

    const posValue = parseFloat(position);
    if (needsPosition && isNaN(posValue)) {
      alert('Please enter a valid position value');
      return;
    }

    if (duplicateMode) {
      // Duplicate and mirror mode - creates new keys adjacent to originals
      let newKeys: Key[];

      // Calculate the bounds of the selection to determine mirror axis
      let mirrorAxis: number;

      if (parsedAngle === 0 && direction === 'vertical') {
        // For vertical mirroring, place mirror axis at the bottom edge
        const maxY = Math.max(...selectedKeysList.map(k => k.y + k.height));
        mirrorAxis = maxY;
        newKeys = duplicateAndMirrorKeysVertically(selectedKeysList, mirrorAxis);
      } else if (parsedAngle === 90 && direction === 'horizontal') {
        // For horizontal mirroring, place mirror axis at the right edge
        const maxX = Math.max(...selectedKeysList.map(k => k.x + k.width));
        mirrorAxis = maxX;
        newKeys = duplicateAndMirrorKeysHorizontally(selectedKeysList, mirrorAxis);
      } else {
        // For custom angles, use the specified position
        const center = getSelectionCenter(selectedKeysList);
        newKeys = duplicateAndMirrorKeysAtAngle(
          selectedKeysList,
          center.x,
          center.y,
          parsedAngle
        );
      }

      // Add all new keys
      newKeys.forEach(key => addKey(key));
    } else {
      // Mirror in place mode - updates existing keys
      let updates: Array<{ id: string; changes: Partial<Key> }>;

      if (parsedAngle === 0 && direction === 'vertical') {
        const mirroredKeys = mirrorKeysVertically(selectedKeysList, posValue);
        updates = selectedKeysList.map((key, index) => ({
          id: key.id,
          changes: mirroredKeys[index]
        }));
      } else if (parsedAngle === 90 && direction === 'horizontal') {
        const mirroredKeys = mirrorKeysHorizontally(selectedKeysList, posValue);
        updates = selectedKeysList.map((key, index) => ({
          id: key.id,
          changes: mirroredKeys[index]
        }));
      } else {
        const center = getSelectionCenter(selectedKeysList);
        const mirroredKeys = mirrorKeysAtAngle(
          selectedKeysList,
          center.x,
          center.y,
          parsedAngle
        );
        updates = selectedKeysList.map((key, index) => ({
          id: key.id,
          changes: mirroredKeys[index]
        }));
      }

      updateKeys(updates);
    }

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

              <div className="checkbox-row" style={{ marginTop: '12px', marginBottom: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={duplicateMode}
                    onChange={(e) => setDuplicateMode(e.target.checked)}
                  />
                  <Copy size={16} />
                  <span>Duplicate & Mirror (create mirrored copies)</span>
                </label>
                <small style={{ color: '#666', marginTop: '4px', marginLeft: '24px', display: 'block' }}>
                  {duplicateMode
                    ? direction === 'horizontal'
                      ? 'Mirrored copies will be placed to the right of the selection'
                      : 'Mirrored copies will be placed below the selection'
                    : 'Selected keys will be mirrored in place (no copies created)'}
                </small>
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
                  disabled={useCenter || (duplicateMode && ((angleValue === 0 && direction === 'vertical') || (angleValue === 90 && direction === 'horizontal')))}
                />
                <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>
                  {duplicateMode && ((angleValue === 0 && direction === 'vertical') || (angleValue === 90 && direction === 'horizontal'))
                    ? 'Auto-calculated: Mirror axis is placed at the edge of the selection'
                    : direction === 'vertical'
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
                <strong>{selectedKeysList.length}</strong> key{selectedKeysList.length !== 1 ? 's' : ''} will be {duplicateMode ? 'duplicated and mirrored' : 'mirrored in place'}
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
            disabled={
              selectedKeysList.length === 0 ||
              (!duplicateMode && !position) ||
              (duplicateMode && !((angleValue === 0 && direction === 'vertical') || (angleValue === 90 && direction === 'horizontal')) && !position)
            }
          >
            {duplicateMode ? 'Duplicate & Mirror' : 'Apply Mirror'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MirrorModal;
