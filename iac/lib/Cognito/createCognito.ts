import * as cdk from 'aws-cdk-lib';
import * as ssm from 'aws-cdk-lib/aws-ssm';

export default function createCognito(
    stack: cdk.Stack,
    stage: string,
) {

    // Retrieve Google OAuth credentials from Parameter Store
    // These should be created manually or via a separate setup script
    const googleClientId = ssm.StringParameter.valueForStringParameter(
      stack,
      `/garmaxai/${stage}/cognito/google-client-id`,
    );
    
    const googleClientSecret = ssm.StringParameter.valueForStringParameter(
      stack,
      `/garmaxai/${stage}/cognito/google-client-secret`,
    );

    const userPool = new cdk.aws_cognito.UserPool(stack, `GarmaxAi-UserPool-${stage}`, {
        userPoolName: `GarmaxAi-UserPool-${stage}`,
        selfSignUpEnabled: true,
        signInAliases: { email: true },
        autoVerify: { email: true },
        passwordPolicy: {
          minLength: 8,
          requireSymbols: true,
          requireDigits: true,
          requireLowercase: true,
          requireUppercase: true,
        },
        accountRecovery: cdk.aws_cognito.AccountRecovery.EMAIL_ONLY,
        standardAttributes: {
          email: {
            required: true,
            mutable: true,
          },
        },
      });

      // Add Google as an identity provider
      const googleProvider = new cdk.aws_cognito.UserPoolIdentityProviderGoogle(
        stack,
        `GarmaxAi-GoogleProvider-${stage}`,
        {
          userPool,
          clientId: googleClientId,
          clientSecretValue: cdk.SecretValue.unsafePlainText(googleClientSecret),
          scopes: ['profile', 'email', 'openid'],
          attributeMapping: {
            email: cdk.aws_cognito.ProviderAttribute.GOOGLE_EMAIL,
            givenName: cdk.aws_cognito.ProviderAttribute.GOOGLE_GIVEN_NAME,
            familyName: cdk.aws_cognito.ProviderAttribute.GOOGLE_FAMILY_NAME,
            profilePicture: cdk.aws_cognito.ProviderAttribute.GOOGLE_PICTURE,
          },
        }
      );
      
      const userPoolClient = new cdk.aws_cognito.UserPoolClient(stack, `GarmaxAi-UserPoolClient-${stage}`, {
        userPool,
        userPoolClientName: `GarmaxAi-WebClient-${stage}`,
        authFlows: {
          userPassword: true,
          userSrp: true,
        },
        generateSecret: false,
        oAuth: {
          flows: {
            authorizationCodeGrant: true,
          },
          scopes: [
            cdk.aws_cognito.OAuthScope.EMAIL,
            cdk.aws_cognito.OAuthScope.OPENID,
            cdk.aws_cognito.OAuthScope.PROFILE,
          ],
          callbackUrls: [
            `https://${stage === 'prod' ? '' : `${stage}.`}garmaxai.com/auth/callback`,
            'http://localhost:3000/auth/callback', // For local development
          ],
          logoutUrls: [
            `https://${stage === 'prod' ? '' : `${stage}.`}garmaxai.com/auth/logout`,
            'http://localhost:3000/auth/logout',
          ],
        },
        supportedIdentityProviders: [
          cdk.aws_cognito.UserPoolClientIdentityProvider.GOOGLE,
          cdk.aws_cognito.UserPoolClientIdentityProvider.COGNITO,
        ],
      });

      // Ensure the client depends on the Google provider
      userPoolClient.node.addDependency(googleProvider);

      // Add a custom domain for the hosted UI
      const cognitoDomain = userPool.addDomain(`GarmaxAi-CognitoDomain-${stage}`, {
        cognitoDomain: {
          domainPrefix: `garmaxai-${stage}`,
        },
      });
    
      const identityPool = new cdk.aws_cognito.CfnIdentityPool(stack, `GarmaxAi-IdentityPool-${stage}`, {
        identityPoolName: `GarmaxAi_IdentityPool_${stage}`,
        allowUnauthenticatedIdentities: false,
        cognitoIdentityProviders: [
          {
            clientId: userPoolClient.userPoolClientId,
            providerName: userPool.userPoolProviderName,
          },
        ],
        
      });

    return [ userPool, userPoolClient, identityPool, cognitoDomain ];
}
