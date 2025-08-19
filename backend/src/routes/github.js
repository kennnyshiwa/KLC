import express from 'express';
import axios from 'axios';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// GitHub OAuth URLs
const GITHUB_OAUTH_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';

// Initiate GitHub OAuth flow for gist access
router.get('/auth', requireAuth, (req, res) => {
  // Debug logging
  console.log('GitHub OAuth Config:', {
    client_id: process.env.GITHUB_CLIENT_ID ? 'Set' : 'Not set',
    redirect_uri: process.env.GITHUB_REDIRECT_URI,
    has_env: !!process.env.GITHUB_CLIENT_ID
  });

  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_REDIRECT_URI) {
    return res.status(500).json({ 
      error: 'GitHub OAuth not configured. Please check environment variables.' 
    });
  }

  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: process.env.GITHUB_REDIRECT_URI,
    scope: 'gist', // Only request gist scope
    state: req.session.userId // Pass user ID for security
  });

  res.redirect(`${GITHUB_OAUTH_URL}?${params.toString()}`);
});

// Handle GitHub OAuth callback
router.get('/callback', requireAuth, async (req, res) => {
  const { code, state, error: githubError, error_description } = req.query;

  // Check if GitHub returned an error
  if (githubError) {
    console.error('GitHub OAuth error:', githubError, error_description);
    return res.redirect(`${process.env.FRONTEND_URL}/import-gists?error=${encodeURIComponent(githubError)}&description=${encodeURIComponent(error_description || '')}`);
  }

  // Verify state to prevent CSRF
  if (state !== req.session.userId) {
    return res.redirect(`${process.env.FRONTEND_URL}/import-gists?error=invalid_state`);
  }

  try {
    // Exchange code for access token
    const tokenResponse = await axios.post(
      GITHUB_TOKEN_URL,
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: process.env.GITHUB_REDIRECT_URI
      },
      {
        headers: {
          Accept: 'application/json'
        }
      }
    );

    const { access_token } = tokenResponse.data;
    
    console.log('GitHub token received:', access_token ? 'Yes' : 'No');

    // Store the GitHub token in session (temporary storage)
    req.session.githubToken = access_token;
    
    console.log('GitHub token stored in session');

    // Save session before redirect
    req.session.save((err) => {
      if (err) {
        console.error('Error saving session:', err);
        return res.redirect(`${process.env.FRONTEND_URL}/import-gists?error=session_save_failed`);
      }
      // Redirect back to frontend with success
      const redirectUrl = `${process.env.FRONTEND_URL}/import-gists?success=true`;
      console.log('Redirecting to:', redirectUrl);
      res.redirect(redirectUrl);
    });
  } catch (error) {
    console.error('GitHub OAuth token exchange error:', error.response?.data || error.message);
    res.redirect(`${process.env.FRONTEND_URL}/import-gists?error=github_auth_failed`);
  }
});

// Fetch user's gists
router.get('/gists', requireAuth, async (req, res) => {
  console.log('Fetching gists, has token:', !!req.session.githubToken);
  
  if (!req.session.githubToken) {
    return res.status(401).json({ error: 'GitHub authentication required' });
  }

  try {
    console.log('Fetching from GitHub API...');
    console.log('Token first 10 chars:', req.session.githubToken.substring(0, 10) + '...');
    
    // Fetch all gists for the authenticated user (includes both public and secret)
    // The /gists endpoint returns ALL gists when authenticated
    const gistsResponse = await axios.get('https://api.github.com/gists', {
      headers: {
        Authorization: `Bearer ${req.session.githubToken}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'KLE2.0-Importer'
      },
      params: {
        per_page: 100, // Max allowed per page
        since: '2010-01-01T00:00:00Z' // Get all gists since 2010 to ensure we get everything
      }
    });

    console.log('GitHub API response status:', gistsResponse.status);
    console.log('Number of gists returned:', gistsResponse.data.length);
    console.log('Response headers:', gistsResponse.headers);
    
    // Check if there are more pages
    if (gistsResponse.headers.link) {
      console.log('Link header (pagination):', gistsResponse.headers.link);
    }
    
    // Log first gist to see structure
    if (gistsResponse.data.length > 0) {
      console.log('First gist structure:', {
        id: gistsResponse.data[0].id,
        files: Object.keys(gistsResponse.data[0].files),
        public: gistsResponse.data[0].public,
        description: gistsResponse.data[0].description
      });
    }

    // Filter for potential KLE layouts (JSON files)
    const kleGists = [];
    
    for (const gist of gistsResponse.data) {
      // Check each file in the gist
      for (const [filename, fileInfo] of Object.entries(gist.files)) {
        console.log('Checking file:', filename, 'Size:', fileInfo.size);
        if (filename.endsWith('.kbd.json') && fileInfo.size < 1000000) { // Limit to 1MB
          console.log('Found JSON file:', filename);
          kleGists.push({
            id: gist.id,
            filename,
            description: gist.description || filename,
            created_at: gist.created_at,
            updated_at: gist.updated_at,
            url: fileInfo.raw_url,
            size: fileInfo.size
          });
        }
      }
    }

    console.log('Total KLE gists found:', kleGists.length);
    res.json({ gists: kleGists });
  } catch (error) {
    console.error('Error fetching gists:', error);
    if (error.response?.status === 401) {
      // Token expired or invalid
      delete req.session.githubToken;
      return res.status(401).json({ error: 'GitHub authentication expired' });
    }
    res.status(500).json({ error: 'Failed to fetch gists' });
  }
});

// Fetch a specific gist content
router.get('/gists/:id/content', requireAuth, async (req, res) => {
  if (!req.session.githubToken) {
    return res.status(401).json({ error: 'GitHub authentication required' });
  }

  const { id } = req.params;
  const { filename } = req.query;

  if (!filename) {
    return res.status(400).json({ error: 'Filename required' });
  }

  try {
    // Fetch the specific gist
    const gistResponse = await axios.get(`https://api.github.com/gists/${id}`, {
      headers: {
        Authorization: `Bearer ${req.session.githubToken}`,
        Accept: 'application/vnd.github.v3+json'
      }
    });

    const file = gistResponse.data.files[filename];
    if (!file) {
      return res.status(404).json({ error: 'File not found in gist' });
    }

    // Return the content
    res.json({ 
      content: file.content,
      filename: file.filename,
      language: file.language
    });
  } catch (error) {
    console.error('Error fetching gist content:', error);
    res.status(500).json({ error: 'Failed to fetch gist content' });
  }
});

// Clear GitHub token
router.post('/logout', requireAuth, (req, res) => {
  delete req.session.githubToken;
  res.json({ success: true });
});

export default router;