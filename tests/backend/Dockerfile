# Backend test runner - lightweight Node.js image for unit tests
FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package.json ./

# Install only the dependencies needed for backend tests
RUN npm install --no-save vitest@^1.0.4 @vitest/coverage-v8@^1.0.4 \
    express@^4.19.2 express-validator@^7.2.0 supertest@^6.3.3 dayjs@^1.11.13 \
    cors@^2.8.5 helmet@^8.0.0 express-rate-limit@^7.4.1 express-session@^1.17.3 \
    openid-client@^5.6.5 node-cache@^5.1.2 yaml@^2.4.2 tsdav@^2.1.2 \
    ical-expander@^3.1.0 node-fetch@^3.3.2

# Copy source code and test configuration
COPY src ./src
COPY config ./config
COPY vitest.config.js ./vitest.config.js

# Set test environment
ENV NODE_ENV=test
ENV SKIP_SESSION_SECRET_CHECK=true
ENV AUTH_ENABLED=false

# Run tests
CMD ["npx", "vitest", "run", "--reporter=verbose"]
