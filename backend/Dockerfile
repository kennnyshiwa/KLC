FROM node:20-alpine

# Install PostgreSQL client for pg_isready
RUN apk add --no-cache postgresql-client

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --only=production

# Generate Prisma client
RUN npx prisma generate

# Copy source files and entrypoint
COPY src ./src
COPY docker-entrypoint.sh ./

# Make entrypoint executable
RUN chmod +x docker-entrypoint.sh

# Expose port
EXPOSE 3001

# Use entrypoint script
ENTRYPOINT ["./docker-entrypoint.sh"]