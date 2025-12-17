# Docker Hub Build and Deploy Workflow

Quick reference for building and deploying Support Planner via Docker Hub.

**Multi-Architecture Support:** Images are built for both AMD64 (x86_64) and ARM64 (Apple Silicon).

## Setup (One-time)

### 1. Create Docker Hub Repository

1. Go to [Docker Hub](https://hub.docker.com/)
2. Create a new repository named `support-planner`
3. Set visibility (public or private)

### 2. Configure Local Environment

Edit `build-and-push.sh` or set environment variable:

```bash
export DOCKER_USERNAME="your-dockerhub-username"
```

### 3. Login to Docker Hub

```bash
docker login
```

## Regular Workflow

### Build and Push New Version

```bash
# Use version from package.json (e.g., if package.json has "version": "0.9.0", builds as v0.9.0)
./build-and-push.sh

# Override with specific version
./build-and-push.sh v1.2.3

# Use 'latest' tag explicitly
./build-and-push.sh latest
```

### Deploy to Portainer

**First time:**
1. Follow [PORTAINER_DEPLOYMENT.md](./PORTAINER_DEPLOYMENT.md)
2. Set `DOCKER_USERNAME` and `IMAGE_VERSION` environment variables

**Updates:**
1. Build and push new image (see above)
2. In Portainer: **Stacks** → **support-planner** → **Pull and redeploy**

## Image Naming Convention

Images are tagged as:
- `{DOCKER_USERNAME}/support-planner:latest` - Always points to most recent build
- `{DOCKER_USERNAME}/support-planner:{VERSION}` - Specific version (e.g., v1.2.3)

## Version Management

### Automatic Versioning

The script automatically reads the version from `package.json`:

1. Update version in `package.json`:
   ```json
   {
     "version": "0.9.0"
   }
   ```

2. Build and push:
   ```bash
   ./build-and-push.sh
   ```
   This creates: `your-username/support-planner:v0.9.0` and `:latest`

### Semantic Versioning

Use semantic versioning in `package.json`:
- `1.0.0` - Major release
- `1.1.0` - Minor release (new features)
- `1.1.1` - Patch release (bug fixes)

The script automatically prefixes with `v` (e.g., `0.9.0` → `v0.9.0`)

### Manual Version Override

```bash
# Development/testing
./build-and-push.sh dev

# Release candidate
./build-and-push.sh v1.2.0-rc1

# Specific version (overrides package.json)
./build-and-push.sh v1.2.0
```

## Rollback

To rollback to a previous version:

1. In Portainer, update `IMAGE_VERSION` to the previous version tag
2. Click **Update the stack**

Example:
```env
IMAGE_VERSION=v1.1.0  # Rollback from v1.2.0 to v1.1.0
```

## Multi-Architecture Details

The build script uses Docker buildx to create images for multiple architectures:

- **linux/amd64** - Intel/AMD x86_64 processors (most servers, older Macs)
- **linux/arm64** - ARM processors (Apple Silicon M1/M2/M3, ARM servers)

Docker automatically pulls the correct architecture for your platform. No special configuration needed!

### Requirements

- Docker Desktop 19.03+ (includes buildx)
- Buildx builder will be created automatically on first run

## Local Testing

Test the built image locally before pushing:

```bash
# Build for your current architecture only (faster for testing)
docker build -t support-planner:test .

# Run locally
docker run -p 5175:5173 --env-file .env support-planner:test

# If tests pass, build multi-arch and push to Docker Hub
./build-and-push.sh v1.2.0
```

### Testing Specific Architecture

```bash
# Build and test AMD64 on Apple Silicon (via emulation)
docker buildx build --platform linux/amd64 --load -t support-planner:test-amd64 .
docker run -p 5175:5173 --env-file .env support-planner:test-amd64

# Build and test ARM64
docker buildx build --platform linux/arm64 --load -t support-planner:test-arm64 .
docker run -p 5175:5173 --env-file .env support-planner:test-arm64
```

## Troubleshooting

### Push Failed - Not Logged In

```bash
docker login
```

### Push Failed - Permission Denied

Verify you own the repository on Docker Hub or have push access.

### Image Too Large

Check `.dockerignore` to ensure unnecessary files aren't included:
- `node_modules/` (should be excluded, installed during build)
- `.git/`
- `test-results/`
- `*.log`

### Build Failed

Check Docker build output for errors:
```bash
docker build -t support-planner:debug .
```

### Buildx Not Available

If you get "buildx: command not found":
1. Update Docker Desktop to version 19.03 or later
2. Enable experimental features in Docker settings (older versions)

### Multi-arch Build Slow

First multi-arch build will be slower as it sets up QEMU emulation. Subsequent builds are faster.

## CI/CD Integration (Future)

This workflow can be automated with GitHub Actions:

```yaml
# .github/workflows/docker-publish.yml
name: Build and Push to Docker Hub

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up QEMU
        uses: docker/setup-qemu-action@v3
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Login to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}
      
      - name: Build and push multi-arch
        run: |
          export DOCKER_USERNAME=${{ secrets.DOCKER_USERNAME }}
          ./build-and-push.sh ${GITHUB_REF#refs/tags/}
```

## Security Notes

- **Never commit Docker Hub credentials** to the repository
- Use Docker Hub access tokens instead of passwords
- Consider using private repositories for production images
- Regularly scan images for vulnerabilities using Docker Scout or similar tools

## Related Documentation

- [PORTAINER_DEPLOYMENT.md](./PORTAINER_DEPLOYMENT.md) - Full Portainer deployment guide
- [README.md](./README.md) - Application documentation
- [Dockerfile](./Dockerfile) - Image build configuration
