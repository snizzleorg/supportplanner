# Runner image for automated browser tests using Puppeteer
FROM node:20-bullseye

# Install Chromium dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 \
    libc6 libcap2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libglib2.0-0 \
    libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 \
    libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxdamage1 \
    libxext6 libxfixes3 libxrandr2 libxrender1 libxshmfence1 libxss1 \
    libxtst6 libxkbcommon0 libgbm1 lsb-release wget xdg-utils \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /runner

# Copy test runner package and install deps
COPY tests/runner/package.json tests/runner/package-lock.json* ./
# Use npm ci when lockfile exists, else npm install. Disable audit/fund to reduce noise.
RUN if [ -f package-lock.json ]; then \
      npm ci --no-audit --no-fund; \
    else \
      npm install --no-audit --no-fund; \
    fi

# Copy runner script
# Copy runner script and public tests
COPY tests/runner/run-tests.mjs ./run-tests.mjs
COPY tests/runner/css-audit.mjs ./css-audit.mjs
COPY public/tests ./public/tests
COPY public/js ./public/js
COPY public/styles.css ./public/styles.css

# Runtime env
ENV PUPPETEER_PRODUCT=chrome
ENV NODE_ENV=production

# Default command expects APP_URL to be provided, e.g. http://app:3000
CMD ["node", "run-tests.mjs"]
