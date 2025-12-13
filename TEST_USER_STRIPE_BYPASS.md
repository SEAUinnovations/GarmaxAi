# Test User Stripe Bypass - Beta Implementation

## Overview
This implementation allows `bettstahlik@gmail.com` to bypass Stripe checkout and receive credits instantly in **all environments including PROD** during the beta phase. This enables seamless internal testing of the generation workflow without payment delays.

**⚠️ IMPORTANT: This is a temporary beta feature and should be removed once proper QA/DEV environments are deployed.**

## How It Works

### 1. Automatic Credit Top-Up
**File:** `src/middleware/testUserCredits.ts`

- Runs on every authenticated request
- Checks if user is `bettstahlik@gmail.com`
- If credits < 1,000 → automatically tops up to 10,000
- Works in **ALL environments** (PROD, QA, DEV, LOCAL)
- Logs with `[TEST USER - BETA - PROD INTERNAL TESTING]` in production

```typescript
// Automatic behavior - no action needed
// Credits auto-replenish during any API call
```

### 2. Stripe Checkout Bypass
**Files:**
- `src/middleware/testUserStripeBypass.ts` - Intercepts credit purchase requests
- `src/controllers/creditsController.ts` - `grantTestUserCredits()` function
- `src/routers/creditsRouter.ts` - Routes configuration

#### Option A: Via Frontend Purchase Flow
When test user clicks "Buy Credits" on Pricing page:
1. Request goes to `POST /api/credits/purchase`
2. `testUserStripeBypass` middleware intercepts
3. Credits granted immediately (base + bonus)
4. Returns success without Stripe redirect

#### Option B: Via Direct API Call
```bash
# Manual credit grant for test user
curl -X POST https://garmaxai.com/api/credits/test-grant \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"credits": 100}'

# Response:
{
  "success": true,
  "message": "Credits granted successfully (test user bypass)",
  "creditsAdded": 115,
  "breakdown": {
    "base": 100,
    "bonus": 15,
    "total": 115
  },
  "newBalance": 10115
}
```

## Credit Pack Options

| Pack | Price | Base Credits | Bonus | Total Credits |
|------|-------|-------------|-------|---------------|
| Small | $5 | 30 | 0 | 30 |
| Medium | $15 | 100 | 15 | 115 |
| Large | $60 | 500 | 150 | 650 |

## Security Measures

1. **Email Validation**: Only `bettstahlik@gmail.com` can use bypass
2. **JWT Required**: Must be authenticated
3. **Audit Logging**: All bypass actions logged with `[TEST USER - BETA]` prefix
4. **Stage Indicators**: PROD usage clearly marked in logs
5. **No Impact on Real Users**: Regular users still use normal Stripe flow

## Testing the Implementation

### Test User Login
```bash
# 1. Login at https://garmaxai.com
# 2. Use Google OAuth with bettstahlik@gmail.com
```

### Verify Auto Top-Up
```bash
# After login, check credits (should be >= 1,000)
curl https://garmaxai.com/api/credits \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

### Test Manual Purchase
```bash
# Buy 100 credits (should grant instantly)
curl -X POST https://garmaxai.com/api/credits/purchase \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"credits": 100}'

# Should return success immediately without Stripe redirect
```

### Test Generate Button
```bash
# With credits available, test generation workflow
# POST /api/generation
# Credits should deduct normally
# Auto-replenish if balance drops below 1,000
```

## Monitoring & Logs

### CloudWatch Logs to Monitor
```bash
# Lambda logs in production
aws logs tail /aws/lambda/GarmaxAi-Backend-prod \
  --follow \
  --filter-pattern "[TEST USER - BETA]"
```

### Expected Log Entries
```
[INFO] [TEST USER - BETA - PROD INTERNAL TESTING] Auto-topped up credits for bettstahlik@gmail.com: 856 → 10000
[INFO] [TEST USER - BETA - PROD INTERNAL TESTING] Bypassed Stripe for bettstahlik@gmail.com: Granted 115 credits (100 + 15 bonus)
[INFO] [TEST USER - BETA - PROD INTERNAL TESTING] Granted 115 credits to bettstahlik@gmail.com (100 + 15 bonus). New balance: 10115
```

## Removal Checklist (Post-Beta)

When QA/DEV environments are deployed and beta phase ends:

### 1. Search for Removal Markers
```bash
git grep "TODO: BETA - Remove"
```

### 2. Files to Modify
- [ ] `src/middleware/testUserCredits.ts` - Restore PROD environment check
- [ ] `src/middleware/testUserStripeBypass.ts` - DELETE entire file
- [ ] `src/controllers/creditsController.ts` - Remove `grantTestUserCredits()` function
- [ ] `src/routers/creditsRouter.ts` - Remove testUserStripeBypass import and `/test-grant` route
- [ ] `src/routes.ts` - Remove testUserStripeBypass import
- [ ] Delete this documentation file

### 3. Restore Original Behavior
```typescript
// src/middleware/testUserCredits.ts
// Add back the PROD check:
const stage = process.env.STAGE?.toUpperCase();
if (stage === 'PROD') {
  return next();
}
```

### 4. Test Removal
```bash
# Ensure bettstahlik@gmail.com goes through normal Stripe flow
# Verify no bypass occurs in any environment
# Check CloudWatch logs show no [TEST USER - BETA] entries
```

## Architecture Notes

### Why This Approach?

1. **Non-Invasive**: Middleware pattern doesn't modify core business logic
2. **Auditable**: All actions clearly logged with beta markers
3. **Reversible**: Simple to remove - search for TODO markers
4. **Safe**: Only affects one specific test user email
5. **Environment Aware**: Logs indicate PROD vs non-PROD usage

### Integration Points

```
Request Flow (Test User):
  ┌─────────────────────────────────────┐
  │  POST /api/credits/purchase         │
  └─────────────┬───────────────────────┘
                │
                ▼
  ┌─────────────────────────────────────┐
  │  requireAuth middleware             │
  │  (validates JWT, sets req.userId)   │
  └─────────────┬───────────────────────┘
                │
                ▼
  ┌─────────────────────────────────────┐
  │  testUserStripeBypass middleware    │
  │  ✓ Check email === test user        │
  │  ✓ Grant credits immediately        │
  │  ✓ Return success (skip next())     │
  └─────────────────────────────────────┘
                │
                │ (If NOT test user)
                ▼
  ┌─────────────────────────────────────┐
  │  createCreditPurchase()             │
  │  (Normal Stripe checkout flow)      │
  └─────────────────────────────────────┘
```

### Regular User Flow (Unchanged)

```
Regular User → POST /api/credits/purchase
             → testUserStripeBypass (passes through via next())
             → createCreditPurchase()
             → Stripe Checkout Session
             → User redirected to Stripe
             → Payment processed
             → Webhook grants credits
```

## Support & Questions

For issues with test user bypass:
1. Check CloudWatch logs for `[TEST USER - BETA]` entries
2. Verify JWT token is valid and fresh
3. Confirm email is exactly `bettstahlik@gmail.com`
4. Check credit balance via GET /api/credits
5. Review Lambda execution logs in CloudWatch

## Related Documentation

- `TEST_USER_CREDITS_GUIDE.md` - Original test user credit documentation
- `STRIPE_INTEGRATION_COMPLETE.md` - Stripe payment flow
- `src/middleware/testUserCredits.ts` - Auto top-up implementation
- `src/middleware/testUserStripeBypass.ts` - Stripe bypass implementation
