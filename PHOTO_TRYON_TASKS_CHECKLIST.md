# Photo-Based Try-On - Remaining Tasks Checklist

## Status: 75% Complete (9/12 tasks done)

---

## ✅ COMPLETED TASKS

- [x] Database migration file created (`drizzle/0002_add_user_photos.sql`)
- [x] Schema types updated (`shared/schema.ts`)
- [x] Storage layer methods implemented (`src/storage/rdsStorage.ts`)
- [x] Photo controller and router created (`src/controllers/photoController.ts`, `src/routers/photoRouter.ts`)
- [x] Try-on controller updated for dual support (`src/controllers/tryonController.ts`)
- [x] EventBridge service updated (`src/services/eventBridgeService.ts`)
- [x] Frontend WebSocket integration (`client/src/pages/VirtualTryonStudio.tsx`)
- [x] Frontend API calls implemented (replaced all mock data)
- [x] Try-on processor Lambda updated (`iac/lambda-handlers/tryonProcessor/index.ts`)
- [x] SMPL processor Python script updated (`smpl-processor/smpl_processor.py`)

---

## 🚧 PENDING TASKS (Priority Order)

### 1. Update aiRenderProcessor Lambda (30 minutes)
**File**: `iac/lambda-handlers/aiRenderProcessor/index.ts`

**Changes Needed**:
```typescript
// Add database connection (same as tryonProcessor)
import mysql from 'mysql2/promise';
let dbConnection: mysql.Connection | null = null;

// Add helper function to fetch photo SMPL data
async function fetchPhotoSmplData(photoId: string, config: any): Promise<string | null> {
  const db = await getDatabaseConnection(config);
  const [rows] = await db.query(
    'SELECT smpl_data_url FROM user_photos WHERE id = ?',
    [photoId]
  );
  
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0].smpl_data_url;
}

// Update event handler to check for photoId
async function processRenderEvent(event: any, config: any) {
  const detail = event.detail;
  
  let smplDataUrl: string;
  
  if (detail.photoId) {
    // NEW: Fetch SMPL data from photo record
    smplDataUrl = await fetchPhotoSmplData(detail.photoId, config);
    if (!smplDataUrl) throw new Error('Photo SMPL data not found');
    console.log(`Using photo SMPL data: ${smplDataUrl}`);
  } else if (detail.avatarId) {
    // LEGACY: Use avatar SMPL data
    smplDataUrl = await fetchAvatarSmplData(detail.avatarId, config);
    console.log(`Using avatar SMPL data: ${smplDataUrl}`);
  } else {
    throw new Error('Event must contain photoId or avatarId');
  }
  
  // Continue with rendering using smplDataUrl...
}
```

**Testing**:
- Deploy Lambda
- Trigger render event with photoId
- Verify SMPL data fetched correctly
- Check CloudWatch logs for errors

---

### 2. Run Database Migration (10 minutes)
**File**: `drizzle/0002_add_user_photos.sql`

**Steps**:
1. **Check Database Connection**:
   ```bash
   # Verify drizzle.config.ts has correct DB URL
   cat drizzle.config.ts
   ```

2. **Run Migration**:
   ```bash
   # Option A: Using Drizzle Kit (recommended)
   npx drizzle-kit push:mysql
   
   # Option B: Manual SQL execution
   mysql -h <host> -u <user> -p <database> < drizzle/0002_add_user_photos.sql
   ```

3. **Verify Tables**:
   ```sql
   -- Check user_photos table created
   DESCRIBE user_photos;
   
   -- Check tryon_sessions updated
   DESCRIBE tryon_sessions;
   
   -- Verify foreign keys
   SELECT * FROM information_schema.KEY_COLUMN_USAGE 
   WHERE TABLE_NAME = 'user_photos' AND CONSTRAINT_NAME LIKE 'FK%';
   
   -- Verify indexes
   SHOW INDEX FROM user_photos;
   ```

4. **Test Queries**:
   ```sql
   -- Test basic insert (should work)
   INSERT INTO user_photos (id, user_id, photo_url, photo_s3_key, photo_type)
   VALUES ('test-123', 'user-123', 'https://example.com/photo.jpg', 'user-123/photo.jpg', 'front');
   
   -- Test FK constraint (should succeed if user exists)
   SELECT * FROM user_photos WHERE user_id = 'user-123';
   
   -- Clean up test
   DELETE FROM user_photos WHERE id = 'test-123';
   ```

**Rollback Plan** (if needed):
```sql
-- Drop photo_id column from tryon_sessions
ALTER TABLE tryon_sessions DROP COLUMN photo_id;

-- Drop user_photos table
DROP TABLE IF EXISTS user_photos;
```

---

### 3. End-to-End Testing (2-3 hours)

#### 3.1 Photo Upload Test
**Endpoint**: `POST /api/tryon/photos/upload`

**Test Cases**:
```bash
# Valid photo upload
curl -X POST http://localhost:5000/api/tryon/photos/upload \
  -H "Cookie: session=..." \
  -F "photo=@test-photo.jpg" \
  -F "type=front"

# Expected: 200 OK with photo object
# Verify:
# - S3 bucket has original + thumbnail
# - Database has user_photos record
# - photo_s3_key field populated correctly
```

**Manual Testing**:
1. Open Virtual Try-On Studio page
2. Click "Upload Photo" button
3. Select a front-facing photo
4. Verify upload progress indicator (if implemented)
5. Check photo appears in user photo gallery
6. Verify thumbnail loads correctly
7. Click on photo to select it
8. Check selection highlight appears

**Error Cases to Test**:
- File too large (> 10MB) → Should show error toast
- Non-image file (PDF, etc.) → Should reject upload
- Invalid photo type → Should show validation error
- Unauthenticated request → Should redirect to login

#### 3.2 Session Creation Test
**Endpoint**: `POST /api/tryon/session/create`

**Test Cases**:
```bash
# Create session with photoId
curl -X POST http://localhost:5000/api/tryon/session/create \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{
    "photoId": "photo-123",
    "garmentIds": ["garment-456"],
    "preferences": {
      "renderQuality": "standard",
      "fitPreference": "fitted"
    }
  }'

# Expected: 201 Created with session object
# Verify:
# - Database has tryon_sessions record with photo_id field
# - EventBridge event published with photoId
# - WebSocket connected and subscription message sent
```

**Manual Testing**:
1. Select photo from gallery
2. Select garment from wardrobe
3. Click "Start Try-On" button
4. Verify processing modal appears
5. Check WebSocket connection established (open DevTools Network tab)
6. Watch for real-time status updates: "queued" → "processing" → "rendering"
7. Verify preview image appears during processing
8. Check final rendered result displays correctly

**Error Cases to Test**:
- PhotoId not found → Should show error
- Photo not SMPL processed → Should queue SMPL first
- Invalid garmentId → Should show error
- Both photoId and avatarId provided → Should reject (XOR validation)
- Neither photoId nor avatarId → Should reject

#### 3.3 SMPL Processing Test
**Verify Lambda Execution**:

1. **Check EventBridge Event**:
   ```bash
   # AWS CLI command to view events
   aws events list-targets-by-rule --rule TryonSessionCreatedRule --region us-east-1
   ```

2. **Monitor CloudWatch Logs**:
   ```bash
   # Tail tryonProcessor Lambda logs
   aws logs tail /aws/lambda/garmaxai-tryon-processor-dev --follow
   
   # Look for:
   # - "Processing try-on session: <sessionId>"
   # - "Using photo-based image: <photoS3Key>"
   # - "Fetched photo S3 key: <key>"
   # - "SMPL estimation pipeline started"
   ```

3. **Verify SMPL Processor (Python)**:
   ```bash
   # Check ECS task logs
   aws ecs list-tasks --cluster garmaxai-smpl-processor --region us-east-1
   
   # Get task logs
   aws logs tail /ecs/garmaxai-smpl-processor --follow
   
   # Look for:
   # - "Using photo-based image: <photoS3Key>"
   # - "Session <sessionId> processed successfully using photo"
   ```

4. **Check S3 Outputs**:
   ```bash
   # List guidance assets uploaded
   aws s3 ls s3://garmaxai-guidance-dev/<sessionId>/ --recursive
   
   # Expected files:
   # - depth.png (depth map)
   # - normals.png (normal map)
   # - pose.png (pose keypoints)
   # - segment.png (segmentation mask)
   ```

5. **Verify Database Update**:
   ```sql
   -- Check photo record updated with SMPL data
   SELECT id, smpl_processed, smpl_data_url, smpl_confidence
   FROM user_photos
   WHERE id = 'photo-123';
   
   -- Expected: smpl_processed = 1, smpl_data_url populated
   ```

#### 3.4 WebSocket Real-Time Updates Test
**Frontend Testing**:

1. Open browser DevTools → Network tab → WS filter
2. Verify WebSocket connection to `ws://localhost:5000/ws/tryon`
3. Check connection message: `{"type": "connected"}`
4. Start try-on session
5. Verify subscription message sent: `{"action": "subscribe", "sessionId": "..."}`
6. Watch for status update messages:
   ```json
   {
     "sessionId": "session-123",
     "status": "queued",
     "progress": 0
   }
   ```
   ```json
   {
     "sessionId": "session-123",
     "status": "processing",
     "progress": 30
   }
   ```
   ```json
   {
     "sessionId": "session-123",
     "status": "rendering",
     "progress": 80,
     "previewImageUrl": "https://..."
   }
   ```
   ```json
   {
     "sessionId": "session-123",
     "status": "completed",
     "progress": 100,
     "renderedImageUrl": "https://..."
   }
   ```

7. Verify frontend UI updates automatically (no page refresh needed)
8. Check progress bar updates correctly
9. Verify result image appears when completed

**Error Case Testing**:
- Network disconnect → Should attempt reconnect after 5 seconds
- Invalid session ID → Should handle gracefully
- Backend restart → WebSocket should reconnect automatically

#### 3.5 End-to-End Flow Test
**Complete User Journey**:

1. **Setup**:
   - Fresh browser session (clear cookies)
   - Login to application
   - Navigate to Virtual Try-On Studio

2. **Photo Upload**:
   - Upload 1-2 photos (front view required)
   - Wait for uploads to complete
   - Verify photos appear in gallery

3. **Garment Selection**:
   - Browse wardrobe
   - Select 1-2 garments
   - Verify selection highlights

4. **Session Start**:
   - Click "Start Try-On"
   - Processing modal opens
   - WebSocket connects

5. **Real-Time Updates**:
   - Watch status: queued → processing → rendering
   - Verify progress bar updates
   - Check preview image appears (if quick preview enabled)

6. **Result Display**:
   - Wait for "completed" status
   - Final rendered image displays
   - Can zoom/pan result
   - Can save to session history

7. **History Check**:
   - Session appears in history sidebar
   - Can click to view previous results
   - Metadata displays correctly (photo used, garments, timestamp)

**Performance Benchmarks**:
- Photo upload: < 5 seconds (for 2MB image)
- SMPL processing: 10-30 seconds (depending on image complexity)
- Rendering: 20-60 seconds (depending on quality setting)
- Total end-to-end: ~1-2 minutes

**Success Criteria**:
- ✅ No errors in console logs
- ✅ All status updates received in real-time
- ✅ Final image renders correctly
- ✅ Database records created properly
- ✅ S3 objects uploaded successfully
- ✅ WebSocket cleanup on unmount (no memory leaks)

---

## 📋 Pre-Deployment Checklist

Before deploying to production:

- [ ] All tests pass (unit + integration)
- [ ] Database migration applied successfully
- [ ] No TypeScript errors (`npm run type-check`)
- [ ] No ESLint warnings (`npm run lint`)
- [ ] Frontend builds without errors (`npm run build`)
- [ ] Backend builds without errors (`npm run build`)
- [ ] Environment variables configured (`.env` file)
- [ ] AWS credentials configured (Parameter Store)
- [ ] S3 buckets exist (`user-photos`, `guidance`, `renders`)
- [ ] EventBridge rules configured
- [ ] Lambda handlers deployed
- [ ] ECS task definition updated (SMPL processor)
- [ ] CloudWatch alarms configured
- [ ] Monitoring dashboards set up
- [ ] Error tracking enabled (Sentry/CloudWatch)
- [ ] Load testing completed (optional but recommended)
- [ ] Rollback plan documented

---

## 🚀 Deployment Steps

### Backend Deployment
```bash
# 1. Build TypeScript
npm run build

# 2. Deploy API (example using PM2)
pm2 restart garmaxai-api

# 3. Verify health check
curl http://localhost:5000/health
```

### Lambda Deployment
```bash
# 1. Install dependencies
cd iac/lambda-handlers
npm install

# 2. Build TypeScript
npm run build

# 3. Deploy (using CDK)
cd ..
cdk deploy GarmaxAiLambdaStack
```

### SMPL Processor Deployment
```bash
# 1. Build Docker image
docker build -t garmaxai-smpl-processor:latest -f Dockerfile.smpl .

# 2. Tag and push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <ecr-url>
docker tag garmaxai-smpl-processor:latest <ecr-url>/garmaxai-smpl-processor:latest
docker push <ecr-url>/garmaxai-smpl-processor:latest

# 3. Update ECS task definition
aws ecs update-service --cluster garmaxai-smpl-processor --service smpl-processor --force-new-deployment
```

### Frontend Deployment
```bash
# 1. Build production bundle
cd client
npm run build

# 2. Deploy to S3 + CloudFront (example)
aws s3 sync dist/ s3://garmaxai-frontend-prod
aws cloudfront create-invalidation --distribution-id <dist-id> --paths "/*"
```

---

## 🐛 Troubleshooting Guide

### Issue: Photo Upload Fails
**Symptoms**: 500 error on upload, no S3 object created

**Debug Steps**:
1. Check S3 bucket permissions (Lambda IAM role has PutObject)
2. Verify S3 bucket exists and name is correct
3. Check Sharp library installed correctly (`npm ls sharp`)
4. Review backend logs for S3Client errors

**Fix**: Update IAM policy to allow S3 uploads

---

### Issue: SMPL Processing Never Completes
**Symptoms**: Session stuck on "processing" status

**Debug Steps**:
1. Check EventBridge event published: `aws events list-rules`
2. Check SQS queue has messages: `aws sqs get-queue-attributes`
3. Check Lambda invoked: `aws logs tail /aws/lambda/...`
4. Check ECS task running: `aws ecs list-tasks`

**Fix**: Verify EventBridge rule target is correct Lambda/ECS

---

### Issue: WebSocket Not Connecting
**Symptoms**: Frontend shows "Failed to connect"

**Debug Steps**:
1. Check WebSocket endpoint URL (correct protocol ws:// or wss://)
2. Verify backend WebSocket server running (`/ws/tryon`)
3. Check CORS settings allow WebSocket connections
4. Test with wscat: `wscat -c ws://localhost:5000/ws/tryon`

**Fix**: Update WebSocket server configuration or reverse proxy

---

### Issue: Database Migration Failed
**Symptoms**: SQL errors on migration execution

**Debug Steps**:
1. Check MySQL version (requires 8.0.16+ for CHECK constraints)
2. Verify database user has ALTER privileges
3. Check for conflicting table/column names
4. Review migration SQL syntax

**Fix**: Update MySQL or adjust migration SQL

---

## 📞 Support & Escalation

**For urgent issues during deployment**:
1. Check CloudWatch Logs for immediate errors
2. Review AWS Health Dashboard for service issues
3. Rollback to previous version if critical failure
4. Contact AWS Support for infrastructure issues

---

## ✅ Sign-Off

**Implementation Completed By**: [Your Name]  
**Date**: [Date]  
**Reviewed By**: [Reviewer Name]  
**Production Deployment Date**: [Date]  

**Notes**:
- All code changes fully commented
- Backward compatibility maintained with avatars
- Performance optimized (connection pooling, caching)
- Security measures implemented (auth, validation, FK constraints)
- Monitoring and logging in place

**Ready for Production**: ⏳ (Pending final 3 tasks completion)
