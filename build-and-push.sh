#!/bin/bash
set -e

# Build and Push Script for Support Planner
# This script builds multi-architecture Docker images (AMD64 + ARM64) and pushes to Docker Hub
# Usage: 
#   ./build-and-push.sh           # Uses version from package.json
#   ./build-and-push.sh v1.0.0    # Uses specified version
#   ./build-and-push.sh latest    # Uses 'latest' tag

# Configuration
DOCKER_USERNAME="${DOCKER_USERNAME:-}"
IMAGE_NAME="support-planner"
FULL_IMAGE_NAME="${DOCKER_USERNAME}/${IMAGE_NAME}"
BUILDER_NAME="multiarch-builder"

if [ -z "${DOCKER_USERNAME}" ]; then
    echo "❌ Error: DOCKER_USERNAME is not set."
    echo "Set it to your Docker Hub username (must own/push to the repository):"
    echo "  export DOCKER_USERNAME=your-dockerhub-username"
    exit 1
fi

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

# Preflight: try to access the repository metadata to catch auth/repo issues early.
# We intentionally don't rely on `docker info | grep Username` since it can be unreliable across Docker Desktop versions.
INSPECT_OUTPUT=$(docker buildx imagetools inspect "${FULL_IMAGE_NAME}:latest" 2>&1) || true
if [ -n "${INSPECT_OUTPUT}" ]; then
    if echo "${INSPECT_OUTPUT}" | grep -qiE "(unauthorized|authentication required|insufficient_scope|denied|forbidden)"; then
        echo "❌ Error: Not authenticated to push to Docker Hub for ${FULL_IMAGE_NAME}."
        echo "Run: docker login"
        exit 1
    fi

    echo "⚠️  Warning: Unable to inspect ${FULL_IMAGE_NAME}:latest on Docker Hub."
    echo "If push fails, ensure the repository exists and your account has permission to push."
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
