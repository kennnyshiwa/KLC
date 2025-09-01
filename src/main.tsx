import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import AuthCallback from './pages/AuthCallback';
import MyLayouts from './pages/MyLayouts';
import PublicLayout from './pages/PublicLayout';
import PublicLayouts from './pages/PublicLayouts';
import ImportGists from './pages/ImportGists';
import GitHubCallback from './pages/GitHubCallback';
import { AuthProvider } from './contexts/AuthContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/auth/github/callback" element={<GitHubCallback />} />
          <Route path="/my-layouts" element={<MyLayouts />} />
          <Route path="/public-layouts" element={<PublicLayouts />} />
          <Route path="/layout/:id" element={<PublicLayout />} />
          <Route path="/import-gists" element={<ImportGists />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);