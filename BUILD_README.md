# Build Script Usage

## Quick Start

```bash
# Set your Docker Hub username
export DOCKER_USERNAME="your-dockerhub-username"

# Login to Docker Hub
docker login

# Build and push (uses version from package.json)
./build-and-push.sh
```

The script automatically reads the version from `package.json` and prefixes it with `v`.
For example, if `package.json` has `"version": "0.10.0"`, it builds as `v0.10.0`.

## Multi-Architecture Support

The build script automatically creates images for:
- **linux/amd64** - Intel/AMD x86_64 (most servers, older Macs)
- **linux/arm64** - ARM64 (Apple Silicon M1/M2/M3, ARM servers)

Docker will automatically pull the correct architecture for your platform.

## Usage Examples

### Build with Version from package.json (Recommended)
```bash
./build-and-push.sh
```
If `package.json` has `"version": "0.10.0"`, creates and pushes:
- `your-username/support-planner:v0.10.0`
- `your-username/support-planner:latest`

### Build with Specific Version (Override)
```bash
./build-and-push.sh v1.0.0
```
Creates and pushes:
- `your-username/support-planner:v1.0.0`
- `your-username/support-planner:latest`

### Build as Latest Only
```bash
./build-and-push.sh latest
```
Creates and pushes: `your-username/support-planner:latest`

### Build Release Candidate
```bash
./build-and-push.sh v1.2.0-rc1
```
Creates and pushes:
- `your-username/support-planner:v1.2.0-rc1`
- `your-username/support-planner:latest`

### Build Development Version
```bash
./build-and-push.sh dev
```
Creates and pushes: `your-username/support-planner:dev`

## Requirements

- Docker Desktop 19.03+ (includes buildx)
- Docker Hub account
- Logged in via `docker login`

## First Run

On first run, the script will:
1. Check if Docker is running
2. Check if you're logged into Docker Hub
3. Create a buildx builder named `multiarch-builder`
4. Bootstrap the builder (sets up QEMU emulation)
5. Build for both architectures
6. Push to Docker Hub

Subsequent runs will reuse the existing builder.

## Build Time

- **First build**: 5-10 minutes (sets up emulation, builds both architectures)
- **Subsequent builds**: 3-5 minutes (reuses cache)

Building for multiple architectures takes longer than single-arch builds, but ensures compatibility across all platforms.

## Troubleshooting

### "buildx: command not found"
Update Docker Desktop to version 19.03 or later.

### "permission denied"
Run `docker login` to authenticate with Docker Hub.

### Build is slow
First build sets up QEMU emulation and is slower. Subsequent builds are faster due to layer caching.

### Want to build for single architecture only?
For local testing, use standard Docker build:
```bash
docker build -t support-planner:test .
```

## Configuration

Edit the script to change defaults:

```bash
DOCKER_USERNAME="${DOCKER_USERNAME:-your-dockerhub-username}"
IMAGE_NAME="support-planner"
BUILDER_NAME="multiarch-builder"
```

Or set environment variables:
```bash
export DOCKER_USERNAME="myusername"
export IMAGE_NAME="my-app"
```

## What Gets Built?

The script builds from the `Dockerfile` in the current directory and includes:
- Application source code
- Node.js dependencies
- Runtime configuration

Excluded (via `.dockerignore`):
- Test files and results
- Documentation
- Git history
- IDE files
- Development dependencies

## Verifying the Build

Check your image on Docker Hub:
```
https://hub.docker.com/r/your-username/support-planner/tags
```

You should see your version tag with both `amd64` and `arm64` listed under architectures.

## Related Documentation

- [DOCKER_HUB_WORKFLOW.md](./DOCKER_HUB_WORKFLOW.md) - Complete workflow guide
- [PORTAINER_DEPLOYMENT.md](./PORTAINER_DEPLOYMENT.md) - Deployment instructions
- [DEPLOYMENT_SUMMARY.md](./DEPLOYMENT_SUMMARY.md) - Overview of changes
