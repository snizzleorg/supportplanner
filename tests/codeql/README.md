# CodeQL Security Tests

This directory contains the Docker-based CodeQL security analysis infrastructure.

## Overview

CodeQL is GitHub's semantic code analysis engine that finds security vulnerabilities and coding errors. This test container runs comprehensive security scans on the JavaScript codebase.

## Running CodeQL Tests

### Quick Start

```bash
# Run CodeQL analysis
docker compose run --rm codeql-tests

# Results will be in test-results/
ls -lh test-results/codeql-results.*
```

### View Results

```bash
# Human-readable CSV format
cat test-results/codeql-results.csv

# Or open in your editor
code test-results/codeql-results.csv

# Machine-readable SARIF format (for tools)
cat test-results/codeql-results.sarif
```

### Rebuild Container (after CodeQL updates)

```bash
docker compose build codeql-tests
```

## What CodeQL Checks

The security-extended query suite includes:

### Critical & High Severity
- **XSS (Cross-Site Scripting)** - Injection of malicious scripts
- **SQL Injection** - Database query manipulation
- **Command Injection** - OS command execution
- **Path Traversal** - Unauthorized file access
- **SSRF (Server-Side Request Forgery)** - Unauthorized network requests
- **ReDoS** - Regular expression denial of service
- **Prototype Pollution** - JavaScript object manipulation

### Medium Severity
- **Log Injection** - Log file manipulation
- **Information Disclosure** - Sensitive data exposure
- **Missing Authentication** - Unprotected endpoints
- **Missing CSRF Protection** - Cross-site request forgery
- **Insecure Randomness** - Weak random number generation
- **Clear Text Secrets** - Hardcoded credentials

### Code Quality
- **Unused Variables** - Dead code detection
- **Type Errors** - JavaScript type issues
- **Deprecated APIs** - Outdated function usage

## Understanding Results

### CSV Format
```csv
"Name","Description","Severity","Message","Path","Start line","Start column","End line","End column"
"XSS","Cross-site scripting vulnerability","error","User input flows to HTML output","/src/file.js","42","10","42","25"
```

### Severity Levels
- **error** - High severity, fix immediately
- **warning** - Medium severity, should fix
- **note** - Low severity, informational

## Integration with CI/CD

### Local Development
```bash
# Run before committing
docker compose run --rm codeql-tests
```

### Test Script Integration
Add to `run-all-tests.sh`:
```bash
echo "Running CodeQL security analysis..."
docker compose run --rm codeql-tests
```

## Current Status

All critical security issues have been addressed:
- ✅ XSS vulnerabilities fixed (escapeHtml utility)
- ✅ ReDoS vulnerabilities fixed (safe string parsing)
- ✅ Format string attacks fixed (sanitized logging)
- ✅ CSRF protection enabled
- ✅ Rate limiting configured

Remaining findings are mostly:
- Log injection warnings (low risk, sanitized)
- False positives (documented in docs/CODEQL_FIXES.md)

## Troubleshooting

### Container Build Fails
```bash
# Clean rebuild
docker compose build --no-cache codeql-tests
```

### Analysis Takes Too Long
The first run downloads query packs (~500MB) and may take 5-10 minutes. Subsequent runs are faster (~2-3 minutes) as the packs are cached in the image.

### Out of Memory
If analysis fails with OOM:
```bash
# Increase Docker memory limit to 4GB+
# Docker Desktop → Settings → Resources → Memory
```

## Files

- `Dockerfile` - CodeQL container definition
- `README.md` - This file
- `../../test-results/codeql-results.csv` - Human-readable results
- `../../test-results/codeql-results.sarif` - Machine-readable results

## References

- [CodeQL Documentation](https://codeql.github.com/docs/)
- [JavaScript Query Suite](https://github.com/github/codeql/tree/main/javascript/ql/src)
- [SARIF Format](https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html)
- [Security Fixes Documentation](../../docs/CODEQL_FIXES.md)
