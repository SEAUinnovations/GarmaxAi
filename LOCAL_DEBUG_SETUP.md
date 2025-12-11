# Local Development Debug Setup Guide

## Quick Start

### 1. Initial Setup

```bash
# Copy environment template
cp .env.local.template .env.local

# Edit .env.local and fill in your values
# At minimum, you need:
# - COGNITO_USER_POOL_ID
# - COGNITO_CLIENT_ID
# - COGNITO_DOMAIN
# - REPLICATE_API_TOKEN (for AI features)
# - STRIPE keys (for payment testing)
```

### 2. Start Docker Services

```bash
# Start all required services (MySQL, Redis, LocalStack)
docker-compose up -d

# Verify services are running
docker-compose ps

# View logs if needed
docker-compose logs -f
```

### 3. Initialize Database

```bash
# Push database schema
npm run db:push

# Seed subscription plans
npm run db:seed:plans
```

### 4. Start Development Servers

**Option A: VS Code Debug (Recommended)**
1. Open VS Code
2. Go to Run & Debug (Cmd+Shift+D)
3. Select "Full Stack: Backend + Frontend"
4. Press F5 or click Start Debugging

**Option B: Terminal**
```bash
# Terminal 1: Backend
npm run dev

# Terminal 2: Frontend
npm run dev:client
```

## VS Code Debug Configurations

### Available Debug Configs

1. **Backend: Debug** - Debug backend server with hot reload
2. **Backend: Test (Jest)** - Debug backend tests
3. **Frontend: Chrome Debug** - Debug React app in Chrome
4. **E2E: Run All Tests** - Debug end-to-end tests
5. **E2E: Current File** - Debug current test file
6. **Full Stack: Backend + Frontend** - Debug both simultaneously

### Breakpoints

- Set breakpoints in TypeScript files
- They work in both `.ts` backend and `.tsx` frontend files
- Source maps are configured for accurate debugging

## VS Code Tasks

Access via `Cmd+Shift+P` → "Tasks: Run Task"

- **Start Docker Services** - Start all containers
- **Stop Docker Services** - Stop all containers
- **View Docker Logs** - Tail all container logs
- **Setup Local Environment** - Run full setup script
- **Install Dependencies** - Install npm packages
- **Database: Push Schema** - Update database schema
- **Database: Seed Plans** - Seed subscription data
- **Build Full Stack** - Build frontend + backend
- **Run All Tests** - Run unit, frontend, and E2E tests

## Environment Variables

### Required for Local Development

```bash
# Cognito (get from AWS Console or CDK outputs)
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
COGNITO_CLIENT_ID=your-client-id
COGNITO_DOMAIN=garmaxai-dev.auth.us-east-1.amazoncognito.com

# Database (default Docker values)
DATABASE_URL=mysql://garmaxuser:garmaxpass@localhost:3306/garmaxai

# API Keys
REPLICATE_API_TOKEN=r8_xxxxx
STRIPE_SECRET_KEY=sk_test_xxxxx
```

### Optional Services

```bash
# Use LocalStack for AWS services (S3, SQS, etc.)
USE_LOCALSTACK=true
AWS_ENDPOINT_URL=http://localhost:4566

# Disable features you don't need
ENABLE_SMPL_PROCESSING=false
```

## Testing Google OAuth Locally

### Prerequisites

1. **Deploy Cognito to dev environment:**
   ```bash
   cd iac
   npm run deploy:dev
   ```

2. **Get Cognito values from CDK outputs:**
   ```bash
   aws cloudformation describe-stacks \
     --stack-name GarmaxAi-Backend-dev \
     --region us-east-1 \
     --query 'Stacks[0].Outputs'
   ```

3. **Update Google OAuth credentials:**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Navigate to APIs & Services → Credentials
   - Add redirect URI: `http://localhost:5000/auth/callback`

4. **Update .env.local with Cognito values**

### Test OAuth Flow

1. Start services: `docker-compose up -d`
2. Start backend: `npm run dev`
3. Start frontend: `npm run dev:client`
4. Navigate to: `http://localhost:5000`
5. Click "Sign in with Google"
6. Should redirect properly (no blank page!)

## Common Issues

### 1. Blank Page on Google Sign-In

**Cause:** Port mismatch or Cognito not configured
**Fix:**
- Ensure FRONTEND_URL=http://localhost:5000 in .env.local
- Verify Cognito callback URLs include localhost:5000
- Check that both frontend (5000) and backend (3000) are running

### 2. Database Connection Error

**Cause:** MySQL container not ready
**Fix:**
```bash
docker-compose down -v
docker-compose up -d
sleep 10
npm run db:push
```

### 3. Cognito Configuration Error

**Cause:** Missing or invalid Cognito environment variables
**Fix:**
- Deploy dev stack: `cd iac && npm run deploy:dev`
- Get outputs and update .env.local
- Verify COGNITO_DOMAIN is without https://

### 4. API Requests Failing

**Cause:** Proxy not configured or ports wrong
**Fix:**
- Verify backend is on port 3000
- Verify frontend is on port 5000
- Check client/vite.config.ts has proxy configured

## Testing

```bash
# Unit tests
npm run test

# Frontend tests
npm run test:frontend

# E2E tests (requires services running)
npm run test:e2e

# All tests
npm run test:all

# With coverage
npm run test:coverage
```

## Debugging Tips

### Backend Debugging

1. Set breakpoints in `src/` files
2. Use "Backend: Debug" configuration
3. Hot reload enabled - code changes apply automatically
4. View logs in Debug Console

### Frontend Debugging

1. Use "Frontend: Chrome Debug" or browser DevTools
2. React DevTools extension recommended
3. Set breakpoints in `client/src/` files
4. Network tab shows API calls

### Database Debugging

```bash
# Connect to MySQL
docker exec -it garmaxai-mysql mysql -u garmaxuser -pgarmaxpass garmaxai

# View tables
SHOW TABLES;

# Query users
SELECT * FROM users;
```

### Redis Debugging

```bash
# Connect to Redis CLI
docker exec -it garmaxai-redis redis-cli

# View keys
KEYS *

# Get value
GET some-key
```

## Production vs Development

| Aspect | Development (.env.local) | Production |
|--------|-------------------------|------------|
| Database | Local MySQL (Docker) | AWS RDS |
| Redis | Local Redis (Docker) | AWS ElastiCache |
| S3 | LocalStack | AWS S3 |
| Cognito | Dev User Pool | Prod User Pool |
| Frontend | localhost:5000 | garmaxai.com |
| Backend | localhost:3000 | API Gateway |

## Next Steps

1. ✅ Setup complete - services running
2. ✅ Debug configurations ready
3. ✅ OAuth fixes applied
4. 🔄 Deploy Cognito dev stack if not done
5. 🔄 Test Google OAuth flow
6. 🔄 Run tests to verify setup

## Resources

- [GOOGLE_SSO_SETUP.md](./GOOGLE_SSO_SETUP.md) - Google OAuth setup guide
- [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) - Full development guide
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Deployment instructions
