import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const ThemeToggle: React.FC = () => {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');

  useEffect(() => {
    const syncFromDom = () => {
      setDarkMode(document.documentElement.classList.contains('dark-mode'));
    };

    window.addEventListener('darkModeToggled', syncFromDom);
    window.addEventListener('storage', syncFromDom);
    return () => {
      window.removeEventListener('darkModeToggled', syncFromDom);
      window.removeEventListener('storage', syncFromDom);
    };
  }, []);

  const handleToggle = () => {
    const nextDarkMode = !darkMode;
    setDarkMode(nextDarkMode);
    localStorage.setItem('darkMode', String(nextDarkMode));

    if (nextDarkMode) {
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
    }

    window.dispatchEvent(new Event('darkModeToggled'));
  };

  return (
    <button
      className={`theme-toggle-button ${darkMode ? 'active' : ''}`}
      onClick={handleToggle}
      title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      type="button"
    >
      {darkMode ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
};

export default ThemeToggle;
