import express from 'express';
import axios from 'axios';
import { prisma } from '../index.js';

const router = express.Router();

// Discord OAuth URLs
const DISCORD_API_URL = 'https://discord.com/api/v10';
const DISCORD_TOKEN_URL = 'https://discord.com/api/oauth2/token';

// Exchange code for token and get user info
router.post('/discord/callback', async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'No authorization code provided' });
  }

  try {
    // Exchange code for access token
    const tokenResponse = await axios.post(DISCORD_TOKEN_URL, 
      new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const { access_token } = tokenResponse.data;

    // Get user info from Discord
    const userResponse = await axios.get(`${DISCORD_API_URL}/users/@me`, {
      headers: {
        Authorization: `Bearer ${access_token}`
      }
    });

    const discordUser = userResponse.data;

    // Find or create user in database
    let user = await prisma.user.findUnique({
      where: { discordId: discordUser.id }
    });
    
    if (!user) {
      user = await prisma.user.create({
        data: {
          discordId: discordUser.id,
          username: discordUser.username,
          discriminator: discordUser.discriminator,
          avatar: discordUser.avatar,
          email: discordUser.email
        }
      });
    } else {
      // Update user info
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          username: discordUser.username,
          discriminator: discordUser.discriminator,
          avatar: discordUser.avatar,
          lastLogin: new Date()
        }
      });
    }

    // Store user in session
    req.session.userId = user.id;
    req.session.user = {
      id: user.discordId,
      username: user.username,
      discriminator: user.discriminator,
      avatar: user.avatar,
      email: user.email
    };

    // Explicitly save session
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ error: 'Failed to save session' });
      }
      console.log('Session saved successfully for user:', user.username);
      res.json({ success: true });
    });
  } catch (error) {
    console.error('Discord auth error:', error.response?.data || error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Get current user
router.get('/me', (req, res) => {
  console.log('Auth check - Session ID:', req.sessionID);
  console.log('Auth check - Session user:', req.session.user);
  
  if (req.session.user) {
    res.json(req.session.user);
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Could not log out' });
    }
    res.json({ success: true });
  });
});

export default router;