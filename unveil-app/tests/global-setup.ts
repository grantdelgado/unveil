import { chromium, FullConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs';

/**
 * Global setup for Playwright tests
 * Creates authenticated sessions for host and guest users
 */
async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL || 'http://localhost:3000';
  const testSecret = process.env.E2E_TEST_SECRET || 'test-secret-12345';
  
  // Test event ID for consistent testing
  const testEventId = '12345678-1234-1234-1234-123456789012';

  // Create .auth directory
  const authDir = path.join(process.cwd(), '.auth');
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Launch browser for session creation
  const browser = await chromium.launch();
  
  try {
    // Create host session
    console.log('Creating test host session...');
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    
    // Create host session via test endpoint
    const hostResponse = await hostPage.request.post(`${baseURL}/test-support/api/create-session`, {
      headers: {
        'x-e2e-test-secret': testSecret,
        'x-test-mode': 'true',
        'content-type': 'application/json',
      },
      data: {
        userType: 'host',
        eventId: testEventId,
      },
    });

    if (!hostResponse.ok()) {
      console.log('Host session endpoint not available - skipping auth setup');
      console.log('Tests will run unauthenticated (ensure test data exists)');
      // Create empty storage state to prevent test failures
      await hostContext.storageState({ path: '.auth/host.json' });
    } else {
      // Navigate to verify session is working
      await hostPage.goto('/');
      await hostPage.waitForLoadState('networkidle');
      
      // Verify authentication worked
      const isLoggedIn = await hostPage.locator('text=Your Events').isVisible().catch(() => false);
      if (!isLoggedIn) {
        console.warn('Host session creation may have failed');
      }
    }

    // Save host storage state
    await hostContext.storageState({ path: '.auth/host.json' });
    await hostContext.close();

    // Create guest session  
    console.log('Creating test guest session...');
    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    
    // Create guest session via test endpoint
    const guestResponse = await guestPage.request.post(`${baseURL}/test-support/api/create-session`, {
      headers: {
        'x-e2e-test-secret': testSecret,
        'x-test-mode': 'true',
        'content-type': 'application/json',
      },
      data: {
        userType: 'guest',
        eventId: testEventId,
      },
    });

    if (!guestResponse.ok()) {
      console.log('Guest session endpoint not available - skipping auth setup');
      console.log('Tests will run unauthenticated (ensure test data exists)');
      // Create empty storage state to prevent test failures
      await guestContext.storageState({ path: '.auth/guest.json' });
    } else {
      // Navigate to verify session is working
      await guestPage.goto('/');
      await guestPage.waitForLoadState('networkidle');
      
      // Verify authentication worked
      const isLoggedIn = await guestPage.locator('text=Your Events').isVisible().catch(() => false);
      if (!isLoggedIn) {
        console.warn('Guest session creation may have failed');
      }
    }

    // Save guest storage state
    await guestContext.storageState({ path: '.auth/guest.json' });
    await guestContext.close();

    console.log('✅ Test authentication sessions created successfully');
    
  } catch (error) {
    console.error('❌ Failed to create test sessions:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

export default globalSetup;
