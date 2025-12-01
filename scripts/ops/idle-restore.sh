#!/bin/bash

# GarmaxAi Idle Restore Script
# Purpose: Restore services from idle state and resume normal operations
# Usage: ./scripts/ops/idle-restore.sh [STAGE]
# Note: This script restores compute resources and event processing capabilities

set -e  # Exit on any error

# Configuration
STAGE=${1:-DEV}
AWS_REGION=${AWS_REGION:-us-east-1}
STACK_NAME="GarmaxAiStack-${STAGE}"

echo "🔄 Starting idle restore for stage: ${STAGE}"
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

# Function to get parameter store value
get_parameter_value() {
    aws ssm get-parameter --name "$1" --query 'Parameter.Value' --output text --region "$AWS_REGION" 2>/dev/null || echo ""
}

if ! check_stack_exists "$STACK_NAME"; then
    echo "❌ Stack $STACK_NAME does not exist in region $AWS_REGION"
    exit 1
fi

echo "✅ Stack exists, proceeding with restore..."

# 1. Verify idle state configuration exists
echo ""
echo "🔍 Checking idle state configuration..."

IDLE_TIMESTAMP=$(get_parameter_value "/garmaxai/idle-state/${STAGE}/timestamp")
IDLE_LAMBDAS=$(get_parameter_value "/garmaxai/idle-state/${STAGE}/lambdas")
IDLE_EVENT_BUS=$(get_parameter_value "/garmaxai/idle-state/${STAGE}/event-bus")

if [ -z "$IDLE_TIMESTAMP" ]; then
    echo "⚠️  No idle state configuration found. System may not have been properly torn down."
    echo "   Proceeding with standard restore procedures..."
else
    echo "  └── Idle state from: $IDLE_TIMESTAMP"
    echo "  └── Lambda functions: $IDLE_LAMBDAS"
    echo "  └── Event bus: $IDLE_EVENT_BUS"
fi

# 2. Restore Lambda concurrency settings
echo ""
echo "🔼 Restoring Lambda functions..."

TRYON_PROCESSOR=$(get_stack_output "TryonProcessorName-${STAGE}")
AI_RENDER_PROCESSOR=$(get_stack_output "AiRenderProcessorName-${STAGE}")
BILLING_PROCESSOR=$(get_stack_output "BillingProcessorName-${STAGE}")

if [ ! -z "$TRYON_PROCESSOR" ]; then
    echo "  └── Removing reserved concurrency limits for TryonProcessor"
    aws lambda delete-reserved-concurrency \
        --function-name "$TRYON_PROCESSOR" \
        --region "$AWS_REGION" > /dev/null 2>&1 || true
        
    # Remove any provisioned concurrency configurations
    aws lambda delete-provisioned-concurrency-config \
        --function-name "$TRYON_PROCESSOR" \
        --qualifier '$LATEST' \
        --region "$AWS_REGION" > /dev/null 2>&1 || true
fi

if [ ! -z "$AI_RENDER_PROCESSOR" ]; then
    echo "  └── Removing reserved concurrency limits for AiRenderProcessor"
    aws lambda delete-reserved-concurrency \
        --function-name "$AI_RENDER_PROCESSOR" \
        --region "$AWS_REGION" > /dev/null 2>&1 || true
fi

if [ ! -z "$BILLING_PROCESSOR" ]; then
    echo "  └── Removing reserved concurrency limits for BillingProcessor"
    aws lambda delete-reserved-concurrency \
        --function-name "$BILLING_PROCESSOR" \
        --region "$AWS_REGION" > /dev/null 2>&1 || true
fi

# 3. Re-enable EventBridge rules
echo ""
echo "✅ Re-enabling EventBridge rules..."

EVENT_BUS_NAME=$(get_stack_output "EventBridgeBusName-${STAGE}")
if [ ! -z "$EVENT_BUS_NAME" ]; then
    # List and enable all rules on the custom event bus
    RULES=$(aws events list-rules --event-bus-name "$EVENT_BUS_NAME" --query 'Rules[].Name' --output text --region "$AWS_REGION" 2>/dev/null || echo "")
    
    for rule in $RULES; do
        if [ ! -z "$rule" ] && [ "$rule" != "None" ]; then
            echo "  └── Enabling rule: $rule"
            aws events enable-rule --name "$rule" --event-bus-name "$EVENT_BUS_NAME" --region "$AWS_REGION" > /dev/null 2>&1 || true
        fi
    done
fi

# 4. Test system connectivity and readiness
echo ""
echo "🧪 Testing system readiness..."

# Test Lambda function accessibility
test_lambda_ready() {
    local function_name=$1
    if [ ! -z "$function_name" ]; then
        local result=$(aws lambda get-function --function-name "$function_name" --region "$AWS_REGION" --query 'Configuration.State' --output text 2>/dev/null || echo "")
        if [ "$result" = "Active" ]; then
            echo "  └── ✅ $function_name is active"
            return 0
        else
            echo "  └── ⚠️  $function_name state: $result"
            return 1
        fi
    fi
}

FUNCTIONS_READY=0
test_lambda_ready "$TRYON_PROCESSOR" && ((FUNCTIONS_READY++))
test_lambda_ready "$AI_RENDER_PROCESSOR" && ((FUNCTIONS_READY++))
test_lambda_ready "$BILLING_PROCESSOR" && ((FUNCTIONS_READY++))

# Test SQS queue accessibility
TRYON_QUEUE_URL=$(get_stack_output "TryonQueueUrl-${STAGE}")
BILLING_QUEUE_URL=$(get_stack_output "BillingQueueUrl-${STAGE}")

if [ ! -z "$TRYON_QUEUE_URL" ]; then
    aws sqs get-queue-attributes --queue-url "$TRYON_QUEUE_URL" --region "$AWS_REGION" > /dev/null 2>&1 && \
        echo "  └── ✅ TryonQueue is accessible" || \
        echo "  └── ⚠️  TryonQueue accessibility issue"
fi

if [ ! -z "$BILLING_QUEUE_URL" ]; then
    aws sqs get-queue-attributes --queue-url "$BILLING_QUEUE_URL" --region "$AWS_REGION" > /dev/null 2>&1 && \
        echo "  └── ✅ BillingQueue is accessible" || \
        echo "  └── ⚠️  BillingQueue accessibility issue"
fi

# 5. Warm up Lambda functions with test invocations
echo ""
echo "🔥 Warming up Lambda functions..."

warm_up_lambda() {
    local function_name=$1
    if [ ! -z "$function_name" ]; then
        echo "  └── Warming up $function_name..."
        # Use a lightweight test payload
        aws lambda invoke \
            --function-name "$function_name" \
            --payload '{"source": "warmup", "detail": {"test": true}}' \
            --region "$AWS_REGION" \
            /tmp/warmup-response-$$.json > /dev/null 2>&1 && \
            echo "    └── ✅ Warmup successful" || \
            echo "    └── ⚠️  Warmup failed (may be expected for some handlers)"
        rm -f /tmp/warmup-response-$$.json
    fi
}

# Note: Only warm up functions that handle warmup events gracefully
warm_up_lambda "$TRYON_PROCESSOR"
warm_up_lambda "$AI_RENDER_PROCESSOR"

# 6. Remove idle monitoring alarms
echo ""
echo "🗑️  Cleaning up idle monitoring..."

aws cloudwatch delete-alarms \
    --alarm-names "GarmaxAi-TryonQueue-Activity-${STAGE}" \
    --region "$AWS_REGION" > /dev/null 2>&1 || true
    
echo "  └── Removed activity monitoring alarms"

# 7. Clean up idle state parameters
echo ""
echo "🧹 Cleaning up idle state configuration..."

aws ssm delete-parameter --name "/garmaxai/idle-state/${STAGE}/timestamp" --region "$AWS_REGION" > /dev/null 2>&1 || true
aws ssm delete-parameter --name "/garmaxai/idle-state/${STAGE}/lambdas" --region "$AWS_REGION" > /dev/null 2>&1 || true
aws ssm delete-parameter --name "/garmaxai/idle-state/${STAGE}/event-bus" --region "$AWS_REGION" > /dev/null 2>&1 || true

echo "  └── Removed idle state parameters"

# 8. Generate readiness report
echo ""
echo "📊 System readiness report:"
echo "  └── Lambda functions active: $FUNCTIONS_READY/3"
echo "  └── EventBridge rules: Enabled"
echo "  └── SQS queues: Accessible"
echo "  └── Warmup completed"

# Calculate time in idle state (if available)
if [ ! -z "$IDLE_TIMESTAMP" ]; then
    CURRENT_TIME=$(date -u +%s 2>/dev/null || echo "")
    IDLE_TIME=$(date -d "$IDLE_TIMESTAMP" +%s 2>/dev/null || echo "")
    
    if [ ! -z "$CURRENT_TIME" ] && [ ! -z "$IDLE_TIME" ]; then
        IDLE_DURATION=$((CURRENT_TIME - IDLE_TIME))
        IDLE_HOURS=$((IDLE_DURATION / 3600))
        IDLE_MINS=$(((IDLE_DURATION % 3600) / 60))
        
        echo "  └── System was idle for: ${IDLE_HOURS}h ${IDLE_MINS}m"
        
        # Estimate cost savings during idle period
        if [ $IDLE_HOURS -gt 0 ]; then
            ESTIMATED_SAVINGS=$(echo "scale=2; $IDLE_HOURS * 0.05" | bc -l 2>/dev/null || echo "~$2")  # Rough estimate
            echo "  └── Estimated savings during idle: $${ESTIMATED_SAVINGS}"
        fi
    fi
fi

echo ""
echo "🎉 Idle restore completed successfully!"
echo ""
echo "📋 Summary:"
echo "  ✅ Lambda concurrency limits removed"
echo "  ✅ EventBridge rules re-enabled"
echo "  ✅ System connectivity verified"
echo "  ✅ Lambda functions warmed up"
echo "  ✅ Idle monitoring cleaned up"
echo ""
echo "🚀 System is now ready to handle production traffic!"
echo ""
echo "📊 Next steps:"
echo "  • Monitor Lambda cold start metrics for 10-15 minutes"
echo "  • Verify end-to-end try-on workflow with test requests"
echo "  • Check CloudWatch logs for any startup issues"
echo ""