#!/bin/bash

# LocalStack initialization script - runs after LocalStack is ready
# Creates S3 buckets, SQS queues, and other AWS resources for local testing

echo "Creating S3 bucket for garment uploads..."
awslocal s3 mb s3://garmax-tryon-uploads --region us-east-1

echo "Creating SQS FIFO queue for Gemini batch processing..."
awslocal sqs create-queue \
  --queue-name GarmaxAi-GeminiBatchProcessing-dev.fifo \
  --attributes FifoQueue=true,ContentBasedDeduplication=true \
  --region us-east-1

echo "Creating EventBridge event bus..."
awslocal events create-event-bus \
  --name GarmaxAi-Tryon-dev \
  --region us-east-1

echo "Creating DynamoDB table for budget tracking..."
awslocal dynamodb create-table \
  --table-name gemini_budget_tracking_dev \
  --attribute-definitions AttributeName=date,AttributeType=S \
  --key-schema AttributeName=date,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1

echo "Creating SSM parameter for Gemini service account..."
awslocal ssm put-parameter \
  --name "/garmaxai/gemini/dev/service-account-json" \
  --value '{"type":"service_account","project_id":"test"}' \
  --type SecureString \
  --region us-east-1

echo "LocalStack initialization complete!"
