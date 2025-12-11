# Enterprise API Documentation

## Overview

The GarmaxAI Enterprise API provides programmatic access to virtual try-on capabilities for e-commerce platforms. This API enables bulk processing, custom integrations, and white-label solutions.

## Base URL

```
Production: https://api.garmaxai.com/api
Development: http://localhost:3000/api
```

## Authentication

All Enterprise API requests require an API key in the `X-API-Key` header:

```bash
curl -H "X-API-Key: gx_live_abc123..." https://api.garmaxai.com/api/v1/...
```

### Getting Started

1. Create an organization (requires user authentication)
2. Generate an API key with appropriate scopes
3. Use the API key for all subsequent requests

## Rate Limiting

- Default: 60 requests per minute per API key
- Custom limits available for specific endpoints
- Rate limit info in response headers:
  - `X-RateLimit-Limit`: Maximum requests per window
  - `X-RateLimit-Remaining`: Requests remaining
  - `X-RateLimit-Reset`: Unix timestamp when limit resets

## Credit System

Enterprise API operations consume credits:

| Operation | Base Credits | Quality Multiplier |
|-----------|-------------|-------------------|
| Single Try-On | 1 | SD: 1x, HD: 2x, 4K: 4x |
| Cart Try-On (per item) | 1 | Same as above |
| Volume Discount | 5+ items: 10% off, 10+ items: 20% off |

### Volume Discounts for Cart Try-Ons

- 5-9 items: 10% discount
- 10-14 items: 20% discount
- 15-19 items: 30% discount
- 20 items: 40% discount (maximum 20 items per cart)

## API Scopes

API keys can be restricted to specific operations:

- `tryon:create` - Create try-on sessions
- `tryon:read` - View try-on sessions and results
- `photos:upload` - Upload customer photos
- `photos:read` - View customer photos
- `customers:create` - Create/update external customers
- `customers:read` - View external customers
- `webhooks:manage` - Configure webhooks
- `all` - Full access to all operations

## Core Resources

### Organizations

Organizations represent your company account. Each organization has:
- Credit balance for API operations
- Multiple team members with permissions
- API keys for programmatic access
- Webhook configurations

### API Keys

Programmatic authentication credentials with:
- Scoped permissions
- Optional rate limits
- Expiration dates
- Usage tracking

### External Customers

Represent your end-users in the GarmaxAI system:
- Identified by your external ID
- Store customer photos for try-ons
- Metadata for tracking

### Cart Try-On Sessions

Batch process multiple garments for a single customer:
- Up to 20 items per cart
- Atomic credit deduction
- Sequential processing
- Webhook notifications on completion

### Webhooks

Receive real-time notifications for:
- `tryon.completed` - Try-on rendering finished
- `tryon.failed` - Try-on processing failed
- `cart_tryon.completed` - Cart try-on finished
- `cart_tryon.partial` - Some items succeeded, some failed
- `cart_tryon.failed` - All items failed

---

## API Endpoints

### Organizations

#### Create Organization
```http
POST /organizations
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "name": "Acme Fashion",
  "domain": "acmefashion.com",
  "billingEmail": "billing@acmefashion.com",
  "settings": {
    "webhookRetries": 3,
    "defaultRenderQuality": "hd"
  }
}
```

**Response:**
```json
{
  "id": "org_abc123",
  "name": "Acme Fashion",
  "credits": 100,
  "status": "active",
  "createdAt": "2025-12-11T10:00:00Z"
}
```

#### Get Organization
```http
GET /organizations/{organizationId}
Authorization: Bearer {jwt_token}
```

#### Update Organization
```http
PATCH /organizations/{organizationId}
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "settings": {
    "defaultRenderQuality": "4k"
  }
}
```

#### Add Credits
```http
POST /organizations/{organizationId}/credits
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "amount": 1000,
  "description": "Monthly credit purchase"
}
```

---

### API Keys

#### Create API Key
```http
POST /organizations/{organizationId}/api-keys
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "name": "Production API Key",
  "scopes": ["tryon:create", "tryon:read", "photos:upload"],
  "rateLimit": 120,
  "expiresAt": "2026-12-11T00:00:00Z"
}
```

**Response:**
```json
{
  "id": "key_xyz789",
  "name": "Production API Key",
  "key": "gx_live_abc123def456...",
  "keyPrefix": "gx_live_abc123",
  "scopes": ["tryon:create", "tryon:read", "photos:upload"],
  "rateLimit": 120,
  "expiresAt": "2026-12-11T00:00:00Z",
  "createdAt": "2025-12-11T10:00:00Z"
}
```

⚠️ **Important:** The full API key is only shown once. Store it securely.

#### List API Keys
```http
GET /organizations/{organizationId}/api-keys
Authorization: Bearer {jwt_token}
```

#### Revoke API Key
```http
DELETE /organizations/{organizationId}/api-keys/{keyId}
Authorization: Bearer {jwt_token}
```

---

### External Customers

#### Upsert Customer
```http
POST /v1/customers
X-API-Key: gx_live_abc123...
Content-Type: application/json

{
  "externalId": "customer_12345",
  "email": "john@example.com",
  "name": "John Doe",
  "metadata": {
    "segment": "premium",
    "referralSource": "google"
  }
}
```

**Response:**
```json
{
  "id": "cust_internal_abc",
  "externalId": "customer_12345",
  "email": "john@example.com",
  "name": "John Doe",
  "photoUrl": null,
  "createdAt": "2025-12-11T10:00:00Z"
}
```

#### Get Customer
```http
GET /v1/customers/{externalId}
X-API-Key: gx_live_abc123...
```

#### List Customers
```http
GET /v1/customers?limit=50&offset=0
X-API-Key: gx_live_abc123...
```

#### Delete Customer
```http
DELETE /v1/customers/{externalId}
X-API-Key: gx_live_abc123...
```

---

### Customer Photos

#### Upload Photo
```http
POST /v1/customers/{externalId}/photos
X-API-Key: gx_live_abc123...
Content-Type: multipart/form-data

photo: <binary data>
metadata: {"capturedAt": "2025-12-11T10:00:00Z"}
```

**Response:**
```json
{
  "photoUrl": "https://s3.amazonaws.com/bucket/enterprise/org-123/photos/...",
  "photoS3Key": "enterprise/org-123/photos/photo_abc.jpg",
  "uploadedAt": "2025-12-11T10:00:00Z"
}
```

#### Get Customer Photos
```http
GET /v1/customers/{externalId}/photos
X-API-Key: gx_live_abc123...
```

---

### Cart Try-On

#### Create Cart Try-On Session
```http
POST /v1/cart-tryons
X-API-Key: gx_live_abc123...
Content-Type: application/json

{
  "cartId": "cart_external_xyz",
  "customerPhotoS3Key": "enterprise/org-123/photos/photo_abc.jpg",
  "cartItems": [
    {
      "productId": "prod_001",
      "variantId": "var_blue_m",
      "name": "Blue Cotton T-Shirt",
      "imageUrl": "https://shop.com/products/tshirt.jpg",
      "category": "tops",
      "quantity": 2,
      "price": 29.99,
      "currency": "USD"
    },
    {
      "productId": "prod_002",
      "variantId": "var_black_32",
      "name": "Black Jeans",
      "imageUrl": "https://shop.com/products/jeans.jpg",
      "category": "bottoms",
      "quantity": 1,
      "price": 79.99,
      "currency": "USD"
    }
  ],
  "renderQuality": "hd",
  "backgroundScene": "studio",
  "metadata": {
    "orderId": "order_789",
    "sessionId": "web_session_456"
  }
}
```

**Response:**
```json
{
  "id": "cart_session_abc",
  "cartId": "cart_external_xyz",
  "status": "queued",
  "progress": 0,
  "creditsRequired": 4,
  "creditsCharged": 4,
  "itemCount": 2,
  "estimatedCompletionTime": "2025-12-11T10:05:00Z",
  "createdAt": "2025-12-11T10:00:00Z"
}
```

**Credit Calculation:**
- Base: 2 items × 1 credit = 2 credits
- Quality multiplier (HD): 2 credits × 2 = 4 credits
- Volume discount: None (< 5 items)
- **Total: 4 credits**

#### Get Cart Try-On Session
```http
GET /v1/cart-tryons/{sessionId}
X-API-Key: gx_live_abc123...
```

**Response:**
```json
{
  "id": "cart_session_abc",
  "status": "completed",
  "progress": 100,
  "cartItems": [
    {
      "productId": "prod_001",
      "name": "Blue Cotton T-Shirt",
      "status": "completed",
      "resultUrl": "https://s3.amazonaws.com/bucket/results/result_001.jpg"
    },
    {
      "productId": "prod_002",
      "name": "Black Jeans",
      "status": "completed",
      "resultUrl": "https://s3.amazonaws.com/bucket/results/result_002.jpg"
    }
  ],
  "completedAt": "2025-12-11T10:04:32Z"
}
```

#### List Cart Try-On Sessions
```http
GET /v1/cart-tryons?cartId=cart_external_xyz&status=completed&limit=20
X-API-Key: gx_live_abc123...
```

#### Cancel Cart Try-On Session
```http
POST /v1/cart-tryons/{sessionId}/cancel
X-API-Key: gx_live_abc123...
```

**Note:** Cancellation refunds credits if processing hasn't started.

---

### Webhooks

#### Create Webhook
```http
POST /v1/webhooks
X-API-Key: gx_live_abc123...
Content-Type: application/json

{
  "url": "https://shop.com/webhooks/garmaxai",
  "events": ["cart_tryon.completed", "cart_tryon.failed"],
  "description": "Production webhook"
}
```

**Response:**
```json
{
  "id": "webhook_abc",
  "url": "https://shop.com/webhooks/garmaxai",
  "events": ["cart_tryon.completed", "cart_tryon.failed"],
  "secret": "whsec_abc123def456...",
  "isActive": true,
  "createdAt": "2025-12-11T10:00:00Z"
}
```

⚠️ **Important:** Store the secret to verify webhook signatures.

#### List Webhooks
```http
GET /v1/webhooks
X-API-Key: gx_live_abc123...
```

#### Get Webhook
```http
GET /v1/webhooks/{webhookId}
X-API-Key: gx_live_abc123...
```

#### Update Webhook
```http
PATCH /v1/webhooks/{webhookId}
X-API-Key: gx_live_abc123...
Content-Type: application/json

{
  "events": ["cart_tryon.completed", "cart_tryon.partial", "cart_tryon.failed"],
  "isActive": true
}
```

#### Delete Webhook
```http
DELETE /v1/webhooks/{webhookId}
X-API-Key: gx_live_abc123...
```

#### Test Webhook
```http
POST /v1/webhooks/{webhookId}/test
X-API-Key: gx_live_abc123...
```

Sends a test event to verify connectivity and signature validation.

---

## Webhook Events

### Event Structure

```json
{
  "id": "evt_abc123",
  "event": "cart_tryon.completed",
  "timestamp": "2025-12-11T10:05:00Z",
  "data": {
    "sessionId": "cart_session_abc",
    "cartId": "cart_external_xyz",
    "organizationId": "org_abc123",
    "status": "completed",
    "itemCount": 2,
    "successCount": 2,
    "failureCount": 0,
    "results": [
      {
        "productId": "prod_001",
        "variantId": "var_blue_m",
        "status": "completed",
        "resultUrl": "https://s3.amazonaws.com/bucket/results/result_001.jpg"
      }
    ]
  }
}
```

### Signature Verification

Verify webhook authenticity using HMAC-SHA256:

```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Express middleware
app.post('/webhooks/garmaxai', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const isValid = verifyWebhookSignature(req.body, signature, webhookSecret);
  
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Process webhook
  handleWebhook(req.body);
  res.status(200).json({ received: true });
});
```

### Event Types

#### `cart_tryon.completed`
All items in the cart successfully processed.

#### `cart_tryon.partial`
Some items succeeded, some failed. Check individual item statuses.

#### `cart_tryon.failed`
All items failed. Check error details.

#### `tryon.completed`
Single try-on session completed (standard API).

#### `tryon.failed`
Single try-on session failed.

### Retry Policy

- Failed webhooks are retried with exponential backoff: 5s, 15s, 45s
- Maximum 10 consecutive failures before automatic deactivation
- HTTP 2xx responses are considered successful
- Timeout: 30 seconds per request

---

## Integration Examples

### Node.js / Express

```javascript
const axios = require('axios');

const API_KEY = 'gx_live_abc123...';
const BASE_URL = 'https://api.garmaxai.com/api';

// Create cart try-on session
async function createCartTryon(cartId, customerPhotoS3Key, cartItems) {
  try {
    const response = await axios.post(
      `${BASE_URL}/v1/cart-tryons`,
      {
        cartId,
        customerPhotoS3Key,
        cartItems,
        renderQuality: 'hd',
        backgroundScene: 'studio'
      },
      {
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Error creating cart try-on:', error.response?.data);
    throw error;
  }
}

// Poll for completion
async function waitForCompletion(sessionId, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await axios.get(
      `${BASE_URL}/v1/cart-tryons/${sessionId}`,
      { headers: { 'X-API-Key': API_KEY } }
    );
    
    const { status, progress } = response.data;
    console.log(`Status: ${status}, Progress: ${progress}%`);
    
    if (status === 'completed' || status === 'failed' || status === 'partial') {
      return response.data;
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  throw new Error('Timeout waiting for completion');
}

// Usage
const session = await createCartTryon(
  'cart_123',
  'enterprise/org-abc/photos/customer.jpg',
  [
    {
      productId: 'prod_001',
      variantId: 'var_blue_m',
      name: 'Blue T-Shirt',
      imageUrl: 'https://shop.com/tshirt.jpg',
      category: 'tops',
      quantity: 1,
      price: 29.99,
      currency: 'USD'
    }
  ]
);

const result = await waitForCompletion(session.id);
console.log('Try-on results:', result.cartItems);
```

### Python

```python
import requests
import time

API_KEY = 'gx_live_abc123...'
BASE_URL = 'https://api.garmaxai.com/api'

def create_cart_tryon(cart_id, customer_photo_s3_key, cart_items):
    response = requests.post(
        f'{BASE_URL}/v1/cart-tryons',
        json={
            'cartId': cart_id,
            'customerPhotoS3Key': customer_photo_s3_key,
            'cartItems': cart_items,
            'renderQuality': 'hd',
            'backgroundScene': 'studio'
        },
        headers={
            'X-API-Key': API_KEY,
            'Content-Type': 'application/json'
        }
    )
    response.raise_for_status()
    return response.json()

def wait_for_completion(session_id, max_attempts=30):
    for _ in range(max_attempts):
        response = requests.get(
            f'{BASE_URL}/v1/cart-tryons/{session_id}',
            headers={'X-API-Key': API_KEY}
        )
        response.raise_for_status()
        
        data = response.json()
        status = data['status']
        progress = data['progress']
        
        print(f'Status: {status}, Progress: {progress}%')
        
        if status in ['completed', 'failed', 'partial']:
            return data
        
        time.sleep(2)
    
    raise TimeoutError('Timeout waiting for completion')

# Usage
session = create_cart_tryon(
    'cart_123',
    'enterprise/org-abc/photos/customer.jpg',
    [
        {
            'productId': 'prod_001',
            'variantId': 'var_blue_m',
            'name': 'Blue T-Shirt',
            'imageUrl': 'https://shop.com/tshirt.jpg',
            'category': 'tops',
            'quantity': 1,
            'price': 29.99,
            'currency': 'USD'
        }
    ]
)

result = wait_for_completion(session['id'])
for item in result['cartItems']:
    print(f'{item["name"]}: {item["resultUrl"]}')
```

### PHP

```php
<?php

class GarmaxAIClient {
    private $apiKey;
    private $baseUrl;
    
    public function __construct($apiKey, $baseUrl = 'https://api.garmaxai.com/api') {
        $this->apiKey = $apiKey;
        $this->baseUrl = $baseUrl;
    }
    
    public function createCartTryon($cartId, $customerPhotoS3Key, $cartItems) {
        $ch = curl_init($this->baseUrl . '/v1/cart-tryons');
        
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'X-API-Key: ' . $this->apiKey,
                'Content-Type: application/json'
            ],
            CURLOPT_POSTFIELDS => json_encode([
                'cartId' => $cartId,
                'customerPhotoS3Key' => $customerPhotoS3Key,
                'cartItems' => $cartItems,
                'renderQuality' => 'hd',
                'backgroundScene' => 'studio'
            ])
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode !== 200) {
            throw new Exception('API request failed: ' . $response);
        }
        
        return json_decode($response, true);
    }
    
    public function getCartTryon($sessionId) {
        $ch = curl_init($this->baseUrl . '/v1/cart-tryons/' . $sessionId);
        
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'X-API-Key: ' . $this->apiKey
            ]
        ]);
        
        $response = curl_exec($ch);
        curl_close($ch);
        
        return json_decode($response, true);
    }
}

// Usage
$client = new GarmaxAIClient('gx_live_abc123...');

$session = $client->createCartTryon(
    'cart_123',
    'enterprise/org-abc/photos/customer.jpg',
    [
        [
            'productId' => 'prod_001',
            'variantId' => 'var_blue_m',
            'name' => 'Blue T-Shirt',
            'imageUrl' => 'https://shop.com/tshirt.jpg',
            'category' => 'tops',
            'quantity' => 1,
            'price' => 29.99,
            'currency' => 'USD'
        ]
    ]
);

echo "Session created: " . $session['id'] . "\n";

// Poll for completion
do {
    sleep(2);
    $result = $client->getCartTryon($session['id']);
    echo "Progress: " . $result['progress'] . "%\n";
} while (!in_array($result['status'], ['completed', 'failed', 'partial']));

print_r($result['cartItems']);
?>
```

---

## Error Handling

### HTTP Status Codes

- `200` - Success
- `201` - Resource created
- `400` - Bad request (validation error)
- `401` - Unauthorized (invalid API key)
- `403` - Forbidden (insufficient permissions/credits)
- `404` - Resource not found
- `429` - Rate limit exceeded
- `500` - Server error

### Error Response Format

```json
{
  "error": "InsufficientCredits",
  "message": "Organization has insufficient credits. Required: 10, Available: 5",
  "code": 403,
  "details": {
    "required": 10,
    "available": 5,
    "organizationId": "org_abc123"
  }
}
```

### Common Errors

#### `InvalidApiKey`
API key is invalid or expired. Check the key and regenerate if needed.

#### `InsufficientCredits`
Organization doesn't have enough credits. Add credits to continue.

#### `RateLimitExceeded`
Too many requests. Wait for rate limit reset or upgrade limits.

#### `InvalidScope`
API key doesn't have permission for this operation. Update scopes.

#### `ResourceNotFound`
Requested resource doesn't exist. Check IDs.

#### `ValidationError`
Request data is invalid. Check error details for specific fields.

---

## Best Practices

### 1. Secure API Key Storage
- Store keys in environment variables or secure vaults
- Never commit keys to version control
- Rotate keys regularly
- Use different keys for development/production

### 2. Implement Webhook Verification
Always verify webhook signatures to prevent spoofing:

```javascript
const isValid = verifyWebhookSignature(
  req.body,
  req.headers['x-webhook-signature'],
  webhookSecret
);
```

### 3. Handle Rate Limits
Implement exponential backoff for rate limit errors:

```javascript
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.response?.status === 429 && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}
```

### 4. Monitor Credit Usage
Track credit consumption to avoid service interruptions:

```javascript
const org = await getOrganization(organizationId);
if (org.credits < estimatedCost) {
  // Alert or auto-purchase credits
}
```

### 5. Use Webhooks for Async Operations
Don't poll for completion. Configure webhooks for real-time updates:

```javascript
// Instead of this:
while (session.status !== 'completed') {
  await sleep(2000);
  session = await getSession(sessionId);
}

// Use webhooks:
app.post('/webhooks/garmaxai', handleWebhook);
```

### 6. Implement Idempotency
Use unique IDs (like order IDs) as cart IDs to prevent duplicate processing:

```javascript
const session = await createCartTryon({
  cartId: `order_${orderId}`, // Use your internal order ID
  // ...
});
```

### 7. Optimize Image URLs
Ensure product images are:
- Publicly accessible
- High resolution (minimum 512x512)
- Fast to download (CDN recommended)
- Properly formatted (JPEG/PNG)

---

## Support

For technical support, integration help, or billing questions:

- Email: enterprise@garmaxai.com
- Documentation: https://docs.garmaxai.com
- Status Page: https://status.garmaxai.com

## Changelog

### v1.0.0 (2025-12-11)
- Initial release
- Organization management
- API key authentication
- External customer management
- Cart try-on pipeline
- Webhook system
- Rate limiting and credit system
