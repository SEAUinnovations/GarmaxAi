// Swagger/OpenAPI configuration for API documentation
export default {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'GarmaxAI API',
      version: '1.0.0',
      description: 'Virtual Try-On API for fashion e-commerce with advanced AI rendering',
      contact: {
        name: 'GarmaxAI Team',
        email: 'api@garmaxai.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000/api',
        description: 'Development server',
      },
      {
        url: 'https://api.garmaxai.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        SessionAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'connect.sid',
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'auth-token',
        },
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'Enterprise API key for programmatic access',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            username: { type: 'string', minLength: 3, maxLength: 50 },
            email: { type: 'string', format: 'email' },
            emailVerified: { type: 'boolean' },
            subscriptionTier: { 
              type: 'string', 
              enum: ['free', 'studio', 'pro'] 
            },
            credits: { type: 'integer', minimum: 0 },
            trialStatus: {
              type: 'string',
              enum: ['active', 'expired', 'converted'],
              nullable: true
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'username', 'email', 'subscriptionTier', 'credits'],
        },
        PhysicalProfile: {
          type: 'object',
          properties: {
            userId: { type: 'string', format: 'uuid' },
            measurementSystem: { type: 'string', enum: ['imperial', 'metric'] },
            height: { type: 'number', minimum: 0, nullable: true },
            weight: { type: 'number', minimum: 0, nullable: true },
            bodyType: { 
              type: 'string', 
              enum: ['pear', 'apple', 'hourglass', 'rectangle', 'inverted_triangle'],
              nullable: true 
            },
            chest: { type: 'number', minimum: 0, nullable: true },
            waist: { type: 'number', minimum: 0, nullable: true },
            hips: { type: 'number', minimum: 0, nullable: true },
            shoulderWidth: { type: 'number', minimum: 0, nullable: true },
            armLength: { type: 'number', minimum: 0, nullable: true },
            legLength: { type: 'number', minimum: 0, nullable: true },
            neckSize: { type: 'number', minimum: 0, nullable: true },
            shoeSize: { type: 'number', minimum: 0, nullable: true },
            skinTone: { 
              type: 'string', 
              enum: ['fair', 'light', 'medium', 'tan', 'dark', 'deep'],
              nullable: true 
            },
            hairColor: { type: 'string', nullable: true },
            eyeColor: { type: 'string', nullable: true },
            fitPreference: { 
              type: 'string', 
              enum: ['tight', 'fitted', 'regular', 'loose', 'oversized'],
              nullable: true 
            },
            completionPercentage: { type: 'integer', minimum: 0, maximum: 100 },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
          required: ['userId', 'measurementSystem'],
        },
        TryonSession: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            status: { 
              type: 'string', 
              enum: ['queued', 'processing_avatar', 'applying_overlays', 'preview_ready', 'awaiting_confirmation', 'rendering_ai', 'completed', 'cancelled', 'failed'] 
            },
            progress: { type: 'integer', minimum: 0, maximum: 100 },
            renderQuality: { type: 'string', enum: ['sd', 'hd', '4k'] },
            backgroundScene: { type: 'string', enum: ['studio', 'urban', 'outdoor', 'custom'] },
            creditsUsed: { type: 'integer', minimum: 0 },
            baseImageUrl: { type: 'string', format: 'url', nullable: true },
            renderedImageUrl: { type: 'string', format: 'url', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'userId', 'status', 'progress', 'renderQuality'],
        },
        ABTestVariant: {
          type: 'object',
          properties: {
            variant: { 
              type: 'string', 
              enum: ['control', 'higher_bonus', 'multi_step', 'text_benefits'] 
            },
            userId: { type: 'string', format: 'uuid' },
            assignedAt: { type: 'string', format: 'date-time' },
          },
          required: ['variant', 'userId'],
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            code: { type: 'integer' },
            details: { type: 'object', nullable: true },
          },
          required: ['error', 'message'],
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object', nullable: true },
          },
          required: ['success'],
        },
        // Enterprise API Schemas
        Organization: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            domain: { type: 'string', nullable: true },
            billingEmail: { type: 'string', format: 'email' },
            credits: { type: 'integer', minimum: 0 },
            settings: { type: 'object' },
            status: { type: 'string', enum: ['active', 'suspended', 'deleted'] },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'name', 'billingEmail', 'credits', 'status'],
        },
        ApiKey: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            organizationId: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            keyPrefix: { type: 'string' },
            scopes: { type: 'array', items: { type: 'string' } },
            rateLimit: { type: 'integer', nullable: true },
            expiresAt: { type: 'string', format: 'date-time', nullable: true },
            lastUsedAt: { type: 'string', format: 'date-time', nullable: true },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'organizationId', 'name', 'keyPrefix', 'scopes', 'isActive'],
        },
        ExternalCustomer: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            organizationId: { type: 'string', format: 'uuid' },
            externalId: { type: 'string' },
            email: { type: 'string', format: 'email', nullable: true },
            name: { type: 'string', nullable: true },
            photoS3Key: { type: 'string', nullable: true },
            photoUrl: { type: 'string', format: 'url', nullable: true },
            metadata: { type: 'object', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'organizationId', 'externalId'],
        },
        CartTryonSession: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            organizationId: { type: 'string', format: 'uuid' },
            cartId: { type: 'string' },
            customerPhotoS3Key: { type: 'string' },
            cartItems: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  productId: { type: 'string' },
                  variantId: { type: 'string' },
                  name: { type: 'string' },
                  imageUrl: { type: 'string', format: 'url' },
                  category: { type: 'string' },
                  quantity: { type: 'integer', minimum: 1 },
                  price: { type: 'number', minimum: 0 },
                  currency: { type: 'string' },
                },
              },
            },
            renderQuality: { type: 'string', enum: ['sd', 'hd', '4k'] },
            backgroundScene: { type: 'string', nullable: true },
            creditsRequired: { type: 'integer', minimum: 0 },
            creditsCharged: { type: 'integer', minimum: 0 },
            status: { type: 'string', enum: ['queued', 'processing', 'completed', 'failed', 'partial', 'cancelled'] },
            progress: { type: 'integer', minimum: 0, maximum: 100 },
            metadata: { type: 'object', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            completedAt: { type: 'string', format: 'date-time', nullable: true },
          },
          required: ['id', 'organizationId', 'cartId', 'cartItems', 'status', 'creditsRequired'],
        },
        Webhook: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            organizationId: { type: 'string', format: 'uuid' },
            url: { type: 'string', format: 'url' },
            events: { type: 'array', items: { type: 'string' } },
            secret: { type: 'string' },
            isActive: { type: 'boolean' },
            failureCount: { type: 'integer', minimum: 0 },
            lastTriggeredAt: { type: 'string', format: 'date-time', nullable: true },
            lastFailedAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'organizationId', 'url', 'events', 'isActive'],
        },
      },
    },
    security: [
      { BearerAuth: [] },
      { SessionAuth: [] },
    ],
  },
  apis: ['./src/routers/*.ts'], // paths to files containing OpenAPI definitions
};