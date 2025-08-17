# KLC Backend

Backend API server for KLC with Discord authentication and layout storage using PostgreSQL.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env` and fill in your values:
```bash
cp .env.example .env
```

3. Set up PostgreSQL:
   - Install PostgreSQL locally or use a hosted service
   - Create a database named `klc`
   - Update `DATABASE_URL` in `.env` with your connection string

4. Run database migrations:
```bash
npx prisma migrate dev --name init
```

5. Generate Prisma client:
```bash
npx prisma generate
```

6. Set up Discord OAuth:
   - Go to https://discord.com/developers/applications
   - Create a new application
   - Go to OAuth2 section
   - Add redirect URI: `http://localhost:5173/auth/callback`
   - Copy Client ID and Client Secret to `.env`

7. Start the server:
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

## API Endpoints

### Authentication
- `POST /auth/discord/callback` - Handle Discord OAuth callback
- `GET /auth/me` - Get current user info
- `POST /auth/logout` - Logout user

### Layouts
- `GET /api/layouts` - Get all user's layouts
- `GET /api/layouts/:id` - Get specific layout
- `POST /api/layouts` - Create new layout
- `PUT /api/layouts/:id` - Update layout
- `DELETE /api/layouts/:id` - Delete layout

## Environment Variables

- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment (development/production)
- `SESSION_SECRET` - Secret for session encryption
- `DISCORD_CLIENT_ID` - Discord OAuth client ID
- `DISCORD_CLIENT_SECRET` - Discord OAuth client secret
- `DISCORD_REDIRECT_URI` - OAuth redirect URI
- `DATABASE_URL` - PostgreSQL connection string
- `FRONTEND_URL` - Frontend URL for CORS

## Database Management

```bash
# View database in Prisma Studio
npx prisma studio

# Create a new migration
npx prisma migrate dev --name your_migration_name

# Apply migrations in production
npx prisma migrate deploy
```