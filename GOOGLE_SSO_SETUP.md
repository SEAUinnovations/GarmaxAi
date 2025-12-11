# Google SSO Integration for GarmaxAi

This document explains how to set up Google Sign-In for your GarmaxAi Cognito User Pool.

## Overview

The Cognito User Pool is configured to support:
- **Email/Password authentication** (traditional sign-up)
- **Google SSO** (Sign in with Google)

Users can sign up and sign in using either method, and their accounts are unified in Cognito.

## Prerequisites

1. **Google Cloud Project** - You need a Google Cloud project with OAuth 2.0 credentials
2. **AWS CLI** configured with appropriate permissions
3. **Domain configured** - Your application domain must be set up

## Step 1: Create Google OAuth Credentials

### 1.1 Go to Google Cloud Console
Visit: https://console.cloud.google.com/

### 1.2 Create or Select a Project
- Create a new project or select an existing one
- Name it something like "GarmaxAi Production"

### 1.3 Enable Google+ API
- Navigate to: **APIs & Services > Library**
- Search for "Google+ API"
- Click **Enable**

### 1.4 Configure OAuth Consent Screen
Navigate to: **APIs & Services > OAuth consent screen**

- **User Type**: External
- **App Name**: GarmaxAi
- **User Support Email**: Your support email
- **Developer Contact**: Your developer email
- **Scopes**: Add `email`, `profile`, `openid`
- **Test Users** (optional): Add test users for development

### 1.5 Create OAuth 2.0 Client ID
Navigate to: **APIs & Services > Credentials**

1. Click **+ CREATE CREDENTIALS**
2. Select **OAuth client ID**
3. **Application type**: Web application
4. **Name**: GarmaxAi Production (or your environment name)
5. **Authorized JavaScript origins**: Leave empty
6. **Authorized redirect URIs** (add these):

For **Production**:
```
https://garmaxai-prod.auth.us-east-1.amazoncognito.com/oauth2/idpresponse
https://garmaxai.com/auth/callback
```

For **QA**:
```
https://garmaxai-qa.auth.us-east-1.amazoncognito.com/oauth2/idpresponse
https://qa.garmaxai.com/auth/callback
```

For **Dev**:
```
https://garmaxai-dev.auth.us-east-1.amazoncognito.com/oauth2/idpresponse
https://dev.garmaxai.com/auth/callback
http://localhost:5000/auth/callback
http://localhost:5001/auth/callback
http://localhost:3000/auth/callback
```

> **Note**: Include `localhost:5000` (Vite dev server default), `localhost:5001` (alternate port), and `localhost:3000` (legacy/API server) for local development compatibility.

7. Click **CREATE**
8. **Save the Client ID and Client Secret** - you'll need these next

## Step 2: Store Credentials in AWS Parameter Store

Run the setup script for each environment:

```bash
# For production
./scripts/setup-google-oauth.sh prod

# For QA
./scripts/setup-google-oauth.sh qa

# For dev
./scripts/setup-google-oauth.sh dev
```

The script will prompt you for:
- Google Client ID
- Google Client Secret

These will be securely stored in AWS Systems Manager Parameter Store.

## Step 3: Deploy the Stack

Deploy your CDK stack to create the Cognito resources:

```bash
cd iac
npm run deploy:prod  # or deploy:qa, deploy:dev
```

## Step 4: Get the Cognito Domain URL

After deployment, retrieve the Cognito domain URL:

```bash
aws cloudformation describe-stacks \
  --stack-name GarmaxAi-Backend-prod \
  --query 'Stacks[0].Outputs[?OutputKey==`CognitoDomainUrl`].OutputValue' \
  --output text
```

## Step 5: Test the Integration

### Using the Hosted UI

Navigate to the Cognito Hosted UI:
```
https://garmaxai-prod.auth.us-east-1.amazoncognito.com/login?client_id=<YOUR_CLIENT_ID>&response_type=code&scope=email+openid+profile&redirect_uri=<YOUR_REDIRECT_URI>
```

You should see:
- Email/Password sign-in form
- "Continue with Google" button

### Programmatic Sign-In

Use AWS Amplify or Cognito SDK in your frontend:

```typescript
import { Auth } from 'aws-amplify';

// Configure Amplify
Auth.configure({
  region: 'us-east-1',
  userPoolId: 'us-east-1_XXXXXXXXX',
  userPoolWebClientId: 'XXXXXXXXXXXXXXXXXXXXXXXXXX',
  oauth: {
    domain: 'garmaxai-prod.auth.us-east-1.amazoncognito.com',
    scope: ['email', 'openid', 'profile'],
    redirectSignIn: 'https://garmaxai.com/auth/callback',
    redirectSignOut: 'https://garmaxai.com/auth/logout',
    responseType: 'code'
  }
});

// Sign in with Google
await Auth.federatedSignIn({ provider: 'Google' });
```

## Configuration Details

### Scopes Requested from Google
- `profile` - User's basic profile information
- `email` - User's email address
- `openid` - OpenID Connect authentication

### Attribute Mapping
Google attributes are mapped to Cognito as follows:
- `email` → Cognito `email`
- `given_name` → Cognito `given_name`
- `family_name` → Cognito `family_name`
- `picture` → Cognito `picture`

### Callback URLs
- **Production**: `https://garmaxai.com/auth/callback`
- **QA**: `https://qa.garmaxai.com/auth/callback`
- **Dev**: `https://dev.garmaxai.com/auth/callback` and `http://localhost:3000/auth/callback`

### Logout URLs
- **Production**: `https://garmaxai.com/auth/logout`
- **QA**: `https://qa.garmaxai.com/auth/logout`
- **Dev**: `https://dev.garmaxai.com/auth/logout` and `http://localhost:3000/auth/logout`

## Troubleshooting

### Error: "redirect_uri_mismatch"
- Ensure the redirect URI in Google Cloud Console exactly matches the Cognito domain
- Check for trailing slashes or http vs https mismatches

### Error: "invalid_client"
- Verify the Client ID and Secret are correct in Parameter Store
- Redeploy the stack after updating credentials

### Google button not appearing
- Check that the User Pool Client has `GOOGLE` in `supportedIdentityProviders`
- Verify the Google provider is created before the client (dependency is set)

### Users can't sign in after Google authentication
- Ensure email verification is enabled on the User Pool
- Check that attribute mappings are correct

## Security Best Practices

1. **Use Parameter Store SecureString** for production secrets
2. **Rotate credentials** periodically
3. **Monitor OAuth usage** in Google Cloud Console
4. **Set up quota limits** to prevent abuse
5. **Use HTTPS only** for callback URLs in production

## CloudFormation Outputs

After deployment, these outputs are available:

| Output Key | Description |
|------------|-------------|
| `UserPoolId` | Cognito User Pool ID |
| `UserPoolClientId` | Cognito User Pool Client ID |
| `IdentityPoolId` | Cognito Identity Pool ID |
| `CognitoDomainUrl` | Hosted UI domain URL |

Retrieve them with:
```bash
aws cloudformation describe-stacks \
  --stack-name GarmaxAi-Backend-prod \
  --query 'Stacks[0].Outputs'
```

## References

- [Cognito User Pool Identity Providers](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-identity-provider.html)
- [Google OAuth 2.0 Setup](https://developers.google.com/identity/protocols/oauth2)
- [AWS Amplify Auth](https://docs.amplify.aws/lib/auth/getting-started/q/platform/js/)
