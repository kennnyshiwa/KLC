import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import cors from 'cors';
import dotenv from 'dotenv';
import pg from 'pg';
import { PrismaClient } from '../generated/prisma/index.js';
import authRoutes from './routes/auth.js';
import layoutRoutes from './routes/layouts.js';
import githubRoutes from './routes/github.js';
import playtimeRoutes from './routes/playtime.js';

// Load environment variables (only in development)
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// Debug: Log GitHub-related env vars
console.log('GitHub Environment Variables:', {
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID ? 'Set' : 'Not set',
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET ? 'Set' : 'Not set',
  GITHUB_REDIRECT_URI: process.env.GITHUB_REDIRECT_URI || 'Not set'
});

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy when running behind nginx
app.set('trust proxy', 1);

// Initialize Prisma
export const prisma = new PrismaClient();

// Test database connection
prisma.$connect()
  .then(() => console.log('Connected to PostgreSQL'))
  .catch(err => console.error('PostgreSQL connection error:', err));

// Initialize PostgreSQL session store
const pgSession = connectPgSimple(session);
const pgPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow the configured frontend URL
    const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
    if (origin === allowedOrigin) {
      return callback(null, true);
    }
    
    // In production, be more restrictive
    if (process.env.NODE_ENV === 'production') {
      return callback(new Error('Not allowed by CORS'));
    }
    
    // In development, allow all origins
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Session configuration
const sessionConfig = {
  store: new pgSession({
    pool: pgPool,
    tableName: 'Session',
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false, // Don't save empty sessions for public endpoints
  name: 'kle.sid', // Custom session cookie name
  cookie: {
    secure: false, // Temporarily disabled to test - nginx handles HTTPS
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    sameSite: 'lax', // Changed from 'strict' to allow cookies after OAuth redirect
    path: '/',
    domain: undefined // Explicitly set to undefined
  }
};

console.log('Session config:', {
  ...sessionConfig,
  secret: '[HIDDEN]',
  cookie: sessionConfig.cookie
});

app.use(session(sessionConfig));

// Debug middleware to log headers
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - Cookie header:`, req.headers.cookie || 'No cookies');
  res.on('finish', () => {
    console.log(`Response ${res.statusCode} - Set-Cookie:`, res.getHeader('set-cookie') || 'No set-cookie');
  });
  next();
});

// Config endpoint
app.get('/api/config', (req, res) => {
  res.json({
    discordClientId: process.env.DISCORD_CLIENT_ID,
    // Add other public config values here
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/layouts', layoutRoutes);
app.use('/api/github', githubRoutes);
app.use('/api/playtime', playtimeRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});