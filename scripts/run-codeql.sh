#!/bin/bash
# Script to run CodeQL analysis locally
# Requires CodeQL CLI to be installed: https://github.com/github/codeql-cli-binaries

set -e

echo "🔍 Running CodeQL Analysis..."

# Check if codeql is installed
if ! command -v codeql &> /dev/null; then
    echo "❌ CodeQL CLI not found. Please install it first:"
    echo "   brew install codeql  # On macOS"
    echo "   Or download from: https://github.com/github/codeql-cli-binaries/releases"
    exit 1
fi

# Download query packs if needed
echo "📥 Downloading CodeQL query packs..."
codeql pack download codeql/javascript-queries

# Create database
echo "📦 Creating CodeQL database..."
codeql database create codeql-db \
    --language=javascript \
    --source-root=. \
    --overwrite

# Run analysis
echo "🔎 Running security queries..."
codeql database analyze codeql-db \
    --format=sarif-latest \
    --output=codeql-results.sarif \
    --sarif-category=javascript \
    codeql/javascript-queries:codeql-suites/javascript-security-extended.qls

# Generate human-readable report
echo "📊 Generating report..."
codeql database analyze codeql-db \
    --format=csv \
    --output=codeql-results.csv \
    codeql/javascript-queries:codeql-suites/javascript-security-extended.qls

echo "✅ Analysis complete!"
echo "   SARIF results: codeql-results.sarif"
echo "   CSV results: codeql-results.csv"
echo ""
echo "To upload results to GitHub:"
echo "   codeql github upload-results --sarif=codeql-results.sarif --repository=snizzleorg/supportplanner"
