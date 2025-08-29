/**
 * Tests for RecipientCountPill component
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RecipientCountPill } from '../RecipientCountPill';
import { useCurrentAudienceCount } from '@/hooks/messaging/useCurrentAudienceCount';

// Mock the hook
jest.mock('@/hooks/messaging/useCurrentAudienceCount', () => ({
  useCurrentAudienceCount: jest.fn(),
}));

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockUseCurrentAudienceCount = useCurrentAudienceCount as jest.MockedFunction<typeof useCurrentAudienceCount>;

describe('RecipientCountPill', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    jest.clearAllMocks();
  });

  const renderWithQuery = (props: Parameters<typeof RecipientCountPill>[0]) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <RecipientCountPill {...props} />
      </QueryClientProvider>
    );
  };

  describe('Upcoming Announcements (should show live count)', () => {
    it('shows live count when loaded successfully', async () => {
      mockUseCurrentAudienceCount.mockReturnValue({
        count: 134,
        loading: false,
        error: null,
      });

      renderWithQuery({
        scheduledMessageId: 'test-id',
        messageType: 'announcement',
        status: 'scheduled',
        snapshotCount: 136,
      });

      expect(screen.getByText('134 people')).toBeInTheDocument();
    });

    it('shows loading skeleton while fetching', () => {
      mockUseCurrentAudienceCount.mockReturnValue({
        count: null,
        loading: true,
        error: null,
      });

      renderWithQuery({
        scheduledMessageId: 'test-id',
        messageType: 'announcement',
        status: 'scheduled',
        snapshotCount: 136,
      });

      expect(screen.getByRole('generic')).toHaveClass('animate-pulse');
    });

    it('shows "Recipients TBD" on error', () => {
      mockUseCurrentAudienceCount.mockReturnValue({
        count: null,
        loading: false,
        error: 'Failed to fetch',
      });

      renderWithQuery({
        scheduledMessageId: 'test-id',
        messageType: 'announcement',
        status: 'scheduled',
        snapshotCount: 136,
      });

      expect(screen.getByText('Recipients TBD')).toBeInTheDocument();
    });

    it('shows singular form for 1 person', () => {
      mockUseCurrentAudienceCount.mockReturnValue({
        count: 1,
        loading: false,
        error: null,
      });

      renderWithQuery({
        scheduledMessageId: 'test-id',
        messageType: 'announcement',
        status: 'scheduled',
        snapshotCount: 136,
      });

      expect(screen.getByText('1 person')).toBeInTheDocument();
    });
  });

  describe('Sent messages (should show delivered count)', () => {
    it('shows delivered count when available', () => {
      mockUseCurrentAudienceCount.mockReturnValue({
        count: null,
        loading: false,
        error: null,
      });

      renderWithQuery({
        scheduledMessageId: 'test-id',
        messageType: 'announcement',
        status: 'sent',
        snapshotCount: 136,
        successCount: 128,
      });

      expect(screen.getByText('128 delivered')).toBeInTheDocument();
    });

    it('falls back to snapshot count when no success count', () => {
      mockUseCurrentAudienceCount.mockReturnValue({
        count: null,
        loading: false,
        error: null,
      });

      renderWithQuery({
        scheduledMessageId: 'test-id',
        messageType: 'announcement',
        status: 'sent',
        snapshotCount: 136,
        successCount: null,
      });

      expect(screen.getByText('136 people')).toBeInTheDocument();
    });
  });

  describe('Direct messages (should show snapshot)', () => {
    it('shows snapshot count for scheduled direct messages', () => {
      mockUseCurrentAudienceCount.mockReturnValue({
        count: null,
        loading: false,
        error: null,
      });

      renderWithQuery({
        scheduledMessageId: 'test-id',
        messageType: 'direct',
        status: 'scheduled',
        snapshotCount: 5,
      });

      expect(screen.getByText('5 people')).toBeInTheDocument();
    });

    it('shows "Recipients TBD" for zero snapshot count', () => {
      mockUseCurrentAudienceCount.mockReturnValue({
        count: null,
        loading: false,
        error: null,
      });

      renderWithQuery({
        scheduledMessageId: 'test-id',
        messageType: 'direct',
        status: 'scheduled',
        snapshotCount: 0,
      });

      expect(screen.getByText('Recipients TBD')).toBeInTheDocument();
    });
  });
});
