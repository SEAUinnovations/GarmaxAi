#!/bin/bash

# Script to update S3 bucket policy for CloudFront OAC
# This must be run after CDK deployment to enable OAC access

set -e

STAGE="${STAGE:-prod}"
REGION="${AWS_REGION:-us-east-1}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== Update S3 Bucket Policy for CloudFront OAC ===${NC}"
echo "Stage: $STAGE"
echo "Region: $REGION"
echo ""

# Get bucket name and distribution ID from CloudFormation outputs
echo -e "${YELLOW}Fetching CloudFormation outputs...${NC}"
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name "GarmaxAi-Frontend-${STAGE}" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue" \
  --output text)

DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --stack-name "GarmaxAi-Frontend-${STAGE}" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendDistributionId'].OutputValue" \
  --output text)

if [ -z "$BUCKET_NAME" ] || [ -z "$DISTRIBUTION_ID" ]; then
  echo -e "${RED}✗ Failed to get bucket name or distribution ID${NC}"
  echo "Bucket: $BUCKET_NAME"
  echo "Distribution: $DISTRIBUTION_ID"
  exit 1
fi

echo -e "${GREEN}✓ Found resources${NC}"
echo "  Bucket: $BUCKET_NAME"
echo "  Distribution: $DISTRIBUTION_ID"
echo ""

# Get AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "  Account: $ACCOUNT_ID"
echo ""

# Create bucket policy JSON
POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipalReadOnly",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::${BUCKET_NAME}/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::${ACCOUNT_ID}:distribution/${DISTRIBUTION_ID}"
        }
      }
    }
  ]
}
EOF
)

echo -e "${YELLOW}Applying bucket policy...${NC}"
echo "$POLICY" | aws s3api put-bucket-policy \
  --bucket "$BUCKET_NAME" \
  --policy file:///dev/stdin

echo -e "${GREEN}✓ Bucket policy updated successfully${NC}"
echo ""
echo -e "${GREEN}=== OAC Configuration Complete ===${NC}"
echo "CloudFront distribution $DISTRIBUTION_ID can now access S3 bucket $BUCKET_NAME"
