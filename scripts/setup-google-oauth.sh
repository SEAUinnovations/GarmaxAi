#!/bin/bash

# Script to set up Google OAuth credentials in AWS Parameter Store
# These credentials are required for Cognito Google SSO integration

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Google OAuth Credentials Setup${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check for required tools
if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI is not installed${NC}"
    exit 1
fi

# Get environment
if [ -z "$1" ]; then
    echo -e "${YELLOW}Usage: $0 <environment>${NC}"
    echo -e "${YELLOW}Example: $0 prod${NC}"
    echo -e "${YELLOW}Example: $0 qa${NC}"
    echo -e "${YELLOW}Example: $0 dev${NC}"
    exit 1
fi

STAGE=$1

echo -e "${YELLOW}Setting up Google OAuth for environment: ${STAGE}${NC}"
echo ""

# Prompt for Google OAuth credentials
echo -e "${GREEN}Please enter your Google OAuth credentials:${NC}"
echo -e "${YELLOW}(You can get these from Google Cloud Console > APIs & Credentials > OAuth 2.0 Client IDs)${NC}"
echo ""

read -p "Google Client ID: " GOOGLE_CLIENT_ID
read -sp "Google Client Secret: " GOOGLE_CLIENT_SECRET
echo ""
echo ""

# Validate inputs
if [ -z "$GOOGLE_CLIENT_ID" ] || [ -z "$GOOGLE_CLIENT_SECRET" ]; then
    echo -e "${RED}Error: Both Client ID and Client Secret are required${NC}"
    exit 1
fi

# Set AWS region
AWS_REGION=${AWS_REGION:-us-east-1}

echo -e "${GREEN}Storing credentials in AWS Parameter Store (Region: ${AWS_REGION})...${NC}"

# Store Client ID
aws ssm put-parameter \
    --name "/garmaxai/${STAGE}/cognito/google-client-id" \
    --value "$GOOGLE_CLIENT_ID" \
    --type "String" \
    --overwrite \
    --region "$AWS_REGION" \
    --description "Google OAuth Client ID for Cognito ${STAGE} environment"

echo -e "${GREEN}✓ Stored Google Client ID${NC}"

# Store Client Secret (as SecureString)
aws ssm put-parameter \
    --name "/garmaxai/${STAGE}/cognito/google-client-secret" \
    --value "$GOOGLE_CLIENT_SECRET" \
    --type "String" \
    --overwrite \
    --region "$AWS_REGION" \
    --description "Google OAuth Client Secret for Cognito ${STAGE} environment"

echo -e "${GREEN}✓ Stored Google Client Secret${NC}"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo -e "1. In Google Cloud Console, add these authorized redirect URIs:"
echo -e "   - https://garmaxai-${STAGE}.auth.${AWS_REGION}.amazoncognito.com/oauth2/idpresponse"
echo -e "   - https://${STAGE}.garmaxai.com/auth/callback"
echo -e "   - http://localhost:3000/auth/callback (for development)"
echo ""
echo -e "2. Deploy or update your CDK stack:"
echo -e "   ${GREEN}cd iac && npm run deploy:${STAGE}${NC}"
echo ""
echo -e "3. After deployment, get the Cognito domain URL from CloudFormation outputs:"
echo -e "   ${GREEN}aws cloudformation describe-stacks --stack-name GarmaxAi-Backend-${STAGE} --query 'Stacks[0].Outputs[?OutputKey==\`CognitoDomainUrl\`].OutputValue' --output text${NC}"
echo ""
