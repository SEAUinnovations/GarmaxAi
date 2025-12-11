# Enterprise API Swagger Documentation

## Add these schemas to swagger.config.js components.schemas:

```javascript
// Organization Schema
Organization: {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    slug: { type: 'string', pattern: '^[a-z0-9-]+$' },
    ownerId: { type: 'string', format: 'uuid' },
    subscriptionTier: { 
      type: 'string',
      enum: ['free', 'starter', 'professional', 'enterprise']
    },
    credits: { type: 'integer', minimum: 0 },
    apiRateLimit: { type: 'integer', minimum: 1 },
    status: { 
      type: 'string',
      enum: ['active', 'suspended', 'deleted']
    },
    billingEmail: { type: 'string', format: 'email', nullable: true },
    companyWebsite: { type: 'string', format: 'uri', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' }
  }
},

// API Key Schema
ApiKey: {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    description: { type: 'string', nullable: true },
    keyPrefix: { type: 'string', example: 'gxai_liv' },
    environment: { 
      type: 'string',
      enum: ['live', 'test']
    },
    scopes: { 
      type: 'array',
      items: { type: 'string' },
      example: ['tryon:create', 'tryon:read', 'photos:upload']
    },
    rateLimit: { type: 'integer', nullable: true },
    lastUsedAt: { type: 'string', format: 'date-time', nullable: true },
    requestCount: { type: 'integer' },
    status: { 
      type: 'string',
      enum: ['active', 'revoked', 'expired']
    },
    expiresAt: { type: 'string', format: 'date-time', nullable: true },
    createdAt: { type: 'string', format: 'date-time' }
  }
},

// Cart Item Schema
CartItem: {
  type: 'object',
  required: ['productId', 'variantId', 'name', 'imageUrl', 'category', 'quantity', 'price', 'currency'],
  properties: {
    productId: { type: 'string' },
    variantId: { type: 'string' },
    name: { type: 'string' },
    imageUrl: { type: 'string', format: 'uri' },
    category: {
      type: 'string',
      enum: ['shirt', 'pants', 'dress', 'jacket', 'shoes', 'hat', 'accessory']
    },
    quantity: { type: 'integer', minimum: 1 },
    price: { type: 'number', minimum: 0 },
    currency: { type: 'string', minLength: 3, maxLength: 3, example: 'USD' }
  }
},

// Cart Try-On Session Schema
CartTryonSession: {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    organizationId: { type: 'string', format: 'uuid' },
    externalCustomerId: { type: 'string' },
    cartId: { type: 'string' },
    cartItems: {
      type: 'array',
      items: { $ref: '#/components/schemas/CartItem' }
    },
    customerPhotoUrl: { type: 'string', format: 'uri' },
    renderQuality: {
      type: 'string',
      enum: ['sd', 'hd', '4k']
    },
    backgroundScene: {
      type: 'string',
      enum: ['studio', 'urban', 'outdoor', 'custom']
    },
    status: {
      type: 'string',
      enum: ['queued', 'processing', 'completed', 'failed']
    },
    progress: { type: 'integer', minimum: 0, maximum: 100 },
    renderedImageUrl: { type: 'string', format: 'uri', nullable: true },
    webhookUrl: { type: 'string', format: 'uri', nullable: true },
    webhookDelivered: { type: 'boolean' },
    creditsUsed: { type: 'integer' },
    createdAt: { type: 'string', format: 'date-time' },
    completedAt: { type: 'string', format: 'date-time', nullable: true }
  }
},

// External Customer Schema
ExternalCustomer: {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    organizationId: { type: 'string', format: 'uuid' },
    externalCustomerId: { type: 'string' },
    email: { type: 'string', format: 'email', nullable: true },
    firstName: { type: 'string', nullable: true },
    lastName: { type: 'string', nullable: true },
    photoUrls: {
      type: 'array',
      items: { type: 'string', format: 'uri' }
    },
    metadata: { type: 'object' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' }
  }
},

// Webhook Configuration Schema
WebhookConfiguration: {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    organizationId: { type: 'string', format: 'uuid' },
    url: { type: 'string', format: 'uri' },
    secret: { type: 'string' },
    events: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['tryon.completed', 'tryon.failed', 'credits.low']
      }
    },
    status: {
      type: 'string',
      enum: ['active', 'disabled']
    },
    failureCount: { type: 'integer' },
    lastFailureAt: { type: 'string', format: 'date-time', nullable: true },
    lastSuccessAt: { type: 'string', format: 'date-time', nullable: true },
    createdAt: { type: 'string', format: 'date-time' }
  }
},

// Error Response Schema
ErrorResponse: {
  type: 'object',
  properties: {
    error: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        details: { type: 'object' }
      }
    }
  }
}
```

## Add API Key security scheme:

```javascript
securitySchemes: {
  ApiKeyAuth: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'API Key',
    description: 'Enter your API key in the format: gxai_live_sk_xxx or gxai_test_sk_xxx'
  },
  // ... existing schemes
}
```

## Swagger Annotations for Router Files

### Cart Try-On Router (src/routers/cartTryonRouter.ts)

```javascript
/**
 * @swagger
 * /api/v1/cart/tryon:
 *   post:
 *     summary: Create cart try-on session
 *     description: Creates a new try-on session for checkout workflow integration. Visualize cart items on customer's photo.
 *     tags: [Cart Try-On]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [externalCustomerId, cartId, cartItems, customerPhoto]
 *             properties:
 *               externalCustomerId:
 *                 type: string
 *                 description: Your customer ID from your system
 *                 example: "customer_12345"
 *               cartId:
 *                 type: string
 *                 description: Your cart/session ID
 *                 example: "cart_abc789"
 *               cartItems:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/CartItem'
 *               customerPhoto:
 *                 type: string
 *                 format: uri
 *                 description: Customer photo URL from upload endpoint
 *               renderQuality:
 *                 type: string
 *                 enum: [sd, hd, 4k]
 *                 default: hd
 *               backgroundScene:
 *                 type: string
 *                 enum: [studio, urban, outdoor, custom]
 *                 default: studio
 *               webhookUrl:
 *                 type: string
 *                 format: uri
 *                 description: Optional webhook for completion notification
 *     responses:
 *       201:
 *         description: Try-on session created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                 status:
 *                   type: string
 *                   enum: [queued]
 *                 progress:
 *                   type: integer
 *                   example: 0
 *                 estimatedTimeSeconds:
 *                   type: integer
 *                   example: 45
 *                 websocketUrl:
 *                   type: string
 *                   format: uri
 *                 creditsEstimate:
 *                   type: integer
 *       400:
 *         description: Invalid request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Invalid or missing API key
 *       402:
 *         description: Insufficient credits
 *       429:
 *         description: Rate limit exceeded
 *         headers:
 *           X-RateLimit-Limit:
 *             schema:
 *               type: integer
 *             description: Total requests allowed per minute
 *           X-RateLimit-Remaining:
 *             schema:
 *               type: integer
 *             description: Requests remaining
 *           X-RateLimit-Reset:
 *             schema:
 *               type: integer
 *             description: Unix timestamp when limit resets
 */

/**
 * @swagger
 * /api/v1/cart/tryon/{sessionId}:
 *   get:
 *     summary: Get cart try-on session
 *     description: Retrieves the current status and results of a cart try-on session
 *     tags: [Cart Try-On]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Try-on session ID
 *     responses:
 *       200:
 *         description: Session retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CartTryonSession'
 *       404:
 *         description: Session not found
 */

/**
 * @swagger
 * /api/v1/cart/tryon:
 *   get:
 *     summary: List cart try-on sessions
 *     description: Retrieve a paginated list of cart try-on sessions
 *     tags: [Cart Try-On]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Number of results per page
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Pagination offset
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [queued, processing, completed, failed]
 *         description: Filter by status
 *       - in: query
 *         name: cartId
 *         schema:
 *           type: string
 *         description: Filter by cart ID
 *       - in: query
 *         name: externalCustomerId
 *         schema:
 *           type: string
 *         description: Filter by customer ID
 *     responses:
 *       200:
 *         description: List of sessions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CartTryonSession'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     offset:
 *                       type: integer
 *                     hasMore:
 *                       type: boolean
 */
```

### External Customers Router

```javascript
/**
 * @swagger
 * /api/v1/customers:
 *   post:
 *     summary: Create or update external customer
 *     description: Creates a new customer record or updates existing one by external ID
 *     tags: [Customers]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [externalCustomerId]
 *             properties:
 *               externalCustomerId:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Customer created/updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ExternalCustomer'
 */

/**
 * @swagger
 * /api/v1/customers/{externalCustomerId}:
 *   get:
 *     summary: Get external customer
 *     tags: [Customers]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: externalCustomerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Customer details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ExternalCustomer'
 */
```

### Photo Upload Router

```javascript
/**
 * @swagger
 * /api/v1/photos/upload:
 *   post:
 *     summary: Upload customer photo
 *     description: Upload a customer photo for use in try-on sessions
 *     tags: [Photos]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [photo]
 *             properties:
 *               photo:
 *                 type: string
 *                 format: binary
 *                 description: Image file (JPEG, PNG, WebP, 5-20MB)
 *               externalCustomerId:
 *                 type: string
 *                 description: Optional customer ID to link photo
 *     responses:
 *       201:
 *         description: Photo uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 photoUrl:
 *                   type: string
 *                   format: uri
 *                 photoS3Key:
 *                   type: string
 *                 thumbnailUrl:
 *                   type: string
 *                   format: uri
 */
```

### Organization Management Router

```javascript
/**
 * @swagger
 * /api/organizations:
 *   post:
 *     summary: Create organization
 *     description: Create a new organization (requires user authentication)
 *     tags: [Organizations]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, slug]
 *             properties:
 *               name:
 *                 type: string
 *               slug:
 *                 type: string
 *                 pattern: '^[a-z0-9-]+$'
 *               billingEmail:
 *                 type: string
 *                 format: email
 *               companyWebsite:
 *                 type: string
 *                 format: uri
 *     responses:
 *       201:
 *         description: Organization created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Organization'
 */

/**
 * @swagger
 * /api/organizations/{orgId}/api-keys:
 *   post:
 *     summary: Create API key
 *     description: Generate a new API key for the organization
 *     tags: [API Keys]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, scopes]
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               scopes:
 *                 type: array
 *                 items:
 *                   type: string
 *               environment:
 *                 type: string
 *                 enum: [live, test]
 *                 default: live
 *               rateLimit:
 *                 type: integer
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: API key created (key shown only once!)
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiKey'
 *                 - type: object
 *                   properties:
 *                     key:
 *                       type: string
 *                       description: Full API key - save securely!
 */

/**
 * @swagger
 * /api/organizations/{orgId}/usage:
 *   get:
 *     summary: Get usage report
 *     description: Retrieve detailed usage analytics for the organization
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *     responses:
 *       200:
 *         description: Usage report
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 period:
 *                   type: object
 *                   properties:
 *                     start:
 *                       type: string
 *                       format: date-time
 *                     end:
 *                       type: string
 *                       format: date-time
 *                 summary:
 *                   type: object
 *                   properties:
 *                     totalRequests:
 *                       type: integer
 *                     totalCreditsUsed:
 *                       type: integer
 *                     avgResponseTimeMs:
 *                       type: number
 *                     successRate:
 *                       type: number
 *                 breakdown:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         type: string
 *                         format: date
 *                       requests:
 *                         type: integer
 *                       creditsUsed:
 *                         type: integer
 *                       successRate:
 *                         type: number
 */

/**
 * @swagger
 * /api/organizations/{orgId}/webhooks:
 *   post:
 *     summary: Create webhook
 *     description: Register a webhook endpoint for event notifications
 *     tags: [Webhooks]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [url, events]
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *               events:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [tryon.completed, tryon.failed, credits.low]
 *     responses:
 *       201:
 *         description: Webhook created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebhookConfiguration'
 */
```

## Tags Configuration

```javascript
tags: [
  {
    name: 'Cart Try-On',
    description: 'E-commerce checkout integration - visualize cart items on customer photos'
  },
  {
    name: 'Customers',
    description: 'External customer management for partner integrations'
  },
  {
    name: 'Photos',
    description: 'Customer photo upload and management'
  },
  {
    name: 'Organizations',
    description: 'Organization management and configuration'
  },
  {
    name: 'API Keys',
    description: 'API key generation and management'
  },
  {
    name: 'Webhooks',
    description: 'Webhook configuration for event notifications'
  },
  {
    name: 'Analytics',
    description: 'Usage tracking and reporting'
  }
]
```
