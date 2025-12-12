# Test User Credit Management System

## Overview

The test user `bettstahlik@gmail.com` is automatically granted sufficient credits for end-to-end testing of the model generation workflow without manual intervention.

## How It Works

### Automatic Credit Top-Up (Recommended)

**Middleware: `src/middleware/testUserCredits.ts`**

- Runs on **every authenticated request** after the `setUser` middleware
- Only active in **DEV and QA environments** (not PROD)
- Checks if user email is `bettstahlik@gmail.com`
- If credits fall below **1,000**, automatically tops up to **10,000 credits**
- Zero manual intervention required

**Integration:** Added to `src/routes.ts` line 31:
```typescript
app.use(setUser);
app.use(ensureTestUserCredits); // Auto-replenishes test user credits
```

### Manual Credit Grant

**Script: `scripts/ensure-test-user-credits.ts`**

For one-time credit grants or initial setup:

```bash
# Grant default 100,000 credits
npx tsx scripts/ensure-test-user-credits.ts

# Grant custom amount
TARGET_CREDITS=50000 npx tsx scripts/ensure-test-user-credits.ts

# Quick shortcut
./scripts/top-up-test-user.sh 50000
```

## Credit Costs Reference

| Operation | Credits | Notes |
|-----------|---------|-------|
| SD Try-on Render | 10 | Standard definition |
| HD Try-on Render | 15 | High definition |
| 4K Try-on Render | 25 | Ultra high definition |
| Avatar Creation | 5 | Per avatar |
| Model Generation (Low) | 1 | Low quality |
| Model Generation (Medium) | 3 | Medium quality |
| Model Generation (High) | 5 | High quality |

**With 10,000 credits you can:**
- Create 1,000 SD renders OR
- Create 666 HD renders OR
- Create 400 4K renders OR
- Create 2,000 avatars

## Testing Workflow

### Development Environment

1. Start services: `npm run dev`
2. Login as `bettstahlik@gmail.com`
3. Credits automatically maintained at 10,000+ on every request
4. Test model generation workflow end-to-end:
   - Upload photos
   - Create avatar
   - Generate try-on renders
   - No manual credit management needed

### Initial Setup

If setting up a new environment:

```bash
# Run dev setup (includes test user credit initialization)
./scripts/dev-setup.sh

# Or manually ensure credits
npx tsx scripts/ensure-test-user-credits.ts
```

## Environment-Specific Behavior

### DEV/QA Environments
- ✅ Automatic credit top-up **ENABLED**
- Threshold: 1,000 credits
- Top-up amount: 10,000 credits
- Runs on every authenticated request

### PROD Environment
- ❌ Automatic credit top-up **DISABLED**
- Manual grants only via script
- Prevents production data pollution

## Configuration

**Test User Email:**
```typescript
// src/middleware/testUserCredits.ts
const TEST_USER_EMAIL = 'bettstahlik@gmail.com';
```

**Credit Thresholds:**
```typescript
const MIN_CREDIT_THRESHOLD = 1000;  // Auto-top-up when below this
const TOP_UP_AMOUNT = 10000;        // Top-up to this amount
```

**Environment Check:**
```typescript
const stage = process.env.STAGE?.toUpperCase();
if (stage === 'PROD') {
  return next(); // Skip in production
}
```

## Monitoring

Automatic top-ups are logged:

```
[INFO] [TEST USER] Auto-topped up credits for bettstahlik@gmail.com: 856 → 10000
```

Check logs in CloudWatch (AWS) or local console for credit replenishment events.

## Database Schema

**Table:** `users`

```sql
SELECT 
  username, 
  email, 
  credits, 
  creditsRemaining 
FROM users 
WHERE email = 'bettstahlik@gmail.com';
```

Both `credits` and `creditsRemaining` are updated synchronously.

## Troubleshooting

### Credits not replenishing automatically?

1. Check `STAGE` environment variable: `echo $STAGE`
   - Should be `dev` or `qa`, not `prod`
2. Check middleware is loaded: Look for import in `src/routes.ts`
3. Check logs for error messages: `[ERROR] Failed to check/top-up test user credits`
4. Verify user exists: `npx tsx scripts/ensure-test-user-credits.ts`

### User doesn't exist?

```bash
# Create user by logging in via OAuth
# Then run:
npx tsx scripts/ensure-test-user-credits.ts
```

### Need more credits immediately?

```bash
# Grant 100k credits instantly
./scripts/top-up-test-user.sh 100000
```

## Files Modified

- `src/middleware/testUserCredits.ts` - Auto-replenishment middleware
- `src/routes.ts` - Middleware integration
- `scripts/ensure-test-user-credits.ts` - Manual credit grant script
- `scripts/top-up-test-user.sh` - Quick top-up shortcut
- `scripts/dev-setup.sh` - Automated setup integration

## Security Considerations

- Test user credit system only runs in non-production environments
- Middleware checks `process.env.STAGE` before granting credits
- Production database writes require explicit script execution
- Logging provides audit trail of all credit modifications

## Future Enhancements

Consider implementing:
- Multiple test user accounts
- Configurable credit thresholds per environment
- Admin API endpoint for credit management
- Dashboard for test user credit monitoring
