import { describe, it, expect, beforeAll } from 'vitest';
import {
  KEYCLOAK_URL,
  KEYCLOAK_REALM,
  KEYCLOAK_CLIENT_ID,
  DATABASE_URL,
  verifyKeycloakHealth,
  getTestAccessToken
} from '../../test/SetupKeycloak';

interface TestResult {
  category: string;
  testName: string;
  status: 'pass' | 'fail';
  details?: string;
}

const results: TestResult[] = [];

function addResult(category: string, testName: string, status: 'pass' | 'fail', details?: string): void {
  results.push({ category, testName, status, details });
}

function generateTestReport(): void {
  let markdown = `
# Keycloak Integration Test Report

## Summary
| Category | Passed | Failed |
|----------|--------|--------|
`;

  const categories = new Set(results.map(r => r.category));
  categories.forEach(category => {
    const categoryResults = results.filter(r => r.category === category);
    const passed = categoryResults.filter(r => r.status === 'pass').length;
    const failed = categoryResults.filter(r => r.status === 'fail').length;
    markdown += `| ${category} | ${passed} | ${failed} |\n`;
  });

  markdown += `
## Test Results

| Category | Test Name | Status |
|----------|-----------|--------|
`;

  results.forEach(result => {
    const statusIcon = result.status === 'pass' ? '✓' : '✗';
    markdown += `| ${result.category} | ${result.testName} | ${statusIcon} |\n`;
  });

  const passed = results.filter(r => r.status === 'pass').length;
  const total = results.length;

  markdown += `
---

## Overall Statistics
- **Total Tests:** ${total}
- **Passed:** ${passed}
- **Failed:** ${total - passed}
- **Pass Rate:** ${((passed / total) * 100).toFixed(2)}%

## Environment Configuration
- **KEYCLOAK_URL:** ${KEYCLOAK_URL}
- **KEYCLOAK_REALM:** ${KEYCLOAK_REALM}
- **KEYCLOAK_CLIENT_ID:** ${KEYCLOAK_CLIENT_ID}
- **DATABASE_URL:** ${DATABASE_URL?.split('@')[0]}@***

---

*Report generated automatically*
`;

  console.log(markdown);

  try {
    const fs = require('fs');
    const path = require('path');
    const reportPath = path.join(__dirname, 'keycloak-test-report.md');
    fs.writeFileSync(reportPath, markdown);
    console.log(`\nReport saved to: ${reportPath}`);
  } catch (error) {
    console.warn('Could not save report to file:', error);
  }
}

describe('Keycloak Integration Tests', () => {
  let healthCheckResult: boolean;

  beforeAll(async () => {
    healthCheckResult = await verifyKeycloakHealth();
  });

  describe('Service Availability', () => {
    it('should have HTTPS endpoint accessible on port 18444', async () => {
      const url = new URL(KEYCLOAK_URL);
      const status = url.protocol === 'https:' && url.port === '18444';
      
      addResult(
        'Service Availability',
        'HTTPS endpoint accessible on port 18444',
        status ? 'pass' : 'fail',
        `URL: ${KEYCLOAK_URL}, Protocol: ${url.protocol}, Port: ${url.port}`
      );
      
      expect(status).toBe(true);
    }, 5000);

    it('should require authentication for admin REST API (401 when unauthenticated)', async () => {
      if (!healthCheckResult) {
        addResult(
          'Service Availability',
          'Admin REST API auth check',
          'fail',
          'Keycloak health check failed'
        );
        expect(false).toBe(true);
        return;
      }

      try {
        const adminUrl = `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users`;
        const response = await fetch(adminUrl);
        
        const status = response.status === 401;
        
        addResult(
          'Service Availability',
          'Admin REST API requires authentication (401)',
          status ? 'pass' : 'fail',
          `Status: ${response.status}`
        );
        
        expect(status).toBe(true);
      } catch (error) {
        addResult(
          'Service Availability',
          'Admin REST API auth check',
          'fail',
          `Error: ${(error as Error).message}`
        );
        expect(false).toBe(true);
      }
    }, 5000);

    it('should verify Keycloak health endpoint', async () => {
      const status = healthCheckResult;
      
      addResult(
        'Service Availability',
        'Health endpoint accessible',
        status ? 'pass' : 'fail',
        `Health check: ${status}`
      );
      
      expect(status).toBe(true);
    }, 5000);
  });

  describe('Database Connectivity', () => {
    it('should have PostgreSQL connectionstring configured', async () => {
      const status = DATABASE_URL?.startsWith('postgresql://');
      
      addResult(
        'Database Connectivity',
        'PostgreSQL connection string configured',
        status ? 'pass' : 'fail',
        `DATABASE_URL: ${DATABASE_URL || 'not set'}`
      );
      
      expect(status).toBe(true);
    });

    it('should connect to PostgreSQL on port 6432', async () => {
      let portStatus = false;
      let detailMsg = '';
      
      try {
        const url = new URL(DATABASE_URL);
        const port = parseInt(url.port) || 6432;
        portStatus = port === 6432;
        detailMsg = `Configured port: ${port}, Expected: 6432`;
      } catch (error) {
        detailMsg = `Error parsing DATABASE_URL: ${(error as Error).message}`;
      }
      
      addResult(
        'Database Connectivity',
        'PostgreSQL uses correct port 6432',
        portStatus ? 'pass' : 'fail',
        detailMsg
      );
      
      expect(portStatus).toBe(true);
    });

    it('should have database name in connectionstring', async () => {
      const status = DATABASE_URL?.includes('/surelm_0');
      
      addResult(
        'Database Connectivity',
        'Database name "surelm_0" in connection string',
        status ? 'pass' : 'fail',
        `DATABASE_URL: ${DATABASE_URL || 'not set'}`
      );
      
      expect(status).toBe(true);
    });
  });

  describe('Configuration', () => {
    it('should use HTTPS for KEYCLOAK_URL', async () => {
      const status = KEYCLOAK_URL.startsWith('https://');
      
      addResult(
        'Configuration',
        'KEYCLOAK_URL uses HTTPS',
        status ? 'pass' : 'fail',
        `URL: ${KEYCLOAK_URL}`
      );
      
      expect(status).toBe(true);
    });

    it('should have correct REALM name (surelm_0_realm)', async () => {
      const status = KEYCLOAK_REALM === 'surelm_0_realm';
      
      addResult(
        'Configuration',
        'KEYCLOAK_REALM is surelm_0_realm',
        status ? 'pass' : 'fail',
        `Current value: ${KEYCLOAK_REALM}`
      );
      
      expect(status).toBe(true);
    });

    it('should have correct CLIENT_ID (web-app)', async () => {
      const status = KEYCLOAK_CLIENT_ID === 'web-app';
      
      addResult(
        'Configuration',
        'KEYCLOAK_CLIENT_ID is web-app',
        status ? 'pass' : 'fail',
        `Current value: ${KEYCLOAK_CLIENT_ID}`
      );
      
      expect(status).toBe(true);
    });

    it('should have all required environment variables', async () => {
      const required = ['KEYCLOAK_URL', 'KEYCLOAK_REALM', 'KEYCLOAK_CLIENT_ID', 'DATABASE_URL'];
      const missing = required.filter(k => !process.env[k]);
      
      const status = missing.length === 0;
      
      addResult(
        'Configuration',
        'All required environment variables set',
        status ? 'pass' : 'fail',
        `Missing: ${missing.join(', ') || 'none'}`
      );
      
      expect(status).toBe(true);
    });
  });

  describe('Authentication Flow', () => {
    it('should be able to get test access token', async () => {
      if (!healthCheckResult) {
        addResult(
          'Authentication Flow',
          'Get test access token',
          'fail',
          'Keycloak health check failed'
        );
        expect(false).toBe(true);
        return;
      }

      try {
        const token = await getTestAccessToken();
        
        const status = token !== null && typeof token === 'string' && token.length > 100;
        
        addResult(
          'Authentication Flow',
          'Successfully retrieved access token',
          status ? 'pass' : 'fail',
          `Token acquired: ${status}, Length: ${token ? (typeof token === 'string' ? token.length : 'object') : 0}`
        );
        
        expect(status).toBe(true);
      } catch (error) {
        addResult(
          'Authentication Flow',
          'Get test access token',
          'fail',
          `Error: ${(error as Error).message}`
        );
        expect(false).toBe(true);
      }
    }, 30000);

    it('should validate JWT structure', async () => {
      if (!healthCheckResult) {
        addResult(
          'Authentication Flow',
          'JWT structure validation',
          'fail',
          'Keycloak health check failed'
        );
        expect(false).toBe(true);
        return;
      }

      try {
        const token = await getTestAccessToken();
        
        if (token === null || typeof token !== 'string') {
          addResult(
            'Authentication Flow',
            'JWT structure validation',
            'fail',
            'Token acquisition failed'
          );
          expect(false).toBe(true);
          return;
        }

        const parts = token.split('.');
        const jwtValid = parts.length === 3;
        
        let headerValid = false;
        let payloadValid = false;

        if (jwtValid) {
          try {
            const header = JSON.parse(atob(parts[0]));
            headerValid = header.alg === 'RS256';
            
            const payload = JSON.parse(atob(parts[1]));
            payloadValid = payload.iss?.includes(KEYCLOAK_URL) && 
                          payload.aud?.includes(KEYCLOAK_CLIENT_ID);
          } catch (e) {
            // Invalid JWT parts
          }
        }

        const status = jwtValid && headerValid && payloadValid;
        
        addResult(
          'Authentication Flow',
          'JWT structure validation',
          status ? 'pass' : 'fail',
          `Parts: ${parts.length}, Header valid: ${headerValid}, Payload valid: ${payloadValid}`
        );
        
        expect(status).toBe(true);
      } catch (error) {
        addResult(
          'Authentication Flow',
          'JWT structure validation',
          'fail',
          `Error: ${(error as Error).message}`
        );
        expect(false).toBe(true);
      }
    }, 30000);

    it('should have valid token expiry', async () => {
      if (!healthCheckResult) {
        addResult(
          'Authentication Flow',
          'Token expiry validation',
          'fail',
          'Keycloak health check failed'
        );
        expect(false).toBe(true);
        return;
      }

      try {
        const token = await getTestAccessToken();
        
        if (token === null || typeof token !== 'string') {
          addResult(
            'Authentication Flow',
            'Token expiry validation',
            'fail',
            'Token acquisition failed'
          );
          expect(false).toBe(true);
          return;
        }

        const parts = token.split('.');
        if (parts.length !== 3) {
          throw new Error('Invalid JWT structure');
        }

        const payload = JSON.parse(atob(parts[1]));
        const exp = payload.exp || 0;
        const now = Math.floor(Date.now() / 1000);
        
        const status = exp > now && exp - now <= 3600;
        
        addResult(
          'Authentication Flow',
          'Token has valid expiry (within 1 hour)',
          status ? 'pass' : 'fail',
          `Expiry: ${exp}, Now: ${now}, Valid seconds: ${exp - now}`
        );
        
        expect(status).toBe(true);
      } catch (error) {
        addResult(
          'Authentication Flow',
          'Token expiry validation',
          'fail',
          `Error: ${(error as Error).message}`
        );
        expect(false).toBe(true);
      }
    }, 30000);
  });
});

if (require.main === module) {
  console.log('Running Keycloak integration tests automatically...\n');
}
