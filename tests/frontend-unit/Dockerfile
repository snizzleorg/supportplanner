# Frontend unit test runner - Vitest with jsdom
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies (including devDependencies for testing)
RUN npm install --no-audit --no-fund

# Copy source code and tests (public is now public-legacy)
COPY vitest.config.frontend.js ./
COPY public-legacy/js ./public-legacy/js

# Runtime env
ENV NODE_ENV=test

# Run unit tests
CMD ["npm", "run", "test:frontend"]
