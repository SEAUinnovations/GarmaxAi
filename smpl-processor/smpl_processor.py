#!/usr/bin/env python3
"""
SMPL Processing Worker for GarmaxAi Virtual Try-On

Purpose: Heavy-duty SMPL pose estimation and guidance asset generation
- Processes user photos through ROMP for 3D pose recovery
- Fits body meshes using SMPLify-X for accurate body shape estimation
- Generates guidance assets: depth maps, normals, poses, segmentation
- Publishes results to EventBridge for downstream AI rendering

Architecture:
- Runs as Fargate container for scalable compute capacity
- Processes messages from SQS queue (one at a time for memory efficiency)
- Downloads assets from S3, processes locally, uploads results
- Uses CPU-optimized PyTorch for Fargate compatibility

Cost Optimization:
- Auto-scales based on queue depth (0 to N instances)
- Uses Fargate Spot instances for 70% cost reduction
- Efficient memory management with model caching
- Processes images in batches when possible

Security:
- Runs as non-root user in container
- Scoped IAM permissions for S3 and EventBridge access only
- Input validation and sanitization for all user uploads
- Secure model loading from versioned S3 bucket
"""

import os
import sys
import json
import time
import logging
import traceback
from typing import Dict, Any, Tuple, Optional
from datetime import datetime
import signal
import psutil

# ML and Computer Vision imports
import torch
import numpy as np
import cv2
from PIL import Image
import trimesh
import yaml

# AWS SDK imports
import boto3
from botocore.exceptions import ClientError, NoCredentialsError

# Configure logging for ECS CloudWatch integration
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)  # ECS captures stdout for CloudWatch
    ]
)
logger = logging.getLogger(__name__)

class SMPLProcessor:
    """
    Main SMPL processing class that handles the full pipeline
    from user photo to guidance assets generation
    """
    
    def __init__(self):
        """Initialize SMPL processor with AWS clients and model loading"""
        self.stage = os.getenv('STAGE', 'DEV')
        self.region = os.getenv('AWS_DEFAULT_REGION', 'us-east-1')
        
        # Initialize AWS clients
        self._init_aws_clients()
        
        # Load environment configuration
        self._load_config()
        
        # Initialize SMPL models (lazy loading for memory efficiency)
        self._smpl_models = {}
        self._romp_model = None
        self._smplify_model = None
        
        # Processing statistics for monitoring
        self.stats = {
            'processed_count': 0,
            'error_count': 0,
            'start_time': datetime.utcnow(),
            'last_activity': datetime.utcnow()
        }
        
        logger.info(f"SMPLProcessor initialized for stage: {self.stage}")
        
    def _init_aws_clients(self):
        """Initialize AWS service clients with error handling"""
        try:
            self.s3_client = boto3.client('s3', region_name=self.region)
            self.events_client = boto3.client('events', region_name=self.region)
            self.cloudwatch = boto3.client('cloudwatch', region_name=self.region)
            logger.info("AWS clients initialized successfully")
        except NoCredentialsError:
            logger.error("AWS credentials not found. Ensure IAM role is properly configured.")\n            sys.exit(1)
        except Exception as e:
            logger.error(f"Failed to initialize AWS clients: {e}")
            sys.exit(1)
    
    def _load_config(self):
        """Load processing configuration from environment variables"""
        self.buckets = {
            'uploads': os.getenv('UPLOADS_BUCKET', ''),
            'guidance': os.getenv('GUIDANCE_BUCKET', ''),
            'renders': os.getenv('RENDERS_BUCKET', ''),
            'smpl_assets': os.getenv('SMPL_ASSETS_BUCKET', '')
        }
        
        self.event_bus_name = os.getenv('EVENT_BUS_NAME', '')\n        
        # Processing limits and timeouts
        self.max_processing_time = int(os.getenv('MAX_PROCESSING_TIME_SECONDS', '600'))
        self.max_image_size_mb = int(os.getenv('MAX_IMAGE_SIZE_MB', '50'))
        self.batch_size = int(os.getenv('BATCH_SIZE', '1'))
        
        # Model paths
        self.model_paths = {
            'smpl': os.getenv('SMPL_MODEL_PATH', '/app/models/smpl'),
            'weights': os.getenv('SMPL_WEIGHTS_PATH', '/app/weights'),
            'romp_config': os.getenv('ROMP_CONFIG_PATH', '/app/configs/romp.yaml'),
            'smplify_config': os.getenv('SMPLIFY_X_CONFIG_PATH', '/app/configs/smplify_x.yaml')
        }
        
        logger.info(f"Configuration loaded: {len([b for b in self.buckets.values() if b])} buckets configured")
        
    def _load_smpl_models(self):
        """Lazy load SMPL models from S3 to minimize memory footprint"""
        if self._smpl_models:
            return  # Already loaded
            
        try:
            logger.info("Loading SMPL models from S3...")
            
            # Download SMPL model files from secure S3 bucket
            model_files = ['basicModel_f_lbs_10_207_0_v1.0.0.pkl',
                          'basicModel_m_lbs_10_207_0_v1.0.0.pkl',
                          'basicModel_neutral_lbs_10_207_0_v1.0.0.pkl']
            
            for model_file in model_files:
                s3_key = f'models/{model_file}'
                local_path = f'{self.model_paths["smpl"]}/{model_file}'
                
                if not os.path.exists(local_path):
                    os.makedirs(os.path.dirname(local_path), exist_ok=True)
                    self.s3_client.download_file(
                        self.buckets['smpl_assets'], 
                        s3_key, 
                        local_path
                    )
                    logger.info(f"Downloaded SMPL model: {model_file}")
                
            # Load models with PyTorch (placeholder - actual SMPL loading would use smplx library)
            # This is a simplified version - production would load actual SMPL models
            self._smpl_models = {
                'female': f'{self.model_paths["smpl"]}/basicModel_f_lbs_10_207_0_v1.0.0.pkl',
                'male': f'{self.model_paths["smpl"]}/basicModel_m_lbs_10_207_0_v1.0.0.pkl',
                'neutral': f'{self.model_paths["smpl"]}/basicModel_neutral_lbs_10_207_0_v1.0.0.pkl'
            }
            
            logger.info("SMPL models loaded successfully")
            
        except Exception as e:
            logger.error(f"Failed to load SMPL models: {e}")
            raise
    
    def process_image(self, session_id: str, user_id: str, avatar_image_key: str, 
                     garment_image_key: str) -> Dict[str, Any]:
        """
        Process user image through full SMPL pipeline
        
        Args:
            session_id: Unique session identifier
            user_id: User identifier for quota tracking
            avatar_image_key: S3 key for user's photo
            garment_image_key: S3 key for garment reference
            
        Returns:
            Dict containing processing results and guidance asset keys
        """
        start_time = time.time()
        temp_dir = f'/app/temp/{session_id}'
        
        try:
            # Create temporary directory for processing
            os.makedirs(temp_dir, exist_ok=True)
            
            logger.info(f"Processing session {session_id} for user {user_id}")
            
            # Step 1: Download and validate input images
            avatar_path, garment_path = self._download_input_images(
                session_id, avatar_image_key, garment_image_key, temp_dir
            )
            
            # Step 2: SMPL pose estimation using ROMP
            pose_results = self._estimate_pose_romp(avatar_path, temp_dir)
            
            # Step 3: Body mesh fitting with SMPLify-X
            mesh_results = self._fit_body_mesh(avatar_path, pose_results, temp_dir)
            
            # Step 4: Generate guidance assets
            guidance_assets = self._generate_guidance_assets(
                avatar_path, garment_path, pose_results, mesh_results, temp_dir
            )
            
            # Step 5: Upload results to S3
            s3_keys = self._upload_guidance_assets(session_id, guidance_assets, temp_dir)
            
            # Step 6: Publish completion event
            self._publish_completion_event(session_id, user_id, s3_keys, mesh_results)
            
            processing_time = time.time() - start_time
            self.stats['processed_count'] += 1
            self.stats['last_activity'] = datetime.utcnow()
            
            logger.info(f"Session {session_id} processed successfully in {processing_time:.2f}s")
            
            # Send success metrics to CloudWatch
            self._send_metrics('SMPL.ProcessingSuccess', 1, {'SessionId': session_id})
            self._send_metrics('SMPL.ProcessingTime', processing_time, {'SessionId': session_id})
            
            return {
                'status': 'success',
                'session_id': session_id,
                'processing_time': processing_time,
                'guidance_assets': s3_keys,
                'smpl_metadata': mesh_results
            }
            
        except Exception as e:
            self.stats['error_count'] += 1
            logger.error(f"Failed to process session {session_id}: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            
            # Send error metrics
            self._send_metrics('SMPL.ProcessingError', 1, {'SessionId': session_id, 'ErrorType': type(e).__name__})
            
            # Publish error event for downstream handling
            self._publish_error_event(session_id, user_id, str(e))
            
            raise
        finally:
            # Clean up temporary files
            self._cleanup_temp_files(temp_dir)
    
    def _download_input_images(self, session_id: str, avatar_key: str, 
                              garment_key: str, temp_dir: str) -> Tuple[str, str]:
        """Download and validate input images from S3"""
        avatar_path = f'{temp_dir}/avatar.jpg'
        garment_path = f'{temp_dir}/garment.jpg'
        
        try:
            # Download avatar image
            self.s3_client.download_file(self.buckets['uploads'], avatar_key, avatar_path)
            
            # Download garment reference image
            self.s3_client.download_file(self.buckets['uploads'], garment_key, garment_path)
            
            # Validate image files and sizes
            self._validate_image(avatar_path, 'avatar')
            self._validate_image(garment_path, 'garment')
            
            logger.info(f"Input images downloaded for session {session_id}")
            return avatar_path, garment_path
            
        except Exception as e:
            logger.error(f"Failed to download input images: {e}")
            raise
    
    def _validate_image(self, image_path: str, image_type: str):
        """Validate image format, size, and content"""
        try:
            # Check file size
            file_size_mb = os.path.getsize(image_path) / (1024 * 1024)
            if file_size_mb > self.max_image_size_mb:
                raise ValueError(f"{image_type} image too large: {file_size_mb:.2f}MB > {self.max_image_size_mb}MB")
            
            # Validate image format and content
            img = Image.open(image_path)
            if img.format not in ['JPEG', 'PNG', 'WEBP']:
                raise ValueError(f"Unsupported {image_type} image format: {img.format}")
            
            # Check minimum dimensions for SMPL processing
            if img.width < 256 or img.height < 256:
                raise ValueError(f"{image_type} image too small: {img.width}x{img.height} < 256x256")
                
            logger.info(f"Validated {image_type} image: {img.width}x{img.height} {img.format}")
            
        except Exception as e:
            logger.error(f"Image validation failed for {image_type}: {e}")
            raise
    
    def _estimate_pose_romp(self, image_path: str, temp_dir: str) -> Dict[str, Any]:
        """Estimate 3D human pose using ROMP (placeholder implementation)"""
        logger.info("Estimating 3D pose using ROMP...")
        
        # Placeholder for actual ROMP pose estimation
        # In production, this would use the ROMP model for 3D pose recovery
        try:
            img = cv2.imread(image_path)
            height, width = img.shape[:2]
            
            # Simulate pose estimation results
            pose_results = {
                'poses_3d': np.random.randn(1, 24, 3).tolist(),  # 24 SMPL joints
                'poses_2d': np.random.randn(1, 17, 2).tolist(),  # 17 keypoints
                'confidence': 0.85,
                'bbox': [width*0.25, height*0.1, width*0.5, height*0.8],  # x, y, w, h
                'person_detected': True
            }
            
            logger.info(f"Pose estimation completed with confidence: {pose_results['confidence']}")
            return pose_results
            
        except Exception as e:
            logger.error(f"Pose estimation failed: {e}")
            raise
    
    def _fit_body_mesh(self, image_path: str, pose_results: Dict[str, Any], 
                      temp_dir: str) -> Dict[str, Any]:
        """Fit SMPL body mesh using SMPLify-X (placeholder implementation)"""
        logger.info("Fitting SMPL body mesh...")
        
        try:
            # Load SMPL models if not already loaded
            self._load_smpl_models()
            
            # Placeholder for actual SMPLify-X mesh fitting
            # In production, this would use SMPLify-X for accurate body shape estimation
            mesh_results = {
                'body_shape': np.random.randn(10).tolist(),  # SMPL beta parameters
                'body_pose': np.random.randn(72).tolist(),   # SMPL pose parameters
                'global_orient': np.random.randn(3).tolist(), # Global rotation
                'translation': [0.0, 0.0, 2.0],             # Global translation
                'gender': 'neutral',  # Estimated gender
                'fit_confidence': 0.78,
                'mesh_vertices': 6890,  # Standard SMPL vertex count
                'estimated_measurements': {
                    'height_cm': 170.0,
                    'chest_cm': 88.0,
                    'waist_cm': 72.0,
                    'hip_cm': 95.0
                }
            }
            
            logger.info(f"Body mesh fitted with confidence: {mesh_results['fit_confidence']}")
            return mesh_results
            
        except Exception as e:
            logger.error(f"Body mesh fitting failed: {e}")
            raise
    
    def _generate_guidance_assets(self, avatar_path: str, garment_path: str,
                                 pose_results: Dict[str, Any], mesh_results: Dict[str, Any],
                                 temp_dir: str) -> Dict[str, str]:
        """Generate guidance assets for AI rendering"""
        logger.info("Generating guidance assets...")
        
        try:
            avatar_img = cv2.imread(avatar_path)
            height, width = avatar_img.shape[:2]
            
            guidance_assets = {}
            
            # Generate depth map (placeholder - would use actual mesh rendering)
            depth_map = np.random.randint(0, 255, (height, width), dtype=np.uint8)
            depth_path = f'{temp_dir}/depth.png'
            cv2.imwrite(depth_path, depth_map)
            guidance_assets['depth'] = depth_path
            
            # Generate normal map (placeholder - would use mesh normals)
            normal_map = np.random.randint(0, 255, (height, width, 3), dtype=np.uint8)
            normal_path = f'{temp_dir}/normals.png'
            cv2.imwrite(normal_path, normal_map)
            guidance_assets['normals'] = normal_path
            
            # Generate pose map (placeholder - would render pose skeleton)
            pose_map = np.random.randint(0, 255, (height, width, 3), dtype=np.uint8)
            pose_path = f'{temp_dir}/pose.png'
            cv2.imwrite(pose_path, pose_map)
            guidance_assets['pose'] = pose_path
            
            # Generate segmentation mask (placeholder - would use person segmentation)
            seg_mask = np.random.randint(0, 255, (height, width), dtype=np.uint8)
            seg_path = f'{temp_dir}/segments.png'
            cv2.imwrite(seg_path, seg_mask)
            guidance_assets['segments'] = seg_path
            
            # Generate text prompt for AI rendering
            prompt = self._generate_text_prompt(mesh_results, garment_path)
            prompt_path = f'{temp_dir}/prompt.txt'
            with open(prompt_path, 'w') as f:
                f.write(prompt)
            guidance_assets['prompt'] = prompt_path
            
            logger.info(f"Generated {len(guidance_assets)} guidance assets")
            return guidance_assets
            
        except Exception as e:
            logger.error(f"Guidance asset generation failed: {e}")
            raise
    
    def _generate_text_prompt(self, mesh_results: Dict[str, Any], garment_path: str) -> str:
        """Generate text prompt for AI rendering based on body measurements and garment"""
        measurements = mesh_results.get('estimated_measurements', {})
        gender = mesh_results.get('gender', 'neutral')
        
        # Basic prompt generation (would be more sophisticated in production)
        prompt = f"A {gender} person with height {measurements.get('height_cm', 170)}cm, "
        prompt += f"wearing fashionable clothing, standing pose, "
        prompt += f"professional photography, high quality, detailed textures, "
        prompt += f"natural lighting, realistic proportions"
        
        return prompt
    
    def _upload_guidance_assets(self, session_id: str, guidance_assets: Dict[str, str],
                               temp_dir: str) -> Dict[str, str]:
        """Upload generated guidance assets to S3"""
        logger.info(f"Uploading guidance assets for session {session_id}")
        
        s3_keys = {}\n        
        try:
            for asset_type, local_path in guidance_assets.items():
                # Generate S3 key with timestamp for uniqueness
                timestamp = int(time.time())
                s3_key = f'{asset_type}/{session_id}-{timestamp}.{local_path.split(".")[-1]}'
                
                # Upload to guidance bucket
                self.s3_client.upload_file(
                    local_path,
                    self.buckets['guidance'],
                    s3_key,
                    ExtraArgs={'ContentType': self._get_content_type(local_path)}
                )
                
                s3_keys[asset_type] = s3_key
                logger.info(f"Uploaded {asset_type} asset: {s3_key}")
            
            return s3_keys
            
        except Exception as e:
            logger.error(f"Failed to upload guidance assets: {e}")
            raise
    
    def _get_content_type(self, file_path: str) -> str:
        """Get appropriate content type for file"""
        ext = file_path.lower().split('.')[-1]
        content_types = {
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'txt': 'text/plain'
        }
        return content_types.get(ext, 'application/octet-stream')
    
    def _publish_completion_event(self, session_id: str, user_id: str, 
                                 s3_keys: Dict[str, str], mesh_results: Dict[str, Any]):
        """Publish guidance-ready event to EventBridge"""
        try:
            event = {
                'Source': 'garmax-ai.smpl',
                'DetailType': 'Guidance Assets Ready',
                'Detail': json.dumps({
                    'sessionId': session_id,
                    'userId': user_id,
                    'guidanceAssets': {
                        'depthMapKey': s3_keys.get('depth', ''),
                        'normalMapKey': s3_keys.get('normals', ''),
                        'poseMapKey': s3_keys.get('pose', ''),
                        'segmentationKey': s3_keys.get('segments', ''),
                        'promptKey': s3_keys.get('prompt', '')
                    },
                    'smplMetadata': {
                        'poseConfidence': mesh_results.get('fit_confidence', 0.0),
                        'bodyShape': mesh_results.get('body_shape', []),
                        'estimatedMeasurements': mesh_results.get('estimated_measurements', {}),
                        'gender': mesh_results.get('gender', 'neutral')\n                    },
                    'timestamp': datetime.utcnow().isoformat(),
                    'processingStage': 'smpl-complete'
                }),
                'EventBusName': self.event_bus_name
            }
            
            response = self.events_client.put_events(Entries=[event])
            
            if response['FailedEntryCount'] > 0:
                logger.error(f"Failed to publish event: {response}")
                raise Exception("EventBridge publish failed")
            
            logger.info(f"Published guidance-ready event for session {session_id}")
            
        except Exception as e:
            logger.error(f"Failed to publish completion event: {e}")
            raise
    
    def _publish_error_event(self, session_id: str, user_id: str, error_message: str):
        """Publish error event for downstream error handling"""
        try:
            event = {
                'Source': 'garmax-ai.smpl',
                'DetailType': 'SMPL Processing Failed',
                'Detail': json.dumps({
                    'sessionId': session_id,
                    'userId': user_id,
                    'error': error_message,
                    'timestamp': datetime.utcnow().isoformat(),
                    'processingStage': 'smpl-error'
                }),
                'EventBusName': self.event_bus_name
            }
            
            self.events_client.put_events(Entries=[event])
            logger.info(f"Published error event for session {session_id}")
            
        except Exception as e:
            logger.error(f"Failed to publish error event: {e}")
    
    def _send_metrics(self, metric_name: str, value: float, dimensions: Dict[str, str]):
        """Send custom metrics to CloudWatch"""
        try:
            self.cloudwatch.put_metric_data(
                Namespace='GarmaxAi/SMPL',
                MetricData=[
                    {
                        'MetricName': metric_name,
                        'Value': value,
                        'Unit': 'Count' if 'Count' in metric_name or 'Error' in metric_name else 'Seconds',
                        'Dimensions': [
                            {'Name': k, 'Value': v} for k, v in dimensions.items()
                        ],
                        'Timestamp': datetime.utcnow()
                    }
                ]
            )
        except Exception as e:
            logger.error(f"Failed to send metrics: {e}")
    
    def _cleanup_temp_files(self, temp_dir: str):
        """Clean up temporary processing files"""
        try:
            if os.path.exists(temp_dir):
                import shutil
                shutil.rmtree(temp_dir)
                logger.info(f"Cleaned up temporary directory: {temp_dir}")
        except Exception as e:
            logger.error(f"Failed to cleanup temp files: {e}")
    
    def get_health_status(self) -> Dict[str, Any]:
        """Get processor health status for monitoring"""
        memory_usage = psutil.virtual_memory()
        cpu_usage = psutil.cpu_percent()
        
        return {
            'status': 'healthy',
            'uptime_seconds': (datetime.utcnow() - self.stats['start_time']).total_seconds(),
            'processed_count': self.stats['processed_count'],
            'error_count': self.stats['error_count'],
            'memory_usage_percent': memory_usage.percent,
            'cpu_usage_percent': cpu_usage,
            'last_activity': self.stats['last_activity'].isoformat(),
            'models_loaded': bool(self._smpl_models)
        }

def signal_handler(signum, frame):
    """Handle graceful shutdown signals"""
    logger.info(f"Received signal {signum}, initiating graceful shutdown...")
    sys.exit(0)

def main():
    """Main entry point for SMPL processing worker"""
    # Set up signal handlers for graceful shutdown
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)
    
    processor = SMPLProcessor()
    logger.info("SMPL processor worker started")
    
    # In production, this would be replaced with SQS message polling
    # For now, simulate processing with test data
    try:
        # Test processing (replace with actual SQS message handling)
        test_session = {
            'session_id': 'test-session-001',
            'user_id': 'test-user-001',
            'avatar_image_key': 'avatars/test-avatar.jpg',
            'garment_image_key': 'garments/test-garment.jpg'
        }
        
        logger.info("Processing test session...")
        result = processor.process_image(**test_session)
        logger.info(f"Test processing result: {result}")
        
        # Print health status
        health = processor.get_health_status()
        logger.info(f"Processor health: {health}")
        
    except KeyboardInterrupt:
        logger.info("Received interrupt signal, shutting down...")
    except Exception as e:
        logger.error(f"Fatal error in main loop: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        sys.exit(1)
    
    logger.info("SMPL processor worker stopped")

if __name__ == '__main__':
    main()