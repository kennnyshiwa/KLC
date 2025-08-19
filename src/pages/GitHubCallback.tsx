import React, { useEffect } from 'react';
import { Loader } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.DEV ? 'http://localhost:3001' : '/api');

const GitHubCallback: React.FC = () => {

  useEffect(() => {
    // Get the full URL including query params
    const queryString = window.location.search;
    
    // Redirect to backend callback with all params
    window.location.href = `${API_URL}/github/callback${queryString}`;
  }, []);

  return (
    <div className="loading-container" style={{ minHeight: '100vh' }}>
      <Loader size={48} className="spin" />
      <p>Connecting to GitHub...</p>
    </div>
  );
};

export default GitHubCallback;