#!/bin/bash

# Build script for SMPL processing container
# Usage: ./scripts/build-smpl-container.sh [STAGE] [VERSION]

set -e  # Exit on any error

# Configuration
STAGE=${1:-DEV}
VERSION=${2:-latest}
AWS_REGION=${AWS_REGION:-us-east-1}
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "")

echo "🏗️  Building SMPL processing container"
echo "📍 Stage: $STAGE"
echo "🏷️  Version: $VERSION" 
echo "🌍 Region: $AWS_REGION"
echo "🔑 Account: $AWS_ACCOUNT_ID"

# Validate prerequisites
if [ -z "$AWS_ACCOUNT_ID" ]; then
    echo "❌ AWS credentials not configured. Please run 'aws configure' or set up IAM role."
    exit 1
fi

# ECR repository details
REPO_NAME="garmax-ai/smpl-processor-${STAGE,,}"
REPO_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${REPO_NAME}"

echo ""
echo "🐳 Building Docker image..."

# Build the container with multi-stage optimization
docker build \
    -f Dockerfile.smpl \
    -t "$REPO_NAME:$VERSION" \
    -t "$REPO_NAME:latest" \
    --build-arg STAGE="$STAGE" \
    --platform linux/amd64 \
    .

echo "✅ Docker image built successfully"

# Login to ECR
echo ""
echo "🔐 Logging into ECR..."
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$REPO_URI"

# Tag for ECR
echo ""
echo "🏷️  Tagging for ECR..."
docker tag "$REPO_NAME:$VERSION" "$REPO_URI:$VERSION"
docker tag "$REPO_NAME:latest" "$REPO_URI:latest"

# Push to ECR
echo ""
echo "📤 Pushing to ECR..."
docker push "$REPO_URI:$VERSION"
docker push "$REPO_URI:latest"

echo ""
echo "🎉 SMPL container build completed!"
echo ""
echo "📋 Summary:"
echo "  └── Repository: $REPO_URI"
echo "  └── Tags: $VERSION, latest"
echo "  └── Platform: linux/amd64"
echo ""
echo "🚀 Container ready for ECS deployment!"
echo ""