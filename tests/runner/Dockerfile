# Puppeteer base image that bundles a compatible Chromium
FROM ghcr.io/puppeteer/puppeteer:22.12.1

WORKDIR /runner

# Copy test runner package and install deps
COPY tests/runner/package.json tests/runner/package-lock.json* ./
# Use npm ci when lockfile exists, else npm install. Disable audit/fund to reduce noise.
RUN if [ -f package-lock.json ]; then \
      npm ci --no-audit --no-fund; \
    else \
      npm install --no-audit --no-fund; \
    fi

# Copy runner script and public tests
COPY tests/runner/run-tests.mjs ./run-tests.mjs
COPY tests/runner/css-audit.mjs ./css-audit.mjs
COPY public/tests ./public/tests
COPY public/js ./public/js
COPY public/styles.css ./public/styles.css

# Copy backend source and config for unit tests
COPY src ./src
COPY config ./config
COPY vitest.config.js ./vitest.config.js
COPY package.json ./package.json

# Install vitest and required dependencies for backend tests
# Note: Do NOT install puppeteer here - it's already in the base image with Chrome
USER root
RUN npm install --no-save vitest@^1.0.4 @vitest/coverage-v8@^1.0.4 \
    express@^4.19.2 express-validator@^7.2.0 supertest@^6.3.3 dayjs@^1.11.13 \
    cors@^2.8.5 helmet@^8.0.0 express-rate-limit@^7.4.1 express-session@^1.17.3 \
    openid-client@^5.6.5 node-cache@^5.1.2 yaml@^2.4.2 tsdav@^2.1.2 \
    ical-expander@^3.1.0 node-fetch@^3.3.2 && \
    chmod -R 777 /tmp && \
    chmod -R 777 /runner/node_modules

# Runtime env
ENV PUPPETEER_PRODUCT=chrome
ENV NODE_ENV=test
ENV TMPDIR=/tmp
ENV SKIP_SESSION_SECRET_CHECK=true
ENV AUTH_ENABLED=false

# Run as root to avoid permission issues with vitest
# (Puppeteer tests will still work as root in Docker)
# Default command expects APP_URL to be provided, e.g. http://app:3000
CMD ["node", "run-tests.mjs"]
