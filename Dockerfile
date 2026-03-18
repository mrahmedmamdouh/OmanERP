FROM node:20-alpine

WORKDIR /app

# Copy package file (no lock file needed)
COPY package.json ./

# Install production dependencies only
RUN npm install --omit=dev

# Copy source code
COPY api/ ./api/
COPY database/ ./database/

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

CMD ["node", "api/server.js"]
