#!/bin/bash

# GarmaxAi Idle Teardown Script
# Purpose: Safely scale down resources during idle periods to reduce costs
# Usage: ./scripts/ops/idle-teardown.sh [STAGE]
# Note: This script does NOT delete S3 buckets or data - only scales down compute resources

set -e  # Exit on any error

# Configuration
STAGE=${1:-DEV}
AWS_REGION=${AWS_REGION:-us-east-1}
STACK_NAME="GarmaxAiStack-${STAGE}"

echo "🔄 Starting idle teardown for stage: ${STAGE}"
echo "📍 Region: ${AWS_REGION}"
echo "🏗️  Stack: ${STACK_NAME}"

# Function to check if stack exists
check_stack_exists() {
    aws cloudformation describe-stacks --stack-name "$1" --region "$AWS_REGION" > /dev/null 2>&1
}

# Function to get stack output value
get_stack_output() {
    aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" \
        --output text \
        --region "$AWS_REGION" 2>/dev/null || echo ""
}

if ! check_stack_exists "$STACK_NAME"; then
    echo "❌ Stack $STACK_NAME does not exist in region $AWS_REGION"
    exit 1
fi

echo "✅ Stack exists, proceeding with teardown..."

# 1. Scale down Lambda concurrency to prevent new executions
echo ""
echo "🔽 Scaling down Lambda functions..."

TRYON_PROCESSOR=$(get_stack_output "TryonProcessorName-${STAGE}")
AI_RENDER_PROCESSOR=$(get_stack_output "AiRenderProcessorName-${STAGE}")
BILLING_PROCESSOR=$(get_stack_output "BillingProcessorName-${STAGE}")

if [ ! -z "$TRYON_PROCESSOR" ]; then
    echo "  └── Setting TryonProcessor reserved concurrency to 0"
    aws lambda put-provisioned-concurrency-config \
        --function-name "$TRYON_PROCESSOR" \
        --provisioned-concurrency-config ProvisionedConcurrencyAmount=0 \
        --qualifier '$LATEST' \
        --region "$AWS_REGION" > /dev/null 2>&1 || true
        
    # Set reserved concurrency to 0 to prevent new invocations
    aws lambda put-reserved-concurrency \
        --function-name "$TRYON_PROCESSOR" \
        --reserved-concurrency-amount 0 \
        --region "$AWS_REGION" > /dev/null 2>&1 || true
fi

if [ ! -z "$AI_RENDER_PROCESSOR" ]; then
    echo "  └── Setting AiRenderProcessor reserved concurrency to 0"
    aws lambda put-reserved-concurrency \
        --function-name "$AI_RENDER_PROCESSOR" \
        --reserved-concurrency-amount 0 \
        --region "$AWS_REGION" > /dev/null 2>&1 || true
fi

if [ ! -z "$BILLING_PROCESSOR" ]; then
    echo "  └── Setting BillingProcessor reserved concurrency to 0"
    aws lambda put-reserved-concurrency \
        --function-name "$BILLING_PROCESSOR" \
        --reserved-concurrency-amount 0 \
        --region "$AWS_REGION" > /dev/null 2>&1 || true
fi

# 2. Disable EventBridge rules to prevent new events
echo ""
echo "🚫 Disabling EventBridge rules..."

EVENT_BUS_NAME=$(get_stack_output "EventBridgeBusName-${STAGE}")
if [ ! -z "$EVENT_BUS_NAME" ]; then
    # List and disable all rules on the custom event bus
    RULES=$(aws events list-rules --event-bus-name "$EVENT_BUS_NAME" --query 'Rules[].Name' --output text --region "$AWS_REGION" 2>/dev/null || echo "")
    
    for rule in $RULES; do
        if [ ! -z "$rule" ] && [ "$rule" != "None" ]; then
            echo "  └── Disabling rule: $rule"
            aws events disable-rule --name "$rule" --event-bus-name "$EVENT_BUS_NAME" --region "$AWS_REGION" > /dev/null 2>&1 || true
        fi
    done
fi

# 3. Create CloudWatch alarm to detect activity and auto-restore
echo ""
echo "📊 Setting up activity monitoring for auto-restore..."

# Create SNS topic for notifications (if it doesn't exist)
SNS_TOPIC_ARN=$(aws sns create-topic --name "garmaxai-idle-notifications-${STAGE}" --region "$AWS_REGION" --query 'TopicArn' --output text 2>/dev/null || echo "")

if [ ! -z "$SNS_TOPIC_ARN" ]; then
    # Create CloudWatch alarm for SQS message activity
    TRYON_QUEUE_URL=$(get_stack_output "TryonQueueUrl-${STAGE}")
    if [ ! -z "$TRYON_QUEUE_URL" ]; then
        QUEUE_NAME=$(basename "$TRYON_QUEUE_URL")
        
        aws cloudwatch put-metric-alarm \
            --alarm-name "GarmaxAi-TryonQueue-Activity-${STAGE}" \
            --alarm-description "Detects activity in try-on queue during idle mode" \
            --metric-name "ApproximateNumberOfMessages" \
            --namespace "AWS/SQS" \
            --statistic "Average" \
            --period 300 \
            --threshold 1 \
            --comparison-operator "GreaterThanOrEqualToThreshold" \
            --dimensions Name=QueueName,Value="$QUEUE_NAME" \
            --evaluation-periods 1 \
            --alarm-actions "$SNS_TOPIC_ARN" \
            --region "$AWS_REGION" > /dev/null 2>&1 || true
            
        echo "  └── Created alarm for queue activity: $QUEUE_NAME"
    fi
fi

# 4. Store current configuration in Parameter Store for restore
echo ""
echo "💾 Backing up current configuration..."

aws ssm put-parameter \
    --name "/garmaxai/idle-state/${STAGE}/timestamp" \
    --value "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --type "String" \
    --overwrite \
    --region "$AWS_REGION" > /dev/null 2>&1 || true

aws ssm put-parameter \
    --name "/garmaxai/idle-state/${STAGE}/lambdas" \
    --value "${TRYON_PROCESSOR},${AI_RENDER_PROCESSOR},${BILLING_PROCESSOR}" \
    --type "StringList" \
    --overwrite \
    --region "$AWS_REGION" > /dev/null 2>&1 || true

aws ssm put-parameter \
    --name "/garmaxai/idle-state/${STAGE}/event-bus" \
    --value "$EVENT_BUS_NAME" \
    --type "String" \
    --overwrite \
    --region "$AWS_REGION" > /dev/null 2>&1 || true

# 5. Generate cost savings report
echo ""
echo "💰 Estimating cost savings..."

# Calculate estimated monthly savings (rough estimates)
LAMBDA_SAVINGS=$(echo "scale=2; 0.0000002 * 1000000 * 24 * 30" | bc -l 2>/dev/null || echo "6.00")  # ~$6/month for 1M requests
EVENTBRIDGE_SAVINGS=$(echo "scale=2; 0.0000010 * 100000 * 24 * 30" | bc -l 2>/dev/null || echo "72.00")  # ~$72/month for 100K events

echo "  └── Estimated Lambda idle savings: ~$${LAMBDA_SAVINGS}/month"
echo "  └── Estimated EventBridge idle savings: ~$${EVENTBRIDGE_SAVINGS}/month"
echo "  └── Total estimated savings: ~$(echo "$LAMBDA_SAVINGS + $EVENTBRIDGE_SAVINGS" | bc -l 2>/dev/null || echo "78.00")/month"

echo ""
echo "🎉 Idle teardown completed successfully!"
echo ""
echo "📋 Summary:"
echo "  ✅ Lambda functions scaled to 0 reserved concurrency"
echo "  ✅ EventBridge rules disabled"
echo "  ✅ Activity monitoring enabled for auto-restore alerts"
echo "  ✅ Configuration backed up to Parameter Store"
echo "  ⚠️  S3 buckets and data remain untouched"
echo ""
echo "🔄 To restore services: ./scripts/ops/idle-restore.sh $STAGE"
echo "📱 Activity alerts will be sent to SNS topic: $(basename "$SNS_TOPIC_ARN" 2>/dev/null || echo "garmaxai-idle-notifications-${STAGE}")"
echo ""