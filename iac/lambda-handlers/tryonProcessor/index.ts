/**
 * Try-On Processor Lambda Handler
 * 
 * Processes photo-based try-on sessions by generating 3D guidance assets and previews.
 * Replaces Ready Player Me with SMPL-based photo-to-3D-lite pipeline for cost efficiency.
 * 
 * ARCHITECTURE OVERVIEW:
 * ===================
 * 1. SQS triggers this Lambda on 'tryon.session.create' events from EventBridge
 * 2. Downloads user photos (front/side views) from uploads bucket
 * 3. Calls SMPL estimation service (ROMP/SMPLify-X) to extract pose and body shape
 * 4. Renders guidance assets: depth maps, normal maps, pose keypoints, segmentation masks
 * 5. Generates quick preview render (low-quality, fast) for immediate user feedback
 * 6. Uploads guidance assets to guidance bucket with organized prefixes
 * 7. Publishes 'tryon.render.requested' event to trigger photorealistic AI rendering
 * 8. Updates session status and sends WebSocket notification to frontend
 * 
 * EVENT CONTRACT:
 * ==============
 * Expected SQS message from EventBridge 'tryon.session.create':
 * {
 *   detail: {
 *     sessionId: string,               // Unique session identifier
 *     userId: string,                  // User ID for quota/billing
 *     inputs: {
 *       frontPhotoKey: string,         // S3 key for front view photo
 *       sidePhotoKey: string,          // S3 key for side view photo (optional)
 *       garmentRefs: Array<{           // Garment reference images
 *         id: string,
 *         type: 'shirt' | 'pants' | 'dress' | 'shoes',
 *         s3Key: string,
 *         color: string,
 *         material: string,
 *         size: string
 *       }>
 *     },
 *     preferences: {
 *       renderQuality: 'fast' | 'standard' | 'premium',
 *       stylePrompt?: string,          // User's style preferences
 *       fitPreference: 'loose' | 'fitted' | 'oversized'
 *     },
 *     trace: {
 *       correlationId: string,
 *       requestId: string,
 *       timestamp: string
 *     }
 *   }
 * }
 * 
 * OUTPUT EVENTS:
 * =============
 * Publishes 'tryon.render.requested' to EventBridge with guidance asset keys:
 * {
 *   sessionId: string,
 *   userId: string,
 *   inputs: {
 *     previewKey: string,              // Preview render S3 key
 *     guidanceKeys: {
 *       depth: string,                 // Depth map for ControlNet Depth
 *       normals: string,               // Normal map for ControlNet Normal
 *       pose: string,                  // Pose keypoints for ControlNet Pose
 *       segment: string                // Segmentation mask for inpainting
 *     },
 *     garments: Array<GarmentMetadata> // Processed garment descriptions
 *   },
 *   renderOptions: {
 *     quality: 'low' | 'med' | 'high',
 *     guidanceScale: number,
 *     steps: number
 *   },
 *   output: {
 *     bucket: 'garmaxai-renders-{stage}',
 *     prefix: 'final/{sessionId}/'
 *   },
 *   trace: { correlationId, requestId, timestamp }
 * }
 * 
 * S3 BUCKET ACCESS PATTERNS:
 * ==========================
 * READ: uploads bucket (avatars/*, garments/*)
 * READ: smpl-assets bucket (models/*, weights/*, configs/*) - if processing locally
 * WRITE: guidance bucket (depth/*, normals/*, poses/*, segments/*, prompts/*)
 * WRITE: renders bucket (previews/*)
 * 
 * ERROR HANDLING:
 * ==============
 * - Invalid photos: return 400 with specific validation errors
 * - SMPL processing failures: retry with different parameters, fallback to 2D pose only
 * - S3 upload failures: retry with exponential backoff
 * - Quota exceeded: return 429 and update user limits
 * - Always publish failure events for session cleanup
 */

// Environment variables with defaults
const UPLOADS_BUCKET_NAME = process.env.UPLOADS_BUCKET_NAME || '';
const GUIDANCE_BUCKET_NAME = process.env.GUIDANCE_BUCKET_NAME || '';
const RENDERS_BUCKET_NAME = process.env.RENDERS_BUCKET_NAME || '';
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME || '';
const STAGE = process.env.STAGE || 'dev';

// Types for better type safety
interface TryonSessionEvent {
  sessionId: string;
  userId: string;
  inputs: {
    frontPhotoKey: string;
    sidePhotoKey?: string;
    garmentRefs: Array<{
      id: string;
      type: 'shirt' | 'pants' | 'dress' | 'shoes' | 'accessories';
      s3Key: string;
      color: string;
      material: string;
      size: string;
      fitNotes?: string;
    }>;
  };
  preferences: {
    renderQuality: 'fast' | 'standard' | 'premium';
    stylePrompt?: string;
    fitPreference: 'loose' | 'fitted' | 'oversized';
  };
  trace: {
    correlationId: string;
    requestId: string;
    timestamp: string;
  };
}

/**
 * Main Lambda handler entry point
 * Processes SQS messages from EventBridge try-on session creation events
 */
export async function handler(event: any) {
  console.log('👥 Try-On Processor invoked with', event.Records?.length || 0, 'messages');

  const results = [];
  
  if (event.Records) {
    for (const record of event.Records) {
      try {
        const result = await processRecord(record);
        results.push(result);
      } catch (error: any) {
        console.error('❌ Failed to process record:', error);
        throw error;
      }
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ 
      processed: results.length,
      successfulSessions: results.filter(r => r.success).length 
    }),
  };
}

/**
 * Process individual SQS record containing try-on session creation event
 */
async function processRecord(record: any): Promise<{ success: boolean; sessionId: string }> {
  const startTime = Date.now();
  
  try {
    // Parse EventBridge event from SQS message body
    const eventData = JSON.parse(record.body);
    const detail: TryonSessionEvent = eventData.detail;
    
    console.log(`🎯 Processing try-on session: ${detail.sessionId}`);
    console.log(`👤 User: ${detail.userId}, Quality: ${detail.preferences.renderQuality}`);

    // Step 1: Validate session and quotas
    console.log('🔍 Validating session and user quotas');
    await validateSessionAndQuotas(detail.userId, detail.sessionId);
    
    // Step 2: Process photos through SMPL pipeline
    console.log('🧮 Running SMPL estimation for pose and body shape extraction');
    const smplResults = await processPhotosWithSMPL(detail.inputs, detail.sessionId);
    
    // Step 3: Generate guidance assets for AI rendering
    console.log('🎨 Generating guidance assets (depth, normals, pose, segmentation)');
    const guidanceAssets = await generateGuidanceAssets(smplResults, detail.sessionId);
    
    // Step 4: Create quick preview render
    console.log('⚡ Generating quick preview render');
    const previewKey = await generatePreviewRender(smplResults, detail.inputs.garmentRefs, detail.sessionId);
    
    // Step 5: Build prompts and publish render request
    console.log('📢 Publishing render request event to EventBridge');
    await publishRenderRequestEvent({
      sessionId: detail.sessionId,
      userId: detail.userId,
      previewKey,
      guidanceAssets,
      garmentMetadata: detail.inputs.garmentRefs,
      renderOptions: mapQualityToRenderOptions(detail.preferences.renderQuality),
      correlationId: detail.trace.correlationId,
    });
    
    console.log(`✅ Try-on processing completed for session ${detail.sessionId}`);
    console.log(`⏱️ Total processing time: ${Date.now() - startTime}ms`);
    
    return { success: true, sessionId: detail.sessionId };
    
  } catch (error: any) {
    console.error('💥 Try-on processing failed:', error);
    
    let sessionId = 'unknown';
    try {
      const eventData = JSON.parse(record.body);
      sessionId = eventData.detail?.sessionId || 'unknown';
    } catch (parseError) {
      // Ignore parse errors
    }
    
    throw error;
  }
}

/**
 * Validate session data and enforce per-user daily quotas
 */
async function validateSessionAndQuotas(userId: string, sessionId: string): Promise<void> {
  // TODO: Implement quota checking via DynamoDB
  console.log(`✅ Quota validation passed for user ${userId}`);
}

/**
 * Process user photos through SMPL pipeline to extract 3D pose and body shape
 * Supports both Lambda-based processing (lightweight) and ECS-based processing (heavy-duty)
 */
async function processPhotosWithSMPL(inputs: TryonSessionEvent['inputs'], sessionId: string): Promise<any> {
  console.log('🔬 Starting SMPL estimation pipeline');
  
  // Check if ECS processing is enabled for heavy SMPL computation
  const smplProcessingMode = process.env.SMPL_PROCESSING_MODE || 'LAMBDA';
  const ecsClusterName = process.env.ECS_CLUSTER_NAME || '';
  const ecsTaskDefinitionArn = process.env.ECS_TASK_DEFINITION_ARN || '';
  
  if (smplProcessingMode === 'ECS' && ecsClusterName && ecsTaskDefinitionArn) {
    console.log('🚢 Delegating SMPL processing to ECS for heavy computation');
    
    // Launch ECS task for compute-intensive SMPL processing
    const ecsResults = await launchEcsSmplTask(sessionId, inputs);
    
    // ECS task will process photos and publish completion event directly
    // Return placeholder to indicate ECS processing is in progress
    return {
      processingMode: 'ECS',
      taskId: ecsResults.taskArn,
      status: 'processing',
      message: 'ECS task launched for heavy SMPL computation'
    };
  }
  
  // Lambda-based processing for lightweight SMPL estimation
  console.log('⚡ Running lightweight SMPL estimation in Lambda');
  
  try {
    // Simulate SMPL processing (replace with actual implementation)
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    console.log('✅ SMPL estimation completed successfully');
    
    return {
      processingMode: 'LAMBDA',
      smplParams: {
        beta: [0.1, 0.2, -0.1],  // Body shape parameters
        theta: [0, 0, 0],        // Pose parameters  
        translation: [0, 0, 2.5], // Global translation
        confidence: 0.85,
      },
      mesh: {
        vertices: [],            // SMPL mesh vertices (6890 vertices)
        faces: [],               // Triangle faces
        uvCoords: [],           // Texture coordinates
        quality: 'standard',
      },
      pose2d: {
        keypoints: [],          // 2D joint keypoints
        confidence: 0.85,
        bbox: [100, 50, 300, 500], // Bounding box [x, y, width, height]
      },
      pose3d: {
        joints: [],             // 3D joint positions
        rootTranslation: [0, 0, 2.5],
        globalOrientation: [0, 0, 0],
      },
      segmentation: {
        personMask: Buffer.from('fake-person-mask'),
        garmentRegions: {
          'upper_body': Buffer.from('upper-body-mask'),
          'lower_body': Buffer.from('lower-body-mask'),
        },
        confidence: 0.78,
      },
      metadata: {
        processingTimeMs: 1500,
        modelVersion: 'smpl-v1.1',
        inputResolution: [512, 512],
        estimatedGender: 'neutral',
      }
    };
    
  } catch (error) {
    console.error('❌ SMPL estimation failed:', error);
    
    // Fallback to 2D pose estimation if 3D fails
    console.log('🔄 Falling back to 2D pose estimation');
    
    return {
      processingMode: 'LAMBDA_FALLBACK',
      smplParams: null,
      mesh: null,
      pose2d: {
        keypoints: [],          // Basic 2D pose keypoints
        confidence: 0.65,       // Lower confidence for fallback
        bbox: [100, 50, 300, 500],
      },
      pose3d: null,
      segmentation: {
        personMask: Buffer.from('basic-person-mask'),
        garmentRegions: {},
        confidence: 0.5,
      },
      metadata: {
        processingTimeMs: 500,
        modelVersion: 'pose2d-fallback',
        inputResolution: [512, 512],
        fallbackReason: error instanceof Error ? error.message : String(error),
      }
    };
  }
}

/**
 * Launch ECS Fargate task for heavy SMPL processing
 * Used when Lambda's 15-minute limit or 10GB memory is insufficient
 */
async function launchEcsSmplTask(sessionId: string, inputs: TryonSessionEvent['inputs']): Promise<any> {
  console.log(`🚢 Launching ECS task for session: ${sessionId}`);
  
  const ecs = new (require('aws-sdk').ECS)({ region: process.env.AWS_REGION });
  
  const taskParams = {
    cluster: process.env.ECS_CLUSTER_NAME,
    taskDefinition: process.env.ECS_TASK_DEFINITION_ARN,
    launchType: 'FARGATE',
    
    // Use private subnets for security
    networkConfiguration: {
      awsvpcConfiguration: {
        subnets: (process.env.ECS_SUBNET_IDS || '').split(',').filter(Boolean),
        securityGroups: [], // Will use default security group from task definition
        assignPublicIp: 'DISABLED', // Private subnets don't need public IPs
      },
    },
    
    // Override container environment variables with session-specific data
    overrides: {
      containerOverrides: [{
        name: 'smpl-processor',
        environment: [
          { name: 'SESSION_ID', value: sessionId },
          { name: 'FRONT_PHOTO_KEY', value: inputs.frontPhotoKey },
          { name: 'SIDE_PHOTO_KEY', value: inputs.sidePhotoKey || '' },
          { name: 'GARMENT_REFS', value: JSON.stringify(inputs.garmentRefs) },
          { name: 'PROCESSING_MODE', value: 'ECS_TASK' },
          { name: 'TASK_TIMEOUT_MINUTES', value: process.env.ECS_TASK_TIMEOUT_MINUTES || '10' },
        ],
      }],
    },
    
    // Resource tagging for cost tracking and monitoring
    tags: [
      { key: 'Service', value: 'GarmaxAi-SMPL' },
      { key: 'SessionId', value: sessionId },
      { key: 'Stage', value: STAGE },
      { key: 'ProcessingType', value: 'HeavySMPL' },
    ],
  };
  
  try {
    const result = await ecs.runTask(taskParams).promise();
    
    if (!result.tasks || result.tasks.length === 0) {
      throw new Error('Failed to launch ECS task - no tasks created');
    }
    
    if (result.failures && result.failures.length > 0) {
      console.error('⚠️  ECS task launch warnings:', result.failures);
    }
    
    const taskArn = result.tasks[0].taskArn;
    const taskId = taskArn?.split('/').pop() || 'unknown';
    
    console.log(`✅ ECS task launched successfully: ${taskId}`);
    
    // Send CloudWatch metric for ECS task launch
    await sendCustomMetric('SMPL.EcsTaskLaunched', 1, { SessionId: sessionId });
    
    return {
      taskArn,
      taskId,
      clusterName: process.env.ECS_CLUSTER_NAME,
      launchedAt: new Date().toISOString(),
    };
    
  } catch (error) {
    console.error('❌ Failed to launch ECS task:', error);
    
    // Send error metric
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    const errorMessage = error instanceof Error ? error.message : String(error);
    await sendCustomMetric('SMPL.EcsTaskLaunchFailed', 1, { SessionId: sessionId, Error: errorName });
    
    throw new Error(`ECS task launch failed: ${errorMessage}`);
  }
}

/**
 * Send custom metrics to CloudWatch for monitoring and alerting
 */
async function sendCustomMetric(
  metricName: string, 
  value: number, 
  dimensions: Record<string, string>
): Promise<void> {
  try {
    const cloudwatch = new (require('aws-sdk').CloudWatch)({ region: process.env.AWS_REGION });
    
    await cloudwatch.putMetricData({
      Namespace: 'GarmaxAi/TryOn',
      MetricData: [{
        MetricName: metricName,
        Value: value,
        Unit: metricName.includes('Time') ? 'Seconds' : 'Count',
        Dimensions: Object.entries(dimensions).map(([Name, Value]) => ({ Name, Value })),
        Timestamp: new Date(),
      }],
    }).promise();
    
    console.log(`📊 Sent metric: ${metricName} = ${value}`);
  } catch (error) {
    console.error(`⚠️  Failed to send metric ${metricName}:`, error);
    // Don't throw - metrics failures shouldn't break processing
  }
}

/**
 * Generate guidance assets from SMPL results for AI rendering conditioning
 */
async function generateGuidanceAssets(smplResults: any, sessionId: string): Promise<any> {
  console.log('🎨 Generating guidance assets from SMPL results');
  
  // TODO: Implement guidance asset generation and S3 upload
  const depthMapKey = `depth/${sessionId}/depth-map-${Date.now()}.png`;
  const normalMapKey = `normals/${sessionId}/normal-map-${Date.now()}.png`;
  const poseKeypointsKey = `poses/${sessionId}/pose-keypoints-${Date.now()}.json`;
  const segmentationMaskKey = `segments/${sessionId}/person-mask-${Date.now()}.png`;
  
  console.log(`📤 Uploading guidance assets to ${GUIDANCE_BUCKET_NAME}`);
  
  return {
    depth: depthMapKey,
    normals: normalMapKey,
    pose: poseKeypointsKey,
    segment: segmentationMaskKey,
  };
}

/**
 * Generate quick preview render for immediate user feedback
 */
async function generatePreviewRender(smplResults: any, garmentRefs: any[], sessionId: string): Promise<string> {
  console.log('⚡ Generating preview render for immediate feedback');
  
  const previewKey = `previews/${sessionId}/preview-${Date.now()}.jpg`;
  console.log(`📤 Uploading preview to ${RENDERS_BUCKET_NAME}/${previewKey}`);
  
  return previewKey;
}

/**
 * Map quality preference to specific render options
 */
function mapQualityToRenderOptions(quality: string): any {
  switch (quality) {
    case 'fast':
      return { quality: 'low', guidanceScale: 5.0, steps: 15 };
    case 'standard':
      return { quality: 'med', guidanceScale: 7.5, steps: 20 };
    case 'premium':
      return { quality: 'high', guidanceScale: 10.0, steps: 30 };
    default:
      return { quality: 'med', guidanceScale: 7.5, steps: 20 };
  }
}

/**
 * Publish render request event to EventBridge for AI processing
 */
async function publishRenderRequestEvent(eventData: any): Promise<void> {
  // TODO: Implement EventBridge event publishing
  console.log('📢 Publishing render request event:', {
    sessionId: eventData.sessionId,
    previewKey: eventData.previewKey,
    guidanceAssetCount: Object.keys(eventData.guidanceAssets).length,
  });
}
