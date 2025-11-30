import * as cdk from 'aws-cdk-lib';

export default function createCognito(
    stack: cdk.Stack,
    stage: string,
) {

    const userPool = new cdk.aws_cognito.UserPool(stack, `ModelMeUserPool-${stage}`, {
        selfSignUpEnabled: true,
        signInAliases: { email: true },
        autoVerify: { email: false },
        passwordPolicy: {
          minLength: 8,
          requireSymbols: true,
          requireDigits: true,
        },
      });
      
      const userPoolClient = new cdk.aws_cognito.UserPoolClient(stack, `ModelMeUserPoolClient-${stage}`, {
        userPool,
        authFlows: {
          userPassword: true,
        },
        generateSecret: false,
      });
    
      const identityPool = new cdk.aws_cognito.CfnIdentityPool(stack, `ModelMeIdentityPool-${stage}`, {
        allowUnauthenticatedIdentities: false,
        cognitoIdentityProviders: [
          {
            clientId: userPoolClient.userPoolClientId,
            providerName: userPool.userPoolProviderName,
          },
        ],
        
      });

    return [ userPool, userPoolClient, identityPool ];
}
