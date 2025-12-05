# Idle Teardown/Restore Infrastructure Implementation

## Overview
Automated resource management system for cost optimization during idle periods. Enabled for all stages (DEV, QA, PROD) during beta phase.

## Architecture

### Lambda Functions Created

1. **TeardownOrchestrator** (`createTeardownOrchestrator.ts`)
   - Orchestrates shutdown of RDS, ElastiCache, ECS, and NAT Gateways
   - Stores state in DynamoDB and Parameter Store for restoration
   - Creates snapshots before deleting ElastiCache (PROD only)
   - Timeout: 15 minutes
   - Memory: 512 MB

2. **RestoreOrchestrator** (`createRestoreOrchestrator.ts`)
   - Restores all resources from idle state
   - Starts RDS cluster
   - Recreates ElastiCache from snapshot
   - Restores ECS service counts
   - Recreates NAT Gateways
   - Timeout: 15 minutes
   - Memory: 512 MB

3. **NATGatewayManager** (`createNATGatewayManager.ts`)
   - Manages NAT Gateway lifecycle
   - Preserves Elastic IPs during teardown
   - Restores routing tables
   - Timeout: 15 minutes
   - Memory: 256 MB

### DynamoDB State Table

**Table**: `garmaxai-resource-states-{stage}`
- **Partition Key**: `resourceId` (STRING) - e.g., "RDS_CLUSTER#prod"
- **Sort Key**: `timestamp` (STRING) - ISO 8601 timestamp
- **GSI**: `stage-index` (partition: stage, sort: timestamp)
- **Billing**: PAY_PER_REQUEST
- **Encryption**: AWS_MANAGED
- **Removal Policy**: 
  - PROD: RETAIN
  - DEV/QA: DESTROY

### EventBridge Rules

1. **Idle Detection Rule**
   - **Schedule**: 
     - DEV: Every 1 hour
     - QA: Every 2 hours
     - PROD: Every 8 hours (beta safety buffer)
   - **Target**: TeardownOrchestrator
   - **Retry**: 2 attempts

2. **Activity Detection Rule**
   - **Event Pattern**: 
     ```json
     {
       "source": ["garmaxai.activity"],
       "detail-type": ["User Activity Detected", "API Request Received"],
       "detail": { "stage": ["{stage}"] }
     }
     ```
   - **Target**: RestoreOrchestrator
   - **Retry**: 2 attempts

## IAM Permissions

### TeardownOrchestrator Permissions
```
RDS: StopDBCluster, DescribeDBClusters, ListTagsForResource
ElastiCache: CreateSnapshot, DeleteCacheCluster, DescribeCacheClusters, DescribeSnapshots
ECS: UpdateService, DescribeServices, ListServices
Lambda: InvokeFunction (NATGatewayManager)
DynamoDB: PutItem, GetItem, Query
SSM: PutParameter, GetParameter, DeleteParameter
SNS: Publish, CreateTopic
```

### RestoreOrchestrator Permissions
```
RDS: StartDBCluster, DescribeDBClusters
ElastiCache: CreateCacheCluster, DescribeCacheClusters, DescribeSnapshots
ECS: UpdateService, DescribeServices
Lambda: InvokeFunction (NATGatewayManager)
DynamoDB: PutItem, GetItem, Query, DeleteItem
SSM: GetParameter, DeleteParameter
SNS: Publish
```

### NATGatewayManager Permissions
```
EC2: DescribeNatGateways, CreateNatGateway, DeleteNatGateway
     DescribeAddresses, AllocateAddress, ReleaseAddress
     DescribeRouteTables, CreateRoute, DeleteRoute, ReplaceRoute, DescribeSubnets
DynamoDB: PutItem, GetItem, Query, UpdateItem
SSM: PutParameter, GetParameter
```

## Teardown Process Flow

1. **Idle Detection Triggered** (EventBridge scheduled rule)
2. **TeardownOrchestrator Invoked**
   - Check current state in DynamoDB
   - If already idle, skip
   - Update state to TEARDOWN_INITIATED
3. **Stop RDS Aurora Cluster**
   - Verify cluster is "available"
   - Stop cluster
   - Store cluster ID in Parameter Store
4. **Teardown ElastiCache**
   - Create snapshot (PROD only)
   - Delete cache cluster
   - Store snapshot name in Parameter Store
5. **Scale ECS Services to 0**
   - List all services in cluster
   - Update desired count to 0
   - Store original counts in Parameter Store
6. **Invoke NATGatewayManager**
   - Delete NAT Gateways
   - Preserve Elastic IPs
   - Save NAT Gateway configurations
   - Update route tables
7. **Update State to IDLE**
8. **Send SNS Notification**

## Restore Process Flow

1. **Activity Detected** (EventBridge custom event)
2. **RestoreOrchestrator Invoked**
   - Retrieve state from Parameter Store
3. **Start RDS Aurora Cluster**
   - Verify cluster is "stopped"
   - Start cluster
   - Wait for "available" state (if wait=true)
4. **Restore ElastiCache**
   - Retrieve snapshot name
   - Create new cache cluster from snapshot
5. **Restore ECS Services**
   - Retrieve original desired counts
   - Update services
6. **Invoke NATGatewayManager**
   - Recreate NAT Gateways
   - Restore route tables
7. **Clean Up State**
   - Delete Parameter Store entries
   - Remove DynamoDB records
8. **Send SNS Notification**

## Cost Savings Estimation

### Monthly Savings Per Stage

| Resource | DEV | QA | PROD (8hr idle) |
|----------|-----|-----|-----------------|
| Lambda idle | $2/mo | $3/mo | $1/mo |
| RDS Aurora stopped | $20/mo | $30/mo | $10/mo (66% uptime) |
| ElastiCache deleted | $13/mo | $13/mo | $4/mo (66% uptime) |
| NAT Gateway deleted | $32/mo | $32/mo | $10/mo (66% uptime) |
| ECS scaled to 0 | $10/mo | $15/mo | $5/mo (66% uptime) |
| **Total Savings** | **~$77/mo** | **~$93/mo** | **~$30/mo** |

**Annual Savings**: ~$200/month (~$2,400/year) across all stages during beta

## Manual Operations

### Trigger Teardown Manually
```bash
aws lambda invoke \
  --function-name GarmaxAi-TeardownOrchestrator-prod \
  --payload '{"resource":"all","stage":"prod"}' \
  /tmp/teardown-response.json
```

### Trigger Restore Manually
```bash
aws lambda invoke \
  --function-name GarmaxAi-RestoreOrchestrator-prod \
  --payload '{"resource":"all","stage":"prod","wait":true}' \
  /tmp/restore-response.json
```

### Trigger Activity Event (Auto-Restore)
```bash
aws events put-events \
  --entries '[{
    "Source": "garmaxai.activity",
    "DetailType": "User Activity Detected",
    "Detail": "{\"stage\":\"prod\",\"activityType\":\"api-request\"}"
  }]'
```

### Check Current State
```bash
aws dynamodb query \
  --table-name garmaxai-resource-states-prod \
  --index-name stage-index \
  --key-condition-expression "stage = :stage" \
  --expression-attribute-values '{":stage":{"S":"prod"}}' \
  --scan-index-forward false \
  --limit 10
```

## CloudFormation Outputs

- `TeardownOrchestratorArn` - Lambda ARN for teardown orchestration
- `RestoreOrchestratorArn` - Lambda ARN for restore orchestration
- `NATGatewayManagerArn` - Lambda ARN for NAT Gateway management
- `IdleDetectionRuleArn` - EventBridge rule ARN for idle detection
- `ActivityDetectionRuleArn` - EventBridge rule ARN for activity detection
- `ResourceStateTableName` - DynamoDB table name for state tracking

## Security Considerations

1. **PROD Safety Buffer**: 8-hour idle threshold provides safety margin during beta
2. **Snapshot Before Delete**: ElastiCache snapshots created for PROD before deletion
3. **State Persistence**: All configurations stored in Parameter Store for reliable restoration
4. **Elastic IP Preservation**: NAT Gateway EIPs preserved to avoid IP changes
5. **Retry Logic**: EventBridge rules configured with 2 retry attempts
6. **VPC Integration**: Lambda functions run in VPC for secure resource access

## Monitoring & Alerts

### SNS Topic
- **Topic Name**: `garmaxai-idle-notifications-{stage}`
- **Events**:
  - Teardown initiated
  - Teardown completed
  - Restore initiated
  - Restore completed
  - Errors during teardown/restore

### CloudWatch Logs
- `/aws/lambda/GarmaxAi-TeardownOrchestrator-{stage}`
- `/aws/lambda/GarmaxAi-RestoreOrchestrator-{stage}`
- `/aws/lambda/GarmaxAi-NATGatewayManager-{stage}`

### Metrics to Monitor
- Lambda invocation count
- Lambda error rate
- Lambda duration
- DynamoDB read/write units
- RDS start/stop operations
- NAT Gateway create/delete operations

## Next Steps

1. **Deploy Infrastructure**: Run `STAGE=prod npx cdk deploy --all`
2. **Configure SNS Subscriptions**: Add email/Slack endpoints to notification topic
3. **Test Teardown**: Manually invoke teardown in DEV environment
4. **Test Restore**: Manually invoke restore in DEV environment
5. **Monitor First Automatic Cycle**: Watch logs during first scheduled teardown
6. **Adjust Thresholds**: Tune idle detection intervals based on usage patterns
7. **Add CloudWatch Alarms**: Set up alerts for failed teardown/restore operations

## Production Readiness

When transitioning to production with real users:

1. **Disable Auto-Teardown for PROD**: Set `enabled: false` on PROD idle detection rule
2. **Keep DEV/QA Auto-Teardown**: Maintain cost savings on non-production environments
3. **Manual PROD Teardown**: Use manual Lambda invocation for planned maintenance windows
4. **Increase PROD Threshold**: Consider 24-hour idle threshold for PROD if auto-teardown needed
