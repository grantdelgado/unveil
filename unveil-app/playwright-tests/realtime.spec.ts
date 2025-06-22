import { test, expect, type Page, type BrowserContext } from '@playwright/test'

// Test configuration
const TEST_USER_PHONE = '+15550000001'
const TEST_EVENT_TITLE = 'Real-Time E2E Test Event'

// Helper function to authenticate a user
async function authenticateUser(page: Page, phoneNumber: string) {
  await page.goto('/login')
  
  // Enter phone number
  await page.fill('input[type="tel"]', phoneNumber)
  await page.click('button[type="submit"]')
  
  // Should redirect to select-event page
  await page.waitForURL('/select-event')
  
  // Wait for page to load
  await page.waitForSelector('text=Select Event', { timeout: 10000 })
}

// Helper function to create a test event
async function createTestEvent(page: Page) {
  await page.goto('/host/events/create')
  
  // Fill out event form
  await page.fill('input[name="title"]', TEST_EVENT_TITLE)
  await page.fill('input[name="location"]', 'Test Location')
  await page.fill('textarea[name="description"]', 'E2E Test Event Description')
  
  // Set event date to tomorrow
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const dateString = tomorrow.toISOString().split('T')[0]
  await page.fill('input[type="date"]', dateString)
  
  // Submit form
  await page.click('button[type="submit"]')
  
  // Wait for redirect to event dashboard
  await page.waitForURL(/\/host\/events\/[^/]+\/dashboard/)
  
  // Extract event ID from URL
  const url = page.url()
  const eventId = url.match(/\/host\/events\/([^/]+)\/dashboard/)?.[1]
  
  return eventId
}

// Helper function to navigate to event
async function navigateToEvent(page: Page, eventId: string, userType: 'host' | 'guest' = 'host') {
  const basePath = userType === 'host' ? '/host/events' : '/guest/events'
  await page.goto(`${basePath}/${eventId}/dashboard`)
  await page.waitForLoadState('networkidle')
}

test.describe('Real-Time Features E2E Tests', () => {
  let hostContext: BrowserContext
  let guestContext: BrowserContext
  let hostPage: Page
  let guestPage: Page
  let testEventId: string

  test.beforeAll(async ({ browser }) => {
    // Create separate browser contexts for host and guest
    hostContext = await browser.newContext()
    guestContext = await browser.newContext()
    
    hostPage = await hostContext.newPage()
    guestPage = await guestContext.newPage()
    
    // Authenticate both users
    await authenticateUser(hostPage, TEST_USER_PHONE)
    await authenticateUser(guestPage, TEST_USER_PHONE)
    
    // Create test event as host
    const eventId = await createTestEvent(hostPage)
    
    if (!eventId) {
      throw new Error('Failed to create test event')
    }
    
    testEventId = eventId
  })

  test.afterAll(async () => {
    // Clean up
    await hostContext.close()
    await guestContext.close()
  })

  test('should broadcast messages in real-time between host and guest', async () => {
    // Navigate both users to the event
    await navigateToEvent(hostPage, testEventId, 'host')
    await navigateToEvent(guestPage, testEventId, 'guest')

    // Host sends a message
    const hostMessage = 'Hello from host - real-time test'
    
    // Look for message composer on host page
    await hostPage.waitForSelector('[data-testid="message-composer"]', { timeout: 10000 })
    await hostPage.fill('[data-testid="message-input"]', hostMessage)
    await hostPage.click('[data-testid="send-message-button"]')

    // Wait for message to appear on host page
    await hostPage.waitForSelector(`text=${hostMessage}`, { timeout: 5000 })

    // Check if message appears on guest page in real-time
    await guestPage.waitForSelector(`text=${hostMessage}`, { timeout: 10000 })

    // Verify message content on both pages
    const hostMessageElement = await hostPage.textContent(`text=${hostMessage}`)
    const guestMessageElement = await guestPage.textContent(`text=${hostMessage}`)
    
    expect(hostMessageElement).toContain(hostMessage)
    expect(guestMessageElement).toContain(hostMessage)
  })

  test('should show real-time message updates', async () => {
    // Navigate to event pages
    await navigateToEvent(hostPage, testEventId, 'host')
    await navigateToEvent(guestPage, testEventId, 'guest')

    // Host sends initial message
    const initialMessage = 'Message to be edited'
    await hostPage.fill('[data-testid="message-input"]', initialMessage)
    await hostPage.click('[data-testid="send-message-button"]')

    // Wait for message to appear on both pages
    await hostPage.waitForSelector(`text=${initialMessage}`)
    await guestPage.waitForSelector(`text=${initialMessage}`)

    // Host edits the message (if edit functionality exists)
    // Note: This depends on if message editing is implemented
    const messageElement = await hostPage.locator(`text=${initialMessage}`).first()
    
    if (await messageElement.isVisible()) {
      // Try to find edit button
      const editButton = await messageElement.locator('..').locator('[data-testid="edit-message"]')
      
      if (await editButton.isVisible()) {
        await editButton.click()
        
        const updatedMessage = 'Updated message content'
        await hostPage.fill('[data-testid="edit-message-input"]', updatedMessage)
        await hostPage.click('[data-testid="save-edit-button"]')

        // Check if updated message appears on guest page
        await guestPage.waitForSelector(`text=${updatedMessage}`, { timeout: 10000 })
        
        const updatedElement = await guestPage.textContent(`text=${updatedMessage}`)
        expect(updatedElement).toContain(updatedMessage)
      }
    }
  })

  test('should handle rapid message sending without data loss', async () => {
    // Navigate to event pages
    await navigateToEvent(hostPage, testEventId, 'host')
    await navigateToEvent(guestPage, testEventId, 'guest')

    // Send multiple messages rapidly
    const messages = [
      'Rapid message 1',
      'Rapid message 2',
      'Rapid message 3',
      'Rapid message 4',
      'Rapid message 5'
    ]

    // Send all messages quickly
    for (const message of messages) {
      await hostPage.fill('[data-testid="message-input"]', message)
      await hostPage.click('[data-testid="send-message-button"]')
      // Small delay to avoid overwhelming the system
      await hostPage.waitForTimeout(100)
    }

    // Wait for all messages to appear on host page
    for (const message of messages) {
      await hostPage.waitForSelector(`text=${message}`, { timeout: 5000 })
    }

    // Check if all messages appear on guest page
    for (const message of messages) {
      await guestPage.waitForSelector(`text=${message}`, { timeout: 10000 })
      const messageElement = await guestPage.textContent(`text=${message}`)
      expect(messageElement).toContain(message)
    }
  })

  test('should broadcast media uploads in real-time', async () => {
    // Navigate to event pages
    await navigateToEvent(hostPage, testEventId, 'host')
    await navigateToEvent(guestPage, testEventId, 'guest')

    // Look for media upload section
    const mediaUploadSection = await hostPage.locator('[data-testid="media-upload"]')
    
    if (await mediaUploadSection.isVisible()) {
      // Create a test file for upload
      const testImagePath = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
      
      // Upload file (this is a simplified example)
      const fileInput = await hostPage.locator('input[type="file"]')
      
      if (await fileInput.isVisible()) {
        // Set file content
        await fileInput.setInputFiles({
          name: 'test-image.png',
          mimeType: 'image/png',
          buffer: Buffer.from(testImagePath.split(',')[1], 'base64')
        })

        // Submit upload
        const uploadButton = await hostPage.locator('[data-testid="upload-media-button"]')
        if (await uploadButton.isVisible()) {
          await uploadButton.click()

          // Wait for upload confirmation on host page
          await hostPage.waitForSelector('[data-testid="media-item"]', { timeout: 10000 })

          // Check if media appears on guest page in real-time
          await guestPage.waitForSelector('[data-testid="media-item"]', { timeout: 15000 })

          // Verify media is visible on both pages
          const hostMediaCount = await hostPage.locator('[data-testid="media-item"]').count()
          const guestMediaCount = await guestPage.locator('[data-testid="media-item"]').count()

          expect(hostMediaCount).toBeGreaterThan(0)
          expect(guestMediaCount).toBe(hostMediaCount)
        }
      }
    } else {
      // Skip test if media upload is not available on the page
      test.skip()
    }
  })

  test('should handle participant RSVP updates in real-time', async () => {
    // Navigate to event pages
    await navigateToEvent(hostPage, testEventId, 'host')
    await navigateToEvent(guestPage, testEventId, 'guest')

    // Guest updates RSVP status
    const rsvpSection = await guestPage.locator('[data-testid="rsvp-section"]')
    
    if (await rsvpSection.isVisible()) {
      // Change RSVP to "Attending"
      const attendingButton = await guestPage.locator('[data-testid="rsvp-attending"]')
      
      if (await attendingButton.isVisible()) {
        await attendingButton.click()

        // Wait for RSVP confirmation
        await guestPage.waitForSelector('[data-testid="rsvp-confirmed"]', { timeout: 5000 })

        // Check if host page shows updated participant count/status
        await hostPage.waitForSelector('[data-testid="participant-stats"]', { timeout: 10000 })
        
        // Look for indication of RSVP update (this depends on UI implementation)
        const participantStats = await hostPage.textContent('[data-testid="participant-stats"]')
        expect(participantStats).toBeTruthy()
      }
    } else {
      // Skip test if RSVP section is not available
      test.skip()
    }
  })

  test('should maintain real-time connection after network reconnection', async () => {
    // Navigate to event pages
    await navigateToEvent(hostPage, testEventId, 'host')
    await navigateToEvent(guestPage, testEventId, 'guest')

    // Send initial message to verify connection
    const beforeMessage = 'Before network interruption'
    await hostPage.fill('[data-testid="message-input"]', beforeMessage)
    await hostPage.click('[data-testid="send-message-button"]')
    
    await guestPage.waitForSelector(`text=${beforeMessage}`, { timeout: 5000 })

    // Simulate network interruption on guest page
    await guestContext.setOffline(true)
    await guestPage.waitForTimeout(2000)

    // Restore network connection
    await guestContext.setOffline(false)
    await guestPage.waitForTimeout(3000)

    // Send message after reconnection
    const afterMessage = 'After network reconnection'
    await hostPage.fill('[data-testid="message-input"]', afterMessage)
    await hostPage.click('[data-testid="send-message-button"]')

    // Verify message appears on guest page after reconnection
    await guestPage.waitForSelector(`text=${afterMessage}`, { timeout: 15000 })
    
    const reconnectedMessage = await guestPage.textContent(`text=${afterMessage}`)
    expect(reconnectedMessage).toContain(afterMessage)
  })

  test('should handle multiple concurrent users gracefully', async () => {
    // Create additional browser context for third user
    const thirdUserContext = await hostContext.browser()!.newContext()
    const thirdUserPage = await thirdUserContext.newPage()
    
    // Authenticate third user
    await authenticateUser(thirdUserPage, TEST_USER_PHONE)
    
    // Navigate all three users to the event
    await navigateToEvent(hostPage, testEventId, 'host')
    await navigateToEvent(guestPage, testEventId, 'guest')
    await navigateToEvent(thirdUserPage, testEventId, 'guest')

    // Each user sends a message
    const hostMessage = 'Message from host user'
    const guestMessage = 'Message from guest user'
    const thirdMessage = 'Message from third user'

    // Send messages from different users
    await hostPage.fill('[data-testid="message-input"]', hostMessage)
    await hostPage.click('[data-testid="send-message-button"]')

    await guestPage.fill('[data-testid="message-input"]', guestMessage)
    await guestPage.click('[data-testid="send-message-button"]')

    await thirdUserPage.fill('[data-testid="message-input"]', thirdMessage)
    await thirdUserPage.click('[data-testid="send-message-button"]')

    // Verify all messages appear on all pages
    const messages = [hostMessage, guestMessage, thirdMessage]
    const pages = [hostPage, guestPage, thirdUserPage]

    for (const page of pages) {
      for (const message of messages) {
        await page.waitForSelector(`text=${message}`, { timeout: 10000 })
        const messageElement = await page.textContent(`text=${message}`)
        expect(messageElement).toContain(message)
      }
    }

    // Clean up third user
    await thirdUserContext.close()
  })

  test('should display real-time notifications for new activity', async () => {
    // Navigate to event pages
    await navigateToEvent(hostPage, testEventId, 'host')
    await navigateToEvent(guestPage, testEventId, 'guest')

    // Check for notification center on host page
    const notificationCenter = await hostPage.locator('[data-testid="notification-center"]')
    
    if (await notificationCenter.isVisible()) {
      // Guest performs an action that should trigger notification
      const guestMessage = 'Message that should trigger notification'
      await guestPage.fill('[data-testid="message-input"]', guestMessage)
      await guestPage.click('[data-testid="send-message-button"]')

      // Wait for notification to appear on host page
      await hostPage.waitForSelector('[data-testid="new-notification"]', { timeout: 10000 })
      
      // Verify notification content
      const notification = await hostPage.textContent('[data-testid="new-notification"]')
      expect(notification).toBeTruthy()
      
      // Check notification counter
      const notificationCount = await hostPage.locator('[data-testid="notification-count"]')
      if (await notificationCount.isVisible()) {
        const count = await notificationCount.textContent()
        expect(parseInt(count || '0')).toBeGreaterThan(0)
      }
    } else {
      // Skip test if notification center is not available
      test.skip()
    }
  })

  test('should handle subscription cleanup on page navigation', async () => {
    // Navigate to event page
    await navigateToEvent(hostPage, testEventId, 'host')
    
    // Send a message to establish subscription
    const testMessage = 'Subscription cleanup test'
    await hostPage.fill('[data-testid="message-input"]', testMessage)
    await hostPage.click('[data-testid="send-message-button"]')
    
    // Wait for message to appear
    await hostPage.waitForSelector(`text=${testMessage}`)
    
    // Navigate away from the event
    await hostPage.goto('/host/dashboard')
    await hostPage.waitForLoadState('networkidle')
    
    // Navigate back to the event
    await navigateToEvent(hostPage, testEventId, 'host')
    
    // Send another message to verify subscription works
    const secondMessage = 'After navigation test'
    await hostPage.fill('[data-testid="message-input"]', secondMessage)
    await hostPage.click('[data-testid="send-message-button"]')
    
    // Verify message appears (subscription should be re-established)
    await hostPage.waitForSelector(`text=${secondMessage}`, { timeout: 5000 })
    
    const messageElement = await hostPage.textContent(`text=${secondMessage}`)
    expect(messageElement).toContain(secondMessage)
  })
}) 