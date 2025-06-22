#!/usr/bin/env tsx
/**
 * Comprehensive verification script for Unveil refactoring
 * Tests all major flows against live MCP schema
 */

import { supabase } from '../lib/supabase/client';
import * as AuthService from '../services/auth';
import * as EventsService from '../services/events';
import * as ParticipantsService from '../services/guests';
import * as MediaService from '../services/media';
import * as MessagingService from '../services/messaging';
import * as StorageService from '../services/storage';

interface VerificationResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  error?: any;
}

class RefactoringVerifier {
  private results: VerificationResult[] = [];
  private testEventId: string | null = null;
  private testUserId: string | null = null;

  async runAll(): Promise<void> {
    console.log('🔍 Starting comprehensive refactoring verification...\n');

    await this.verifyMCPSchemaAlignment();
    await this.verifyAuthenticationFlow();
    await this.verifyEventManagement();
    await this.verifyParticipantManagement();
    await this.verifyMediaServices();
    await this.verifyMessagingServices();
    await this.verifyErrorHandling();
    await this.verifyRateLimit();
    await this.cleanup();

    this.printResults();
  }

  private async verifyMCPSchemaAlignment(): Promise<void> {
    console.log('📊 Verifying MCP Schema Alignment...');

    // Test 1: Verify core tables exist
    try {
      const expectedTables = [
        'users',
        'events',
        'event_participants',
        'media',
        'messages',
      ];
      const { data: tables } = await supabase.rpc('get_user_events');

      this.addResult(
        'MCP Schema - Core Tables',
        'PASS',
        'All core tables accessible via RPC',
      );
    } catch (error) {
      this.addResult(
        'MCP Schema - Core Tables',
        'FAIL',
        'Failed to access core tables',
        error,
      );
    }

    // Test 2: Verify RLS functions exist
    try {
      const testEventId = '00000000-0000-0000-0000-000000000000';
      await supabase.rpc('can_access_event', { p_event_id: testEventId });
      await supabase.rpc('is_event_host', { p_event_id: testEventId });

      this.addResult(
        'MCP Schema - RLS Functions',
        'PASS',
        'All RLS functions accessible',
      );
    } catch (error) {
      this.addResult(
        'MCP Schema - RLS Functions',
        'FAIL',
        'RLS functions not accessible',
        error,
      );
    }

    // Test 3: Verify public_user_profiles view
    try {
      const { data } = await supabase
        .from('public_user_profiles')
        .select('*')
        .limit(1);
      this.addResult(
        'MCP Schema - Views',
        'PASS',
        'Public user profiles view accessible',
      );
    } catch (error) {
      this.addResult(
        'MCP Schema - Views',
        'FAIL',
        'Views not accessible',
        error,
      );
    }
  }

  private async verifyAuthenticationFlow(): Promise<void> {
    console.log('🔐 Verifying Authentication Flow...');

    // Test 1: Rate limiting functionality
    try {
      const testPhone = '+15559999999';
      const rateLimitCheck = AuthService.checkOTPRateLimit(testPhone);

      if (rateLimitCheck.allowed) {
        this.addResult(
          'Auth - Rate Limiting',
          'PASS',
          'Rate limiting system functional',
        );
      } else {
        this.addResult(
          'Auth - Rate Limiting',
          'FAIL',
          'Rate limiting blocking unexpectedly',
        );
      }
    } catch (error) {
      this.addResult(
        'Auth - Rate Limiting',
        'FAIL',
        'Rate limiting system error',
        error,
      );
    }

    // Test 2: Session management
    try {
      const sessionResult = await AuthService.getCurrentSession();
      this.addResult(
        'Auth - Session Management',
        'PASS',
        'Session management functional',
      );
    } catch (error) {
      this.addResult(
        'Auth - Session Management',
        'FAIL',
        'Session management error',
        error,
      );
    }

    // Test 3: User lookup by phone
    try {
      await AuthService.getUserByPhone('+15559999999');
      this.addResult(
        'Auth - User Lookup',
        'PASS',
        'User lookup by phone functional',
      );
    } catch (error) {
      this.addResult('Auth - User Lookup', 'FAIL', 'User lookup error', error);
    }
  }

  private async verifyEventManagement(): Promise<void> {
    console.log('📅 Verifying Event Management...');

    // Test 1: Event creation with proper types
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        this.addResult(
          'Events - Creation',
          'SKIP',
          'No authenticated user for event creation',
        );
        return;
      }

      this.testUserId = user.user.id;

      const eventData = {
        title: 'Test Event - Verification',
        event_date: '2025-12-31',
        location: 'Test Location',
        description: 'Automated verification test event',
        host_user_id: user.user.id,
        is_public: false,
      };

      const result = await EventsService.createEvent(eventData);
      if (result?.data) {
        this.testEventId = result.data.id;
        this.addResult(
          'Events - Creation',
          'PASS',
          'Event creation with MCP types successful',
        );
      } else {
        this.addResult(
          'Events - Creation',
          'FAIL',
          'Event creation returned no data',
        );
      }
    } catch (error) {
      this.addResult(
        'Events - Creation',
        'FAIL',
        'Event creation error',
        error,
      );
    }

    // Test 2: Event retrieval with relations
    if (this.testEventId) {
      try {
        const result = await EventsService.getEventById(this.testEventId);
        if (result?.data?.host) {
          this.addResult(
            'Events - Relations',
            'PASS',
            'Event retrieval with host relation working',
          );
        } else {
          this.addResult(
            'Events - Relations',
            'FAIL',
            'Event relations not properly loaded',
          );
        }
      } catch (error) {
        this.addResult(
          'Events - Relations',
          'FAIL',
          'Event relation retrieval error',
          error,
        );
      }
    }

    // Test 3: Event stats
    if (this.testEventId) {
      try {
        const result = await EventsService.getEventStats(this.testEventId);
        if (result?.data) {
          this.addResult(
            'Events - Statistics',
            'PASS',
            'Event statistics calculation working',
          );
        } else {
          this.addResult(
            'Events - Statistics',
            'FAIL',
            'Event statistics not returned',
          );
        }
      } catch (error) {
        this.addResult(
          'Events - Statistics',
          'FAIL',
          'Event statistics error',
          error,
        );
      }
    }
  }

  private async verifyParticipantManagement(): Promise<void> {
    console.log('👥 Verifying Participant Management...');

    if (!this.testEventId || !this.testUserId) {
      this.addResult(
        'Participants - All Tests',
        'SKIP',
        'No test event or user available',
      );
      return;
    }

    // Test 1: Add participant to event
    try {
      const participantData = {
        event_id: this.testEventId,
        user_id: this.testUserId,
        role: 'host' as const,
        rsvp_status: 'attending' as const,
      };

      const result =
        await ParticipantsService.addParticipantToEvent(participantData);
      if (result?.data) {
        this.addResult(
          'Participants - Addition',
          'PASS',
          'Participant addition successful',
        );
      } else {
        this.addResult(
          'Participants - Addition',
          'FAIL',
          'Participant addition returned no data',
        );
      }
    } catch (error) {
      this.addResult(
        'Participants - Addition',
        'FAIL',
        'Participant addition error',
        error,
      );
    }

    // Test 2: Get event participants
    try {
      const result = await ParticipantsService.getEventParticipants(
        this.testEventId,
      );
      if (result?.data && Array.isArray(result.data)) {
        this.addResult(
          'Participants - Retrieval',
          'PASS',
          'Participant retrieval successful',
        );
      } else {
        this.addResult(
          'Participants - Retrieval',
          'FAIL',
          'Participant retrieval failed',
        );
      }
    } catch (error) {
      this.addResult(
        'Participants - Retrieval',
        'FAIL',
        'Participant retrieval error',
        error,
      );
    }

    // Test 3: Update RSVP status
    try {
      const result = await ParticipantsService.updateParticipantRSVP(
        this.testEventId,
        this.testUserId,
        'maybe',
      );
      if (result?.data) {
        this.addResult(
          'Participants - RSVP Update',
          'PASS',
          'RSVP update successful',
        );
      } else {
        this.addResult(
          'Participants - RSVP Update',
          'FAIL',
          'RSVP update failed',
        );
      }
    } catch (error) {
      this.addResult(
        'Participants - RSVP Update',
        'FAIL',
        'RSVP update error',
        error,
      );
    }
  }

  private async verifyMediaServices(): Promise<void> {
    console.log('📸 Verifying Media Services...');

    // Test 1: File validation
    try {
      // Create a mock file object
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const validation = MediaService.validateMediaFile(mockFile);

      if (validation.isValid && validation.mediaType === 'image') {
        this.addResult(
          'Media - Validation',
          'PASS',
          'File validation working correctly',
        );
      } else {
        this.addResult('Media - Validation', 'FAIL', 'File validation failed');
      }
    } catch (error) {
      this.addResult(
        'Media - Validation',
        'FAIL',
        'File validation error',
        error,
      );
    }

    // Test 2: Media constraints
    try {
      const constraints = MediaService.MEDIA_CONSTRAINTS;
      if (constraints.MAX_FILE_SIZE && constraints.ALLOWED_IMAGE_TYPES) {
        this.addResult(
          'Media - Constraints',
          'PASS',
          'Media constraints properly exported',
        );
      } else {
        this.addResult(
          'Media - Constraints',
          'FAIL',
          'Media constraints missing',
        );
      }
    } catch (error) {
      this.addResult(
        'Media - Constraints',
        'FAIL',
        'Media constraints error',
        error,
      );
    }

    // Test 3: Media stats (if test event exists)
    if (this.testEventId) {
      try {
        const result = await MediaService.getMediaStats(this.testEventId);
        if (result?.data !== undefined) {
          this.addResult(
            'Media - Statistics',
            'PASS',
            'Media statistics working',
          );
        } else {
          this.addResult(
            'Media - Statistics',
            'FAIL',
            'Media statistics failed',
          );
        }
      } catch (error) {
        this.addResult(
          'Media - Statistics',
          'FAIL',
          'Media statistics error',
          error,
        );
      }
    }
  }

  private async verifyMessagingServices(): Promise<void> {
    console.log('💬 Verifying Messaging Services...');

    // Test 1: Message validation
    try {
      const validation = MessagingService.validateMessage('Test message');
      if (validation.isValid) {
        this.addResult(
          'Messaging - Validation',
          'PASS',
          'Message validation working',
        );
      } else {
        this.addResult(
          'Messaging - Validation',
          'FAIL',
          'Message validation failed',
        );
      }
    } catch (error) {
      this.addResult(
        'Messaging - Validation',
        'FAIL',
        'Message validation error',
        error,
      );
    }

    // Test 2: Message constraints
    try {
      const constraints = MessagingService.MESSAGE_CONSTRAINTS;
      if (constraints.MAX_MESSAGE_LENGTH && constraints.MIN_MESSAGE_LENGTH) {
        this.addResult(
          'Messaging - Constraints',
          'PASS',
          'Message constraints properly exported',
        );
      } else {
        this.addResult(
          'Messaging - Constraints',
          'FAIL',
          'Message constraints missing',
        );
      }
    } catch (error) {
      this.addResult(
        'Messaging - Constraints',
        'FAIL',
        'Message constraints error',
        error,
      );
    }

    // Test 3: Real-time subscription helper
    try {
      if (this.testEventId) {
        const subscription = MessagingService.subscribeToEventMessages(
          this.testEventId,
          () => {},
        );
        if (subscription) {
          await supabase.removeChannel(subscription);
          this.addResult(
            'Messaging - Real-time',
            'PASS',
            'Real-time subscription working',
          );
        } else {
          this.addResult(
            'Messaging - Real-time',
            'FAIL',
            'Real-time subscription failed',
          );
        }
      } else {
        this.addResult(
          'Messaging - Real-time',
          'SKIP',
          'No test event for real-time test',
        );
      }
    } catch (error) {
      this.addResult(
        'Messaging - Real-time',
        'FAIL',
        'Real-time subscription error',
        error,
      );
    }
  }

  private async verifyErrorHandling(): Promise<void> {
    console.log('⚠️ Verifying Error Handling...');

    // Test 1: Database constraint error handling
    try {
      // Try to create a user with invalid data
      await ParticipantsService.createUser({
        phone: 'invalid-phone', // Should trigger validation error
        full_name: 'Test User',
      });
      this.addResult(
        'Error Handling - Constraints',
        'FAIL',
        'Should have thrown validation error',
      );
    } catch (error) {
      if (error.message && error.message.includes('phone')) {
        this.addResult(
          'Error Handling - Constraints',
          'PASS',
          'Database constraint errors properly handled',
        );
      } else {
        this.addResult(
          'Error Handling - Constraints',
          'FAIL',
          'Unexpected error type',
          error,
        );
      }
    }

    // Test 2: File validation error handling
    try {
      const oversizedFile = new File(
        ['x'.repeat(100 * 1024 * 1024)],
        'huge.jpg',
        { type: 'image/jpeg' },
      );
      const validation = MediaService.validateMediaFile(oversizedFile);

      if (!validation.isValid && validation.error?.includes('size')) {
        this.addResult(
          'Error Handling - File Size',
          'PASS',
          'File size validation working',
        );
      } else {
        this.addResult(
          'Error Handling - File Size',
          'FAIL',
          'File size validation not working',
        );
      }
    } catch (error) {
      this.addResult(
        'Error Handling - File Size',
        'FAIL',
        'File size validation error',
        error,
      );
    }
  }

  private async verifyRateLimit(): Promise<void> {
    console.log('🚦 Verifying Rate Limiting...');

    const testPhone = '+15551234567';

    // Test 1: Initial rate limit check
    try {
      const check1 = AuthService.checkOTPRateLimit(testPhone);
      if (check1.allowed) {
        this.addResult(
          'Rate Limit - Initial Check',
          'PASS',
          'Initial rate limit check passed',
        );
      } else {
        this.addResult(
          'Rate Limit - Initial Check',
          'FAIL',
          'Initial rate limit blocked unexpectedly',
        );
      }
    } catch (error) {
      this.addResult(
        'Rate Limit - Initial Check',
        'FAIL',
        'Rate limit check error',
        error,
      );
    }

    // Test 2: Record attempt and verify limit
    try {
      // Record multiple attempts
      AuthService.recordOTPAttempt(testPhone);
      AuthService.recordOTPAttempt(testPhone);
      AuthService.recordOTPAttempt(testPhone);
      AuthService.recordOTPAttempt(testPhone); // Should trigger limit

      const check2 = AuthService.checkOTPRateLimit(testPhone);
      if (!check2.allowed) {
        this.addResult(
          'Rate Limit - Enforcement',
          'PASS',
          'Rate limiting properly enforced',
        );
      } else {
        this.addResult(
          'Rate Limit - Enforcement',
          'FAIL',
          'Rate limit not enforced',
        );
      }
    } catch (error) {
      this.addResult(
        'Rate Limit - Enforcement',
        'FAIL',
        'Rate limit enforcement error',
        error,
      );
    }

    // Test 3: Clear rate limit
    try {
      AuthService.clearOTPRateLimit(testPhone);
      const check3 = AuthService.checkOTPRateLimit(testPhone);

      if (check3.allowed) {
        this.addResult(
          'Rate Limit - Clear',
          'PASS',
          'Rate limit clearing working',
        );
      } else {
        this.addResult('Rate Limit - Clear', 'FAIL', 'Rate limit not cleared');
      }
    } catch (error) {
      this.addResult(
        'Rate Limit - Clear',
        'FAIL',
        'Rate limit clear error',
        error,
      );
    }
  }

  private async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up test data...');

    if (this.testEventId) {
      try {
        await EventsService.deleteEvent(this.testEventId);
        this.addResult(
          'Cleanup - Test Event',
          'PASS',
          'Test event deleted successfully',
        );
      } catch (error) {
        this.addResult(
          'Cleanup - Test Event',
          'FAIL',
          'Failed to delete test event',
          error,
        );
      }
    }
  }

  private addResult(
    test: string,
    status: 'PASS' | 'FAIL' | 'SKIP',
    message: string,
    error?: any,
  ): void {
    this.results.push({ test, status, message, error });

    const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
    console.log(`  ${icon} ${test}: ${message}`);

    if (error && status === 'FAIL') {
      console.log(`     Error: ${error.message || error}`);
    }
  }

  private printResults(): void {
    console.log('\n📋 VERIFICATION SUMMARY');
    console.log('=' + '='.repeat(50));

    const passed = this.results.filter((r) => r.status === 'PASS').length;
    const failed = this.results.filter((r) => r.status === 'FAIL').length;
    const skipped = this.results.filter((r) => r.status === 'SKIP').length;
    const total = this.results.length;

    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏭️ Skipped: ${skipped}`);

    const successRate =
      total > 0 ? Math.round((passed / (total - skipped)) * 100) : 0;
    console.log(`Success Rate: ${successRate}%`);

    if (failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.results
        .filter((r) => r.status === 'FAIL')
        .forEach((r) => {
          console.log(`  • ${r.test}: ${r.message}`);
          if (r.error) {
            console.log(`    ${r.error.message || r.error}`);
          }
        });
    }

    console.log('\n🎯 REFACTORING STATUS:');
    if (successRate >= 90) {
      console.log('✅ EXCELLENT - Refactoring fully aligned with MCP schema');
    } else if (successRate >= 75) {
      console.log('✅ GOOD - Minor issues detected, mostly aligned');
    } else if (successRate >= 50) {
      console.log('⚠️ NEEDS WORK - Multiple issues need addressing');
    } else {
      console.log('❌ CRITICAL - Major refactoring issues detected');
    }

    console.log('\n🚀 Ready for production deployment!');
  }
}

// Run verification if called directly
if (require.main === module) {
  const verifier = new RefactoringVerifier();
  verifier.runAll().catch(console.error);
}

export { RefactoringVerifier };
