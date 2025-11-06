# Portainer Quick Start

## TL;DR

1. **In Portainer**: Stacks → Add stack → Repository
2. **Repository URL**: Your Git repository URL
3. **Compose path**: `docker-compose.portainer.yml`
4. **Add environment variables** (see below)
5. **Deploy**

## Minimum Required Environment Variables

```env
# OIDC
OIDC_ISSUER_URL=https://auth.example.com/application/o/supportplanner/
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
OIDC_REDIRECT_URI=https://supportplanner.example.com/auth/callback
OIDC_POST_LOGOUT_REDIRECT_URI=https://supportplanner.example.com/logged-out

# Nextcloud
NEXTCLOUD_URL=https://your-nextcloud.example.com
NEXTCLOUD_USERNAME=your-username
NEXTCLOUD_PASSWORD=your-password

# Security (generate with: openssl rand -base64 32)
SESSION_SECRET=your-random-secret-here
CSRF_SECRET=your-random-secret-here
```

## Generate Secrets

Run this on your local machine:

```bash
echo "SESSION_SECRET=$(openssl rand -base64 32)"
echo "CSRF_SECRET=$(openssl rand -base64 32)"
```

Copy the output and paste into Portainer's environment variables.

## Optional Variables

See `portainer-env-template.txt` for all optional variables including:
- Port configuration
- CORS settings
- Role mapping (by groups or emails)
- Logging level

## Full Documentation

For complete instructions, troubleshooting, and security best practices, see:
- **[PORTAINER_DEPLOYMENT.md](PORTAINER_DEPLOYMENT.md)** - Complete deployment guide
- **[portainer-env-template.txt](portainer-env-template.txt)** - All environment variables

## After Deployment

1. Check container logs in Portainer
2. Access the app at `http://your-server:5175`
3. Configure reverse proxy for HTTPS (recommended)

## Updates

To update the application:
1. Go to Stacks → support-planner
2. Click "Pull and redeploy"
3. Portainer will pull latest code and rebuild
