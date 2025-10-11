#!/bin/bash
# Run all tests (backend + frontend) in Docker

set -e  # Exit on first failure

echo "🧪 Running Backend Unit Tests..."
docker compose run --rm backend-tests

echo ""
echo "🌐 Running Frontend Integration Tests..."
docker compose run --rm frontend-tests

echo ""
echo "✅ All tests passed!"
