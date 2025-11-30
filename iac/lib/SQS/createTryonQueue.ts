import * as cdk from 'aws-cdk-lib';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Stack } from 'aws-cdk-lib';
import { env } from '../../../parameters/config';

export default function createTryonQueue(
  stack: Stack,
  stage: string,
) {
  // Dead Letter Queue for failed messages
  const deadLetterQueue = new sqs.Queue(stack, `TryonDLQ-${stage}`, {
    queueName: `GarmaxAi-TryonDLQ-${stage}.fifo`,
    fifo: true,
    contentBasedDeduplication: true,
    retentionPeriod: cdk.Duration.days(14),
  });

  // Main processing queue
  const tryonQueue = new sqs.Queue(stack, `TryonProcessingQueue-${stage}`, {
    queueName: `GarmaxAi-TryonProcessing-${stage}.fifo`,
    fifo: true,
    contentBasedDeduplication: true,
    visibilityTimeout: cdk.Duration.minutes(5),
    receiveMessageWaitTime: cdk.Duration.seconds(20), // Long polling
    deadLetterQueue: {
      queue: deadLetterQueue,
      maxReceiveCount: 3, // Retry up to 3 times before moving to DLQ
    },
  });

  // Output queue URL for environment variables
  new cdk.CfnOutput(stack, `TryonQueueUrl-${stage}`, {
    value: tryonQueue.queueUrl,
    exportName: `TryonQueueUrl-${stage}`,
    description: 'Try-On Processing Queue URL',
  });

  new cdk.CfnOutput(stack, `TryonQueueArn-${stage}`, {
    value: tryonQueue.queueArn,
    exportName: `TryonQueueArn-${stage}`,
    description: 'Try-On Processing Queue ARN',
  });

  return { tryonQueue, deadLetterQueue };
}
