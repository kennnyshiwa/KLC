import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, LogOut, User, ChevronDown, Settings } from 'lucide-react';
import UserSettings from './UserSettings';

const UserMenu: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading, login, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading) {
    return <div className="user-menu">Loading...</div>;
  }

  if (!user) {
    return (
      <button className="login-button" onClick={login}>
        <LogIn size={16} />
        <span>Login with Discord</span>
      </button>
    );
  }

  const avatarUrl = user.avatar 
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
    : `https://cdn.discordapp.com/embed/avatars/${parseInt(user.discriminator) % 5}.png`;

  return (
    <div className="user-menu" ref={dropdownRef}>
      <button 
        className="user-menu-button" 
        onClick={() => setShowDropdown(!showDropdown)}
      >
        <img 
          src={avatarUrl} 
          alt={user.username} 
          className="user-avatar"
        />
        <span className="user-name">{user.username}</span>
        <ChevronDown size={14} />
      </button>
      
      {showDropdown && (
        <div className="user-dropdown">
          <div className="user-dropdown-info">
            <User size={16} />
            <span>{user.username}#{user.discriminator}</span>
          </div>
          <div className="dropdown-separator" />
          <button className="user-dropdown-item" onClick={() => {
            setShowDropdown(false);
            navigate('/my-layouts');
          }}>
            My Layouts
          </button>
          <button className="user-dropdown-item" onClick={() => {
            setShowDropdown(false);
            setShowSettings(true);
          }}>
            <Settings size={16} />
            <span>Settings</span>
          </button>
          <div className="dropdown-separator" />
          <button className="user-dropdown-item logout" onClick={logout}>
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      )}
      
      <UserSettings 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
      />
    </div>
  );
};

export default UserMenu;