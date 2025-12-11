  ____    _    ____  __  __ _____  __  __
 / ___|  / \  |  _ \|  \/  | ____| \ \/ /
| |  _  / _ \ | |_) | |\/| |  _|    \  / 
| |_| |/ ___ \|  _ <| |  | | |___   /  \ 
 \____/_/   \_\_| \_\_|  |_|_____| /_/\_\

# GARMAX AI

**GARMAX AI** is a modern full-stack platform for AI-powered virtual try-on with photo-first experiences, SMPL-based 3D pose estimation, subscription & credit management, and scalable rendering pipelines. Features production-ready AWS serverless architecture with event-driven processing, separate secure buckets, and intelligent cost management.

## 🔍 Key Files Quick Reference

### 🎨 AI Rendering Pipeline
- **[`src/services/aiRenderingService.ts`](src/services/aiRenderingService.ts)** - Main AI rendering coordinator with Replicate/Gemini routing
- **[`src/services/geminiImageService.ts`](src/services/geminiImageService.ts)** - Google Gemini Imagen 3 API integration with batch processing
- **[`src/services/batchImageService.ts`](src/services/batchImageService.ts)** - Hybrid batch orchestrator for efficient AI rendering
- **[`iac/lambda-handlers/aiRenderProcessor/index.ts`](iac/lambda-handlers/aiRenderProcessor/index.ts)** - Lambda handler for AI image generation processing

### 🤖 SMPL 3D Processing
- **[`smpl-processor/smpl_processor.py`](smpl-processor/smpl_processor.py)** - Complete SMPL pose estimation pipeline (ROMP + SMPLify-X)
- **[`iac/lambda-handlers/tryonProcessor/index.ts`](iac/lambda-handlers/tryonProcessor/index.ts)** - Lambda handler for 3D try-on processing
- **[`src/services/garmentAnalysisService.ts`](src/services/garmentAnalysisService.ts)** - AWS Rekognition garment classification

### ⚡ Event Processing
- **[`src/websocket/tryonWebSocket.ts`](src/websocket/tryonWebSocket.ts)** - Real-time status updates via WebSocket
- **[`src/services/jobStatusService.ts`](src/services/jobStatusService.ts)** - Job status management and notifications
- **[`iac/lib/EventBridge/createTryonEventBus.ts`](iac/lib/EventBridge/createTryonEventBus.ts)** - EventBridge configuration for event-driven architecture

### 🏗️ Infrastructure & Config
- **[`iac/lib/garmaxAiStack.ts`](iac/lib/garmaxAiStack.ts)** - Main CDK stack with all AWS resources
- **[`parameters/config.ts`](parameters/config.ts)** - Environment configuration and feature flags
- **[`shared/schema.ts`](shared/schema.ts)** - TypeScript schemas for events and data structures
- **[`scripts/ops/`](scripts/ops/)** - Idle teardown/restore scripts for cost optimization

### 🎮 Frontend Components
- **[`client/src/pages/VirtualTryonStudio.tsx`](client/src/pages/VirtualTryonStudio.tsx)** - Main try-on interface
- **[`client/src/components/tryon/TryonCanvas.tsx`](client/src/components/tryon/TryonCanvas.tsx)** - React Three Fiber 3D canvas
- **[`client/src/components/tryon/ProcessingModal.tsx`](client/src/components/tryon/ProcessingModal.tsx)** - Real-time processing status UI

## 📋 Table of Contents

- [Key Files Quick Reference](#-key-files-quick-reference)
- [Features](#-features) 
- [Architecture Overview](#-architecture-overview)
- [Rendering Pipeline](#-rendering-pipeline)
- [Storage & Security](#-storage--security)
- [Cost Management](#-cost-management)
- [Enterprise API](#-enterprise-api)
- [Tech Stack](#-tech-stack)
- [Infrastructure (IaC)](#-infrastructure-iac)
- [Installation](#-installation)
- [Environment Variables](#-environment-variables)
- [Running Locally](#-running-locally)
- [Deployment](#-deployment)
- [Operations](#-operations)
- [Event Flow Documentation](#-event-flow-documentation)
- [Project Structure](#-project-structure)
- [Contributing](#-contributing)

## ✨ Features

### Core Platform
- **Photo-First Try-On**: Upload photos directly - no Ready Player Me avatars required
- **SMPL 3D Pose Estimation**: Advanced human pose detection using ROMP/SMPLify-X pipeline
- **Event-Driven Architecture**: Fully documented EventBridge + SQS orchestration
- **Separate Lambda Handlers**: Individual functions for Try-On processing, AI rendering, and billing
- **Heavy Code Documentation**: Comprehensive inline comments explaining every workflow step

### AI & Rendering
- **Hybrid Rendering Pipeline**: Replicate-first with feature-gated Bedrock failover (OFF by default)
- **ControlNet Conditioning**: Depth/normal/pose/segmentation guidance for consistent results
- **Budget-Safe Processing**: Circuit breakers and daily spending limits prevent cost spikes
- **Multiple Model Support**: Fashion diffusion models with garment-specific fine-tuning

### Security & Storage
- **5 Separate S3 Buckets**: Uploads, guidance, renders, SMPL assets, and centralized logs
- **SMPL Asset Protection**: Versioned bucket with strict IAM policies for ML models
- **S3_MANAGED Encryption**: No KMS complexity while maintaining security
- **Lifecycle Management**: Automatic transitions to IA and Glacier for cost optimization
- **Access Logging**: Comprehensive audit trails for compliance and debugging

### Cost Management
- **Idle Teardown/Restore**: Scripts to scale down during inactive periods
- **Per-User Quotas**: Daily limits for try-ons and renders to control spend
- **Provider Failover**: Feature flags prevent expensive Bedrock calls unless explicitly enabled
- **CloudWatch Monitoring**: Budget alarms and resource utilization tracking

## ☁️ Architecture Overview

### Event-Driven Serverless Design

```mermaid
graph TB
    User[User Upload] -->|Photo + Garment| API[API Gateway]
    API --> EB1[EventBridge Bus]
    EB1 --> SQS1[Try-On Queue<br/>FIFO]
    SQS1 --> L1[TryonProcessor<br/>Lambda]
    
    L1 -->|SMPL Estimation| S3G[Guidance Bucket<br/>depth/normals/poses]
    L1 --> EB2[EventBridge Bus]
    EB2 --> L2[AiRenderProcessor<br/>Lambda]
    
    L2 -->|Replicate API| REP[Replicate<br/>Fashion Models]
    L2 -->|Feature Flag OFF| BED[Bedrock<br/>Failover]
    L2 -->|Final Result| S3R[Renders Bucket<br/>previews/final]
    
    BILLING[Stripe Webhooks] --> EB3[EventBridge Bus]
    EB3 --> SQS2[Billing Queue<br/>FIFO]
    SQS2 --> L3[BillingProcessor<br/>Lambda]
```

### S3 Storage Architecture

```mermaid
graph LR
    subgraph "User Content"
        S3U[Uploads Bucket<br/>photos/garments]
        S3R[Renders Bucket<br/>previews/final]
    end
    
    subgraph "AI Assets"
        S3G[Guidance Bucket<br/>depth/normals/poses]
        S3S[SMPL Assets Bucket<br/>models/weights<br/>VERSIONED]
    end
    
    subgraph "Operations"
        S3L[Logs Bucket<br/>access-logs<br/>7yr retention]
    end
    
    S3U -.->|Access Logs| S3L
    S3R -.->|Access Logs| S3L
    S3G -.->|Access Logs| S3L
    S3S -.->|Access Logs| S3L
```

## 🎨 Rendering Pipeline

### Complete AI Rendering Workflow

```mermaid
flowchart TD
    A[📸 User Photo Upload] --> B[🔍 SMPL Pose Estimation]
    B --> C[🎯 Guidance Asset Generation]
    C --> D[🎨 AI Rendering Pipeline]
    D --> E[✨ Final Try-On Result]
    
    subgraph "SMPL Processing (tryonProcessor)"
        B1[ROMP: 3D Pose Recovery]
        B2[SMPLify-X: Body Mesh Fitting]
        B3[Joint/Limb Detection]
        B --> B1 --> B2 --> B3
    end
    
    subgraph "Guidance Generation"
        C1[Depth Maps<br/>3D consistency]
        C2[Normal Maps<br/>Lighting]
        C3[Pose Maps<br/>Limb alignment]
        C4[Segmentation Masks<br/>Clothing regions]
        C --> C1
        C --> C2
        C --> C3
        C --> C4
    end
    
    subgraph "AI Rendering (aiRenderProcessor)"
        D1{Traffic Router<br/>userId % 100}
        D2[Gemini Batch<br/>Processing]
        D3[Replicate Nano<br/>Banana Pro]
        D4[PhotoMaker<br/>Fallback]
        D5[SDXL<br/>Final Fallback]
        
        D --> D1
        D1 -->|"% traffic"| D2
        D1 -->|"remaining"| D3
        D2 -->|"failure"| D4
        D3 -->|"failure"| D4
        D4 -->|"failure"| D5
    end
    
    C1 --> D
    C2 --> D
    C3 --> D
    C4 --> D
```

### Provider Routing & Failover Chain

**Traffic Distribution** ([`aiRenderingService.ts`](src/services/aiRenderingService.ts))
```typescript
// Hash-based routing for consistent user experience
const shouldUseGemini = hash(userId) % 100 < GEMINI_TRAFFIC_PERCENT;

// Gemini Route: Gemini Batch → PhotoMaker → SDXL
// Replicate Route: Nano Banana → PhotoMaker → SDXL
```

**SMPL → ControlNet Pipeline** ([`smpl-processor/smpl_processor.py`](smpl-processor/smpl_processor.py))
```python
# Complete 3D processing workflow
pose_results = self._estimate_pose_romp(image_path)
mesh_results = self._fit_body_mesh(pose_results) 
guidance_assets = self._generate_guidance_assets(mesh_results)
```

### Rendering Providers

**Primary: Replicate API**
- Fashion-tuned Stable Diffusion models
- ControlNet for pose/depth conditioning
- ~$0.01-0.05 per generation
- 10-30 second processing time
- High-quality fashion-specific results

**Failover: Amazon Bedrock (Feature Flag OFF)**
- Stability AI Stable Diffusion XL
- ~$0.02-0.08 per generation 
- Enabled only via `ALLOW_BEDROCK_FAILOVER=true`
- Circuit breaker limits daily usage

## 🔒 Storage & Security

### Separate S3 Buckets

| Bucket | Purpose | Access Pattern | Lifecycle |
|--------|---------|----------------|-----------|
| **Uploads** | User photos, garment refs | Lambda read-only | Temp: 7d, User content: 30d→IA |
| **Guidance** | SMPL-generated assets | Lambda read/write | Processing: 1d, Assets: 90d expire |
| **Renders** | Preview/final outputs | Lambda write, User read | Preview: 30d, Final: 60d→IA |
| **SMPL Assets** | ML models, weights | Lambda read-only | Versioned, extended retention |
| **Logs** | Access logs, compliance | System write-only | 7yr retention, auto-archive |

### Security Features

- **S3_MANAGED Encryption**: Server-side encryption without KMS complexity
- **Block Public Access**: All buckets deny public read/write by default
- **Scoped IAM Policies**: Lambda functions have minimal required permissions
- **Access Logging**: All bucket access logged to centralized logs bucket
- **Versioning**: SMPL assets bucket maintains model version history
- **SSL-Only Access**: Bucket policies require HTTPS for all operations

## 💰 Cost Management

### Idle Management Scripts

**Teardown Services** (`./scripts/ops/idle-teardown.sh`)
- Sets Lambda reserved concurrency to 0 (prevents new invocations)
- Disables EventBridge rules (stops event processing)
- Creates activity monitoring alarms for auto-restore notifications
- Backs up configuration to Parameter Store
- **Estimated savings: ~$78/month during idle periods**

**Restore Services** (`./scripts/ops/idle-restore.sh`)
- Removes Lambda concurrency limits
- Re-enables EventBridge rules
- Warms up functions to prevent cold starts
- Tests system readiness and connectivity
- Cleans up idle monitoring configuration

### Budget Controls

- **Daily spending limits**: Circuit breakers halt processing at budget thresholds
- **Per-user quotas**: Prevent individual users from excessive resource consumption
- **Provider failover gates**: Bedrock rendering disabled by default (cost protection)
- **CloudWatch alarms**: Alert on unusual spending patterns or quota breaches

---

## 🏢 Enterprise API

GarmaxAI provides a comprehensive Enterprise API for programmatic access to virtual try-on capabilities. Perfect for e-commerce platforms, fashion retailers, and integrators.

### Key Features

- **API Key Authentication**: Secure programmatic access with scoped permissions
- **Cart Try-On Pipeline**: Process multiple garments in a single batch (up to 20 items)
- **Webhook System**: Real-time notifications for async operations
- **Credit System**: Transparent pricing with volume discounts
- **Rate Limiting**: Configurable limits per API key
- **External Customer Management**: Map your users to our system
- **Photo Upload & Storage**: Secure S3-backed photo management

### Quick Start

```bash
# Create organization (requires JWT auth)
curl -X POST https://api.garmaxai.com/api/organizations \
  -H "Authorization: Bearer <jwt>" \
  -d '{"name":"Acme Fashion","billingEmail":"billing@acme.com"}'

# Generate API key
curl -X POST https://api.garmaxai.com/api/organizations/{orgId}/api-keys \
  -H "Authorization: Bearer <jwt>" \
  -d '{"name":"Production Key","scopes":["tryon:create","tryon:read"]}'

# Create cart try-on session
curl -X POST https://api.garmaxai.com/api/v1/cart-tryons \
  -H "X-API-Key: gx_live_..." \
  -d '{
    "cartId": "cart_123",
    "customerPhotoS3Key": "enterprise/org-abc/photos/customer.jpg",
    "cartItems": [
      {
        "productId": "prod_001",
        "name": "Blue T-Shirt",
        "imageUrl": "https://shop.com/tshirt.jpg",
        "category": "tops",
        "quantity": 1,
        "price": 29.99,
        "currency": "USD"
      }
    ],
    "renderQuality": "hd"
  }'
```

### Documentation

📚 **[Complete Enterprise API Documentation](ENTERPRISE_API.md)**

Includes:
- 26+ API endpoints with examples
- Authentication & rate limiting
- Credit system & pricing
- Webhook integration guide
- Code examples (Node.js, Python, PHP)
- Error handling & best practices

### API Endpoints Overview

| Resource | Endpoints | Authentication |
|----------|-----------|----------------|
| Organizations | 4 endpoints | JWT (User Session) |
| API Keys | 3 endpoints | JWT (User Session) |
| External Customers | 4 endpoints | API Key |
| Customer Photos | 2 endpoints | API Key |
| Cart Try-Ons | 4 endpoints | API Key |
| Webhooks | 6 endpoints | API Key |

---

## 🛠 Tech Stack

### Backend
- **Runtime**: Node.js 20.x (Lambda)
- **Framework**: Express.js with TypeScript
- **Database**: MySQL/Aurora with Drizzle ORM
- **Authentication**: Session-based (Passport.js)
- **Event Processing**: AWS EventBridge + SQS
- **Storage**: S3 with lifecycle policies

### Frontend  
- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + Radix UI
- **State Management**: React Query (TanStack)
- **Form Handling**: React Hook Form + Zod validation
- **Deployment**: S3 Static Site + CloudFront

### AI & ML
- **Pose Estimation**: SMPL, ROMP, SMPLify-X
- **Image Generation**: Stable Diffusion via Replicate/Bedrock
- **Conditioning**: ControlNet (depth, normal, pose, segmentation)
- **Models**: Fashion-specific fine-tuned diffusion models

### Infrastructure
- **IaC**: AWS CDK (TypeScript)
- **Compute**: Lambda (serverless) + optional ECS (heavy jobs)
- **Storage**: 5 separate S3 buckets with lifecycle policies
- **CDN**: CloudFront with custom domains
- **Monitoring**: CloudWatch + X-Ray tracing
- **Cost Control**: Budget alarms + idle management scripts

## 🏗 Infrastructure (IaC)

### CDK Stack Components

```typescript
// Bucket Creation (with comprehensive security)
const uploadsBucket = createUploadsBucket(this, stage, logsBucket);
const guidanceBucket = createGuidanceBucket(this, stage, logsBucket);
const rendersBucket = createRendersBucket(this, stage, logsBucket);
const smplAssetsBucket = createSmplAssetsBucket(this, stage, logsBucket);

// Lambda Functions (separate handlers)
const tryonProcessor = createTryonProcessor(this, stage, {
  uploadsBucket, guidanceBucket, rendersBucket, smplAssetsBucket
});

const aiRenderProcessor = createAiRenderProcessor(this, stage, {
  guidanceBucket, rendersBucket, allowBedrockFailover: false
});
```

### Environment-Specific Configuration

```typescript
// parameters/config.ts - Feature flags and limits
export const env = {
  // Rendering configuration
  RENDER_PROVIDER: 'replicate',
  ALLOW_BEDROCK_FAILOVER: false,  // Cost protection
  
  // Budget controls
  BEDROCK_DAILY_BUDGET_USD: '50',
  MAX_RENDERS_PER_USER_DAILY: '20',
  MAX_TRYONS_PER_USER_DAILY: '50',
  
  // Processing configuration  
  SMPL_PROCESSING_MODE: 'LAMBDA', // or 'ECS'
  ENABLE_ECS_HEAVY_JOBS: false,
};
```

## ⚙️ Installation

### Prerequisites

```bash
# Node.js and package manager
node --version  # v20.x required
npm --version   # v10.x recommended

# AWS CLI and CDK
aws --version   # v2.x required
npm install -g aws-cdk@latest

# Docker (for local development)
docker --version
```

### Setup Steps

1. **Clone and Install Dependencies**
```bash
git clone https://github.com/your-org/garmax-ai.git
cd garmax-ai
npm install

# Install CDK dependencies
cd iac
npm install
cd ..
```

2. **Configure Environment Variables**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Configure AWS Credentials**
```bash
aws configure
# Or use IAM roles, SSO, etc.
```

4. **Deploy Infrastructure**
```bash
cd iac
npm run build
cdk bootstrap  # First time only
cdk deploy GarmaxAiStack-DEV
```

## 🔧 Environment Variables

### Required Variables

```bash
# Database
DATABASE_URL="mysql://user:pass@host:3306/garmax_ai"

# API Keys
INTERNAL_API_KEY="your-internal-api-key"
REPLICATE_API_TOKEN="your-replicate-token"

# AWS Configuration  
AWS_REGION="us-east-1"
AWS_ACCOUNT_ID="123456789012"

# Stage Configuration
STAGE="DEV"  # DEV, QA, PROD
```

### Optional Variables (Feature Flags)

```bash
# Cost controls (recommended for production)
ALLOW_BEDROCK_FAILOVER="false"
BEDROCK_DAILY_BUDGET_USD="50"
MAX_RENDERS_PER_USER_DAILY="20"

# Processing configuration
SMPL_PROCESSING_MODE="LAMBDA"  # LAMBDA or ECS
ENABLE_ECS_HEAVY_JOBS="false"

# Domain configuration
HOSTED_ZONE_NAME="your-domain.com"
FRONTEND_DOMAIN_NAME="app.your-domain.com"  
BACKEND_DOMAIN_NAME="api.your-domain.com"
```

## 🚀 Running Locally

### Backend Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# API available at: http://localhost:3001
```

### Frontend Development  
```bash
# Navigate to client directory
cd client

# Install dependencies
npm install  

# Start development server
npm run dev

# Frontend available at: http://localhost:5173
```

### Full Stack with Docker
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## 📦 Deployment

### Staging Deployment
```bash
cd iac
npm run build
cdk deploy GarmaxAiStack-QA
```

### Production Deployment
```bash
cd iac
npm run build

# Deploy with additional safety checks
cdk diff GarmaxAiStack-PROD  # Review changes
cdk deploy GarmaxAiStack-PROD --require-approval broadening
```

### Frontend Deployment
```bash
cd client
npm run build

# Deploy to S3 bucket (output from CDK)
aws s3 sync dist/ s3://your-frontend-bucket --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"
```

## ⚡ Operations

### Idle Management

**Scale Down During Inactive Periods**
```bash
# Teardown (saves ~$78/month during idle)
./scripts/ops/idle-teardown.sh DEV

# System automatically creates monitoring for activity detection
# SNS notifications will alert when restore is needed
```

**Restore Services When Activity Resumes**
```bash  
# Restore full functionality
./scripts/ops/idle-restore.sh DEV

# System tests connectivity and warms up functions
# Ready for production traffic within 2-3 minutes
```

### Monitoring & Debugging

**CloudWatch Logs Access**
```bash
# Try-On processor logs
aws logs tail /aws/lambda/GarmaxAi-TryonProcessor-DEV --follow

# AI render processor logs  
aws logs tail /aws/lambda/GarmaxAi-AiRenderProcessor-DEV --follow

# Billing processor logs
aws logs tail /aws/lambda/GarmaxAi-BillingProcessor-DEV --follow
```

**Budget Monitoring**
```bash
# Check current spending
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-01-31 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE

# Review budget alarms
aws budgets describe-budgets --account-id YOUR_ACCOUNT_ID
```

### Queue Management

**Monitor SQS Queue Health**
```bash
# Check try-on queue metrics
aws sqs get-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/ACCOUNT/GarmaxAi-TryonQueue-DEV-fifo \
  --attribute-names All

# Purge queue if needed (emergency)
aws sqs purge-queue \
  --queue-url https://sqs.us-east-1.amazonaws.com/ACCOUNT/GarmaxAi-TryonQueue-DEV-fifo
```

## 📊 Event Flow Documentation

### Try-On Processing Flow

```mermaid
sequenceDiagram
    participant User
    participant API
    participant EventBridge
    participant TryonQueue
    participant TryonProcessor
    participant GuidanceBucket
    participant AiRenderProcessor
    participant RendersBucket
    
    User->>API: Upload photo + garment
    API->>EventBridge: PublishEvent(tryon-requested)
    EventBridge->>TryonQueue: Route to FIFO queue
    TryonQueue->>TryonProcessor: Trigger Lambda
    
    TryonProcessor->>TryonProcessor: SMPL pose estimation
    TryonProcessor->>GuidanceBucket: Store depth/normal/pose maps
    TryonProcessor->>EventBridge: PublishEvent(guidance-ready)
    
    EventBridge->>AiRenderProcessor: Direct invoke
    AiRenderProcessor->>GuidanceBucket: Fetch guidance assets
    AiRenderProcessor->>AiRenderProcessor: Replicate API call
    AiRenderProcessor->>RendersBucket: Store final render
    AiRenderProcessor->>EventBridge: PublishEvent(render-complete)
```

### Event Schema Documentation

**Try-On Request Event**
```typescript
{
  source: 'garmax-ai.tryon',
  detail-type: 'Tryon Requested',
  detail: {
    sessionId: string,
    userId: string,
    avatarImageKey: string,
    garmentImageKey: string,
    preferences: {
      style?: string,
      fit?: 'tight' | 'loose' | 'normal',
      background?: string
    }
  }
}
```

**Guidance Ready Event**
```typescript  
{
  source: 'garmax-ai.tryon',
  detail-type: 'Guidance Assets Ready',
  detail: {
    sessionId: string,
    userId: string,
    guidanceAssets: {
      depthMapKey: string,
      normalMapKey: string,
      poseMapKey: string,
      segmentationKey: string,
      promptKey: string
    },
    smplMetadata: {
      poseConfidence: number,
      bodyShape: string,
      estimatedFit: string
    }
  }
}
```

## 📁 Project Structure

```
garmax-ai/
├── README.md                          # This comprehensive documentation
├── package.json                       # Root project dependencies
├── docker-compose.yml                 # Local development environment
├── .env.example                       # Environment template
│
├── client/                            # React frontend application  
│   ├── src/
│   │   ├── components/
│   │   │   ├── tryon/                 # Try-on specific components
│   │   │   └── ui/                    # Reusable UI components
│   │   ├── pages/
│   │   │   ├── VirtualTryonStudio.tsx # Main try-on interface
│   │   │   └── Dashboard.tsx          # User dashboard
│   │   └── hooks/                     # Custom React hooks
│   └── package.json
│
├── src/                              # Express.js backend API
│   ├── app.ts                        # Application setup
│   ├── routes.ts                     # Route definitions
│   ├── controllers/                  # Request handlers
│   │   ├── tryonController.ts        # Try-on session management
│   │   ├── garmentController.ts      # Garment catalog
│   │   └── avatarController.ts       # Avatar management
│   ├── services/                     # Business logic
│   │   ├── generationService.ts      # AI generation coordination
│   │   └── jobStatusService.ts       # Real-time status updates
│   └── websocket/
│       └── tryonWebSocket.ts         # WebSocket handler
│
├── iac/                              # AWS CDK infrastructure
│   ├── lib/
│   │   ├── garmaxAiStack.ts          # Main CDK stack
│   │   ├── Storage/                  # S3 bucket creators
│   │   │   ├── createUploadsBucket.ts
│   │   │   ├── createGuidanceBucket.ts
│   │   │   ├── createRendersBucket.ts
│   │   │   ├── createSmplAssetsBucket.ts
│   │   │   └── createLogsBucket.ts
│   │   ├── Lambda/                   # Lambda function creators
│   │   │   ├── createTryonProcessor.ts
│   │   │   ├── createAiRenderProcessor.ts
│   │   │   └── createBillingProcessor.ts
│   │   └── EventBridge/
│   │       └── createTryonEventBus.ts
│   └── lambda-handlers/              # Lambda function code
│       ├── tryonProcessor/
│       │   └── index.ts              # SMPL processing logic
│       ├── aiRenderProcessor/
│       │   └── index.ts              # AI rendering logic
│       └── billingProcessor/
│           └── index.js              # Billing event handling
│
├── parameters/                       # Environment configuration
│   ├── config.ts                     # Shared configuration
│   ├── DEV.ts                        # Development settings
│   ├── QA.ts                         # Staging settings
│   └── PROD.ts                       # Production settings
│
├── scripts/                          # Operational scripts
│   └── ops/
│       ├── idle-teardown.sh          # Scale down for cost savings
│       └── idle-restore.sh           # Restore services
│
├── shared/                           # Shared TypeScript schemas
│   └── schema.ts                     # Event and data schemas
│
└── logs/                             # Local development logs
```

## 🤝 Contributing

### Development Workflow

1. **Fork and Clone**
```bash
git fork https://github.com/your-org/garmax-ai.git
git clone https://github.com/your-username/garmax-ai.git
cd garmax-ai
```

2. **Create Feature Branch**
```bash
git checkout -b feature/your-feature-name
```

3. **Development Standards**
- Follow existing code documentation patterns (heavy commenting)
- Add inline comments explaining business logic
- Include error handling and logging
- Write tests for new Lambda functions
- Update this README for any architectural changes

4. **Test Locally**
```bash
npm run test
npm run build
cd iac && npm run build
```

5. **Submit Pull Request**
- Include comprehensive description of changes
- Reference any related issues
- Ensure all tests pass
- Request review from maintainers

### Code Documentation Standards

**Lambda Functions**: Every function should have:
- Purpose and event schema documentation at the top
- Inline comments for each processing step
- Error handling with descriptive messages
- Cost implications noted where applicable

**Example**:
```typescript
/**
 * TryonProcessor Lambda Handler
 * 
 * Purpose: Processes user photos through SMPL pipeline to generate guidance assets
 * 
 * Event Schema:
 * {
 *   sessionId: string,
 *   userId: string, 
 *   avatarImageKey: string,
 *   garmentImageKey: string
 * }
 * 
 * Output: Publishes guidance-ready event to EventBridge
 * Cost Impact: ~$0.01 per processing (SMPL estimation)
 */
export const handler = async (event: SQSEvent): Promise<void> => {
  // Parse and validate SQS message containing try-on request
  const records = event.Records;
  
  for (const record of records) {
    // Extract try-on session details from message body
    const body = JSON.parse(record.body);
    // ... rest of implementation with detailed comments
  }
};
```

---

**Built with ❤️ by the GARMAX AI team**

For questions, issues, or contributions, please reach out through GitHub Issues or our community channels.