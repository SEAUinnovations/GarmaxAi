  ____    _    ____  __  __ _____  __  __
 / ___|  / \  |  _ \|  \/  | ____| \ \/ /
| |  _  / _ \ | |_) | |\/| |  _|    \  / 
| |_| |/ ___ \|  _ <| |  | | |___   /  \ 
 \____/_/   \_\_| \_\_|  |_|_____| /_/\_\

# GARMEX

**GARMEX** is a modern full-stack platform for AI-powered virtual try-on, garment analysis, subscription & credit management, and image generation. It features a production-ready AWS serverless + edge architecture with dedicated billing event flows and scalable rendering.

## 📋 Table of Contents

- [Features](#-features)
- [Architecture Overview](#-architecture-overview)
- [Tech Stack](#-tech-stack)
- [Infrastructure (IaC)](#-infrastructure-iac)
- [Installation](#-installation)
- [Environment Variables](#-environment-variables)
- [Running Locally](#-running-locally)
- [Deployment](#-deployment)
- [Stripe Billing Workflow](#-stripe-billing-workflow)
- [Try-On & Rendering Flow](#-try-on--rendering-flow)
- [Security & Isolation](#-security--isolation)
- [Project Structure](#-project-structure)
- [Scripts](#-scripts)
- [Migration from Previous Name](#-migration-from-previous-name)
- [Contributing](#-contributing)

## ✨ Features

- **Edge + Serverless Architecture**: Static SPA on S3 + CloudFront; backend behind separate CloudFront distribution.
- **Isolated Billing Workflow**: Stripe webhooks → EventBridge → dedicated Billing SQS → Lambda processor.
- **Event-Driven Try-On**: Custom EventBridge bus + FIFO queue for ordered processing & rendering.
- **AI Image Generation & Virtual Try-On**: Pluggable rendering pipeline.
- **MySQL / Aurora Compatible Data Layer** with Drizzle ORM.
- **Secure User Auth**: Session + Passport-based (extensible for Cognito/OIDC).
- **Real-time Updates**: WebSocket channel for try-on session status.
- **Modern Frontend**: React 19, Vite, Tailwind, Radix, React Query, Zod.
- **Strict Webhook Verification**: Signature + timestamp tolerance.
- **Scalable Queues**: Separate FIFO queues (Try-On vs Billing) for workload isolation.

## ☁️ Architecture Overview

```
                +-----------------------------+
                |        Users / Browsers     |
                +---------------+-------------+
                                |
                        HTTPS (CloudFront)
                                |
                    +-----------v-----------+
                    | Frontend Distribution |---> Private S3 (Static SPA)
                    +-----------+-----------+
                                |
                           API Calls
                                |
                    +-----------v-----------+
                    | Backend Distribution  |
                    +-----------+-----------+
                                |
                        API Gateway (REST)
                                |
                            Lambda (API)
                                |
                    EventBridge (Custom Bus)
                    /          |          \
          Stripe Webhook   Try-On Events   Render Requests
                |                |               |
        Verified & Published     |               |
                |                |               |
         +------v------+   +-----v------+   +-----v------+
         | Billing SQS |   | Try-On SQS |   | (Optional) |
         +------+------+
                |
         BillingProcessor (Lambda)
                |
        Subscription/Credit Updates
```

## 🏗️ Tech Stack

### Frontend
- React 19, TypeScript, Vite
- Tailwind CSS 4, Radix UI, React Query, React Hook Form, Zod, Wouter

### Backend / Services
- Node.js + Express (TypeScript)
- WebSockets (`ws`) for session updates
- Stripe (payments, subscription events)
- AWS SDK (S3, EventBridge, SQS, Rekognition etc.)

### Data Layer
- MySQL / Aurora MySQL (Drizzle ORM)
- Drizzle Kit migrations

### Infrastructure / Cloud
- AWS CDK (TypeScript) IaC
- CloudFront (frontend + backend distributions)
- S3 (static site bucket, uploads)
- API Gateway + Lambda
- EventBridge (custom bus)
- SQS (Try-On FIFO queue, Billing FIFO queue + DLQs)
- WAF (optional) + Route53 DNS

## 🛠️ Infrastructure (IaC)

`iac/` contains modular creators for each resource (CloudFront, SQS, EventBridge, Lambda, VPC, Storage). The main stack (`garmaxAiStack.ts`) wires:
- Frontend static bucket + CloudFront distribution (SPA fallback, security headers)
- Backend CloudFront distribution (`backend.garmaxai.com`) → API Gateway → API Lambda
- EventBridge bus (`GarmaxAi-Tryon-<STAGE>`) + rules
- FIFO queues (Try-On, Billing) + processor Lambdas
- Outputs (bucket name, distribution IDs, bus name, queue URLs)

## 🚀 Installation
```bash
git clone https://github.com/SEAUinnovations/GarmaxAi.git
cd GarmaxAi
npm install
```

## 🔧 Environment Variables
Create `.env` in project root:
```env
DATABASE_URL=mysql://root:password@localhost:3306/garmaxai
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
AWS_REGION=us-east-1
EVENTBRIDGE_BUS_NAME=GarmaxAi-Tryon-DEV
S3_BUCKET_NAME=garmax-tryon-uploads
NODE_ENV=development
PORT=3000
```

## 🧪 Running Locally
```bash
# Start backend (Express + Vite middleware proxy)
npm run dev

# (Optional) Separate frontend dev server
npm run dev:client
```
Local endpoints:
- Frontend: http://localhost:3000
- API: http://localhost:3000/api
- Webhook: http://localhost:3000/api/webhooks/stripe

### Stripe Local Forwarding
```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
stripe trigger checkout.session.completed
```

## 🌐 Deployment

### Infrastructure
```bash
cd iac
npm ci
npx cdk synth
npx cdk deploy GarmaxAiStack --require-approval never
```

Retrieve key outputs:
```bash
aws cloudformation list-exports --query "Exports[?starts_with(Name,'FrontendBucketName') || starts_with(Name,'FrontendDistributionId') || starts_with(Name,'BillingQueueUrl') || starts_with(Name,'EventBridgeBusName')].{Name:Name,Value:Value}" --output table
```

### Frontend Upload
```bash
npm --prefix client ci
npm --prefix client run build
aws s3 sync client/dist s3://<FrontendBucketName-STAGE>/ --delete
aws cloudfront create-invalidation --distribution-id <FrontendDistributionId-STAGE> --paths "/*"
```

## 💳 Stripe Billing Workflow
1. Stripe → `POST /api/webhooks/stripe` (backend distribution). 
2. Signature verified using raw body + `STRIPE_WEBHOOK_SECRET` (tolerance 300s).
3. Verified event published to EventBridge (`source: stripe`, `detailType: event.type`).
4. EventBridge rule routes selected events to Billing FIFO SQS.
5. `BillingProcessor` Lambda consumes messages, performs subscription/credit logic (idempotency recommended via event.id storage).
6. Failures retried; after threshold enter DLQ for analysis.

## 🔁 Try-On & Rendering Flow
1. Client initiates a session (future: emits event to bus).
2. EventBridge rule sends `tryon.session.create` → Try-On FIFO queue.
3. Try-On processor Lambda orchestrates AI rendering, may emit progress events.
4. WebSocket notifies client of status changes.

## 🛡️ Security & Isolation
- Separate CloudFront distributions (frontend vs backend) with WAF support.
- Private static bucket (Origin Access Identity) + SSL required.
- Webhook verification before any downstream processing.
- Dedicated Billing queue isolates payment load from rendering pipeline.
- IAM scoped: API Lambda only `events:PutEvents` on the custom bus.
- DLQs for both Try-On and Billing for resilience.

## 📂 Project Structure
```
GarmaxAi/
├── client/                 # React SPA (Vite)
├── src/                    # Express backend (TypeScript)
│   ├── controllers/        # Route handlers
│   ├── routers/            # Express routers (incl. paymentsRouter)
│   ├── services/           # Domain services (credits, subscription, etc.)
│   ├── websocket/          # WebSocket server logic
│   └── utils/              # Logging, response formatting
├── shared/                 # Shared schema/types
├── iac/                    # AWS CDK infrastructure code
│   ├── lib/                # Resource factories
│   └── lambda-handlers/    # Deployed Lambda handler code
├── attached_assets/        # Generated images / media
├── parameters/             # Environment/stage config files
├── package.json
├── tsconfig.json
└── README.md
```

## 📝 Scripts
| Script | Description |
|--------|-------------|
| `npm run dev` | Start backend (port 3000) with Vite integration |
| `npm run dev:client` | Start standalone Vite dev server (port 5000) |
| `npm run build` | Build frontend + bundle backend |
| `npm start` | Run production backend |
| `npm run check` | TypeScript type check |
| `npm run db:push` | Apply Drizzle schema changes |

## 🔧 Migration from Previous Name
The project was formerly called “ModelMe” / “ModelMeAI”. All internal references updated to **Garmex**. Update any external systems (DNS, webhook endpoints, monitoring dashboards) to use new domains and naming conventions.

## 🤝 Contributing
Pull requests welcome. Please ensure changes are scoped, tested (where applicable), and align with established patterns in `iac/` and `src/`.

## 📄 License
MIT License.


 