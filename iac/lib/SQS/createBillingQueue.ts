import * as cdk from 'aws-cdk-lib';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Stack } from 'aws-cdk-lib';

export default function createBillingQueue(
  stack: Stack,
  stage: string,
) {
  const dlq = new sqs.Queue(stack, `BillingDLQ-${stage}`, {
    queueName: `GarmaxAi-BillingDLQ-${stage}.fifo`,
    fifo: true,
    contentBasedDeduplication: true,
    retentionPeriod: cdk.Duration.days(14),
  });

  const billingQueue = new sqs.Queue(stack, `BillingQueue-${stage}`, {
    queueName: `GarmaxAi-Billing-${stage}.fifo`,
    fifo: true,
    contentBasedDeduplication: true,
    visibilityTimeout: cdk.Duration.minutes(5),
    receiveMessageWaitTime: cdk.Duration.seconds(20),
    deadLetterQueue: { queue: dlq, maxReceiveCount: 3 },
  });

  new cdk.CfnOutput(stack, `BillingQueueUrl-${stage}`, {
    value: billingQueue.queueUrl,
    exportName: `BillingQueueUrl-${stage}`,
    description: 'Billing (Stripe) Queue URL',
  });

  new cdk.CfnOutput(stack, `BillingQueueArn-${stage}`, {
    value: billingQueue.queueArn,
    exportName: `BillingQueueArn-${stage}`,
    description: 'Billing (Stripe) Queue ARN',
  });

  return { billingQueue, billingDlq: dlq };
}
