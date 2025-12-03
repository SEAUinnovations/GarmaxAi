  ____    _    ____  __  __ _____  __  __
 / ___|  / \  |  _ \|  \/  | ____| \ \/ /
| |  _  / _ \ | |_) | |\/| |  _|    \  / 
| |_| |/ ___ \|  _ <| |  | | |___   /  \ 
 \____/_/   \_\_| \_\_|  |_|_____| /_/\_\

# GARMAX AI - Developer Guide

**Complete onboarding guide for developers joining the GARMAX AI team.** This guide covers setup, architecture understanding, development workflow, testing practices, and codebase navigation to get you productive quickly.

## 🔍 Key Files Quick Reference

### 🚀 Getting Started Essential
- **[`package.json`](package.json)** - Root project dependencies and scripts
- **[`.env.example`](.env.example)** - Environment variables template
- **[`parameters/config.ts`](parameters/config.ts)** - Environment configuration and feature flags
- **[`shared/schema.ts`](shared/schema.ts)** - Database schema and TypeScript types

### 🎯 Core Backend Services
- **[`src/app.ts`](src/app.ts)** - Express application setup and middleware
- **[`src/routes.ts`](src/routes.ts)** - Route definitions and API structure
- **[`src/storage.ts`](src/storage.ts)** - Storage abstraction layer (dev vs prod)
- **[`src/services/`](src/services/)** - Business logic services directory
  - [`generationService.ts`](src/services/generationService.ts) - AI generation coordination
  - [`jobStatusService.ts`](src/services/jobStatusService.ts) - Real-time status management
  - [`aiRenderingService.ts`](src/services/aiRenderingService.ts) - Main AI rendering pipeline

### 🎮 Frontend Development
- **[`client/src/App.tsx`](client/src/App.tsx)** - Main React application
- **[`client/src/pages/VirtualTryonStudio.tsx`](client/src/pages/VirtualTryonStudio.tsx)** - Primary try-on interface
- **[`client/src/components/tryon/`](client/src/components/tryon/)** - Try-on specific components
- **[`client/src/services/api.ts`](client/src/services/api.ts)** - Type-safe API client

### 🏗️ Infrastructure & Processing
- **[`iac/lib/garmaxAiStack.ts`](iac/lib/garmaxAiStack.ts)** - CDK infrastructure stack
- **[`smpl-processor/smpl_processor.py`](smpl-processor/smpl_processor.py)** - SMPL 3D pose processing
- **[`iac/lambda-handlers/`](iac/lambda-handlers/)** - Lambda function implementations
- **[`src/websocket/tryonWebSocket.ts`](src/websocket/tryonWebSocket.ts)** - Real-time WebSocket handler

### 🧪 Testing & Quality
- **[`tests/setup.ts`](tests/setup.ts)** - Backend testing configuration
- **[`client/src/test/setup.ts`](client/src/test/setup.ts)** - Frontend testing setup
- **[`jest.config.js`](jest.config.js)** - Backend test configuration
- **[`client/vitest.config.ts`](client/vitest.config.ts)** - Frontend test configuration

## ⚡ Quick Setup (5 minutes)

### Prerequisites
```bash
# Verify Node.js version (v20.x required)
node --version

# Verify npm version
npm --version

# AWS CLI for infrastructure deployment
aws --version

# Docker for local development
docker --version
```

### 1. Environment Configuration
```bash
# Clone and install
git clone https://github.com/SEAUinnovations/GarmaxAi.git
cd GarmaxAi
npm install

# Install CDK dependencies
cd iac && npm install && cd ..

# Configure environment
cp .env.example .env
```

### 2. Database Setup

**Option A: Local Development (Memory Storage)**
```bash
# Automatic - no configuration needed
NODE_ENV=development
npm run dev
```

**Option B: AWS RDS Aurora (Production-like)**
```bash
# Configure RDS connection in .env
DATABASE_URL=mysql://admin:password@cluster-endpoint.us-east-1.rds.amazonaws.com:3306/garmaxai

# Push schema
npm run db:push
```

### 3. Start Development
```bash
# Full stack development
npm run dev

# Backend: http://localhost:3001
# Frontend: http://localhost:5173 (automatically opens)
```

## 🏗️ Architecture Deep Dive

### Storage Abstraction Layer

The application uses a flexible storage system that automatically switches between development and production storage:

**Development Mode** ([`src/storage.ts`](src/storage.ts))
```typescript
// Automatic in-memory storage
const storage = await getStorage(); // Returns MemStorage
```

**Production Mode**
```typescript
// Automatic RDS Aurora MySQL via Drizzle ORM
const storage = await getStorage(); // Returns RDSStorage
```

**Key Benefits:**
- Zero configuration for local development
- Same API for both storage types
- Automatic environment detection
- Easy testing with ephemeral data

### Event-Driven Processing

**EventBridge + SQS Architecture** ([`iac/lib/EventBridge/createTryonEventBus.ts`](iac/lib/EventBridge/createTryonEventBus.ts))

```mermaid
flowchart LR
    API[API Request] --> EB[EventBridge Bus]
    EB --> SQS1[Try-On Queue FIFO]
    EB --> SQS2[Render Queue FIFO] 
    EB --> SQS3[Billing Queue FIFO]
    
    SQS1 --> L1[TryonProcessor λ]
    SQS2 --> L2[AiRenderProcessor λ]
    SQS3 --> L3[BillingProcessor λ]
```

**Event Schemas** ([`shared/schema.ts`](shared/schema.ts))
```typescript
// Try-on request event
interface TryonRequestEvent {
  source: 'garmax-ai.tryon';
  'detail-type': 'Tryon Requested';
  detail: {
    sessionId: string;
    userId: string;
    avatarImageKey: string;
    garmentImageKey: string;
  };
}
```

### Real-Time Updates

**WebSocket Integration** ([`src/websocket/tryonWebSocket.ts`](src/websocket/tryonWebSocket.ts))

```typescript
// Room-based broadcasting
socket.join(`session-${sessionId}`);
io.to(`session-${sessionId}`).emit('status-update', {
  sessionId,
  status: 'processing',
  stage: 'smpl-estimation',
  progress: 45
});
```

## 🎨 AI Rendering Pipeline

### Service Hierarchy

**Main Coordinator** ([`src/services/aiRenderingService.ts`](src/services/aiRenderingService.ts))
```typescript
// Traffic routing decision
const shouldUseGemini = this.shouldRouteToGemini(userId);

if (shouldUseGemini) {
  // Route to Gemini batch processing
  return await batchImageService.queueRequest(userId, geminiRequest);
} else {
  // Route to Replicate Nano Banana Pro
  return await replicate.run("google/nano-banana-pro", { input });
}
```

**Gemini Batch Processing** ([`src/services/geminiImageService.ts`](src/services/geminiImageService.ts))
```typescript
// Hybrid batching: 50 images OR 45s timeout
const batch = await this.collectBatchRequests(maxSize: 50, timeout: 45000);
const results = await this.submitGeminiBatch(batch);
```

**SMPL 3D Processing** ([`smpl-processor/smpl_processor.py`](smpl-processor/smpl_processor.py))
```python
# Complete pose estimation pipeline
def process_image(self, session_id, avatar_key, garment_key):
    pose_results = self._estimate_pose_romp(avatar_path)
    mesh_results = self._fit_body_mesh(pose_results)
    guidance_assets = self._generate_guidance_assets(mesh_results)
    return self._upload_guidance_assets(session_id, guidance_assets)
```

### Failover Chain Strategy

1. **Primary**: Gemini Imagen 3 (cost-effective batch processing)
2. **Fallback 1**: Replicate Nano Banana Pro (high-quality fashion models)
3. **Fallback 2**: PhotoMaker (identity preservation)
4. **Final**: Stable Diffusion XL (reliable baseline)

## 💻 Development Workflow

### Local Development Commands

```bash
# Development server with auto-reload
npm run dev

# Frontend-only development
cd client && npm run dev

# Backend-only development
npm run dev:server

# Type checking
npm run check

# Database operations
npm run db:push          # Push schema changes
npm run db:migrate       # Run migrations
npm run db:studio        # Open Drizzle Studio
```

### Feature Development Process

1. **Create Feature Branch**
```bash
git checkout -b feature/your-feature-name
```

2. **Implement & Test**
```bash
# Run tests continuously
npm run test:watch

# Check types
npm run check

# Lint and format
npm run lint
npm run format
```

3. **Update Documentation**
- Add inline comments for complex logic
- Update API documentation in route files
- Add tests for new functionality

4. **Submit PR**
- Reference related issues
- Include screenshots for UI changes
- Ensure all tests pass

### Code Documentation Standards

**Lambda Functions**: Heavy commenting required
```typescript
/**
 * TryonProcessor Lambda Handler
 * 
 * Processes user photos through SMPL pipeline to generate guidance assets
 * for AI rendering. Uses ROMP for pose estimation and SMPLify-X for mesh fitting.
 * 
 * Cost Impact: ~$0.01 per processing (CPU-intensive SMPL operations)
 * Processing Time: 15-45 seconds depending on image complexity
 */
export const handler = async (event: SQSEvent) => {
  // Parse SQS message containing try-on session details
  for (const record of event.Records) {
    const { sessionId, userId, avatarImageKey } = JSON.parse(record.body);
    
    // Download user photo from uploads bucket
    // ... implementation with detailed step-by-step comments
  }
};
```

**Service Classes**: Business logic explanation
```typescript
/**
 * AI Rendering Service - Main coordinator for image generation
 * 
 * Implements hybrid routing between Gemini (batch) and Replicate (real-time)
 * with comprehensive failover chain for reliability.
 */
export class AIRenderingService {
  /**
   * Generate virtual try-on render with provider failover
   * 
   * Routing Strategy:
   * - Hash user ID for consistent experience (same user = same provider)
   * - Route percentage to Gemini based on GEMINI_TRAFFIC_PERCENT
   * - Fall back through Nano Banana → PhotoMaker → SDXL on failures
   */
  async generateTryOnRender(options: TryOnRenderOptions) {
    // Implementation with step-by-step comments
  }
}
```

## 🧪 Testing Infrastructure

### Backend Testing (Jest)

**Test Structure** ([`tests/`](tests/))
```
tests/
├── setup.ts              # Global test setup
├── utils/testHelpers.ts   # Test utilities and helpers
├── mocks/                 # Mock implementations
├── auth/auth.test.ts      # Authentication tests
├── e2e/tryon.test.ts      # End-to-end workflow tests
└── users/user.test.ts     # User management tests
```

**Example Test** ([`tests/auth/auth.test.ts`](tests/auth/auth.test.ts))
```typescript
import { TestClient } from '../utils/testHelpers';

describe('Authentication', () => {
  let client: TestClient;

  beforeEach(() => {
    client = new TestClient();
  });

  it('should register new user successfully', async () => {
    const response = await client.post('/api/auth/register', {
      email: 'test@example.com',
      password: 'securePassword123'
    });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('user');
    expect(response.body.user.email).toBe('test@example.com');
  });
});
```

### Frontend Testing (Vitest)

**Test Structure** ([`client/src/test/`](client/src/test/))
```
client/src/test/
├── setup.ts                    # Global test setup
├── mocks/
│   ├── handlers.ts            # MSW API handlers
│   └── server.ts              # MSW server setup
└── __tests__/
    ├── components/            # Component tests
    ├── pages/                 # Page integration tests
    └── services/              # Service unit tests
```

**Component Testing Example**
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { TryonCanvas } from '@/components/tryon/TryonCanvas';

describe('TryonCanvas', () => {
  it('should render 3D canvas with avatar', async () => {
    render(<TryonCanvas avatarUrl="/avatar.glb" />);
    
    expect(screen.getByTestId('tryon-canvas')).toBeInTheDocument();
    
    // Test 3D interaction
    const canvas = screen.getByRole('img'); // Canvas element
    fireEvent.click(canvas);
    
    expect(screen.getByText('Avatar loaded')).toBeInTheDocument();
  });
});
```

### Running Tests

```bash
# Backend tests
npm run test

# Frontend tests  
cd client && npm run test

# Test coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

### Mock Services

**AWS Services Mock** ([`tests/mocks/aws-sdk.ts`](tests/mocks/aws-sdk.ts))
```typescript
// Comprehensive AWS SDK mocking
const mockS3 = {
  upload: jest.fn().mockResolvedValue({ Location: 'mock-s3-url' }),
  getObject: jest.fn().mockResolvedValue({ Body: Buffer.from('mock-data') }),
  deleteObject: jest.fn().mockResolvedValue({})
};
```

**API Mocking with MSW** ([`client/src/test/mocks/handlers.ts`](client/src/test/mocks/handlers.ts))
```typescript
import { rest } from 'msw';

export const handlers = [
  rest.post('/api/tryon/sessions', (req, res, ctx) => {
    return res(ctx.json({ sessionId: 'mock-session-123' }));
  }),
  
  rest.get('/api/tryon/sessions/:id', (req, res, ctx) => {
    return res(ctx.json({ 
      sessionId: req.params.id,
      status: 'processing',
      progress: 45
    }));
  })
];
```

## 🔧 Configuration & Environment

### Environment Variables Structure

**Development** ([`.env.example`](.env.example))
```bash
# Database - Automatic memory storage
NODE_ENV=development

# API Configuration  
PORT=3001
CLIENT_PORT=5173

# Feature Flags
ENABLE_GEMINI_BATCH=false
GEMINI_TRAFFIC_PERCENT=0
ALLOW_BEDROCK_FAILOVER=false
```

**Production** ([`parameters/PROD.ts`](parameters/PROD.ts))
```typescript
export const prodConfig = {
  // Database
  DATABASE_URL: process.env.DATABASE_URL,
  
  // AI Rendering
  RENDER_PROVIDER: 'replicate',
  ENABLE_GEMINI_BATCH: 'true',
  GEMINI_TRAFFIC_PERCENT: '10', // Gradual rollout
  
  // Cost Controls
  BEDROCK_DAILY_BUDGET_USD: '200',
  MAX_RENDERS_PER_USER_DAILY: '50'
};
```

### Feature Flags System

**Configuration** ([`parameters/config.ts`](parameters/config.ts))
```typescript
// Centralized feature flag management
export const getConfig = () => ({
  // Rendering configuration
  enableGeminiBatch: process.env.ENABLE_GEMINI_BATCH === 'true',
  geminiTrafficPercent: parseInt(process.env.GEMINI_TRAFFIC_PERCENT || '0'),
  
  // Cost protection
  allowBedrockFailover: process.env.ALLOW_BEDROCK_FAILOVER === 'true',
  bedrockDailyBudget: parseFloat(process.env.BEDROCK_DAILY_BUDGET_USD || '50'),
  
  // Processing limits
  maxRendersPerUserDaily: parseInt(process.env.MAX_RENDERS_PER_USER_DAILY || '20')
});
```

## 🚀 Deployment Process

### Development Deployment
```bash
# Deploy infrastructure
cd iac
npm run build
cdk deploy GarmaxAiStack-DEV
```

### Production Deployment
```bash
# Review changes first
cdk diff GarmaxAiStack-PROD

# Deploy with safety checks
cdk deploy GarmaxAiStack-PROD --require-approval broadening

# Deploy frontend
cd client
npm run build
aws s3 sync dist/ s3://your-frontend-bucket
```

## 🔍 Debugging & Monitoring

### Local Debugging

**Backend Debugging**
```bash
# Debug mode with inspector
npm run dev:debug

# View detailed logs
DEBUG=garmax:* npm run dev
```

**Frontend Debugging**
- React Developer Tools (browser extension)
- Redux DevTools (for state management)
- Network tab for API calls
- Console for WebSocket messages

### Production Monitoring

**CloudWatch Logs**
```bash
# Lambda function logs
aws logs tail /aws/lambda/GarmaxAi-TryonProcessor-PROD --follow

# API Gateway logs
aws logs tail /aws/apigateway/GarmaxAi-PROD --follow
```

**Health Checks**
```bash
# Application health
curl https://api.garmax.ai/api/health

# Storage health
curl https://api.garmax.ai/api/health/storage
```

## 🎯 Common Development Tasks

### Adding a New API Endpoint

1. **Define Route** ([`src/routes.ts`](src/routes.ts))
```typescript
app.use('/api/tryon', tryonRouter);
```

2. **Create Router** (`src/routers/newFeatureRouter.ts`)
```typescript
/**
 * @swagger
 * /api/new-feature:
 *   post:
 *     summary: Create new feature
 *     tags: [NewFeature]
 */
router.post('/', async (req, res) => {
  // Implementation
});
```

3. **Add Service Logic** (`src/services/newFeatureService.ts`)
```typescript
export class NewFeatureService {
  async processFeature(data: FeatureData) {
    // Business logic
  }
}
```

4. **Write Tests** (`tests/newFeature.test.ts`)
```typescript
describe('NewFeature API', () => {
  it('should create new feature', async () => {
    // Test implementation
  });
});
```

### Adding a Lambda Function

1. **Create Handler** (`iac/lambda-handlers/newProcessor/index.ts`)
```typescript
export const handler = async (event: SQSEvent) => {
  // Process SQS messages
};
```

2. **Add Infrastructure** (`iac/lib/Lambda/createNewProcessor.ts`)
```typescript
export function createNewProcessor(scope: Construct, stage: string) {
  return new Function(scope, `NewProcessor-${stage}`, {
    // Lambda configuration
  });
}
```

3. **Connect to EventBridge** (`iac/lib/EventBridge/createTryonEventBus.ts`)
```typescript
new Rule(scope, `NewProcessorRule-${stage}`, {
  eventBus: bus,
  eventPattern: { source: ['garmax-ai.new-feature'] },
  targets: [new LambdaFunction(newProcessor)]
});
```

### Adding a React Component

1. **Create Component** (`client/src/components/NewComponent.tsx`)
```typescript
interface Props {
  data: ComponentData;
}

export function NewComponent({ data }: Props) {
  return <div>{/* Implementation */}</div>;
}
```

2. **Add Tests** (`client/src/test/__tests__/components/NewComponent.test.tsx`)
```typescript
describe('NewComponent', () => {
  it('should render correctly', () => {
    render(<NewComponent data={mockData} />);
    // Assertions
  });
});
```

## 🎉 You're Ready!

This guide covers the essential knowledge for contributing to GARMAX AI. Key takeaways:

1. **Storage abstraction** makes local development frictionless
2. **Event-driven architecture** enables scalable processing
3. **Heavy documentation** in Lambda functions is required
4. **Testing infrastructure** supports both backend and frontend
5. **Feature flags** enable safe gradual rollouts

### Next Steps
- Explore the codebase using the Quick Reference links
- Run `npm run dev` and experiment with the try-on studio
- Review existing tests to understand patterns
- Start with small features to get familiar with the architecture

### Getting Help
- Check inline documentation in service files
- Review test files for usage examples
- Examine Lambda handlers for processing workflows
- Use the Quick Reference for rapid file navigation

**Happy coding!** 🚀