# Use full Node.js 18 image (includes build tools needed for native modules like better-sqlite3)
FROM node:18

# Set working directory
WORKDIR /app

# Copy root package files
COPY package*.json ./
# Copy backend package files
COPY backend/package*.json ./backend/

# Install dependencies for backend (RE-ENABLED scripts for native module compilation)
RUN cd backend && npm install --omit=dev

# Copy all application code
COPY . .

# Explicitly rebuild better-sqlite3 to ensure binaries match the environment
RUN cd backend && npm rebuild better-sqlite3

# Run the seeding script manually after files are copied
RUN cd backend && node server/seed.js

# Create data directory for SQLite
RUN mkdir -p backend/data

# Expose port 3000
EXPOSE 3000

# Start from the root
CMD ["npm", "start"]