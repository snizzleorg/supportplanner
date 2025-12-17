# Portainer Deployment Guide

This guide explains how to deploy the Support Planner application using Portainer with pre-built Docker images from Docker Hub.

## Prerequisites

- Portainer instance running and accessible
- Pre-built Docker image pushed to Docker Hub (see [Building and Publishing](#building-and-publishing-to-docker-hub))
- Git repository URL for this project (or copy of docker-compose.portainer.yml)
- Environment variable values ready (see below)

## Building and Publishing to Docker Hub

**Before deploying to Portainer**, you must build and push the Docker image locally:

### 1. Configure Docker Hub Username

Edit `build-and-push.sh` and set your Docker Hub username:

```bash
DOCKER_USERNAME="your-dockerhub-username"
```

Or set it as an environment variable:

```bash
export DOCKER_USERNAME="your-dockerhub-username"
```

### 2. Login to Docker Hub

```bash
docker login
```

### 3. Build and Push

Run the build script:

```bash
# Automatically uses version from package.json (e.g., "0.10.0" → v0.10.0)
./build-and-push.sh

# Or override with a specific version
./build-and-push.sh v1.0.0
```

The script will:
- Build the Docker image locally for **multiple architectures** (AMD64 + ARM64)
- Tag it with your version (and 'latest')
- Push both tags to Docker Hub

**Note:** The image supports both AMD64 (x86_64) and ARM64 (Apple Silicon). Docker will automatically pull the correct architecture for your Portainer host.

## Deployment Steps

### 1. Create a New Stack in Portainer

1. Log into your Portainer instance
2. Navigate to **Stacks** → **Add stack**
3. Choose **Repository** as the build method
4. Enter your Git repository URL

### 2. Configure the Stack

- **Name**: `support-planner` (or your preferred name)
- **Compose path**: `docker-compose.portainer.yml`
- **Branch**: `main` (or your deployment branch)

### 3. Set Environment Variables

In Portainer's **Environment variables** section, add the following variables:

#### Required Variables

```env
# --- Docker Image Configuration (Required) ---
DOCKER_USERNAME=your-dockerhub-username
IMAGE_VERSION=latest

# --- Authentik OIDC (Required for authentication) ---
OIDC_ISSUER_URL=https://auth.example.com/application/o/supportplanner/
OIDC_CLIENT_ID=your-client-id-here
OIDC_CLIENT_SECRET=your-client-secret-here
OIDC_REDIRECT_URI=https://supportplanner.example.com/auth/callback
OIDC_POST_LOGOUT_REDIRECT_URI=https://supportplanner.example.com/logged-out

# --- Nextcloud Integration (Required) ---
NEXTCLOUD_URL=https://your-nextcloud.example.com
NEXTCLOUD_USERNAME=your-nextcloud-username
NEXTCLOUD_PASSWORD=your-nextcloud-password

# --- Security Secrets (REQUIRED in production) ---
# Generate random strings for these (e.g., using: openssl rand -base64 32)
SESSION_SECRET=your-random-session-secret-here
CSRF_SECRET=your-random-csrf-secret-here
```

#### Optional Variables

```env
# Port configuration
PORT=5173
EXTERNAL_PORT=5175

# CORS allowed origins (comma-separated)
ALLOWED_ORIGINS=https://supportplanner.example.com,https://app.example.com

# Role mapping by groups
ADMIN_GROUPS=admins,superusers
EDITOR_GROUPS=editors,moderators

# Role mapping by email (overrides groups)
ADMIN_EMAILS=admin@example.com,boss@example.com
EDITOR_EMAILS=editor@example.com

# Auth overrides (for testing only)
AUTH_DISABLED=false
AUTH_BYPASS_ROLE=reader

# Logging
LOG_LEVEL=WARN

# OIDC scopes (default: openid profile email)
OIDC_SCOPES=openid profile email

# Bot tokens (for scripts)
# Comma-separated list of token:role entries. Roles: reader, editor.
# Use with: Authorization: Bearer <token>
BOT_TOKENS=your-reader-token:reader,your-editor-token:editor
```

### 4. Deploy the Stack

1. Click **Deploy the stack**
2. Portainer will:
   - Clone the repository (for the compose file)
   - Pull the pre-built image from Docker Hub
   - Start the container with your environment variables

### 5. Verify Deployment

1. Check the **Containers** section to ensure `support-planner` is running
2. View logs if there are any issues
3. Access the application at `http://your-server:5175` (or your configured port)

## Updating the Deployment

To update to a new version:

### Option 1: Update to Latest

1. Build and push a new image locally:
   ```bash
   ./build-and-push.sh
   ```
2. In Portainer, go to **Stacks** → **support-planner**
3. Click **Pull and redeploy**
4. Portainer will pull the latest image from Docker Hub

### Option 2: Update to Specific Version

1. Build and push with a version tag:
   ```bash
   ./build-and-push.sh v1.1.0
   ```
2. In Portainer, update the `IMAGE_VERSION` environment variable to `v1.1.0`
3. Click **Update the stack**
4. Portainer will pull the specific version from Docker Hub

## Troubleshooting

### Container won't start

- Check the container logs in Portainer
- Verify all required environment variables are set
- Ensure secrets (SESSION_SECRET, CSRF_SECRET) are not empty

### Authentication issues

- Verify OIDC_ISSUER_URL is correct and accessible from the container
- Check OIDC_REDIRECT_URI matches your Authentik configuration
- Ensure OIDC_CLIENT_ID and OIDC_CLIENT_SECRET are correct

### Nextcloud connection issues

- Verify NEXTCLOUD_URL is accessible from the container
- Check NEXTCLOUD_USERNAME and NEXTCLOUD_PASSWORD are correct
- Review container logs for specific error messages

## Security Best Practices

1. **Never commit secrets** - Use Portainer's environment variables
2. **Generate strong secrets** - Use `openssl rand -base64 32` for SESSION_SECRET and CSRF_SECRET
3. **Use HTTPS** - Configure a reverse proxy (Traefik, Nginx) for SSL/TLS
4. **Restrict CORS** - Set ALLOWED_ORIGINS to your specific domains
5. **Regular updates** - Pull and redeploy regularly to get security updates

## Data Persistence

The stack uses a named volume `support-planner-data` to persist:
- Geocode cache
- Audit history database
- Other application data

This data persists across container restarts and updates.

## Alternative: Using Portainer's Web Editor

If you prefer to paste the compose file directly:

1. Choose **Web editor** instead of **Repository**
2. Copy the contents of `docker-compose.portainer.yml`
3. Paste into the editor
4. Update the image name with your Docker Hub username if not using environment variables:
   ```yaml
   image: your-dockerhub-username/support-planner:latest
   ```
5. Set environment variables as described above
6. Deploy

## Why Pre-built Images?

Portainer has limitations when building images directly:
- Build context size limits
- Build timeout issues
- Resource constraints on the Portainer host

By building locally and pushing to Docker Hub, you get:
- ✅ Faster deployments (no build time)
- ✅ Consistent images across environments
- ✅ Better control over versioning
- ✅ No build failures in Portainer

## Support

For issues specific to:
- **Application**: See main [README.md](./README.md)
- **Portainer**: Consult [Portainer documentation](https://docs.portainer.io/)
- **Docker**: See [Docker documentation](https://docs.docker.com/)
