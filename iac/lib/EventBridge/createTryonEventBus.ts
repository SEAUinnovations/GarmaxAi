import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Stack } from 'aws-cdk-lib';
import { env } from '../../../parameters/config';

export default function createTryonEventBus(
  stack: Stack,
  stage: string,
  tryonQueue: sqs.Queue,
  billingQueue?: sqs.Queue,
  tryonProcessor?: lambda.Function,
  aiRenderProcessor?: lambda.Function,
) {
  // Create custom EventBridge bus for try-on events
  const tryonEventBus = new events.EventBus(stack, `TryonEventBus-${stage}`, {
    eventBusName: `GarmaxAi-Tryon-${stage}`,
  });

  // Rule for session creation events -> SQS Queue
  const sessionCreateRule = new events.Rule(stack, `TryonSessionCreateRule-${stage}`, {
    eventBus: tryonEventBus,
    ruleName: `GarmaxAi-TryonSessionCreate-${stage}`,
    description: 'Route try-on session creation events to processing queue',
    eventPattern: {
      source: ['garmax.tryon'],
      detailType: ['tryon.session.create'],
    },
  });

  sessionCreateRule.addTarget(new targets.SqsQueue(tryonQueue, {
    messageGroupId: 'tryon-sessions',
  }));

  // Stripe events -> SQS Queue (fan-out entry point)
  const stripeRule = new events.Rule(stack, `StripeEventsRule-${stage}`, {
    eventBus: tryonEventBus,
    ruleName: `GarmaxAi-StripeEvents-${stage}`,
    description: 'Route verified Stripe events from webhook to processing queue',
    eventPattern: {
      source: ['stripe'],
      detailType: [
        'checkout.session.completed',
        'payment_intent.succeeded',
        'payment_intent.payment_failed',
        'invoice.payment_succeeded',
        'invoice.payment_failed',
        'customer.subscription.created',
        'customer.subscription.updated',
        'customer.subscription.deleted',
      ],
    },
  });

  stripeRule.addTarget(new targets.SqsQueue(billingQueue ?? tryonQueue, {
    messageGroupId: 'stripe-events',
  }));

  // Rule for render request events -> Lambda (if provided)
  if (aiRenderProcessor) {
    const renderRequestRule = new events.Rule(stack, `TryonRenderRequestRule-${stage}`, {
      eventBus: tryonEventBus,
      ruleName: `GarmaxAi-TryonRenderRequest-${stage}`,
      description: 'Route try-on render requests to AI processor',
      eventPattern: {
        source: ['garmax.tryon'],
        detailType: ['tryon.render.requested'],
      },
    });

    renderRequestRule.addTarget(new targets.LambdaFunction(aiRenderProcessor));
  }

  // Optional: Rule to trigger Lambda directly for processing (alternative to SQS)
  if (tryonProcessor) {
    const processingRule = new events.Rule(stack, `TryonProcessingRule-${stage}`, {
      eventBus: tryonEventBus,
      ruleName: `GarmaxAi-TryonProcessing-${stage}`,
      description: 'Route try-on events to processor Lambda',
      eventPattern: {
        source: ['garmax.tryon'],
        detailType: ['tryon.session.create', 'tryon.render.requested'],
      },
    });

    // Uncomment to enable direct Lambda invocation
    // processingRule.addTarget(new targets.LambdaFunction(tryonProcessor));
  }

  // Output event bus ARN
  new cdk.CfnOutput(stack, `TryonEventBusArn-${stage}`, {
    value: tryonEventBus.eventBusArn,
    exportName: `TryonEventBusArn-${stage}`,
    description: 'Try-On EventBridge Bus ARN',
  });

  new cdk.CfnOutput(stack, `TryonEventBusName-${stage}`, {
    value: tryonEventBus.eventBusName,
    exportName: `TryonEventBusName-${stage}`,
    description: 'Try-On EventBridge Bus Name',
  });

  return tryonEventBus;
}
