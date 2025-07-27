import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.DEV ? 'http://localhost:3001' : '/api');

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      
      if (!code) {
        console.error('No authorization code found');
        navigate('/');
        return;
      }

      try {
        console.log('Exchanging code for token:', code);
        const response = await fetch(`${API_URL}/auth/discord/callback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ code }),
        });

        console.log('Auth response status:', response.status);
        if (response.ok) {
          console.log('Authentication successful, redirecting...');
          // Redirect to home page after successful login
          window.location.href = '/';
        } else {
          const error = await response.text();
          console.error('Authentication failed:', response.status, error);
          navigate('/');
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        navigate('/');
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      backgroundColor: '#1a1a1a',
      color: '#fff'
    }}>
      <div>
        <h2>Authenticating with Discord...</h2>
        <p>Please wait while we log you in.</p>
      </div>
    </div>
  );
};

export default AuthCallback;