import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { parseOriginalKLE } from '../utils/originalKLEParser';
import { Loader, ArrowLeft, Github, Check, X, Edit2, Save, FileJson } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.DEV ? 'http://localhost:3001' : '/api');

interface Gist {
  id: string;
  filename: string;
  description: string;
  created_at: string;
  updated_at: string;
  url: string;
  size: number;
}

interface GistPreview {
  gist: Gist;
  content: string;
  rawJson: any; // The original KLE JSON array
  parsed: any;  // The parsed keyboard object
  keyCount: number;
  name: string;
  selected: boolean;
  error?: string;
}

const ImportGists: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [githubConnected, setGithubConnected] = useState(false);
  const [previews, setPreviews] = useState<GistPreview[]>([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    
    // Don't redirect if auth is still loading
    if (authLoading) {
      return;
    }
    
    if (!user) {
      navigate('/');
      return;
    }

    // Check if we're returning from GitHub OAuth
    const params = new URLSearchParams(location.search);
    if (params.get('success') === 'true') {
      setGithubConnected(true);
      fetchGists();
    } else if (params.get('error')) {
      const errorType = params.get('error');
      const errorDesc = params.get('description');
      
      if (errorType === 'redirect_uri_mismatch') {
        setError('GitHub OAuth error: The redirect URI doesn\'t match. Please check your GitHub OAuth app settings.');
      } else if (errorDesc) {
        setError(`GitHub OAuth error: ${errorDesc}`);
      } else {
        setError(`GitHub OAuth error: ${errorType}`);
      }
    }
  }, [user, authLoading, navigate, location]);

  const connectGitHub = () => {
    window.location.href = `${API_URL}/github/auth`;
  };

  const fetchGists = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${API_URL}/github/gists`, {
        credentials: 'include'
      });

      if (response.status === 401) {
        setGithubConnected(false);
        setError('GitHub authentication expired. Please reconnect.');
        return;
      }

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Gists fetch error:', errorData);
        throw new Error(`Failed to fetch gists: ${response.status}`);
      }

      const data = await response.json();
      if (!data.gists || data.gists.length === 0) {
        setPreviews([]);
        return;
      }
      
      // Fetch content for each gist
      await fetchGistContents(data.gists);
    } catch (err) {
      setError('Failed to fetch gists. Please try again.');
      console.error('Error in fetchGists:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchGistContents = async (gistList: Gist[]) => {
    const previewPromises = gistList.map(async (gist) => {
      try {
        const response = await fetch(
          `${API_URL}/github/gists/${gist.id}/content?filename=${encodeURIComponent(gist.filename)}`,
          { credentials: 'include' }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch gist content');
        }

        const data = await response.json();
        
        // Try to parse as KLE JSON
        let parsed = null;
        let keyCount = 0;
        let error = undefined;
        
        try {
          const content = JSON.parse(data.content);
          
          // Parse using the original KLE parser to preserve all properties
          parsed = parseOriginalKLE(content);
          keyCount = parsed.keys.length;
          
          return {
            gist,
            content: data.content,
            rawJson: content, // Store the original JSON
            parsed,
            keyCount,
            name: gist.description || gist.filename.replace('.kbd.json', ''),
            selected: !!parsed && !error,
            error
          } as GistPreview;
        } catch (parseError: any) {
          error = parseError.message;
          
          return {
            gist,
            content: data.content,
            rawJson: null,
            parsed,
            keyCount,
            name: gist.description || gist.filename.replace('.kbd.json', ''),
            selected: false,
            error
          } as GistPreview;
        }
      } catch (err) {
        return {
          gist,
          content: '',
          rawJson: null,
          parsed: null,
          keyCount: 0,
          name: gist.description || gist.filename,
          selected: false,
          error: 'Failed to fetch content'
        } as GistPreview;
      }
    });

    const results = await Promise.all(previewPromises);
    setPreviews(results);
  };

  const toggleSelection = (id: string) => {
    setPreviews(prev => prev.map(p => 
      p.gist.id === id ? { ...p, selected: !p.selected } : p
    ));
  };

  const startEditing = (id: string, name: string) => {
    setEditingId(id);
    setEditingName(name);
  };

  const saveEdit = () => {
    if (editingId && editingName.trim()) {
      setPreviews(prev => prev.map(p => 
        p.gist.id === editingId ? { ...p, name: editingName.trim() } : p
      ));
    }
    setEditingId(null);
    setEditingName('');
  };

  const importSelected = async () => {
    const selectedPreviews = previews.filter(p => p.selected && p.parsed);
    if (selectedPreviews.length === 0) return;

    setImporting(true);
    let successCount = 0;

    for (const preview of selectedPreviews) {
      try {
        // Save as a new layout with the raw KLE JSON
        // Strip out CSS from metadata to prevent issues
        let cleanedData = preview.rawJson;
        if (Array.isArray(cleanedData) && cleanedData.length > 0 && 
            typeof cleanedData[0] === 'object' && !Array.isArray(cleanedData[0])) {
          // First element is metadata
          const metadataCopy = { ...cleanedData[0] };
          delete metadataCopy.css; // Remove CSS to prevent custom shape issues
          cleanedData = [metadataCopy, ...cleanedData.slice(1)];
        }
        
        const layoutData = {
          name: preview.name,
          description: `Imported from Gist: ${preview.gist.filename}`,
          data: cleanedData, // Use cleaned data without CSS
          isPublic: false,
          tags: ['imported', 'gist']
        };

        const response = await fetch(`${API_URL}/layouts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(layoutData)
        });

        if (response.ok) {
          successCount++;
        }
      } catch (err) {
        console.error('Failed to import layout:', err);
      }
    }

    if (successCount > 0) {
      // Navigate to My Layouts page
      navigate('/my-layouts');
    } else {
      setError('Failed to import layouts. Please try again.');
    }
    
    setImporting(false);
  };

  const selectAll = () => {
    setPreviews(prev => prev.map(p => ({ ...p, selected: !p.error })));
  };

  const deselectAll = () => {
    setPreviews(prev => prev.map(p => ({ ...p, selected: false })));
  };

  const selectedCount = previews.filter(p => p.selected).length;

  // Show loading while auth is loading
  if (authLoading) {
    return (
      <div className="loading-container" style={{ minHeight: '100vh' }}>
        <Loader size={48} className="spin" />
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="import-gists-page">
      <div className="import-header">
        <button className="btn btn-sm" onClick={() => navigate('/')}>
          <ArrowLeft size={16} />
          Back to Editor
        </button>
        <h1>Import from KLE Gists</h1>
      </div>

      {!githubConnected && !loading && (
        <div className="github-connect-container">
          <div className="github-connect-box">
            <Github size={48} />
            <h2>Connect to GitHub</h2>
            <p>To import your KLE layouts from GitHub Gists, you need to connect your GitHub account.</p>
            <p className="privacy-note">We only request access to read your gists. Your data remains private.</p>
            <button className="btn btn-primary btn-large" onClick={connectGitHub}>
              Connect GitHub Account
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="loading-container">
          <Loader size={48} className="spin" />
          <p>Fetching your gists...</p>
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {!loading && githubConnected && previews.length === 0 && (
        <div className="empty-state">
          <FileJson size={48} />
          <h2>No KLE Layouts Found</h2>
          <p>We couldn't find any .kbd.json files in your GitHub Gists.</p>
          <p className="privacy-note">Note: If you have secret gists, you may need to disconnect and reconnect with proper permissions.</p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '20px' }}>
            <button className="btn btn-secondary" onClick={async () => {
              await fetch(`${API_URL}/github/logout`, { method: 'POST', credentials: 'include' });
              setGithubConnected(false);
              setPreviews([]);
            }}>
              Disconnect GitHub
            </button>
            <button className="btn btn-primary" onClick={() => navigate('/')}>
              Back to Editor
            </button>
          </div>
        </div>
      )}

      {!loading && githubConnected && previews.length > 0 && (
        <>
          <div className="import-controls">
            <div className="selection-info">
              {selectedCount} of {previews.length} layouts selected
            </div>
            <div className="control-buttons">
              <button className="btn btn-sm" onClick={selectAll}>
                Select All Valid
              </button>
              <button className="btn btn-sm" onClick={deselectAll}>
                Deselect All
              </button>
              <button 
                className="btn btn-primary"
                onClick={importSelected}
                disabled={selectedCount === 0 || importing}
              >
                {importing ? (
                  <>
                    <Loader size={16} className="spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Import Selected ({selectedCount})
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="gist-list">
            {previews.map(preview => (
              <div 
                key={preview.gist.id} 
                className={`gist-item ${preview.error ? 'has-error' : ''} ${preview.selected ? 'selected' : ''}`}
              >
                <div className="gist-checkbox">
                  <input
                    type="checkbox"
                    checked={preview.selected}
                    onChange={() => toggleSelection(preview.gist.id)}
                    disabled={!!preview.error}
                  />
                </div>
                
                <div className="gist-info">
                  <div className="gist-name">
                    {editingId === preview.gist.id ? (
                      <div className="name-editor">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit();
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          autoFocus
                        />
                        <button className="btn btn-sm" onClick={saveEdit}>
                          <Check size={14} />
                        </button>
                        <button className="btn btn-sm" onClick={() => setEditingId(null)}>
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="name-display">
                        <span>{preview.name}</span>
                        <button 
                          className="btn btn-sm btn-icon"
                          onClick={() => startEditing(preview.gist.id, preview.name)}
                          title="Edit name"
                        >
                          <Edit2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="gist-meta">
                    <span className="filename">{preview.gist.filename}</span>
                    {preview.keyCount > 0 && (
                      <span className="key-count">{preview.keyCount} keys</span>
                    )}
                    <span className="date">
                      Updated {new Date(preview.gist.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                  
                  {preview.error && (
                    <div className="gist-error">
                      <X size={14} />
                      <span>{preview.error}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default ImportGists;