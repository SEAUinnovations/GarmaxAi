#!/bin/bash
set -e

echo "=== CORS Fix Deployment ==="
echo "Committing changes..."

cd /Users/supremeod/Repos/GarmaxAi

# Add and commit the CORS fix
git add src/app.ts src/routers/authRouter.ts
git commit -m "Fix CORS: Return specific origin instead of wildcard with credentials

- Changed CORS callback to return specific origin instead of true
- This prevents Access-Control-Allow-Origin: * when credentials are used
- Added exposedHeaders for Set-Cookie
- Fixes OAuth callback CORS preflight errors"

echo "Pushing to GitHub..."
git push

echo "Deploying to production..."
AWS_PROFILE=920792187297_AdministratorAccess npm run deploy:prod

echo "=== Deployment Complete ==="
