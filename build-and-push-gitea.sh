#!/bin/bash
set -e

# Build and Push Script for Support Planner - Gitea Registry
# This script builds Docker images and pushes to Gitea
# Note: Builds for current platform only (no multi-arch due to Gitea SSL certificate limitations)
# Usage: 
#   ./build-and-push-gitea.sh           # Uses version from package.json
#   ./build-and-push-gitea.sh v1.0.0    # Uses specified version
#   ./build-and-push-gitea.sh latest    # Uses 'latest' tag
#
# Environment variables:
#   GITEA_USERNAME  - Gitea username (default: ruettinger)
#   GITEA_PASSWORD  - Gitea password or personal access token (required for non-interactive)
#   GITEA_REGISTRY  - Gitea registry URL (default: git.b.picoquant.com)

# Configuration
GITEA_USERNAME="${GITEA_USERNAME:-ruettinger}"
GITEA_PASSWORD="${GITEA_PASSWORD:-}"  # Can also be a personal access token
GITEA_REGISTRY="${GITEA_REGISTRY:-git.b.picoquant.com}"
IMAGE_NAME="support-planner"
FULL_IMAGE_NAME="${GITEA_REGISTRY}/${GITEA_USERNAME}/${IMAGE_NAME}"

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
echo "Building and pushing Support Planner to Gitea"
echo "Multi-architecture: AMD64 (x86_64) + ARM64 (Apple Silicon)"
echo "================================================"
echo "Registry: ${GITEA_REGISTRY}"
echo "Image: ${FULL_IMAGE_NAME}"
echo "Version: ${VERSION}"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running. Please start Docker and try again."
    exit 1
fi

# Login to Gitea registry
echo "🔐 Authenticating to Gitea registry..."
# Remove any existing credentials to avoid keychain conflicts
docker logout "${GITEA_REGISTRY}" > /dev/null 2>&1 || true
if [ -n "${GITEA_PASSWORD}" ]; then
    echo "${GITEA_PASSWORD}" | docker login "${GITEA_REGISTRY}" -u "${GITEA_USERNAME}" --password-stdin
else
    echo "GITEA_PASSWORD not set, attempting interactive login..."
    docker login "${GITEA_REGISTRY}" -u "${GITEA_USERNAME}"
fi

# Build image for current platform
echo ""
echo "� Building Docker image..."
echo ""

if [ "${VERSION}" != "latest" ]; then
    docker build \
        --tag "${FULL_IMAGE_NAME}:${VERSION}" \
        --tag "${FULL_IMAGE_NAME}:latest" \
        .
    
    echo ""
    echo "📤 Pushing to Gitea..."
    docker push "${FULL_IMAGE_NAME}:${VERSION}"
    docker push "${FULL_IMAGE_NAME}:latest"
    
    echo ""
    echo "✅ Successfully pushed to Gitea!"
    echo ""
    echo "Images pushed:"
    echo "  - ${FULL_IMAGE_NAME}:${VERSION}"
    echo "  - ${FULL_IMAGE_NAME}:latest"
else
    docker build \
        --tag "${FULL_IMAGE_NAME}:latest" \
        .
    
    echo ""
    echo "📤 Pushing to Gitea..."
    docker push "${FULL_IMAGE_NAME}:latest"
    
    echo ""
    echo "✅ Successfully pushed to Gitea!"
    echo ""
    echo "Images pushed:"
    echo "  - ${FULL_IMAGE_NAME}:latest"
fi

echo ""
echo "To pull the image:"
echo "  docker pull ${FULL_IMAGE_NAME}:${VERSION}"
echo ""
