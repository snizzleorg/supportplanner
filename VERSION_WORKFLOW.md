# Version Management Workflow

This document explains how version management works with automatic detection from `package.json`.

## How It Works

The build script automatically reads the version from `package.json` and prefixes it with `v`:

```json
// package.json
{
  "version": "0.10.0"
}
```

```bash
./build-and-push.sh
# Builds and pushes: v0.10.0 and latest
```

## Release Workflow

### 1. Update Version in package.json

```bash
# Edit package.json
{
  "name": "supportplanner",
  "version": "0.10.0",  // ← Update this
  ...
}
```

### 2. Commit the Version Change

```bash
git add package.json
git commit -m "Bump version to 0.10.0"
git push
```

### 3. Build and Push to Docker Hub

```bash
# Script automatically uses v0.10.0 from package.json
./build-and-push.sh
```

Output:
```
📦 Using version from package.json: v0.10.0
================================================
Building and pushing Support Planner to Docker Hub
Multi-architecture: AMD64 (x86_64) + ARM64 (Apple Silicon)
================================================
Image: your-username/support-planner
Version: v0.10.0
...
```

### 4. Deploy to Portainer

Update the `IMAGE_VERSION` environment variable in Portainer to `v0.10.0` and redeploy.

Or, if using `latest`, just click "Pull and redeploy".

## Version Override

You can still override the version manually:

```bash
# For development builds
./build-and-push.sh dev

# For release candidates
./build-and-push.sh v1.0.0-rc1

# For hotfixes
./build-and-push.sh v0.10.1-hotfix
```

## Semantic Versioning Guidelines

Follow semantic versioning in `package.json`:

- **Major version** (`1.0.0` → `2.0.0`): Breaking changes
- **Minor version** (`1.0.0` → `1.1.0`): New features, backward compatible
- **Patch version** (`1.0.0` → `1.0.1`): Bug fixes, backward compatible

### Examples

```json
// New feature release
"version": "0.10.0" → "0.11.0"

// Bug fix
"version": "0.10.0" → "0.10.1"

// Major release with breaking changes
"version": "0.9.5" → "1.0.0"
```

## Pre-release Versions

For pre-release versions, use manual override:

```bash
# Update package.json to 1.0.0-beta
{
  "version": "1.0.0-beta"
}

# Build
./build-and-push.sh
# Creates: v1.0.0-beta

# Or override manually
./build-and-push.sh v1.0.0-beta.1
```

## Checking Current Version

### In package.json
```bash
grep version package.json
```

### On Docker Hub
Visit: `https://hub.docker.com/r/your-username/support-planner/tags`

### In Running Container
```bash
docker exec support-planner cat package.json | grep version
```

## Best Practices

1. **Always update package.json first** - This keeps your codebase and Docker images in sync
2. **Commit before building** - Ensures the version in Git matches the Docker image
3. **Use semantic versioning** - Makes it clear what changed between versions
4. **Tag Git commits** - Match Docker tags with Git tags for traceability

### Example Complete Workflow

```bash
# 1. Update version
vim package.json  # Change "version": "0.10.0" to "0.11.0"

# 2. Commit
git add package.json
git commit -m "Release v0.10.0: Add new feature X"
git tag v0.10.0
git push origin main --tags

# 3. Build and push Docker image
./build-and-push.sh  # Automatically uses v0.10.0

# 4. Deploy
# Update IMAGE_VERSION in Portainer to v0.10.0 and redeploy
```

## Troubleshooting

### Script uses 'latest' instead of package.json version

Check if `package.json` exists in the current directory:
```bash
ls -la package.json
```

Verify the version format in `package.json`:
```bash
grep '"version"' package.json
```

### Version has extra characters

The script extracts only the version number. If you see issues:
```bash
# Debug: Check what version is extracted
grep '"version"' package.json | head -1 | sed 's/.*"version": "\(.*\)".*/\1/'
```

### Want to see version before building

Run this to preview:
```bash
PACKAGE_VERSION=$(grep '"version"' package.json | head -1 | sed 's/.*"version": "\(.*\)".*/\1/')
echo "Will build as: v${PACKAGE_VERSION}"
```

## Related Documentation

- [BUILD_README.md](./BUILD_README.md) - Build script usage
- [DOCKER_HUB_WORKFLOW.md](./DOCKER_HUB_WORKFLOW.md) - Complete workflow guide
- [DEPLOYMENT_SUMMARY.md](./DEPLOYMENT_SUMMARY.md) - Deployment overview
