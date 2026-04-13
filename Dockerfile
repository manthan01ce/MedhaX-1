# Use full Node.js 18 image (includes build tools needed for native modules like better-sqlite3)
FROM node:18

# Set working directory
WORKDIR /app

# Copy root package files
COPY package*.json ./
# Copy backend package files
COPY backend/package*.json ./backend/

# Install dependencies for backend (ignore scripts to prevent early seed execution)
RUN cd backend && npm install --omit=dev --ignore-scripts

# Copy all application code
COPY . .

# Run the seeding script manually after files are copied
RUN cd backend && node server/seed.js

# Create data directory for SQLite
RUN mkdir -p backend/data

# Expose port 3000
EXPOSE 3000

# Start from the root
CMD ["npm", "start"]