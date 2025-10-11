# Frontend unit test runner - Vitest with jsdom
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies (including devDependencies for testing)
RUN npm ci --no-audit --no-fund

# Copy source code and tests
COPY vitest.config.frontend.js ./
COPY public/js ./public/js

# Runtime env
ENV NODE_ENV=test

# Run unit tests
CMD ["npm", "run", "test:frontend"]
