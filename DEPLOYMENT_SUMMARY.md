# Deployment Changes Summary

## What Changed

The deployment workflow has been updated to use **pre-built multi-architecture Docker images from Docker Hub** instead of building directly in Portainer.

**Multi-Architecture Support:** Images are built for both AMD64 (x86_64) and ARM64 (Apple Silicon).

## Why This Change?

Portainer cannot build images reliably due to:
- Build context size limitations
- Build timeout issues
- Resource constraints

## New Workflow

### 1. Build Locally and Push to Docker Hub

```bash
# Set your Docker Hub username
export DOCKER_USERNAME="your-dockerhub-username"

# Login to Docker Hub
docker login

# Build and push (automatically uses version from package.json)
./build-and-push.sh          # Uses package.json version (e.g., "0.10.0" → v0.10.0)
./build-and-push.sh v1.0.0   # Override with specific version
```

### 2. Deploy in Portainer

The `docker-compose.portainer.yml` now pulls pre-built images instead of building:

```yaml
services:
  support-planner:
    image: ${DOCKER_USERNAME}/support-planner:${IMAGE_VERSION}
    # ... rest of config
```

Set these environment variables in Portainer:
- `DOCKER_USERNAME` - Your Docker Hub username
- `IMAGE_VERSION` - Version tag (e.g., `latest`, `v1.0.0`)

## Files Modified

### Created
- ✅ `build-and-push.sh` - Script to build and push images to Docker Hub
- ✅ `DOCKER_HUB_WORKFLOW.md` - Quick reference guide
- ✅ `DEPLOYMENT_SUMMARY.md` - This file

### Updated
- ✅ `docker-compose.portainer.yml` - Changed from `build: .` to `image: ...`
- ✅ `portainer-env-template.txt` - Added Docker Hub configuration variables
- ✅ `PORTAINER_DEPLOYMENT.md` - Updated with new workflow instructions
- ✅ `.dockerignore` - Added test files and documentation to reduce image size

### Unchanged
- ✅ `docker-compose.yml` - Local development still uses `build: .`
- ✅ `Dockerfile` - No changes to build process
- ✅ Test containers - Not pushed to Docker Hub (as requested)

## Quick Start

### First Time Setup

1. **Configure Docker Hub:**
   ```bash
   export DOCKER_USERNAME="your-dockerhub-username"
   docker login
   ```

2. **Build and push:**
   ```bash
   ./build-and-push.sh
   ```

3. **Deploy in Portainer:**
   - Add environment variables (see `portainer-env-template.txt`)
   - Deploy stack using `docker-compose.portainer.yml`

### Updating

1. **Update version in package.json:**
   ```json
   {
     "version": "0.10.0"
   }
   ```

2. **Build new version:**
   ```bash
   ./build-and-push.sh  # Automatically uses v0.10.0 from package.json
   ```

3. **Update in Portainer:**
   - Option A: Update `IMAGE_VERSION` env var to `v0.10.0` and redeploy
   - Option B: Just click "Pull and redeploy" if using `latest`

## Documentation

- **[PORTAINER_DEPLOYMENT.md](./PORTAINER_DEPLOYMENT.md)** - Complete Portainer deployment guide
- **[DOCKER_HUB_WORKFLOW.md](./DOCKER_HUB_WORKFLOW.md)** - Docker Hub workflow reference
- **[portainer-env-template.txt](./portainer-env-template.txt)** - Environment variables template

## Benefits

- ✅ **Faster deployments** - No build time in Portainer
- ✅ **Consistent images** - Same image across all environments
- ✅ **Version control** - Easy rollbacks with version tags
- ✅ **No build failures** - Build issues caught locally before deployment
- ✅ **Smaller context** - Test files excluded from production images
- ✅ **Multi-architecture** - Works on AMD64 and ARM64 servers automatically
- ✅ **Automatic versioning** - Version synced with package.json

## Migration Checklist

- [ ] Create Docker Hub repository
- [ ] Configure `DOCKER_USERNAME` in `build-and-push.sh`
- [ ] Run `docker login`
- [ ] Ensure `package.json` has correct version number
- [ ] Build and push first image: `./build-and-push.sh`
- [ ] Update Portainer stack with new environment variables
- [ ] Test deployment
- [ ] Document your Docker Hub username for team members

## Support

For questions or issues:
1. Check [PORTAINER_DEPLOYMENT.md](./PORTAINER_DEPLOYMENT.md) for detailed instructions
2. Review [DOCKER_HUB_WORKFLOW.md](./DOCKER_HUB_WORKFLOW.md) for workflow details
3. See [README.md](./README.md) for application-specific documentation
