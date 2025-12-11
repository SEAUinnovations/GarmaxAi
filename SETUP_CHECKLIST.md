# Local Debug Setup Checklist

## ✅ Completed

- [x] Created `.env.local.template` with all required environment variables
- [x] Created `.env.local` file (needs configuration)
- [x] Added VS Code debug configurations in `.vscode/launch.json`
- [x] Added VS Code tasks in `.vscode/tasks.json`
- [x] Created `LOCAL_DEBUG_SETUP.md` guide
- [x] Created `scripts/setup-local-debug.sh` automation script
- [x] Updated `client/vite.config.ts` with proxy for API requests
- [x] Updated Cognito callback URLs to include localhost:5000
- [x] Updated `.gitignore` to exclude all `.env.*` files

## 🔄 Next Steps (Do These Now)

### 1. Start Docker Desktop
```bash
# Open Docker Desktop application
# Wait for it to fully start (whale icon in menu bar)
```

### 2. Configure Environment Variables
Edit `.env.local` and add your values:
```bash
# Required for OAuth to work:
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
COGNITO_CLIENT_ID=your-client-id-here  
COGNITO_DOMAIN=garmaxai-prod.auth.us-east-1.amazoncognito.com

# Required for AI features:
REPLICATE_API_TOKEN=r8_xxxxx

# Required for payments:
STRIPE_SECRET_KEY=sk_test_xxxxx
```

### 3. Run Setup Script
```bash
./scripts/setup-local-debug.sh
```

### 4. Initialize Database
```bash
npm run db:push
npm run db:seed:plans
```

### 5. Start Debugging

**Option A: VS Code (Recommended)**
1. Press `F5` or click Run & Debug
2. Select "Full Stack: Backend + Frontend"
3. Set breakpoints anywhere in TypeScript files
4. Debug with hot reload!

**Option B: Terminal**
```bash
# Terminal 1: Backend
npm run dev

# Terminal 2: Frontend  
npm run dev:client
```

### 6. Test Google OAuth
1. Navigate to http://localhost:5000
2. Click "Sign in with Google"
3. Should work without blank page! ✨

## 📋 VS Code Features Available

### Debug Configurations
- **Full Stack: Backend + Frontend** - Debug both simultaneously
- **Backend: Debug** - Debug server with hot reload
- **Frontend: Chrome Debug** - Debug React in Chrome
- **Backend: Test (Jest)** - Debug tests
- **E2E: Run All Tests** - Debug end-to-end tests

### Tasks (Cmd+Shift+P → "Tasks: Run Task")
- Start/Stop Docker Services
- View Docker Logs
- Database Push/Seed
- Build Frontend/Backend
- Run All Tests

### Debugging Features
✅ Breakpoints in TypeScript (.ts) and React (.tsx)
✅ Hot reload - changes apply without restart
✅ Source maps configured
✅ Console logging in Debug Console
✅ Variable inspection
✅ Call stack navigation

## 🔍 Quick Tests

### Test Backend
```bash
curl http://localhost:3000/health
# Should return: {"status":"ok"}
```

### Test Frontend
```bash
open http://localhost:5000
# Should load the app
```

### Test Database
```bash
docker exec -it garmaxai-mysql mysql -u garmaxuser -pgarmaxpass -e "SHOW DATABASES;"
# Should show 'garmaxai' database
```

### Test Redis
```bash
docker exec -it garmaxai-redis redis-cli ping
# Should return: PONG
```

## 🐛 Common Issues

### Docker Not Running
**Error:** "Cannot connect to the Docker daemon"
**Fix:** Start Docker Desktop application

### Port Already in Use
**Error:** "Port 3000 is already allocated"
**Fix:** 
```bash
lsof -ti:3000 | xargs kill -9
lsof -ti:5000 | xargs kill -9
```

### Database Connection Failed
**Error:** "Can't connect to MySQL server"
**Fix:**
```bash
docker-compose down -v
docker-compose up -d
sleep 10
npm run db:push
```

### Cognito Errors
**Error:** "Server configuration error" or blank OAuth page
**Fix:**
1. Verify `.env.local` has correct Cognito values
2. Check `FRONTEND_URL=http://localhost:5000`
3. Ensure Cognito callback URLs include `http://localhost:5000/auth/callback`
4. Verify Google OAuth credentials have the redirect URI

## 📚 Documentation

- `LOCAL_DEBUG_SETUP.md` - Full setup guide
- `GOOGLE_SSO_SETUP.md` - Google OAuth configuration
- `DEVELOPER_GUIDE.md` - Development practices
- `DEPLOYMENT_GUIDE.md` - Production deployment

## 🎯 Success Criteria

You'll know everything is working when:
- ✅ Docker services all show "Up" in `docker-compose ps`
- ✅ Backend responds at http://localhost:3000/health
- ✅ Frontend loads at http://localhost:5000
- ✅ You can set breakpoints and they hit in VS Code
- ✅ Google Sign-In redirects properly (no blank page)
- ✅ Database queries work
- ✅ Tests pass

## 🚀 Ready to Code!

Once setup is complete:
1. Set breakpoints in your code
2. Press F5 to start debugging
3. Make changes and see them hot reload
4. Run tests with VS Code test runner
5. View logs in Debug Console

Happy debugging! 🎉
