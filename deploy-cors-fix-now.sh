#!/bin/bash
set -e

echo "======================================"
echo "CORS FIX DEPLOYMENT SCRIPT"
echo "======================================"
echo ""

cd /Users/supremeod/Repos/GarmaxAi

echo "Step 1: Checking git status..."
git status --short

echo ""
echo "Step 2: Adding changed files..."
git add src/app.ts src/routers/authRouter.ts

echo ""
echo "Step 3: Committing changes..."
git commit -m "Fix CORS: Return specific origin instead of wildcard with credentials

Critical fix for OAuth callback CORS errors:
- Changed callback(null, true) to callback(null, origin) on line 40
- This prevents Access-Control-Allow-Origin: * when credentials:include is used
- Added exposedHeaders: ['Set-Cookie'] for proper cookie handling
- Added logging for no-origin requests

The wildcard * is not allowed with credentials mode, browser blocks the request.
Now returns the specific origin (e.g., https://garmaxai.com) which is compliant." || echo "Nothing to commit or already committed"

echo ""
echo "Step 4: Pushing to GitHub..."
git push origin main

echo ""
echo "Step 5: Building and deploying to production..."
echo "This will take ~60-90 seconds..."
AWS_PROFILE=920792187297_AdministratorAccess npm run deploy:prod

echo ""
echo "======================================"
echo "✅ DEPLOYMENT COMPLETE"
echo "======================================"
echo ""
echo "Next steps:"
echo "1. Wait 10-15 seconds for Lambda to update"
echo "2. Test OAuth from https://garmaxai.com"
echo "3. Check browser console - CORS error should be gone"
echo ""
