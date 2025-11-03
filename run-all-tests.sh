#!/bin/bash
# Run all tests (backend + frontend + security) in Docker

set -e  # Exit on first failure

echo "🧪 Running Backend Unit Tests..."
docker compose run --rm backend-tests

echo ""
echo "🌐 Running Frontend Integration Tests..."
docker compose run --rm frontend-tests

echo ""
echo "🔒 Running CodeQL Security Analysis..."
docker compose run --rm codeql-tests

echo ""
echo "✅ All tests passed!"
echo ""
echo "📊 Test Results:"
echo "   - Backend: See container output above"
echo "   - Frontend: See container output above"
echo "   - Security: test-results/codeql-results.csv"
