# Build a small image for the Node/Express server
FROM node:20-alpine

# Install ca-certificates for HTTPS requests
RUN apk add --no-cache ca-certificates

# Create app directory
WORKDIR /usr/src/support-planner

# Install dependencies first (leverage Docker layer caching)
COPY package.json ./
RUN npm install --production=false

# Copy the rest of the app (config is now in src/config/)
COPY . .

# Expose the port (default 5173)
EXPOSE 5173

# Run the server
CMD ["npm", "run", "start"]
