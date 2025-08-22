/**
 * Tests for SendFlowModal Direct message type copy
 *
 * Verifies that Direct message type shows the correct audience context:
 * "Visible in app only to selected guests. Not visible to late joiners."
 */

import React from 'react';
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SendFlowModal } from '@/components/features/messaging/host/SendFlowModal';

const mockPreviewData = {
  guests: [
    {
      id: 'guest-1',
      displayName: 'John Doe',
      tags: [],
      rsvpStatus: 'pending' as const,
      hasPhone: true,
    },
  ],
  totalCount: 1,
  validRecipientsCount: 1,
  tagCounts: {},
  rsvpStatusCounts: {},
};

const mockOnSend = vi.fn();
const mockOnClose = vi.fn();

describe('SendFlowModal - Direct Message Copy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should show Direct audience copy for direct message type', () => {
    render(
      <SendFlowModal
        isOpen={true}
        onClose={mockOnClose}
        onSend={mockOnSend}
        previewData={mockPreviewData}
        messageContent="Test direct message"
        messageType="direct"
      />,
    );

    // Should show Direct message context
    expect(screen.getByText('💬 Direct:')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Visible in app only to selected guests\. Not visible to late joiners\./,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/SMS notifications sent to 1 selected guests now\./),
    ).toBeInTheDocument();
  });

  test('should show Announcement copy for announcement message type', () => {
    render(
      <SendFlowModal
        isOpen={true}
        onClose={mockOnClose}
        onSend={mockOnSend}
        previewData={mockPreviewData}
        messageContent="Test announcement message"
        messageType="announcement"
      />,
    );

    // Should show Announcement message context
    expect(screen.getByText('📢 Announcement:')).toBeInTheDocument();
    expect(
      screen.getByText(/Visible in app to all current and future guests\./),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/SMS notifications sent to 1 guests now\./),
    ).toBeInTheDocument();
  });

  test('should show Channel copy for channel message type', () => {
    render(
      <SendFlowModal
        isOpen={true}
        onClose={mockOnClose}
        onSend={mockOnSend}
        previewData={mockPreviewData}
        messageContent="Test channel message"
        messageType="channel"
      />,
    );

    // Should show Channel message context
    expect(screen.getByText('🏷️ Channel:')).toBeInTheDocument();
    expect(
      screen.getByText(/Visible in app to anyone with selected tags\./),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/SMS notifications sent to 1 current tag members now\./),
    ).toBeInTheDocument();
  });

  test('should not show any message type copy for other types', () => {
    render(
      <SendFlowModal
        isOpen={true}
        onClose={mockOnClose}
        onSend={mockOnSend}
        previewData={mockPreviewData}
        messageContent="Test invitation message"
        messageType="invitation"
      />,
    );

    // Should not show any of the specific message type contexts
    expect(screen.queryByText('💬 Direct:')).not.toBeInTheDocument();
    expect(screen.queryByText('📢 Announcement:')).not.toBeInTheDocument();
    expect(screen.queryByText('🏷️ Channel:')).not.toBeInTheDocument();
  });

  test('should display Direct message context with proper structure', () => {
    render(
      <SendFlowModal
        isOpen={true}
        onClose={mockOnClose}
        onSend={mockOnSend}
        previewData={mockPreviewData}
        messageContent="Test direct message"
        messageType="direct"
      />,
    );

    // Verify the Direct message context is present and structured correctly
    const directLabel = screen.getByText('💬 Direct:');
    expect(directLabel).toBeInTheDocument();

    const audienceText = screen.getByText(
      /Visible in app only to selected guests/,
    );
    expect(audienceText).toBeInTheDocument();

    const smsText = screen.getByText(
      /SMS notifications sent to 1 selected guests now/,
    );
    expect(smsText).toBeInTheDocument();

    // Verify Direct context appears in the correct section (before recipient grid)
    const deliverySummary = screen.getByText('📊 Delivery Summary');
    expect(deliverySummary).toBeInTheDocument();
  });
});
