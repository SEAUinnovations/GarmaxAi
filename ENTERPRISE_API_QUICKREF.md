# Enterprise API Quick Reference

## Authentication

### User Session (JWT)
For organization and API key management:
```bash
Authorization: Bearer <jwt_token>
```

### API Key
For all v1 endpoints (customers, photos, cart try-ons, webhooks):
```bash
X-API-Key: gx_live_abc123...
```

## Common Operations

### 1. Setup Organization

```bash
# Create organization
POST /api/organizations
Authorization: Bearer <jwt>
{
  "name": "Your Company",
  "billingEmail": "billing@company.com"
}

# Add credits
POST /api/organizations/{orgId}/credits
Authorization: Bearer <jwt>
{
  "amount": 1000
}
```

### 2. Generate API Key

```bash
POST /api/organizations/{orgId}/api-keys
Authorization: Bearer <jwt>
{
  "name": "Production Key",
  "scopes": ["all"],
  "rateLimit": 120,
  "expiresAt": "2026-12-31T23:59:59Z"
}
```

**Response includes full key (only shown once!):**
```json
{
  "key": "gx_live_abc123def456..."
}
```

### 3. Upload Customer Photo

```bash
POST /api/v1/customers/{externalId}/photos
X-API-Key: gx_live_abc123...
Content-Type: multipart/form-data

photo=<binary>
```

### 4. Create Cart Try-On

```bash
POST /api/v1/cart-tryons
X-API-Key: gx_live_abc123...
{
  "cartId": "cart_123",
  "customerPhotoS3Key": "enterprise/org-{orgId}/photos/photo.jpg",
  "cartItems": [
    {
      "productId": "prod_001",
      "variantId": "var_blue_m",
      "name": "Blue T-Shirt",
      "imageUrl": "https://shop.com/tshirt.jpg",
      "category": "tops",
      "quantity": 1,
      "price": 29.99,
      "currency": "USD"
    }
  ],
  "renderQuality": "hd"
}
```

### 5. Check Status

```bash
GET /api/v1/cart-tryons/{sessionId}
X-API-Key: gx_live_abc123...
```

### 6. Configure Webhook

```bash
POST /api/v1/webhooks
X-API-Key: gx_live_abc123...
{
  "url": "https://shop.com/webhooks/garmaxai",
  "events": ["cart_tryon.completed", "cart_tryon.failed"]
}
```

## Credit Costs

| Quality | Multiplier | Example (1 item) |
|---------|-----------|------------------|
| SD | 1x | 1 credit |
| HD | 2x | 2 credits |
| 4K | 4x | 4 credits |

### Volume Discounts

| Items | Discount |
|-------|----------|
| 1-4 | 0% |
| 5-9 | 10% |
| 10-14 | 20% |
| 15-19 | 30% |
| 20 | 40% |

**Example:** 10 items × HD (2x) = 20 base credits → 20% discount = **16 credits**

## API Scopes

| Scope | Permissions |
|-------|-------------|
| `tryon:create` | Create try-on sessions |
| `tryon:read` | View try-on results |
| `photos:upload` | Upload customer photos |
| `photos:read` | View customer photos |
| `customers:create` | Create/update customers |
| `customers:read` | View customers |
| `webhooks:manage` | Configure webhooks |
| `all` | Full access |

## Rate Limits

- Default: **60 requests/minute** per API key
- Custom limits available per endpoint
- Headers returned:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`

## Webhook Events

### cart_tryon.completed
All items successfully processed.

```json
{
  "event": "cart_tryon.completed",
  "timestamp": "2025-12-11T10:00:00Z",
  "data": {
    "sessionId": "session_abc",
    "cartId": "cart_123",
    "organizationId": "org_xyz",
    "status": "completed",
    "results": [
      {
        "productId": "prod_001",
        "variantId": "var_blue_m",
        "status": "completed",
        "resultUrl": "https://s3.../result.jpg"
      }
    ]
  }
}
```

### cart_tryon.partial
Some items succeeded, some failed.

### cart_tryon.failed
All items failed.

## Webhook Verification

```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
```

## Error Codes

| Code | Error | Solution |
|------|-------|----------|
| 401 | Invalid API key | Check key format and expiration |
| 403 | Insufficient credits | Add credits to organization |
| 403 | Insufficient permissions | Update API key scopes |
| 404 | Resource not found | Verify IDs |
| 429 | Rate limit exceeded | Wait for reset or upgrade limits |
| 400 | Validation error | Check request body format |

## Testing

```bash
# Test webhook connectivity
POST /api/v1/webhooks/{webhookId}/test
X-API-Key: gx_live_abc123...

# List sessions with filters
GET /api/v1/cart-tryons?cartId=cart_123&status=completed&limit=20
X-API-Key: gx_live_abc123...

# Check organization credits
GET /api/organizations/{orgId}
Authorization: Bearer <jwt>
```

## Best Practices

1. **Store API keys securely** - Use environment variables
2. **Implement webhook verification** - Validate HMAC signatures
3. **Handle rate limits** - Exponential backoff on 429 errors
4. **Monitor credits** - Alert before running out
5. **Use webhooks** - Don't poll for completion
6. **Idempotent cart IDs** - Use order IDs to prevent duplicates
7. **Optimize images** - Use CDN for product images

## Support

- 📧 Email: enterprise@garmaxai.com
- 📚 Full docs: [ENTERPRISE_API.md](ENTERPRISE_API.md)
- 🔍 Status: https://status.garmaxai.com

## Code Snippets

### Node.js - Complete Flow

```javascript
const axios = require('axios');

const API_KEY = process.env.GARMAXAI_API_KEY;
const BASE_URL = 'https://api.garmaxai.com/api';

async function processTryOn(cartId, customerPhoto, products) {
  // 1. Upload customer photo
  const formData = new FormData();
  formData.append('photo', customerPhoto);
  
  await axios.post(
    `${BASE_URL}/v1/customers/${cartId}/photos`,
    formData,
    { headers: { 'X-API-Key': API_KEY } }
  );
  
  // 2. Create cart try-on
  const session = await axios.post(
    `${BASE_URL}/v1/cart-tryons`,
    {
      cartId,
      customerPhotoS3Key: `enterprise/org-{orgId}/photos/${cartId}.jpg`,
      cartItems: products.map(p => ({
        productId: p.id,
        variantId: p.variantId,
        name: p.name,
        imageUrl: p.imageUrl,
        category: p.category,
        quantity: 1,
        price: p.price,
        currency: 'USD'
      })),
      renderQuality: 'hd'
    },
    { headers: { 'X-API-Key': API_KEY } }
  );
  
  return session.data;
}

// Webhook handler
app.post('/webhooks/garmaxai', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const isValid = verifySignature(req.body, signature, WEBHOOK_SECRET);
  
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  const { event, data } = req.body;
  
  if (event === 'cart_tryon.completed') {
    // Update your database with results
    console.log('Try-on completed:', data.sessionId);
    data.results.forEach(item => {
      console.log(`${item.productId}: ${item.resultUrl}`);
    });
  }
  
  res.status(200).json({ received: true });
});
```

### Python - Async Processing

```python
import requests
import hmac
import hashlib

API_KEY = os.environ['GARMAXAI_API_KEY']
BASE_URL = 'https://api.garmaxai.com/api'

def create_cart_tryon(cart_id, customer_photo_key, items):
    response = requests.post(
        f'{BASE_URL}/v1/cart-tryons',
        json={
            'cartId': cart_id,
            'customerPhotoS3Key': customer_photo_key,
            'cartItems': items,
            'renderQuality': 'hd'
        },
        headers={'X-API-Key': API_KEY}
    )
    response.raise_for_status()
    return response.json()

def verify_webhook(payload, signature, secret):
    expected = hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected)

# Flask webhook handler
@app.route('/webhooks/garmaxai', methods=['POST'])
def handle_webhook():
    signature = request.headers.get('X-Webhook-Signature')
    payload = request.get_data(as_text=True)
    
    if not verify_webhook(payload, signature, WEBHOOK_SECRET):
        return {'error': 'Invalid signature'}, 401
    
    data = request.json
    
    if data['event'] == 'cart_tryon.completed':
        # Process results
        for item in data['data']['results']:
            print(f"{item['productId']}: {item['resultUrl']}")
    
    return {'received': True}
```

### PHP - Webhook Handler

```php
<?php
function verifyWebhookSignature($payload, $signature, $secret) {
    $expected = hash_hmac('sha256', $payload, $secret);
    return hash_equals($signature, $expected);
}

$payload = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_WEBHOOK_SIGNATURE'];

if (!verifyWebhookSignature($payload, $signature, $webhookSecret)) {
    http_response_code(401);
    exit(json_encode(['error' => 'Invalid signature']));
}

$data = json_decode($payload, true);

if ($data['event'] === 'cart_tryon.completed') {
    foreach ($data['data']['results'] as $item) {
        echo "{$item['productId']}: {$item['resultUrl']}\n";
    }
}

http_response_code(200);
echo json_encode(['received' => true]);
?>
```
