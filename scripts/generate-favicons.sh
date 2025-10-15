#!/bin/bash

# Generate PNG favicons from SVG
# Requires: imagemagick (brew install imagemagick)

cd "$(dirname "$0")/.."

SVG_FILE="public/favicon.svg"

if [ ! -f "$SVG_FILE" ]; then
  echo "Error: $SVG_FILE not found"
  exit 1
fi

# Check if convert command exists
if ! command -v convert &> /dev/null; then
  echo "Error: ImageMagick not installed"
  echo "Install with: brew install imagemagick"
  exit 1
fi

echo "Generating PNG favicons from SVG..."

# Generate different sizes
convert -background none "$SVG_FILE" -resize 16x16 public/favicon-16x16.png
echo "✓ Generated favicon-16x16.png"

convert -background none "$SVG_FILE" -resize 32x32 public/favicon-32x32.png
echo "✓ Generated favicon-32x32.png"

convert -background none "$SVG_FILE" -resize 180x180 public/apple-touch-icon.png
echo "✓ Generated apple-touch-icon.png"

convert -background none "$SVG_FILE" -resize 192x192 public/icon-192.png
echo "✓ Generated icon-192.png"

convert -background none "$SVG_FILE" -resize 512x512 public/icon-512.png
echo "✓ Generated icon-512.png"

echo ""
echo "✅ All favicons generated successfully!"
