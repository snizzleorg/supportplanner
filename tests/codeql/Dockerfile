# CodeQL Security Analysis Container
# Note: Uses linux/amd64 platform (works on both x86_64 and ARM64 via emulation)
FROM ubuntu:22.04

# Install dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    unzip \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Install CodeQL CLI (x86_64 version)
# Works on ARM64 via Docker's QEMU emulation
WORKDIR /opt
RUN CODEQL_VERSION="2.19.3" && \
    echo "Downloading CodeQL v${CODEQL_VERSION} (x86_64)..." && \
    curl -L "https://github.com/github/codeql-cli-binaries/releases/download/v${CODEQL_VERSION}/codeql-linux64.zip" -o codeql.zip && \
    unzip codeql.zip && \
    rm codeql.zip && \
    chmod +x /opt/codeql/codeql

# Add CodeQL to PATH
ENV PATH="/opt/codeql:${PATH}"

# Download JavaScript query pack
RUN codeql pack download codeql/javascript-queries

# Set working directory
WORKDIR /app

# Copy source code
COPY . .

# Create output directory
RUN mkdir -p /app/test-results

# Default command runs the analysis
CMD ["sh", "-c", "\
    echo '🔍 Running CodeQL Security Analysis...' && \
    echo '📦 Creating CodeQL database...' && \
    codeql database create /tmp/codeql-db \
        --language=javascript \
        --source-root=/app \
        --overwrite && \
    echo '🔎 Running security queries...' && \
    codeql database analyze /tmp/codeql-db \
        --format=sarif-latest \
        --output=/app/test-results/codeql-results.sarif \
        --sarif-category=javascript \
        codeql/javascript-queries:codeql-suites/javascript-security-extended.qls && \
    echo '📊 Generating human-readable report...' && \
    codeql database analyze /tmp/codeql-db \
        --format=csv \
        --output=/app/test-results/codeql-results.csv \
        codeql/javascript-queries:codeql-suites/javascript-security-extended.qls && \
    echo '✅ CodeQL analysis complete!' && \
    echo '   Results saved to test-results/' && \
    echo '' && \
    echo '📋 Summary:' && \
    wc -l /app/test-results/codeql-results.csv | awk '{print \"   Total findings: \" $1-1}' && \
    grep -c '\"error\"' /app/test-results/codeql-results.csv | awk '{print \"   High severity: \" $1}' || echo '   High severity: 0' && \
    grep -c '\"warning\"' /app/test-results/codeql-results.csv | awk '{print \"   Medium severity: \" $1}' || echo '   Medium severity: 0' \
"]
