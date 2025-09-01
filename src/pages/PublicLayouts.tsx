import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKeyboardStore } from '../store/keyboardStoreOptimized';
import { Loader, Search, Eye, User, Calendar, Tag, ChevronLeft, ChevronRight } from 'lucide-react';
import LayoutPreview from '../components/LayoutPreview';
import { parseOriginalKLE } from '../utils/originalKLEParser';
import { Keyboard } from '../types';

interface Owner {
  username: string;
  discriminator: string;
}

interface PublicLayout {
  id: string;
  name: string;
  description: string;
  data: any;
  isPublic: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  owner: Owner;
}

interface LayoutsResponse {
  layouts: PublicLayout[];
  total: number;
  page: number;
  totalPages: number;
}

// In development, always use absolute URL to backend
// In production, use relative URL or configured absolute URL
const API_URL = import.meta.env.DEV 
  ? (import.meta.env.VITE_API_URL?.startsWith('http') 
      ? import.meta.env.VITE_API_URL 
      : 'http://localhost:3001')
  : (import.meta.env.VITE_API_URL || '/api');

const PublicLayouts: React.FC = () => {
  const navigate = useNavigate();
  const setKeyboard = useKeyboardStore((state) => state.setKeyboard);
  const setCurrentLayoutId = useKeyboardStore((state) => state.setCurrentLayoutId);
  const markAsSaved = useKeyboardStore((state) => state.markAsSaved);
  
  const [layouts, setLayouts] = useState<PublicLayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedLayout, setSelectedLayout] = useState<PublicLayout | null>(null);

  useEffect(() => {
    fetchLayouts();
  }, [currentPage, searchQuery]);

  const fetchLayouts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '12',
        ...(searchQuery && { search: searchQuery })
      });
      
      const response = await fetch(`${API_URL}/layouts/public?${params}`);
      
      if (response.ok) {
        const data: LayoutsResponse = await response.json();
        setLayouts(data.layouts);
        setTotalPages(data.totalPages);
        setTotal(data.total);
        setError('');
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch public layouts:', response.status, errorText);
        setError('Failed to fetch public layouts');
      }
    } catch (error) {
      console.error('Error fetching public layouts:', error);
      setError('Failed to fetch public layouts');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadLayout = (layout: PublicLayout) => {
    let parsedKeyboard: Keyboard;
    
    // Parse the layout data
    if (Array.isArray(layout.data)) {
      parsedKeyboard = parseOriginalKLE(layout.data);
    } else if (layout.data && typeof layout.data === 'object' && 'keys' in layout.data) {
      parsedKeyboard = layout.data;
    } else {
      console.error('Unknown layout format:', layout.data);
      alert('Unable to load this layout - unknown format');
      return;
    }
    
    // Set the layout name from the public layout
    parsedKeyboard.meta = parsedKeyboard.meta || {};
    parsedKeyboard.meta.name = layout.name;
    
    // Load the layout into the editor
    setKeyboard(parsedKeyboard);
    setCurrentLayoutId(null); // Clear layout ID since this is a copy
    markAsSaved(); // Mark as saved to prevent unsaved changes warning
    
    // Navigate to the editor
    navigate('/');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1); // Reset to first page on new search
  };

  const parseLayoutForPreview = (layout: PublicLayout): Keyboard => {
    try {
      if (Array.isArray(layout.data)) {
        return parseOriginalKLE(layout.data);
      } else if (layout.data && typeof layout.data === 'object' && 'keys' in layout.data) {
        return layout.data;
      }
    } catch (error) {
      console.error('Error parsing layout for preview:', error);
    }
    return { meta: {}, keys: [] };
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <div className="public-layouts-page">
      <div className="page-header">
        <button 
          onClick={() => navigate('/')} 
          className="btn btn-back"
        >
          <ChevronLeft size={18} />
          Back to Editor
        </button>
        <h1>Public Layouts Gallery</h1>
        <p className="subtitle">Browse and load community-shared keyboard layouts</p>
      </div>

      <div className="search-bar">
        <form onSubmit={handleSearch}>
          <div className="search-input-wrapper">
            <Search size={20} />
            <input
              type="text"
              placeholder="Search layouts by name, description, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            <button type="submit" className="btn btn-primary">
              Search
            </button>
          </div>
        </form>
        {total > 0 && (
          <p className="search-results-count">
            Showing {layouts.length} of {total} layouts
          </p>
        )}
      </div>

      {loading ? (
        <div className="loading-container">
          <Loader className="spinner" size={48} />
          <p>Loading layouts...</p>
        </div>
      ) : error ? (
        <div className="error-container">
          <p className="error-message">{error}</p>
          <button onClick={fetchLayouts} className="btn">
            Try Again
          </button>
        </div>
      ) : layouts.length === 0 ? (
        <div className="empty-state">
          <p>No public layouts found</p>
          {searchQuery && (
            <button 
              onClick={() => {
                setSearchQuery('');
                setCurrentPage(1);
              }} 
              className="btn"
            >
              Clear Search
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="layouts-grid">
            {layouts.map(layout => (
              <div 
                key={layout.id} 
                className="layout-card"
                onClick={() => setSelectedLayout(layout)}
              >
                <div className="layout-preview">
                  <LayoutPreview 
                    keyboard={parseLayoutForPreview(layout)}
                    width={280}
                    height={140}
                  />
                  <div className="layout-overlay">
                    <button className="btn btn-view">
                      <Eye size={16} />
                      View Details
                    </button>
                  </div>
                </div>
                <div className="layout-info">
                  <h3 className="layout-name">{layout.name}</h3>
                  {layout.description && (
                    <p className="layout-description">{layout.description}</p>
                  )}
                  <div className="layout-meta">
                    <span className="layout-owner">
                      <User size={14} />
                      {layout.owner.username}#{layout.owner.discriminator}
                    </span>
                    <span className="layout-date">
                      <Calendar size={14} />
                      {formatDate(layout.updatedAt)}
                    </span>
                  </div>
                  {layout.tags && layout.tags.length > 0 && (
                    <div className="layout-tags">
                      {layout.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="tag">
                          <Tag size={12} />
                          {tag}
                        </span>
                      ))}
                      {layout.tags.length > 3 && (
                        <span className="tag more-tags">+{layout.tags.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="btn pagination-btn"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={18} />
                Previous
              </button>
              <span className="pagination-info">
                Page {currentPage} of {totalPages}
              </span>
              <button
                className="btn pagination-btn"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </>
      )}

      {/* Layout Detail Modal */}
      {selectedLayout && (
        <div className="modal-overlay" onClick={() => setSelectedLayout(null)}>
          <div className="modal-content layout-detail-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedLayout.name}</h2>
              <button 
                className="close-btn" 
                onClick={() => setSelectedLayout(null)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="layout-preview-large">
                <LayoutPreview 
                  keyboard={parseLayoutForPreview(selectedLayout)}
                  width={600}
                  height={300}
                />
              </div>
              {selectedLayout.description && (
                <div className="layout-detail-section">
                  <h3>Description</h3>
                  <p>{selectedLayout.description}</p>
                </div>
              )}
              <div className="layout-detail-meta">
                <div className="meta-item">
                  <strong>Created by:</strong>
                  <span>{selectedLayout.owner.username}#{selectedLayout.owner.discriminator}</span>
                </div>
                <div className="meta-item">
                  <strong>Last updated:</strong>
                  <span>{formatDate(selectedLayout.updatedAt)}</span>
                </div>
                <div className="meta-item">
                  <strong>Created:</strong>
                  <span>{formatDate(selectedLayout.createdAt)}</span>
                </div>
              </div>
              {selectedLayout.tags && selectedLayout.tags.length > 0 && (
                <div className="layout-detail-section">
                  <h3>Tags</h3>
                  <div className="layout-tags">
                    {selectedLayout.tags.map(tag => (
                      <span key={tag} className="tag">
                        <Tag size={12} />
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button 
                className="btn" 
                onClick={() => setSelectedLayout(null)}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary"
                onClick={() => handleLoadLayout(selectedLayout)}
              >
                Load Layout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicLayouts;