// MSW mock handlers for API endpoints
import { http, HttpResponse } from 'msw';

export const handlers = [
  // Authentication endpoints
  http.post('/api/auth/login', async ({ request }) => {
    const { email, password } = await request.json() as { email: string; password: string };
    
    if (email === 'test@example.com' && password === 'password123') {
      return HttpResponse.json({
        user: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          username: 'testuser',
          email: 'test@example.com',
          emailVerified: true,
          subscriptionTier: 'free',
          credits: 10,
        },
      });
    }
    
    return new HttpResponse(null, { 
      status: 401,
      statusText: 'Invalid credentials'
    });
  }),

  http.post('/api/auth/register', async ({ request }) => {
    const userData = await request.json() as any;
    
    return HttpResponse.json({
      user: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        username: userData.username,
        email: userData.email,
        emailVerified: false,
        subscriptionTier: 'free',
        credits: 10,
      },
    }, { status: 201 });
  }),

  http.get('/api/auth/me', () => {
    return HttpResponse.json({
      user: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        username: 'testuser',
        email: 'test@example.com',
        emailVerified: true,
        subscriptionTier: 'free',
        credits: 10,
      },
    });
  }),

  http.post('/api/auth/logout', () => {
    return HttpResponse.json({ 
      message: 'Successfully logged out' 
    });
  }),

  // Profile endpoints
  http.get('/api/users/profile/physical', () => {
    return HttpResponse.json({
      userId: '123e4567-e89b-12d3-a456-426614174000',
      heightFeet: 5,
      heightInches: 8,
      measurementSystem: 'imperial',
      bodyType: 'athletic',
      fitPreference: 'fitted',
      completionPercentage: 75,
    });
  }),

  http.patch('/api/users/profile/physical', async ({ request }) => {
    const body = await request.json() as any;
    return HttpResponse.json({
      userId: '123e4567-e89b-12d3-a456-426614174000',
      completionPercentage: 85,
      ...body,
    });
  }),

  http.get('/api/users/profile/benefits', () => {
    return HttpResponse.json({
      completionPercentage: 75,
      benefits: [
        'Better try-on accuracy',
        'Personalized recommendations',
        'Size guidance',
      ],
    });
  }),

  // Analytics endpoints
  http.get('/api/analytics/ab-variant', () => {
    return HttpResponse.json({
      variant: 'control',
      userId: '123e4567-e89b-12d3-a456-426614174000',
      assignedAt: new Date().toISOString(),
    });
  }),

  http.post('/api/analytics/profile-event', () => {
    return HttpResponse.json({ success: true });
  }),

  // Try-on session endpoints
  http.post('/api/tryon/sessions', async ({ request }) => {
    const sessionData = await request.json() as any;
    
    return HttpResponse.json({
      id: 'session-123e4567-e89b-12d3-a456-426614174000',
      userId: '123e4567-e89b-12d3-a456-426614174000',
      status: 'processing',
      progress: 0,
      renderQuality: sessionData.preferences?.renderQuality || 'hd',
      creditsUsed: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }),

  http.get('/api/tryon/sessions/:sessionId/status', ({ params }) => {
    return HttpResponse.json({
      id: params.sessionId,
      userId: '123e4567-e89b-12d3-a456-426614174000',
      status: 'completed',
      progress: 100,
      renderQuality: 'hd',
      creditsUsed: 2,
      renderedImageUrl: 'https://example.com/result.jpg',
      createdAt: new Date(Date.now() - 60000).toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }),

  http.post('/api/tryon/sessions/:sessionId/cancel', ({ params }) => {
    return HttpResponse.json({
      id: params.sessionId,
      status: 'cancelled',
      message: 'Try-on session cancelled successfully',
    });
  }),

  // Credits endpoints
  http.get('/api/credits', () => {
    return HttpResponse.json({
      balance: 25,
      monthlyQuota: 50,
      used: 7,
    });
  }),

  // Health endpoint
  http.get('/api/health', () => {
    return HttpResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        redis: 'connected',
        storage: 'connected',
      },
    });
  }),

  // Default error handler
  http.get('*', () => {
    console.warn('Unhandled API request');
    return new HttpResponse(null, { 
      status: 404,
      statusText: 'Not Found'
    });
  }),
];