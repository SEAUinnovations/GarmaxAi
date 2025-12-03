#!/bin/bash
#
# Update Parameter Store values from .env file
# 
# USAGE:
#   ./scripts/update-parameters.sh DEV
#   ./scripts/update-parameters.sh PROD
#
# This script reads API keys from your .env file and updates
# the corresponding AWS Systems Manager Parameter Store values.
# Use this for initial setup or when rotating credentials.
#
# PREREQUISITES:
# - AWS CLI configured with appropriate credentials
# - IAM permissions: ssm:PutParameter on /garmaxai/* parameters
# - .env file in repository root with all required keys
#

set -e

# Check arguments
if [ -z "$1" ]; then
  echo "❌ Error: Stage argument required"
  echo "Usage: $0 <STAGE>"
  echo "Example: $0 DEV"
  exit 1
fi

STAGE=$1
PREFIX="/garmaxai/${STAGE}"

# Check if .env file exists
if [ ! -f .env ]; then
  echo "❌ Error: .env file not found in current directory"
  exit 1
fi

# Source .env file
echo "📥 Loading environment variables from .env..."
set -a
source .env
set +a

# Helper function to update parameter
update_parameter() {
  local param_name=$1
  local param_value=$2
  local param_type=${3:-String}
  
  if [ -z "$param_value" ] || [ "$param_value" = "PLACEHOLDER_UPDATE_AFTER_DEPLOY" ]; then
    echo "⚠️  Skipping ${param_name} (empty or placeholder value)"
    return
  fi
  
  echo "📝 Updating ${param_name}..."
  aws ssm put-parameter \
    --name "${param_name}" \
    --value "${param_value}" \
    --type "${param_type}" \
    --overwrite \
    --no-cli-pager > /dev/null
  
  echo "✅ Updated ${param_name}"
}

echo ""
echo "🚀 Updating Parameter Store for stage: ${STAGE}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Replicate API Key
update_parameter "${PREFIX}/replicate/api-key" "${REPLICATE_API_KEY}" "SecureString"

# Stripe Configuration
update_parameter "${PREFIX}/stripe/secret-key" "${STRIPE_SECRET_KEY}" "SecureString"
update_parameter "${PREFIX}/stripe/webhook-secret" "${STRIPE_WEBHOOK_SECRET}" "SecureString"
update_parameter "${PREFIX}/stripe/price-basic-monthly" "${STRIPE_PRICE_BASIC_MONTHLY}" "String"
update_parameter "${PREFIX}/stripe/price-pro-monthly" "${STRIPE_PRICE_PRO_MONTHLY}" "String"
update_parameter "${PREFIX}/stripe/price-unlimited-monthly" "${STRIPE_PRICE_UNLIMITED_MONTHLY}" "String"
update_parameter "${PREFIX}/stripe/price-starter-monthly" "${STRIPE_STARTER_PRICE_ID}" "String"

# Cognito Configuration
update_parameter "${PREFIX}/cognito/user-pool-id" "${COGNITO_USER_POOL_ID}" "String"
update_parameter "${PREFIX}/cognito/client-id" "${COGNITO_CLIENT_ID}" "String"

# Redis Configuration
update_parameter "${PREFIX}/redis/url" "${REDIS_URL}" "SecureString"

# Database Configuration
update_parameter "${PREFIX}/database/url" "${DATABASE_URL}" "SecureString"

# RDS-specific parameters (if using RDS)
update_parameter "${PREFIX}/rds/host" "${RDS_HOST}" "String"
update_parameter "${PREFIX}/rds/username" "${RDS_USERNAME}" "String"
update_parameter "${PREFIX}/rds/password" "${RDS_PASSWORD}" "SecureString"

# Frontend URL
update_parameter "${PREFIX}/frontend/url" "${FRONTEND_URL}" "String"

# Budget and Alerts
update_parameter "${PREFIX}/budget/daily-usd" "${DAILY_BUDGET_USD:-100}" "String"
update_parameter "${PREFIX}/alerts/email" "${ALERT_EMAIL}" "String"

# AWS Configuration
update_parameter "${PREFIX}/aws/account-id" "${AWS_ACCOUNT_ID}" "String"

# S3 Bucket Names
update_parameter "${PREFIX}/s3/uploads-bucket" "${UPLOADS_BUCKET_NAME}" "String"
update_parameter "${PREFIX}/s3/renders-bucket" "${RENDERS_BUCKET_NAME}" "String"
update_parameter "${PREFIX}/s3/guidance-bucket" "${GUIDANCE_BUCKET_NAME}" "String"
update_parameter "${PREFIX}/s3/smpl-assets-bucket" "${SMPL_ASSETS_BUCKET_NAME}" "String"

# Google Gemini Configuration
update_parameter "${PREFIX}/gemini/api-endpoint" "${GEMINI_API_ENDPOINT:-https://generativelanguage.googleapis.com}" "String"
update_parameter "${PREFIX}/gemini/daily-budget-usd" "${GEMINI_DAILY_BUDGET_USD:-200}" "String"
update_parameter "${PREFIX}/gemini/max-batch-size" "${GEMINI_MAX_BATCH_SIZE:-50}" "String"
update_parameter "${PREFIX}/gemini/service-account-json" "${GEMINI_SERVICE_ACCOUNT_JSON}" "SecureString"

# Application Security
update_parameter "${PREFIX}/security/internal-api-key" "${INTERNAL_API_KEY}" "SecureString"
update_parameter "${PREFIX}/security/jwt-secret" "${JWT_SECRET}" "SecureString"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Parameter Store update complete for ${STAGE}!"
echo ""
echo "💡 Next steps:"
echo "   1. Verify parameters in AWS Console: Systems Manager → Parameter Store"
echo "   2. Redeploy Lambda functions to pick up new configuration"
echo "   3. Restart ECS services if running"
echo ""
