FROM node:20-alpine

WORKDIR /app

# Copy backend package files and install dependencies
COPY backend/package*.json ./
RUN npm install --install-strategy=shallow

# Copy all app directories
COPY backend/ ./backend/
COPY web/dist/ ./web/dist/
COPY public/ ./public/
COPY uploads/ ./uploads/
COPY data/ ./data/
COPY desktop/ ./desktop/

# Copy entrypoint script
COPY entrypoint.sh ./

EXPOSE 4000

# Use bootstrap.js as entry point
# bootstrap.js loads .env files then imports server.js
CMD ["node", "backend/src/bootstrap.js"]