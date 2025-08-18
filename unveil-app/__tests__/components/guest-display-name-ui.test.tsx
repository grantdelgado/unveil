/**
 * Tests for guest display name functionality in UI components
 * Ensures components properly use guest_display_name over guest_name
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GuestListItem } from '@/components/features/host-dashboard/GuestListItem';
import type { OptimizedGuest } from '@/hooks/guests/useGuestData';

// Mock the logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  }
}));

// Mock RSVP utilities
vi.mock('@/lib/types/rsvp', () => ({
  normalizeRSVPStatus: vi.fn((status) => status || 'pending'),
  getRSVPStatusConfig: vi.fn(() => ({
    label: 'Pending',
    color: 'gray',
    icon: '⏳'
  }))
}));

describe('Guest Display Name in UI Components', () => {
  const createMockGuest = (overrides: Partial<OptimizedGuest> = {}): OptimizedGuest => ({
    id: 'guest-1',
    event_id: 'event-1',
    user_id: null,
    guest_name: 'Default Guest Name',
    guest_email: 'guest@example.com',
    phone: '+1234567890',

    notes: null,
    guest_tags: null,
    role: 'guest',
    invited_at: null,
    phone_number_verified: false,
    sms_opt_out: false,
    preferred_communication: 'sms',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    guest_display_name: 'Default Display Name',
    users: null,
    ...overrides
  });

  describe('GuestListItem Component', () => {
    it('should display guest_display_name when available', () => {
      const guest = createMockGuest({
        guest_name: 'Original Guest Name',
        guest_display_name: 'Computed Display Name',
        users: {
          id: 'user-1',
          full_name: 'User Full Name',
          email: 'user@example.com',
          phone: '+1234567890',
          avatar_url: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          intended_redirect: null,
          onboarding_completed: true
        }
      });

      render(
        <GuestListItem 
          guest={guest}
          onRemove={vi.fn()}
        />
      );

      // Should display the computed display name, not the original guest name
      expect(screen.getByText('Computed Display Name')).toBeInTheDocument();
      expect(screen.queryByText('Original Guest Name')).not.toBeInTheDocument();
    });

    it('should fallback to users.full_name when guest_display_name is not available', () => {
      const guest = createMockGuest({
        guest_name: 'Original Guest Name',
        guest_display_name: '', // Empty display name
        users: {
          id: 'user-1',
          full_name: 'User Full Name',
          email: 'user@example.com',
          phone: '+1234567890',
          avatar_url: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          intended_redirect: null,
          onboarding_completed: true
        }
      });

      render(
        <GuestListItem 
          guest={guest}
          onRemove={vi.fn()}
        />
      );

      // Should fallback to user's full name
      expect(screen.getByText('User Full Name')).toBeInTheDocument();
    });

    it('should fallback to guest_name when both guest_display_name and users.full_name are not available', () => {
      const guest = createMockGuest({
        guest_name: 'Fallback Guest Name',
        guest_display_name: '', // Empty display name
        users: null // No user linked
      });

      render(
        <GuestListItem 
          guest={guest}
          onRemove={vi.fn()}
        />
      );

      // Should fallback to guest name
      expect(screen.getByText('Fallback Guest Name')).toBeInTheDocument();
    });

    it('should display "Unnamed Guest" when all name fields are empty', () => {
      const guest = createMockGuest({
        guest_name: null,
        guest_display_name: '',
        users: null
      });

      render(
        <GuestListItem 
          guest={guest}
          onRemove={vi.fn()}
        />
      );

      // Should show fallback text
      expect(screen.getByText('Unnamed Guest')).toBeInTheDocument();
    });

    it('should prefer guest_display_name over users.full_name when both are available', () => {
      const guest = createMockGuest({
        guest_name: 'Original Guest Name',
        guest_display_name: 'Computed Display Name',
        users: {
          id: 'user-1',
          full_name: 'Different User Name',
          email: 'user@example.com',
          phone: '+1234567890',
          avatar_url: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          intended_redirect: null,
          onboarding_completed: true
        }
      });

      render(
        <GuestListItem 
          guest={guest}
          onRemove={vi.fn()}
        />
      );

      // Should prefer computed display name over user's full name
      expect(screen.getByText('Computed Display Name')).toBeInTheDocument();
      expect(screen.queryByText('Different User Name')).not.toBeInTheDocument();
      expect(screen.queryByText('Original Guest Name')).not.toBeInTheDocument();
    });

    it('should handle linked user scenario correctly', () => {
      const guest = createMockGuest({
        guest_name: 'Guest Import Name',
        guest_display_name: 'John Smith', // This would come from users.full_name via COALESCE
        user_id: 'user-1',
        users: {
          id: 'user-1',
          full_name: 'John Smith',
          email: 'john@example.com',
          phone: '+1234567890',
          avatar_url: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          intended_redirect: null,
          onboarding_completed: true
        }
      });

      render(
        <GuestListItem 
          guest={guest}
          onRemove={vi.fn()}
        />
      );

      // Should show the user's actual name, not the import name
      expect(screen.getByText('John Smith')).toBeInTheDocument();
      expect(screen.queryByText('Guest Import Name')).not.toBeInTheDocument();
    });

    it('should handle unlinked guest scenario correctly', () => {
      const guest = createMockGuest({
        guest_name: 'Jane Doe',
        guest_display_name: 'Jane Doe', // Same as guest_name since no user linked
        user_id: null,
        users: null
      });

      render(
        <GuestListItem 
          guest={guest}
          onRemove={vi.fn()}
        />
      );

      // Should show the guest name since no user is linked
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    });
  });

  describe('Search and Filtering Behavior', () => {
    it('should enable search by guest_display_name', () => {
      // This would be tested in the parent component that handles search
      // Here we just verify the display name is accessible
      const guest = createMockGuest({
        guest_display_name: 'Searchable Display Name'
      });

      expect(guest.guest_display_name).toBe('Searchable Display Name');
      expect(typeof guest.guest_display_name).toBe('string');
    });

    it('should maintain backward compatibility with guest_name', () => {
      const guest = createMockGuest({
        guest_name: 'Legacy Guest Name',
        guest_display_name: 'New Display Name'
      });

      // Both fields should be available
      expect(guest.guest_name).toBe('Legacy Guest Name');
      expect(guest.guest_display_name).toBe('New Display Name');
    });
  });

  describe('Data Integrity', () => {
    it('should never modify the original guest_name field', () => {
      const originalGuestName = 'Original Name';
      const guest = createMockGuest({
        guest_name: originalGuestName,
        guest_display_name: 'Different Display Name'
      });

      render(
        <GuestListItem 
          guest={guest}
          onRemove={vi.fn()}
        />
      );

      // Original guest_name should remain unchanged
      expect(guest.guest_name).toBe(originalGuestName);
      // But display should use the computed name
      expect(screen.getByText('Different Display Name')).toBeInTheDocument();
    });

    it('should handle edge case where guest_display_name is undefined', () => {
      const guest = createMockGuest({
        guest_name: 'Backup Name',
        // @ts-ignore - Simulating undefined display name for edge case testing
        guest_display_name: undefined
      });

      render(
        <GuestListItem 
          guest={guest}
          onRemove={vi.fn()}
        />
      );

      // Should fallback gracefully
      expect(screen.getByText('Backup Name')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should maintain proper accessibility attributes with display names', () => {
      const guest = createMockGuest({
        guest_display_name: 'Accessible Display Name'
      });

      render(
        <GuestListItem 
          guest={guest}
          onRemove={vi.fn()}
        />
      );

      // The display name should be readable by screen readers
      const nameElement = screen.getByText('Accessible Display Name');
      expect(nameElement).toBeInTheDocument();
      expect(nameElement).toBeVisible();
    });
  });
});