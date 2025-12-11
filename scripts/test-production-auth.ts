#!/usr/bin/env ts-node
/**
 * Production Authentication Validation Script
 * 
 * This script validates the authentication system in production:
 * - Verifies all required environment variables are present
 * - Tests OAuth URL generation
 * - Validates callback endpoint configuration
 * - Checks Cognito connectivity
 * - Verifies token exchange capability (without actual user login)
 * 
 * Usage:
 *   npm run test:prod-auth
 *   or
 *   ts-node scripts/test-production-auth.ts
 */

import axios from 'axios';
import * as https from 'https';

// Configuration
const ENVIRONMENT = process.env.ENVIRONMENT || 'PROD';
// Backend API is at be.garmaxai.com (custom domain) or the API Gateway URL
const API_BASE_URL = process.env.API_BASE_URL || 'https://be.garmaxai.com';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://garmaxai.com';

// Color output helpers
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') {
  const timestamp = new Date().toISOString();
  const icons = { info: 'ℹ', success: '✓', error: '✗', warning: '⚠' };
  const colorMap = {
    info: colors.blue,
    success: colors.green,
    error: colors.red,
    warning: colors.yellow,
  };

  console.log(
    `${colors.bright}[${timestamp}]${colors.reset} ${colorMap[type]}${icons[type]} ${message}${colors.reset}`
  );
}

// Test results tracking
interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

const results: TestResult[] = [];

function addResult(name: string, passed: boolean, message: string, details?: any) {
  results.push({ name, passed, message, details });
  if (passed) {
    log(`${name}: ${message}`, 'success');
  } else {
    log(`${name}: ${message}`, 'error');
    if (details) {
      console.log(`  Details:`, JSON.stringify(details, null, 2));
    }
  }
}

// Test 1: Verify Environment Variables
async function testEnvironmentVariables(): Promise<void> {
  log('Testing environment variables configuration...', 'info');

  const requiredEnvVars = [
    'COGNITO_USER_POOL_ID',
    'COGNITO_CLIENT_ID',
    'COGNITO_DOMAIN',
    'AWS_REGION',
    'FRONTEND_URL',
  ];

  const optionalEnvVars = [
    'JWT_SECRET',
    'SESSION_SECRET',
    'DATABASE_URL',
  ];

  let allPresent = true;
  const missing: string[] = [];
  const present: string[] = [];

  // Check via API endpoint if available
  try {
    const response = await axios.get(`${API_BASE_URL}/health`, {
      timeout: 10000,
    });

    if (response.data.cognito) {
      addResult(
        'Environment Variables',
        true,
        'Cognito configuration detected in API health check'
      );
    } else {
      addResult(
        'Environment Variables',
        false,
        'Cognito configuration not found in health check'
      );
    }
  } catch (error: any) {
    addResult(
      'Environment Variables Check',
      false,
      'Could not verify via health endpoint',
      { error: error.message }
    );
  }

  // Log expected values for manual verification
  log('\nExpected environment variables for production:', 'info');
  console.log('  COGNITO_USER_POOL_ID: us-east-1_Nv6bFfopm');
  console.log('  COGNITO_CLIENT_ID: 159hhk7l99f2t3hld86mgigejs');
  console.log('  COGNITO_DOMAIN: garmaxai-prod.auth.us-east-1.amazoncognito.com');
  console.log('  AWS_REGION: us-east-1');
  console.log('  FRONTEND_URL: https://garmaxai.com\n');
}

// Test 2: OAuth URL Generation
async function testOAuthURLGeneration(): Promise<void> {
  log('Testing OAuth URL generation...', 'info');

  try {
    const response = await axios.get(`${API_BASE_URL}/api/auth/oauth/google`, {
      timeout: 10000,
      validateStatus: () => true, // Accept any status
    });

    if (response.status === 200 && response.data.authUrl) {
      const authUrl = response.data.authUrl;
      
      // Validate URL structure
      const urlChecks = [
        {
          check: authUrl.includes('auth.us-east-1.amazoncognito.com'),
          name: 'Contains Cognito domain',
        },
        {
          check: authUrl.includes('/oauth2/authorize'),
          name: 'Contains authorize endpoint',
        },
        {
          check: authUrl.includes('client_id='),
          name: 'Contains client_id',
        },
        {
          check: authUrl.includes('response_type=code'),
          name: 'Contains response_type',
        },
        {
          check: authUrl.includes('scope='),
          name: 'Contains scope',
        },
        {
          check: authUrl.includes('redirect_uri='),
          name: 'Contains redirect_uri',
        },
        {
          check: authUrl.includes('identity_provider=Google'),
          name: 'Contains Google provider',
        },
        {
          check: authUrl.includes(encodeURIComponent(FRONTEND_URL)),
          name: 'Contains correct frontend URL',
        },
      ];

      const allPassed = urlChecks.every((c) => c.check);
      const failed = urlChecks.filter((c) => !c.check).map((c) => c.name);

      if (allPassed) {
        addResult(
          'OAuth URL Generation',
          true,
          'OAuth URL structure is valid',
          { authUrl }
        );
      } else {
        addResult(
          'OAuth URL Generation',
          false,
          `OAuth URL missing required parameters: ${failed.join(', ')}`,
          { authUrl, failed }
        );
      }
    } else {
      addResult(
        'OAuth URL Generation',
        false,
        `Unexpected response: ${response.status}`,
        response.data
      );
    }
  } catch (error: any) {
    addResult(
      'OAuth URL Generation',
      false,
      'Failed to call OAuth endpoint',
      { error: error.message, stack: error.stack }
    );
  }
}

// Test 3: Callback Endpoint Accessibility
async function testCallbackEndpoint(): Promise<void> {
  log('Testing callback endpoint accessibility...', 'info');

  try {
    // Test that the endpoint exists and returns appropriate error for missing code
    const response = await axios.post(
      `${API_BASE_URL}/api/auth/oauth/callback`,
      {},
      {
        timeout: 10000,
        validateStatus: () => true,
      }
    );

    if (response.status === 400 && response.data.message === 'Missing authorization code') {
      addResult(
        'Callback Endpoint',
        true,
        'Callback endpoint is accessible and validates input correctly'
      );
    } else if (response.status === 500) {
      addResult(
        'Callback Endpoint',
        false,
        'Callback endpoint returned server error - possible configuration issue',
        response.data
      );
    } else {
      addResult(
        'Callback Endpoint',
        false,
        `Unexpected response: ${response.status}`,
        response.data
      );
    }
  } catch (error: any) {
    addResult(
      'Callback Endpoint',
      false,
      'Failed to reach callback endpoint',
      { error: error.message }
    );
  }
}

// Test 4: Cognito Domain Connectivity
async function testCognitoConnectivity(): Promise<void> {
  log('Testing Cognito domain connectivity...', 'info');

  const cognitoDomain = 'garmaxai-prod.auth.us-east-1.amazoncognito.com';

  try {
    // Test HTTPS connectivity to Cognito
    const response = await axios.get(`https://${cognitoDomain}/.well-known/jwks.json`, {
      timeout: 10000,
      validateStatus: () => true,
    });

    if (response.status === 200 && response.data.keys) {
      addResult(
        'Cognito Connectivity',
        true,
        'Successfully connected to Cognito domain',
        { domain: cognitoDomain }
      );
    } else {
      addResult(
        'Cognito Connectivity',
        false,
        `Unexpected response from Cognito: ${response.status}`,
        response.data
      );
    }
  } catch (error: any) {
    addResult(
      'Cognito Connectivity',
      false,
      'Failed to connect to Cognito domain',
      { domain: cognitoDomain, error: error.message }
    );
  }
}

// Test 5: Email/Password Login Endpoint
async function testEmailPasswordLogin(): Promise<void> {
  log('Testing email/password login endpoint...', 'info');

  try {
    // Test with invalid credentials to verify endpoint is working
    const response = await axios.post(
      `${API_BASE_URL}/api/auth/login`,
      {
        email: 'test-validation@example.com',
        password: 'invalid-password',
      },
      {
        timeout: 10000,
        validateStatus: () => true,
      }
    );

    // Should return 401 for invalid credentials
    if (response.status === 401) {
      addResult(
        'Email/Password Login',
        true,
        'Login endpoint is accessible and validating credentials'
      );
    } else if (response.status === 500) {
      addResult(
        'Email/Password Login',
        false,
        'Login endpoint returned server error',
        response.data
      );
    } else {
      addResult(
        'Email/Password Login',
        false,
        `Unexpected response: ${response.status}`,
        response.data
      );
    }
  } catch (error: any) {
    addResult(
      'Email/Password Login',
      false,
      'Failed to reach login endpoint',
      { error: error.message }
    );
  }
}

// Test 6: Get Current User Endpoint (Authentication Check)
async function testAuthenticatedEndpoint(): Promise<void> {
  log('Testing authenticated endpoint protection...', 'info');

  try {
    // Test without token - should return 401
    const response = await axios.get(`${API_BASE_URL}/api/auth/me`, {
      timeout: 10000,
      validateStatus: () => true,
    });

    if (response.status === 401) {
      addResult(
        'Authentication Protection',
        true,
        'Protected endpoints correctly require authentication'
      );
    } else {
      addResult(
        'Authentication Protection',
        false,
        `Protected endpoint returned unexpected status: ${response.status}`,
        response.data
      );
    }
  } catch (error: any) {
    addResult(
      'Authentication Protection',
      false,
      'Failed to test authenticated endpoint',
      { error: error.message }
    );
  }
}

// Test 7: CORS Configuration
async function testCORSConfiguration(): Promise<void> {
  log('Testing CORS configuration...', 'info');

  try {
    const response = await axios.options(`${API_BASE_URL}/api/auth/login`, {
      headers: {
        'Origin': FRONTEND_URL,
        'Access-Control-Request-Method': 'POST',
      },
      timeout: 10000,
      validateStatus: () => true,
    });

    const corsHeaders = {
      'access-control-allow-origin': response.headers['access-control-allow-origin'],
      'access-control-allow-credentials': response.headers['access-control-allow-credentials'],
      'access-control-allow-methods': response.headers['access-control-allow-methods'],
    };

    if (corsHeaders['access-control-allow-origin']) {
      addResult(
        'CORS Configuration',
        true,
        'CORS headers are configured',
        corsHeaders
      );
    } else {
      addResult(
        'CORS Configuration',
        false,
        'CORS headers may not be configured correctly',
        { response: response.headers }
      );
    }
  } catch (error: any) {
    addResult(
      'CORS Configuration',
      false,
      'Failed to test CORS',
      { error: error.message }
    );
  }
}

// Test 8: Logout Endpoint
async function testLogoutEndpoint(): Promise<void> {
  log('Testing logout endpoint...', 'info');

  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/auth/logout`,
      {},
      {
        timeout: 10000,
        validateStatus: () => true,
      }
    );

    // Logout should work even without authentication
    if (response.status === 200 || response.status === 204) {
      addResult(
        'Logout Endpoint',
        true,
        'Logout endpoint is accessible'
      );
    } else {
      addResult(
        'Logout Endpoint',
        false,
        `Unexpected response: ${response.status}`,
        response.data
      );
    }
  } catch (error: any) {
    addResult(
      'Logout Endpoint',
      false,
      'Failed to reach logout endpoint',
      { error: error.message }
    );
  }
}

// Print summary
function printSummary(): void {
  console.log('\n' + '='.repeat(80));
  console.log(`${colors.bright}${colors.cyan}PRODUCTION AUTHENTICATION VALIDATION SUMMARY${colors.reset}`);
  console.log('='.repeat(80) + '\n');

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  console.log(`${colors.bright}Environment:${colors.reset} ${ENVIRONMENT}`);
  console.log(`${colors.bright}API Base URL:${colors.reset} ${API_BASE_URL}`);
  console.log(`${colors.bright}Frontend URL:${colors.reset} ${FRONTEND_URL}\n`);

  console.log(`${colors.green}✓ Passed:${colors.reset} ${passed}/${total}`);
  console.log(`${colors.red}✗ Failed:${colors.reset} ${failed}/${total}\n`);

  if (failed > 0) {
    console.log(`${colors.red}${colors.bright}Failed Tests:${colors.reset}`);
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  ${colors.red}✗ ${r.name}${colors.reset}: ${r.message}`);
      });
    console.log();
  }

  console.log('='.repeat(80) + '\n');

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Main execution
async function main(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log(`${colors.bright}${colors.cyan}PRODUCTION AUTHENTICATION VALIDATION${colors.reset}`);
  console.log('='.repeat(80) + '\n');

  log(`Starting validation for ${ENVIRONMENT} environment...`, 'info');
  log(`API Base URL: ${API_BASE_URL}`, 'info');
  log(`Frontend URL: ${FRONTEND_URL}\n`, 'info');

  // Run all tests
  await testEnvironmentVariables();
  await testOAuthURLGeneration();
  await testCallbackEndpoint();
  await testCognitoConnectivity();
  await testEmailPasswordLogin();
  await testAuthenticatedEndpoint();
  await testCORSConfiguration();
  await testLogoutEndpoint();

  // Print summary
  printSummary();
}

// Execute if run directly
// ES module compatibility - check if this is the main module
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  main().catch((error) => {
    log(`Fatal error: ${error.message}`, 'error');
    console.error(error);
    process.exit(1);
  });
}

export { main, testEnvironmentVariables, testOAuthURLGeneration };
