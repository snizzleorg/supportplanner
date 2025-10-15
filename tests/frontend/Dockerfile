# Frontend test runner - Puppeteer base image with Chromium
FROM ghcr.io/puppeteer/puppeteer:22.12.1

WORKDIR /runner

# Copy test runner package and install deps
COPY tests/frontend/package.json tests/frontend/package-lock.json* ./
# Use npm ci when lockfile exists, else npm install. Disable audit/fund to reduce noise.
RUN if [ -f package-lock.json ]; then \
      npm ci --no-audit --no-fund; \
    else \
      npm install --no-audit --no-fund; \
    fi

# Copy runner script and public tests (public is now public-legacy)
COPY tests/frontend/run-tests.mjs ./run-tests.mjs
COPY tests/frontend/css-audit.mjs ./css-audit.mjs
COPY public-legacy/tests ./public-legacy/tests
COPY public-legacy/js ./public-legacy/js
COPY public-legacy/styles.css ./public-legacy/styles.css

# Runtime env
ENV PUPPETEER_PRODUCT=chrome
ENV NODE_ENV=production

# Default command expects APP_URL to be provided, e.g. http://app:3000
CMD ["node", "run-tests.mjs"]
