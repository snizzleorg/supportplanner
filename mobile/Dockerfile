# Mobile app Docker image with Capacitor support
FROM node:20-alpine

# Install dependencies for Capacitor and mobile development
RUN apk add --no-cache \
    ca-certificates \
    openjdk11-jre \
    android-tools

# Create app directory
WORKDIR /usr/src/mobile-planner

# Install dependencies first (leverage Docker layer caching)
COPY mobile/package.json ./
RUN npm install

# Copy mobile app files
COPY mobile/ ./

# Expose the port for mobile dev server
EXPOSE 5174

# Run the mobile dev server
CMD ["npm", "run", "dev"]
