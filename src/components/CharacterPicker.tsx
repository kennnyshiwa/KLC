import React, { useState } from 'react';
import { X } from 'lucide-react';

interface CharacterPickerProps {
  onSelect: (char: string) => void;
  onClose: () => void;
}

const characterSets = {
  'Arrows': ['←', '↑', '→', '↓', '⇐', '⇑', '⇒', '⇓', '⇤', '⇥', '⇦', '⇧', '⇨', '⇩'],
  'Math': ['±', '×', '÷', '≈', '≠', '≤', '≥', '∞', '∑', '∏', '√', '∫', '∂', '∇'],
  'Currency': ['¢', '£', '¤', '¥', '€', '₹', '₽', '₩', '₪', '₫', '₱', '₨'],
  'Music': ['♩', '♪', '♫', '♬', '♭', '♮', '♯', '𝄞', '𝄢', '𝄪', '𝄫', '𝄬'],
  'Symbols': ['©', '®', '™', '§', '¶', '†', '‡', '•', '‣', '⁂', '❦', '☞'],
  'Greek': ['α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'ι', 'κ', 'λ', 'μ', 'ν', 'ξ', 'ο', 'π', 'ρ', 'σ', 'τ', 'υ', 'φ', 'χ', 'ψ', 'ω'],
  'Box Drawing': ['─', '│', '┌', '┐', '└', '┘', '├', '┤', '┬', '┴', '┼', '═', '║', '╔', '╗', '╚', '╝', '╠', '╣', '╦', '╩', '╬'],
  'Misc': ['°', '′', '″', '‰', '№', '℃', '℉', '⌘', '⌥', '⌫', '⌦', '⏎', '⏏', '⏸', '⏯', '⏹', '⏺'],
};

const CharacterPicker: React.FC<CharacterPickerProps> = ({ onSelect, onClose }) => {
  const [activeSet, setActiveSet] = useState<string>('Arrows');
  
  return (
    <div className="character-picker-overlay" onClick={onClose}>
      <div className="character-picker" onClick={(e) => e.stopPropagation()}>
        <div className="character-picker-header">
          <h3>Character Picker</h3>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        
        <div className="character-sets">
          {Object.keys(characterSets).map(setName => (
            <button
              key={setName}
              className={`character-set-btn ${activeSet === setName ? 'active' : ''}`}
              onClick={() => setActiveSet(setName)}
            >
              {setName}
            </button>
          ))}
        </div>
        
        <div className="character-grid">
          {characterSets[activeSet as keyof typeof characterSets].map((char, index) => (
            <button
              key={index}
              className="character-btn"
              onClick={() => {
                onSelect(char);
                onClose();
              }}
            >
              {char}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CharacterPicker;