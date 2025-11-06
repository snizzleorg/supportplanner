#!/bin/bash
set -e

# Build and Push Script for Support Planner
# This script builds multi-architecture Docker images (AMD64 + ARM64) and pushes to Docker Hub
# Usage: 
#   ./build-and-push.sh           # Uses version from package.json
#   ./build-and-push.sh v1.0.0    # Uses specified version
#   ./build-and-push.sh latest    # Uses 'latest' tag

# Configuration
DOCKER_USERNAME="universaldilettant"
IMAGE_NAME="support-planner"
FULL_IMAGE_NAME="${DOCKER_USERNAME}/${IMAGE_NAME}"
BUILDER_NAME="multiarch-builder"

# Get version from argument, or extract from package.json, or default to 'latest'
if [ -n "$1" ]; then
    VERSION="$1"
elif [ -f "package.json" ]; then
    # Extract version from package.json using grep and sed
    PACKAGE_VERSION=$(grep '"version"' package.json | head -1 | sed 's/.*"version": "\(.*\)".*/\1/')
    if [ -n "$PACKAGE_VERSION" ]; then
        VERSION="v${PACKAGE_VERSION}"
        echo "📦 Using version from package.json: ${VERSION}"
    else
        VERSION="latest"
        echo "⚠️  Could not extract version from package.json, using 'latest'"
    fi
else
    VERSION="latest"
    echo "⚠️  package.json not found, using 'latest'"
fi

echo "================================================"
echo "Building and pushing Support Planner to Docker Hub"
echo "Multi-architecture: AMD64 (x86_64) + ARM64 (Apple Silicon)"
echo "================================================"
echo "Image: ${FULL_IMAGE_NAME}"
echo "Version: ${VERSION}"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if logged into Docker Hub
if ! docker info | grep -q "Username"; then
    echo "⚠️  Warning: You may not be logged into Docker Hub."
    echo "Run 'docker login' if the push fails."
    echo ""
fi

# Check if buildx is available
if ! docker buildx version > /dev/null 2>&1; then
    echo "❌ Error: Docker buildx is not available. Please update Docker to a newer version."
    exit 1
fi

# Create or use existing buildx builder
echo "🔧 Setting up multi-architecture builder..."
if ! docker buildx inspect "${BUILDER_NAME}" > /dev/null 2>&1; then
    echo "Creating new builder: ${BUILDER_NAME}"
    docker buildx create --name "${BUILDER_NAME}" --use
else
    echo "Using existing builder: ${BUILDER_NAME}"
    docker buildx use "${BUILDER_NAME}"
fi

# Bootstrap the builder (ensures it's ready)
docker buildx inspect --bootstrap

# Build and push multi-architecture image
echo ""
echo "🔨 Building multi-architecture Docker image..."
echo "Platforms: linux/amd64, linux/arm64"
echo ""

if [ "${VERSION}" != "latest" ]; then
    # Build and push both version tag and latest tag
    docker buildx build \
        --platform linux/amd64,linux/arm64 \
        --tag "${FULL_IMAGE_NAME}:${VERSION}" \
        --tag "${FULL_IMAGE_NAME}:latest" \
        --push \
        .
    
    echo ""
    echo "✅ Successfully pushed to Docker Hub!"
    echo ""
    echo "Images pushed (multi-arch):"
    echo "  - ${FULL_IMAGE_NAME}:${VERSION}"
    echo "  - ${FULL_IMAGE_NAME}:latest"
else
    # Build and push only latest tag
    docker buildx build \
        --platform linux/amd64,linux/arm64 \
        --tag "${FULL_IMAGE_NAME}:latest" \
        --push \
        .
    
    echo ""
    echo "✅ Successfully pushed to Docker Hub!"
    echo ""
    echo "Images pushed (multi-arch):"
    echo "  - ${FULL_IMAGE_NAME}:latest"
fi

echo ""
echo "Architectures included:"
echo "  - linux/amd64 (Intel/AMD x86_64)"
echo "  - linux/arm64 (Apple Silicon, ARM servers)"
echo ""
echo "To use in Portainer, update your docker-compose.portainer.yml to use:"
echo "  image: ${FULL_IMAGE_NAME}:${VERSION}"
echo ""
echo "Docker will automatically pull the correct architecture for your platform."
echo ""
