#!/bin/bash

# Frontend deployment script for GarmaxAi
# This script builds the frontend and optionally deploys to S3

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
STAGE="${STAGE:-dev}"
SKIP_UPLOAD="${SKIP_UPLOAD:-false}"
BUILD_ONLY="${BUILD_ONLY:-false}"

echo -e "${GREEN}=== GarmaxAi Frontend Deployment ===${NC}"
echo "Stage: $STAGE"
echo "Project Root: $PROJECT_ROOT"
echo ""

# Step 1: Clean previous builds
echo -e "${YELLOW}Cleaning previous builds...${NC}"
cd "$PROJECT_ROOT"
rm -rf dist/public
rm -rf client/dist
echo -e "${GREEN}✓ Clean complete${NC}"
echo ""

# Step 2: Install dependencies (if needed)
if [ ! -d "client/node_modules" ]; then
  echo -e "${YELLOW}Installing client dependencies...${NC}"
  cd "$PROJECT_ROOT/client"
  npm ci
  echo -e "${GREEN}✓ Dependencies installed${NC}"
  echo ""
fi

# Step 2.5: Set API URL based on stage
case "$STAGE" in
  dev)
    export VITE_API_URL="https://dev.garmaxai.com/api"
    ;;
  qa)
    export VITE_API_URL="https://qa.garmaxai.com/api"
    ;;
  prod)
    export VITE_API_URL="https://be.garmaxai.com/api"
    ;;
esac

echo -e "${YELLOW}API URL: $VITE_API_URL${NC}"
echo ""

# Step 3: Build frontend from root (uses root vite.config.ts)
echo -e "${YELLOW}Building frontend...${NC}"
cd "$PROJECT_ROOT"
npm run build:frontend

# Verify build
if [ ! -d "dist/public" ]; then
  echo -e "${RED}✗ Build failed - dist/public not found${NC}"
  exit 1
fi

# Count files
FILE_COUNT=$(find dist/public -type f | wc -l | tr -d ' ')
echo -e "${GREEN}✓ Build complete - $FILE_COUNT files generated${NC}"
echo ""

# List main assets
echo -e "${YELLOW}Build artifacts:${NC}"
ls -lh dist/public/
echo ""

# Step 4: Upload to S3 (if not skipped)
if [ "$BUILD_ONLY" = "true" ] || [ "$SKIP_UPLOAD" = "true" ]; then
  echo -e "${YELLOW}Skipping S3 upload (BUILD_ONLY=$BUILD_ONLY, SKIP_UPLOAD=$SKIP_UPLOAD)${NC}"
  exit 0
fi

# Get S3 bucket and CloudFront distribution from CloudFormation
echo -e "${YELLOW}Fetching CloudFormation outputs...${NC}"
STACK_NAME="GarmaxAi-Frontend-${STAGE}"

if [ -z "$S3_BUCKET" ]; then
  S3_BUCKET=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue" \
    --output text 2>/dev/null)
fi

if [ -z "$CLOUDFRONT_ID" ]; then
  CLOUDFRONT_ID=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='FrontendDistributionId'].OutputValue" \
    --output text 2>/dev/null)
fi

if [ -z "$S3_BUCKET" ]; then
  echo -e "${RED}✗ Could not determine S3 bucket from CloudFormation stack $STACK_NAME${NC}"
  echo -e "${YELLOW}Set S3_BUCKET environment variable or ensure stack exists${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Found resources${NC}"
echo "  Bucket: $S3_BUCKET"
echo "  Distribution: $CLOUDFRONT_ID"
echo ""

echo -e "${YELLOW}Uploading to S3 bucket: $S3_BUCKET${NC}"

# Check if AWS CLI is available
if ! command -v aws &> /dev/null; then
  echo -e "${RED}✗ AWS CLI not found. Please install it first.${NC}"
  exit 1
fi

# Upload to S3 with cache control
aws s3 sync dist/public/ "s3://$S3_BUCKET/" \
  --delete \
  --cache-control "public, max-age=31536000" \
  --exclude "*.html" \
  --exclude "index.html"

# Upload HTML files with no-cache
aws s3 sync dist/public/ "s3://$S3_BUCKET/" \
  --cache-control "no-cache, no-store, must-revalidate" \
  --exclude "*" \
  --include "*.html"

echo -e "${GREEN}✓ Upload complete${NC}"
echo ""

# Step 5: Invalidate CloudFront (if distribution ID is set)
if [ -n "$CLOUDFRONT_ID" ]; then
  echo -e "${YELLOW}Invalidating CloudFront distribution: $CLOUDFRONT_ID${NC}"
  aws cloudfront create-invalidation \
    --distribution-id "$CLOUDFRONT_ID" \
    --paths "/*" \
    > /dev/null
  echo -e "${GREEN}✓ CloudFront invalidation created${NC}"
else
  echo -e "${YELLOW}⚠ CLOUDFRONT_ID not set, skipping invalidation${NC}"
fi

echo ""
echo -e "${GREEN}=== Deployment Complete ===${NC}"
