import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import cors from 'cors';
import dotenv from 'dotenv';
import pg from 'pg';
import { PrismaClient } from '../generated/prisma/index.js';
import authRoutes from './routes/auth.js';
import layoutRoutes from './routes/layouts.js';

// Load environment variables (only in development)
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// Debug: Log Discord client ID (first few chars only for security)
console.log('Discord Client ID:', process.env.DISCORD_CLIENT_ID ? process.env.DISCORD_CLIENT_ID.substring(0, 6) + '...' : 'NOT SET');
console.log('Discord Redirect URI:', process.env.DISCORD_REDIRECT_URI || 'NOT SET');

const app = express();
const PORT = process.env.PORT || 3001;

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
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());

app.use(session({
  store: new pgSession({
    pool: pgPool,
    tableName: 'Session',
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
  }
}));

// Config endpoint
app.get('/config', (req, res) => {
  res.json({
    discordClientId: process.env.DISCORD_CLIENT_ID,
    // Add other public config values here
  });
});

// Routes
app.use('/auth', authRoutes);
app.use('/api/layouts', layoutRoutes);

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