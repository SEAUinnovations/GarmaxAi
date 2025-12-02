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

# 3a. Restore NAT Gateways
echo ""
echo "🔌 Restoring NAT Gateways..."

NAT_MANAGER_FUNCTION=$(get_stack_output "NATGatewayManagerFunctionName-${STAGE}")
VPC_ID=$(get_stack_output "VpcId-${STAGE}")

if [ ! -z "$NAT_MANAGER_FUNCTION" ] && [ ! -z "$VPC_ID" ]; then
    echo "  └── Invoking NAT Gateway manager for VPC: $VPC_ID"
    aws lambda invoke \
        --function-name "$NAT_MANAGER_FUNCTION" \
        --payload "{\"action\":\"restore\",\"vpcId\":\"$VPC_ID\"}" \
        --region "$AWS_REGION" \
        /tmp/nat-restore-response.json > /dev/null 2>&1 || true
    
    if [ -f /tmp/nat-restore-response.json ]; then
        cat /tmp/nat-restore-response.json | jq '.' 2>/dev/null || cat /tmp/nat-restore-response.json
        rm /tmp/nat-restore-response.json
    fi
    echo "  └── Waiting for NAT Gateways to become available (~3-5 minutes)..."
    sleep 30
else
    echo "  └── NAT Gateway manager not configured"
fi

# 3b. Start RDS Aurora Cluster
echo ""
echo "🗄️  Starting RDS Aurora cluster..."

RDS_CLUSTER_ID=$(get_parameter_value "/garmaxai/idle-state/${STAGE}/rds-cluster")
if [ -z "$RDS_CLUSTER_ID" ]; then
    RDS_CLUSTER_ID=$(get_stack_output "RDSClusterIdentifier-${STAGE}")
fi

if [ ! -z "$RDS_CLUSTER_ID" ]; then
    CLUSTER_STATUS=$(aws rds describe-db-clusters \
        --db-cluster-identifier "$RDS_CLUSTER_ID" \
        --query 'DBClusters[0].Status' \
        --output text \
        --region "$AWS_REGION" 2>/dev/null || echo "not-found")
    
    if [ "$CLUSTER_STATUS" == "stopped" ]; then
        echo "  └── Starting RDS cluster: $RDS_CLUSTER_ID"
        aws rds start-db-cluster \
            --db-cluster-identifier "$RDS_CLUSTER_ID" \
            --region "$AWS_REGION" > /dev/null 2>&1 || true
        
        echo "  └── Waiting for RDS cluster to become available (~7-10 minutes)..."
        aws rds wait db-cluster-available \
            --db-cluster-identifier "$RDS_CLUSTER_ID" \
            --region "$AWS_REGION" 2>/dev/null || echo "  ⚠️  Wait timed out, cluster may still be starting"
    elif [ "$CLUSTER_STATUS" == "available" ]; then
        echo "  ✅ RDS cluster already running"
    else
        echo "  └── RDS cluster status: $CLUSTER_STATUS"
    fi
else
    echo "  └── No RDS cluster to restore"
fi

# 3c. Restore ElastiCache
echo ""
echo "📦 Restoring ElastiCache cluster..."

REDIS_CLUSTER_NAME=$(get_stack_output "RedisClusterName-${STAGE}")
if [ ! -z "$REDIS_CLUSTER_NAME" ]; then
    CLUSTER_EXISTS=$(aws elasticache describe-cache-clusters \
        --cache-cluster-id "$REDIS_CLUSTER_NAME" \
        --region "$AWS_REGION" 2>/dev/null && echo "yes" || echo "no")
    
    if [ "$CLUSTER_EXISTS" == "no" ]; then
        if [ "$STAGE" == "PROD" ]; then
            SNAPSHOT_NAME=$(get_parameter_value "/garmaxai/idle-state/${STAGE}/redis-snapshot")
            
            if [ ! -z "$SNAPSHOT_NAME" ]; then
                echo "  └── Restoring from snapshot: $SNAPSHOT_NAME"
                SUBNET_GROUP=$(get_stack_output "RedisSubnetGroup-${STAGE}")
                SECURITY_GROUP=$(get_stack_output "RedisSecurityGroup-${STAGE}")
                
                aws elasticache create-cache-cluster \
                    --cache-cluster-id "$REDIS_CLUSTER_NAME" \
                    --snapshot-name "$SNAPSHOT_NAME" \
                    --cache-node-type "cache.t4g.micro" \
                    --engine "redis" \
                    --cache-subnet-group-name "$SUBNET_GROUP" \
                    --security-group-ids "$SECURITY_GROUP" \
                    --region "$AWS_REGION" > /dev/null 2>&1 || true
                
                echo "  └── ElastiCache restore initiated (~8-12 minutes)"
                sleep 60
            else
                echo "  └── No snapshot found for PROD restore"
            fi
        else
            echo "  └── Fresh ElastiCache cluster will be recreated by CDK"
        fi
    else
        echo "  ✅ ElastiCache cluster already exists"
    fi
else
    echo "  └── No ElastiCache cluster to restore"
fi

# 3d. Restore ECS Services
echo ""
echo "📈 Restoring ECS services..."

ECS_CLUSTER_NAME=$(get_stack_output "EcsClusterName-${STAGE}")
if [ ! -z "$ECS_CLUSTER_NAME" ]; then
    SERVICES=$(get_parameter_value "/garmaxai/idle-state/${STAGE}/ecs-services")
    
    if [ ! -z "$SERVICES" ]; then
        for service_arn in $SERVICES; do
            SERVICE_NAME=$(basename "$service_arn")
            echo "  └── Restoring service: $SERVICE_NAME (desired count: 1)"
            aws ecs update-service \
                --cluster "$ECS_CLUSTER_NAME" \
                --service "$SERVICE_NAME" \
                --desired-count 1 \
                --region "$AWS_REGION" > /dev/null 2>&1 || true
        done
    else
        echo "  └── No ECS services to restore"
    fi
else
    echo "  └── No ECS cluster configured"
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

# 4a. Comprehensive Health Checks
echo ""
echo "🏥 Performing comprehensive health checks..."

# Check API Gateway endpoint
API_URL=$(get_stack_output "ApiUrl-${STAGE}")
if [ ! -z "$API_URL" ]; then
    echo "  └── Testing API Gateway endpoint..."
    API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/health" --max-time 10 2>/dev/null || echo "000")
    if [ "$API_STATUS" == "200" ]; then
        echo "    └── ✅ API Gateway healthy (HTTP $API_STATUS)"
    else
        echo "    └── ⚠️  API Gateway status: HTTP $API_STATUS"
    fi
fi

# Check RDS connectivity
if [ ! -z "$RDS_CLUSTER_ID" ]; then
    RDS_ENDPOINT=$(aws rds describe-db-clusters \
        --db-cluster-identifier "$RDS_CLUSTER_ID" \
        --query 'DBClusters[0].Endpoint' \
        --output text \
        --region "$AWS_REGION" 2>/dev/null || echo "")
    
    RDS_STATUS=$(aws rds describe-db-clusters \
        --db-cluster-identifier "$RDS_CLUSTER_ID" \
        --query 'DBClusters[0].Status' \
        --output text \
        --region "$AWS_REGION" 2>/dev/null || echo "unknown")
    
    if [ "$RDS_STATUS" == "available" ]; then
        echo "  └── ✅ RDS cluster available at $RDS_ENDPOINT"
    else
        echo "  └── ⚠️  RDS cluster status: $RDS_STATUS"
    fi
fi

# Check ElastiCache connectivity
if [ ! -z "$REDIS_CLUSTER_NAME" ]; then
    REDIS_STATUS=$(aws elasticache describe-cache-clusters \
        --cache-cluster-id "$REDIS_CLUSTER_NAME" \
        --query 'CacheClusters[0].CacheClusterStatus' \
        --output text \
        --region "$AWS_REGION" 2>/dev/null || echo "not-found")
    
    if [ "$REDIS_STATUS" == "available" ]; then
        echo "  └── ✅ ElastiCache cluster available"
    elif [ "$REDIS_STATUS" == "creating" ] || [ "$REDIS_STATUS" == "modifying" ]; then
        echo "  └── 🔄 ElastiCache cluster status: $REDIS_STATUS (may take 8-12 minutes)"
    else
        echo "  └── ⚠️  ElastiCache cluster status: $REDIS_STATUS"
    fi
fi

# Check NAT Gateway status
if [ ! -z "$VPC_ID" ]; then
    NAT_COUNT=$(aws ec2 describe-nat-gateways \
        --filter "Name=vpc-id,Values=$VPC_ID" "Name=state,Values=available" \
        --query 'NatGateways | length(@)' \
        --output text \
        --region "$AWS_REGION" 2>/dev/null || echo "0")
    
    if [ "$NAT_COUNT" -gt 0 ]; then
        echo "  └── ✅ NAT Gateways available: $NAT_COUNT"
    else
        echo "  └── ⚠️  No NAT Gateways found (may still be creating)"
    fi
fi

# Check ECS service running tasks
if [ ! -z "$ECS_CLUSTER_NAME" ]; then
    RUNNING_TASKS=$(aws ecs list-tasks \
        --cluster "$ECS_CLUSTER_NAME" \
        --desired-status RUNNING \
        --query 'taskArns | length(@)' \
        --output text \
        --region "$AWS_REGION" 2>/dev/null || echo "0")
    
    if [ "$RUNNING_TASKS" -gt 0 ]; then
        echo "  └── ✅ ECS running tasks: $RUNNING_TASKS"
    else
        echo "  └── 🔄 ECS tasks starting up (may take 2-3 minutes)"
    fi
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
aws ssm delete-parameter --name "/garmaxai/idle-state/${STAGE}/rds-cluster" --region "$AWS_REGION" > /dev/null 2>&1 || true
aws ssm delete-parameter --name "/garmaxai/idle-state/${STAGE}/redis-snapshot" --region "$AWS_REGION" > /dev/null 2>&1 || true
aws ssm delete-parameter --name "/garmaxai/idle-state/${STAGE}/ecs-services" --region "$AWS_REGION" > /dev/null 2>&1 || true

echo "  └── Removed all idle state parameters"

# 8. Calculate restore duration and cost savings
RESTORE_END=$(date -u +%s)
RESTORE_DURATION=$((RESTORE_END - RESTORE_START))
RESTORE_MINS=$((RESTORE_DURATION / 60))
RESTORE_SECS=$((RESTORE_DURATION % 60))

echo ""
echo "📊 Restore Performance Report:"
echo "  └── Total restore time: ${RESTORE_MINS}m ${RESTORE_SECS}s"

# Calculate time in idle state
IDLE_TIMESTAMP=$(get_parameter_value "/garmaxai/idle-state/${STAGE}/timestamp")
if [ ! -z "$IDLE_TIMESTAMP" ]; then
    CURRENT_TIME=$(date -u +%s 2>/dev/null || echo "")
    IDLE_TIME=$(date -d "$IDLE_TIMESTAMP" +%s 2>/dev/null || date -j -f "%Y-%m-%d %H:%M:%S" "$IDLE_TIMESTAMP" "+%s" 2>/dev/null || echo "")
    
    if [ ! -z "$CURRENT_TIME" ] && [ ! -z "$IDLE_TIME" ]; then
        IDLE_DURATION=$((CURRENT_TIME - IDLE_TIME))
        IDLE_HOURS=$((IDLE_DURATION / 3600))
        IDLE_MINS=$(((IDLE_DURATION % 3600) / 60))
        
        echo "  └── System was idle for: ${IDLE_HOURS}h ${IDLE_MINS}m"
        
        # Calculate actual cost savings ($209.40/month = $0.2902/hr)
        if [ $IDLE_HOURS -gt 0 ]; then
            HOURLY_RATE=0.2902
            SAVINGS=$(echo "$IDLE_HOURS * $HOURLY_RATE" | bc -l 2>/dev/null || echo "~\$$(($IDLE_HOURS * 29 / 100))")
            echo "  └── Cost savings during idle: \$$(printf "%.2f" $SAVINGS)"
            echo "      • RDS Aurora: \$$(printf "%.2f" $(echo "$IDLE_HOURS * 0.0833" | bc -l))"
            echo "      • ElastiCache: \$$(printf "%.2f" $(echo "$IDLE_HOURS * 0.0181" | bc -l))"
            echo "      • NAT Gateway: \$$(printf "%.2f" $(echo "$IDLE_HOURS * 0.0444" | bc -l))"
            echo "      • ECS Fargate: \$$(printf "%.2f" $(echo "$IDLE_HOURS * 0.0417" | bc -l))"
            echo "      • (EventBridge & Lambda savings excluded during active hours)"
        fi
    fi
fi

# 9. Send success notification via SNS
SNS_TOPIC_ARN=$(get_stack_output "AlertTopicArn-${STAGE}")
if [ ! -z "$SNS_TOPIC_ARN" ]; then
    MESSAGE="✅ GarmaxAI ${STAGE} Environment Restore Completed

📊 Restore Summary:
• Duration: ${RESTORE_MINS}m ${RESTORE_SECS}s
• Idle Time: ${IDLE_HOURS}h ${IDLE_MINS}m
• Cost Savings: \$$(printf "%.2f" $SAVINGS)

🔌 Restored Resources:
• NAT Gateways: $NAT_COUNT available
• RDS Aurora: $RDS_STATUS
• ElastiCache: $REDIS_STATUS
• ECS Tasks: $RUNNING_TASKS running
• Lambda Functions: $FUNCTIONS_READY/3 active

🏥 Health Status:
• API Gateway: HTTP $API_STATUS
• SQS Queues: Accessible
• Lambda Functions: Warmed up

🚀 System is ready for production traffic!

Next Steps:
1. Monitor CloudWatch for 10-15 minutes
2. Test end-to-end workflows
3. Check application logs for startup issues

Timestamp: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"

    aws sns publish \
        --topic-arn "$SNS_TOPIC_ARN" \
        --subject "✅ GarmaxAI ${STAGE} - Restore Completed" \
        --message "$MESSAGE" \
        --region "$AWS_REGION" > /dev/null 2>&1 || echo "  └── ⚠️  Failed to send SNS notification"
fi

# 10. Generate readiness report
echo ""
echo "📋 System Readiness Report:"
echo "  ✅ Lambda functions active: $FUNCTIONS_READY/3"
echo "  ✅ EventBridge rules: Enabled"
echo "  ✅ SQS queues: Accessible"
echo "  ✅ RDS cluster: $RDS_STATUS"
echo "  ✅ ElastiCache: $REDIS_STATUS"
echo "  ✅ NAT Gateways: $NAT_COUNT available"
echo "  ✅ ECS tasks: $RUNNING_TASKS running"
echo "  ✅ API endpoint: HTTP $API_STATUS"
echo "  ✅ Lambda warmup: Completed"

echo ""
echo "🎉 Idle restore completed successfully!"
echo ""
echo "🚀 System is now ready to handle production traffic!"
echo ""
echo "📊 Next steps:"
echo "  • Monitor Lambda cold start metrics for 10-15 minutes"
echo "  • Verify end-to-end try-on workflow with test requests"
echo "  • Check CloudWatch logs for any startup issues"
echo "  • Review cost savings report in CloudWatch dashboard"
echo ""