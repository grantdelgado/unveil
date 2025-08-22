import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SendConfirmationModal } from '../SendConfirmationModal';
import type { RecipientPreviewData } from '@/lib/types/messaging';

// Mock preview data
const mockPreviewData: RecipientPreviewData = {
  guests: [
    {
      id: '1',
      displayName: 'John Doe',
      tags: ['Family'],
      rsvpStatus: 'attending',
      hasPhone: true,
    },
    {
      id: '2',
      displayName: 'Jane Smith',
      tags: ['College Friends'],
      rsvpStatus: 'pending',
      hasPhone: true,
    },
    {
      id: '3',
      displayName: 'Bob Wilson',
      tags: ['Work'],
      rsvpStatus: 'attending',
      hasPhone: false,
    },
  ],
  totalCount: 3,
  validRecipientsCount: 2,
  tagCounts: { Family: 1, 'College Friends': 1, Work: 1 },
  rsvpStatusCounts: { attending: 2, pending: 1 },
};

describe('SendConfirmationModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    previewData: mockPreviewData,
    messageContent: 'Test message content for the event',
    messageType: 'announcement' as const,
    isLoading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal when open', () => {
    render(<SendConfirmationModal {...defaultProps} />);

    expect(screen.getByText('Confirm Message Send')).toBeInTheDocument();
    expect(screen.getByText('📊 Delivery Summary')).toBeInTheDocument();
  });

  it('displays correct recipient counts', () => {
    render(<SendConfirmationModal {...defaultProps} />);

    // Use more specific selectors to avoid multiple matches
    expect(screen.getByText('Will Receive')).toBeInTheDocument();
    expect(screen.getByText('Excluded')).toBeInTheDocument();
    expect(screen.getByText('Total Selected')).toBeInTheDocument();

    // Check that the numbers are displayed in the right context
    const willReceiveSection = screen.getByText('Will Receive').parentElement;
    expect(willReceiveSection).toHaveTextContent('2');

    const excludedSection = screen.getByText('Excluded').parentElement;
    expect(excludedSection).toHaveTextContent('1');

    const totalSection = screen.getByText('Total Selected').parentElement;
    expect(totalSection).toHaveTextContent('3');
  });

  it('shows large group warning for >50 recipients', () => {
    const largeGroupData = {
      ...mockPreviewData,
      totalCount: 75,
      validRecipientsCount: 60,
    };

    render(
      <SendConfirmationModal {...defaultProps} previewData={largeGroupData} />,
    );

    expect(screen.getByText('Large Group Alert')).toBeInTheDocument();
    expect(screen.getByText(/60 recipients/)).toBeInTheDocument();
  });

  it('prevents send when no delivery method selected', () => {
    render(<SendConfirmationModal {...defaultProps} />);

    // Uncheck both checkboxes to disable all delivery methods
    const pushCheckbox = screen.getByLabelText(/Push Notification/);
    const smsCheckbox = screen.getByLabelText(/SMS Text Message/);

    fireEvent.click(pushCheckbox);
    fireEvent.click(smsCheckbox);

    // The button should be disabled when no delivery methods are selected
    const sendButton = screen.getByRole('button', { name: /Send Message/ });
    expect(sendButton).toBeDisabled();
  });

  it('calls onConfirm with correct options when send clicked', async () => {
    render(<SendConfirmationModal {...defaultProps} />);

    const sendButton = screen.getByRole('button', { name: /Send Message/ });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(defaultProps.onConfirm).toHaveBeenCalledWith({
        sendViaPush: true,
        sendViaSms: true, // Both are enabled by default based on the component behavior
      });
    });
  });

  it('shows message preview with expand/collapse functionality', () => {
    const longMessage = 'A'.repeat(200); // Long message
    render(
      <SendConfirmationModal {...defaultProps} messageContent={longMessage} />,
    );

    expect(screen.getByText('View Full Message')).toBeInTheDocument();

    fireEvent.click(screen.getByText('View Full Message'));
    expect(screen.getByText('Show Less')).toBeInTheDocument();
  });

  it('calls onClose when cancel clicked', () => {
    render(<SendConfirmationModal {...defaultProps} />);

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButton);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('does not render when not open', () => {
    render(<SendConfirmationModal {...defaultProps} isOpen={false} />);

    expect(screen.queryByText('Confirm Message Send')).not.toBeInTheDocument();
  });

  it('shows loading state correctly', () => {
    render(<SendConfirmationModal {...defaultProps} isLoading={true} />);

    expect(screen.getByText('Sending...')).toBeInTheDocument();

    const sendButton = screen.getByRole('button', { name: /Sending/ });
    expect(sendButton).toBeDisabled();
  });
});
