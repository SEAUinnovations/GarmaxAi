# GarmaxAI Enterprise API - Implementation Guide

## Overview

The GarmaxAI Enterprise API enables e-commerce companies to integrate virtual try-on capabilities directly into their checkout workflows. Customers can visualize products from their shopping cart on their own photos before completing purchases.

### Key Features

- **Checkout Integration**: Seamless API for visualizing cart items on customer photos
- **Organization Management**: Multi-user enterprise accounts with role-based access control
- **API Key Authentication**: Secure programmatic access with scoped permissions
- **Webhook Notifications**: Real-time updates when try-on sessions complete
- **Auto-Refund System**: Automatic credit refunds for failed renders
- **Rate Limiting**: Configurable request limits per organization/API key
- **Usage Tracking**: Detailed analytics and billing reports

---

## Architecture

### Database Schema

#### Organizations
```sql
- Multi-user enterprise accounts
- Shared credit pool across team members
- Configurable API rate limits
- Subscription tier management
```

#### API Keys
```sql
- Secure key generation (gxai_live_xxx / gxai_test_xxx)
- BCrypt hashed storage
- Scoped permissions (tryon:create, photos:upload, etc.)
- Per-key rate limiting
- Usage tracking and analytics
```

#### External Customers
```sql
- Stores end-customer data from partner platforms
- Links to organization (e.g., Shopify store)
- External reference IDs for your customer records
- Photo storage for try-on sessions
```

#### Cart Try-On Sessions
```sql
- Represents a single checkout try-on request
- Contains cart items with product details
- Customer photo and render configuration
- Processing status and results
- Webhook delivery tracking
```

---

## Getting Started

### 1. Create an Organization

**Endpoint**: `POST /api/organizations`

```bash
curl -X POST https://api.garmaxai.com/api/organizations \
  -H "Authorization: Bearer YOUR_COGNITO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My E-commerce Store",
    "slug": "my-store",
    "billingEmail": "billing@mystore.com",
    "companyWebsite": "https://mystore.com"
  }'
```

**Response**:
```json
{
  "id": "org_abc123",
  "name": "My E-commerce Store",
  "slug": "my-store",
  "subscriptionTier": "free",
  "credits": 0,
  "apiRateLimit": 60,
  "status": "active",
  "createdAt": "2025-12-11T10:00:00Z"
}
```

### 2. Generate API Key

**Endpoint**: `POST /api/organizations/:orgId/api-keys`

```bash
curl -X POST https://api.garmaxai.com/api/organizations/org_abc123/api-keys \
  -H "Authorization: Bearer YOUR_COGNITO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Checkout Integration",
    "description": "API key for production checkout try-on",
    "scopes": [
      "tryon:create",
      "tryon:read",
      "customers:create",
      "photos:upload"
    ],
    "environment": "live",
    "rateLimit": 100
  }'
```

**Response**:
```json
{
  "id": "key_xyz789",
  "name": "Production Checkout Integration",
  "key": "gxai_live_sk_1234567890abcdef1234567890abcdef",
  "keyPrefix": "gxai_liv",
  "scopes": ["tryon:create", "tryon:read", "customers:create", "photos:upload"],
  "environment": "live",
  "status": "active",
  "createdAt": "2025-12-11T10:05:00Z"
}
```

⚠️ **IMPORTANT**: Save the `key` value securely. It will only be shown once!

### 3. Configure Webhook (Optional)

**Endpoint**: `POST /api/organizations/:orgId/webhooks`

```bash
curl -X POST https://api.garmaxai.com/api/organizations/org_abc123/webhooks \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://mystore.com/webhooks/garmaxai",
    "events": ["tryon.completed", "tryon.failed", "credits.low"]
  }'
```

**Response**:
```json
{
  "id": "webhook_def456",
  "url": "https://mystore.com/webhooks/garmaxai",
  "secret": "whsec_abcdef1234567890",
  "events": ["tryon.completed", "tryon.failed", "credits.low"],
  "status": "active"
}
```

---

## Checkout Integration Workflow

### Complete Integration Example

Here's how to integrate GarmaxAI into your checkout page:

#### Step 1: Upload Customer Photo

When customer clicks "Try On" button on your checkout page:

```javascript
// Frontend: Upload customer photo
const uploadPhoto = async (photoFile) => {
  const formData = new FormData();
  formData.append('photo', photoFile);
  
  const response = await fetch('https://api.garmaxai.com/api/v1/photos/upload', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer gxai_live_sk_1234567890abcdef...',
    },
    body: formData
  });
  
  const { photoUrl, photoS3Key } = await response.json();
  return { photoUrl, photoS3Key };
};
```

#### Step 2: Create or Update External Customer

```javascript
const createOrUpdateCustomer = async (customerId, customerData) => {
  const response = await fetch('https://api.garmaxai.com/api/v1/customers', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer gxai_live_sk_1234567890abcdef...',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      externalCustomerId: customerId, // Your customer ID
      email: customerData.email,
      firstName: customerData.firstName,
      lastName: customerData.lastName,
      metadata: {
        source: 'checkout',
        platform: 'shopify'
      }
    })
  });
  
  return await response.json();
};
```

#### Step 3: Create Cart Try-On Session

```javascript
const createCartTryon = async (cartData, customerPhoto) => {
  const response = await fetch('https://api.garmaxai.com/api/v1/cart/tryon', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer gxai_live_sk_1234567890abcdef...',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      externalCustomerId: 'customer_12345', // Your customer ID
      cartId: 'cart_abc789', // Your cart/session ID
      cartItems: [
        {
          productId: 'prod_001',
          variantId: 'var_001_m',
          name: 'Classic Blue Denim Jacket',
          imageUrl: 'https://mystore.com/products/jacket.jpg',
          category: 'jacket',
          quantity: 1,
          price: 89.99,
          currency: 'USD'
        },
        {
          productId: 'prod_002',
          variantId: 'var_002_32',
          name: 'Slim Fit Black Jeans',
          imageUrl: 'https://mystore.com/products/jeans.jpg',
          category: 'pants',
          quantity: 1,
          price: 59.99,
          currency: 'USD'
        }
      ],
      customerPhoto: customerPhoto.photoUrl,
      renderQuality: 'hd', // or 'sd' for faster preview, '4k' for premium
      backgroundScene: 'studio', // or 'urban', 'outdoor'
      webhookUrl: 'https://mystore.com/webhooks/tryon-complete' // Optional
    })
  });
  
  return await response.json();
};
```

**Response**:
```json
{
  "id": "cart_tryon_xyz123",
  "status": "queued",
  "progress": 0,
  "estimatedTimeSeconds": 45,
  "websocketUrl": "wss://api.garmaxai.com/ws/tryon?session=cart_tryon_xyz123",
  "cartItems": [...],
  "creditsEstimate": 15
}
```

#### Step 4: Monitor Progress (WebSocket or Polling)

**Option A: WebSocket (Real-time)**

```javascript
const monitorTryonProgress = (sessionId) => {
  const ws = new WebSocket(`wss://api.garmaxai.com/ws/tryon?session=${sessionId}`);
  
  ws.onopen = () => {
    ws.send(JSON.stringify({
      action: 'subscribe',
      sessionId: sessionId
    }));
  };
  
  ws.onmessage = (event) => {
    const update = JSON.parse(event.data);
    
    switch(update.status) {
      case 'processing':
        updateProgressBar(update.progress);
        break;
      case 'completed':
        displayTryonImage(update.renderedImageUrl);
        ws.close();
        break;
      case 'failed':
        showError(update.message);
        ws.close();
        break;
    }
  };
};
```

**Option B: Polling**

```javascript
const pollTryonStatus = async (sessionId) => {
  const response = await fetch(
    `https://api.garmaxai.com/api/v1/cart/tryon/${sessionId}`,
    {
      headers: {
        'Authorization': 'Bearer gxai_live_sk_1234567890abcdef...'
      }
    }
  );
  
  const session = await response.json();
  
  if (session.status === 'completed') {
    displayTryonImage(session.renderedImageUrl);
    return true;
  } else if (session.status === 'failed') {
    showError('Try-on failed. Credits have been refunded.');
    return true;
  }
  
  return false; // Continue polling
};

// Poll every 3 seconds
const pollInterval = setInterval(async () => {
  const complete = await pollTryonStatus('cart_tryon_xyz123');
  if (complete) clearInterval(pollInterval);
}, 3000);
```

#### Step 5: Handle Webhook Notification (Backend)

```javascript
// Express.js example
app.post('/webhooks/garmaxai', express.raw({type: 'application/json'}), (req, res) => {
  const signature = req.headers['x-garmaxai-signature'];
  const payload = req.body.toString();
  
  // Verify webhook signature
  const expectedSignature = crypto
    .createHmac('sha256', process.env.GARMAXAI_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  
  if (signature !== expectedSignature) {
    return res.status(401).send('Invalid signature');
  }
  
  const event = JSON.parse(payload);
  
  switch(event.type) {
    case 'tryon.completed':
      // Update your database
      await updateTryonResult(event.data.sessionId, {
        status: 'completed',
        imageUrl: event.data.renderedImageUrl,
        creditsUsed: event.data.creditsUsed
      });
      
      // Notify customer via email/SMS
      await notifyCustomer(event.data.externalCustomerId);
      break;
      
    case 'tryon.failed':
      // Log error and notify customer
      await logTryonFailure(event.data.sessionId, event.data.error);
      break;
      
    case 'credits.low':
      // Alert your team to add credits
      await alertBillingTeam(event.data.creditsRemaining);
      break;
  }
  
  res.status(200).send('OK');
});
```

---

## API Reference

### Authentication

All API requests must include an API key in the Authorization header:

```
Authorization: Bearer gxai_live_sk_1234567890abcdef...
```

### Rate Limiting

Rate limits are enforced per API key:
- Default: 60 requests per minute
- Can be customized per key
- Response headers indicate current status:
  - `X-RateLimit-Limit`: Total requests allowed
  - `X-RateLimit-Remaining`: Requests remaining
  - `X-RateLimit-Reset`: Timestamp when limit resets

### Core Endpoints

#### 1. Create Cart Try-On Session

**POST** `/api/v1/cart/tryon`

Creates a new try-on session for checkout integration.

**Request Body**:
```json
{
  "externalCustomerId": "string (required)",
  "cartId": "string (required)",
  "cartItems": [
    {
      "productId": "string",
      "variantId": "string",
      "name": "string",
      "imageUrl": "string (URL)",
      "category": "shirt|pants|dress|jacket|shoes|hat|accessory",
      "quantity": "number",
      "price": "number",
      "currency": "string (3 chars)"
    }
  ],
  "customerPhoto": "string (URL from photo upload)",
  "renderQuality": "sd|hd|4k (default: hd)",
  "backgroundScene": "studio|urban|outdoor|custom (default: studio)",
  "webhookUrl": "string (optional)"
}
```

**Response** (201 Created):
```json
{
  "id": "cart_tryon_xyz123",
  "status": "queued",
  "progress": 0,
  "estimatedTimeSeconds": 45,
  "websocketUrl": "wss://...",
  "creditsEstimate": 15
}
```

**Credits**: 10 (SD), 15 (HD), 25 (4K)

#### 2. Get Cart Try-On Session

**GET** `/api/v1/cart/tryon/:sessionId`

Retrieves the current status and results of a try-on session.

**Response** (200 OK):
```json
{
  "id": "cart_tryon_xyz123",
  "status": "completed",
  "progress": 100,
  "cartItems": [...],
  "customerPhotoUrl": "https://...",
  "renderedImageUrl": "https://...",
  "creditsUsed": 15,
  "createdAt": "2025-12-11T10:00:00Z",
  "completedAt": "2025-12-11T10:00:45Z"
}
```

**Status Values**:
- `queued`: Waiting to be processed
- `processing`: Currently generating try-on image
- `completed`: Successfully completed
- `failed`: Processing failed (credits auto-refunded)

#### 3. Upload Customer Photo

**POST** `/api/v1/photos/upload`

Uploads a customer photo for use in try-on sessions.

**Request**: `multipart/form-data`
- `photo`: Image file (JPEG, PNG, WebP)
- `externalCustomerId`: (optional) Link to customer

**Response** (201 Created):
```json
{
  "photoUrl": "https://...",
  "photoS3Key": "uploads/...",
  "thumbnailUrl": "https://..."
}
```

#### 4. Create/Update External Customer

**POST** `/api/v1/customers`

Creates or updates a customer record.

**Request Body**:
```json
{
  "externalCustomerId": "string (required)",
  "email": "string (optional)",
  "firstName": "string (optional)",
  "lastName": "string (optional)",
  "metadata": "object (optional)"
}
```

**Response** (200 OK):
```json
{
  "id": "ext_cust_abc123",
  "externalCustomerId": "customer_12345",
  "email": "customer@example.com",
  "photoUrls": [],
  "createdAt": "2025-12-11T10:00:00Z"
}
```

#### 5. List Cart Try-On Sessions

**GET** `/api/v1/cart/tryon`

**Query Parameters**:
- `limit`: Number of results (default: 20, max: 100)
- `offset`: Pagination offset
- `status`: Filter by status
- `cartId`: Filter by cart ID
- `externalCustomerId`: Filter by customer

**Response** (200 OK):
```json
{
  "data": [...],
  "pagination": {
    "total": 150,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

### Organization Management Endpoints

#### 1. Create Organization

**POST** `/api/organizations`

**Auth**: Cognito JWT (user account required)

#### 2. Add Credits

**POST** `/api/organizations/:orgId/credits`

**Request Body**:
```json
{
  "amount": 1000,
  "paymentMethod": "stripe_pm_xyz"
}
```

#### 3. Get Usage Report

**GET** `/api/organizations/:orgId/usage`

**Query Parameters**:
- `startDate`: ISO 8601 date
- `endDate`: ISO 8601 date
- `groupBy`: `day|week|month`

**Response**:
```json
{
  "period": {
    "start": "2025-12-01T00:00:00Z",
    "end": "2025-12-11T23:59:59Z"
  },
  "summary": {
    "totalRequests": 1250,
    "totalCreditsUsed": 15000,
    "avgResponseTimeMs": 3500,
    "successRate": 0.98
  },
  "breakdown": [
    {
      "date": "2025-12-01",
      "requests": 120,
      "creditsUsed": 1500,
      "successRate": 0.99
    },
    ...
  ]
}
```

---

## Webhook Events

### Event Types

#### `tryon.completed`

Triggered when a try-on session successfully completes.

```json
{
  "type": "tryon.completed",
  "timestamp": "2025-12-11T10:00:45Z",
  "data": {
    "sessionId": "cart_tryon_xyz123",
    "externalCustomerId": "customer_12345",
    "cartId": "cart_abc789",
    "renderedImageUrl": "https://...",
    "creditsUsed": 15,
    "processingTimeSeconds": 42
  }
}
```

#### `tryon.failed`

Triggered when a try-on session fails. Credits are automatically refunded.

```json
{
  "type": "tryon.failed",
  "timestamp": "2025-12-11T10:00:30Z",
  "data": {
    "sessionId": "cart_tryon_xyz123",
    "externalCustomerId": "customer_12345",
    "error": "SMPL processing failed",
    "creditsRefunded": 15
  }
}
```

#### `credits.low`

Triggered when organization credits fall below threshold (10% of monthly average).

```json
{
  "type": "credits.low",
  "timestamp": "2025-12-11T10:00:00Z",
  "data": {
    "organizationId": "org_abc123",
    "creditsRemaining": 50,
    "threshold": 100
  }
}
```

### Webhook Signature Verification

All webhooks include an `X-GarmaxAI-Signature` header with HMAC-SHA256 signature:

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

---

## Pricing & Credits

### Credit Costs

| Operation | Credits | USD Estimate |
|-----------|---------|--------------|
| SD Try-On | 10 | $0.01-0.02 |
| HD Try-On | 15 | $0.02-0.05 |
| 4K Try-On | 25 | $0.05-0.08 |
| Photo Upload | 0 | Free |
| API Calls | 0 | Free |

### Subscription Tiers

| Tier | Monthly Price | Included Credits | Rate Limit |
|------|---------------|------------------|------------|
| **Free** | $0 | 0 | 60 req/min |
| **Starter** | $49/mo | 1,000 | 120 req/min |
| **Professional** | $199/mo | 5,000 | 300 req/min |
| **Enterprise** | Custom | Custom | Custom |

### Auto-Refund Policy

Credits are automatically refunded in these scenarios:
- **100% refund**: SMPL processing fails
- **100% refund**: AI rendering fails
- **50% refund**: Customer rejects preview (if preview feature used)
- **0% refund**: Successful completion (even if customer doesn't like result)

---

## Error Handling

### Error Response Format

```json
{
  "error": {
    "code": "INSUFFICIENT_CREDITS",
    "message": "Organization has insufficient credits to process this request",
    "details": {
      "required": 15,
      "available": 5
    }
  }
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `INVALID_API_KEY` | 401 | API key is invalid or revoked |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INSUFFICIENT_CREDITS` | 402 | Not enough credits |
| `INVALID_PHOTO` | 400 | Photo format/quality issues |
| `PROCESSING_FAILED` | 500 | Server-side processing error |
| `SESSION_NOT_FOUND` | 404 | Session ID doesn't exist |

### Retry Logic

For transient errors (500, 502, 503, 504), implement exponential backoff:

```javascript
async function retryRequest(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1 || error.status < 500) {
        throw error;
      }
      await new Promise(resolve => 
        setTimeout(resolve, Math.pow(2, i) * 1000)
      );
    }
  }
}
```

---

## Best Practices

### 1. Photo Guidelines

Provide customers with clear instructions:
- **Full body shot** preferred
- **Good lighting** (natural or bright indoor)
- **Neutral background** (solid color works best)
- **Straight-on pose** (facing camera)
- **Minimal clothing** for best garment visualization
- **Supported formats**: JPEG, PNG, WebP
- **Size limits**: 5-20MB, min 512x512px

### 2. Performance Optimization

- Use **SD quality** for instant previews, offer HD upgrade
- Cache rendered images on your CDN
- Implement **image lazy loading** for result galleries
- Use **WebSocket** for real-time updates (better UX than polling)

### 3. User Experience

- Show **progress indicators** during processing (30-60 seconds typical)
- Display **estimated wait time** based on quality
- Allow customers to **continue shopping** while processing
- Send **email notification** when try-on completes
- Store results for **30 days** for customer review

### 4. Security

- **Never expose API keys** in frontend code
- Use **server-side proxy** for API calls
- Implement **webhook signature verification**
- Validate all customer inputs
- Rate-limit your own endpoints

### 5. Error Recovery

- Display friendly error messages
- Offer to **retry failed try-ons**
- Provide **fallback** to viewing product on model
- Log errors for debugging

---

## SDK Examples

### Node.js SDK

```javascript
const GarmaxAI = require('@garmaxai/sdk');

const client = new GarmaxAI({
  apiKey: process.env.GARMAXAI_API_KEY,
  environment: 'production'
});

// Create try-on session
const session = await client.cart.createTryon({
  externalCustomerId: 'cust_123',
  cartId: 'cart_456',
  cartItems: [...],
  customerPhoto: photoUrl,
  renderQuality: 'hd'
});

// Monitor progress
session.on('progress', (update) => {
  console.log(`Progress: ${update.progress}%`);
});

session.on('completed', (result) => {
  console.log('Rendered image:', result.imageUrl);
});

session.on('failed', (error) => {
  console.error('Try-on failed:', error);
});
```

### Python SDK

```python
from garmaxai import Client

client = Client(api_key=os.environ['GARMAXAI_API_KEY'])

# Create try-on session
session = client.cart.create_tryon(
    external_customer_id='cust_123',
    cart_id='cart_456',
    cart_items=[...],
    customer_photo=photo_url,
    render_quality='hd'
)

# Wait for completion
result = session.wait_for_completion(timeout=120)
print(f"Rendered image: {result.image_url}")
```

### cURL Example

```bash
#!/bin/bash

API_KEY="gxai_live_sk_1234567890abcdef..."

# Upload photo
PHOTO_RESPONSE=$(curl -X POST \
  https://api.garmaxai.com/api/v1/photos/upload \
  -H "Authorization: Bearer $API_KEY" \
  -F "photo=@customer_photo.jpg")

PHOTO_URL=$(echo $PHOTO_RESPONSE | jq -r '.photoUrl')

# Create try-on
SESSION_RESPONSE=$(curl -X POST \
  https://api.garmaxai.com/api/v1/cart/tryon \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"externalCustomerId\": \"cust_123\",
    \"cartId\": \"cart_456\",
    \"cartItems\": [
      {
        \"productId\": \"prod_001\",
        \"variantId\": \"var_001_m\",
        \"name\": \"Blue Jacket\",
        \"imageUrl\": \"https://mystore.com/jacket.jpg\",
        \"category\": \"jacket\",
        \"quantity\": 1,
        \"price\": 89.99,
        \"currency\": \"USD\"
      }
    ],
    \"customerPhoto\": \"$PHOTO_URL\",
    \"renderQuality\": \"hd\"
  }")

SESSION_ID=$(echo $SESSION_RESPONSE | jq -r '.id')

# Poll for result
while true; do
  STATUS_RESPONSE=$(curl -X GET \
    https://api.garmaxai.com/api/v1/cart/tryon/$SESSION_ID \
    -H "Authorization: Bearer $API_KEY")
  
  STATUS=$(echo $STATUS_RESPONSE | jq -r '.status')
  
  if [ "$STATUS" = "completed" ]; then
    IMAGE_URL=$(echo $STATUS_RESPONSE | jq -r '.renderedImageUrl')
    echo "Try-on completed: $IMAGE_URL"
    break
  elif [ "$STATUS" = "failed" ]; then
    echo "Try-on failed"
    break
  fi
  
  sleep 3
done
```

---

## Testing

### Test Mode

Use test API keys for development:

```
gxai_test_sk_1234567890abcdef...
```

Test mode features:
- No credits charged
- Faster processing (mock results)
- Webhooks sent to RequestBin/webhook.site
- Sandbox environment

### Sample Test Data

```javascript
// Test customer
{
  externalCustomerId: "test_customer_001",
  email: "test@example.com",
  firstName: "Test",
  lastName: "Customer"
}

// Test cart items
[
  {
    productId: "test_prod_001",
    variantId: "test_var_001_m",
    name: "Test Product",
    imageUrl: "https://via.placeholder.com/800x1000",
    category: "shirt",
    quantity: 1,
    price: 49.99,
    currency: "USD"
  }
]
```

---

## Support & Resources

### Documentation
- API Reference: https://docs.garmaxai.com/api
- Integration Guides: https://docs.garmaxai.com/guides
- SDKs: https://github.com/garmaxai

### Support Channels
- Email: enterprise@garmaxai.com
- Slack Community: https://garmaxai.slack.com
- Discord: https://discord.gg/garmaxai
- Status Page: https://status.garmaxai.com

### Rate Limits & Quotas
- Dashboard: https://dashboard.garmaxai.com
- Usage Analytics: Real-time usage tracking
- Billing: Automated invoicing and reports

---

## Changelog

### v1.0.0 (2025-12-11)
- Initial release
- Cart try-on integration
- Organization management
- API key authentication
- Webhook notifications
- Auto-refund system
- Rate limiting
- Usage tracking

---

## License

This API is provided under the GarmaxAI Enterprise License Agreement.
Contact sales@garmaxai.com for licensing information.
