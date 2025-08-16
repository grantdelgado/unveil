/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SendConfirmationModal } from '../SendConfirmationModal';
import type { RecipientPreviewData } from '@/lib/types/messaging';

// Mock preview data
const mockPreviewData: RecipientPreviewData = {
  guests: [
    { id: '1', displayName: 'John Doe', tags: ['Family'], rsvpStatus: 'attending', hasPhone: true },
    { id: '2', displayName: 'Jane Smith', tags: ['College Friends'], rsvpStatus: 'pending', hasPhone: true },
    { id: '3', displayName: 'Bob Wilson', tags: ['Work'], rsvpStatus: 'attending', hasPhone: false },
  ],
  totalCount: 3,
  validRecipientsCount: 2,
  tagCounts: { 'Family': 1, 'College Friends': 1, 'Work': 1 },
  rsvpStatusCounts: { 'attending': 2, 'pending': 1 }
};

describe('SendConfirmationModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onConfirm: jest.fn(),
    previewData: mockPreviewData,
    messageContent: 'Test message content for the event',
    messageType: 'announcement' as const,
    isLoading: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders modal when open', () => {
    render(<SendConfirmationModal {...defaultProps} />);
    
    expect(screen.getByText('Confirm Message Send')).toBeInTheDocument();
    expect(screen.getByText('📊 Delivery Summary')).toBeInTheDocument();
  });

  it('displays correct recipient counts', () => {
    render(<SendConfirmationModal {...defaultProps} />);
    
    expect(screen.getByText('2')).toBeInTheDocument(); // Will Receive
    expect(screen.getByText('1')).toBeInTheDocument(); // Excluded
    expect(screen.getByText('3')).toBeInTheDocument(); // Total Selected
  });

  it('shows large group warning for >50 recipients', () => {
    const largeGroupData = {
      ...mockPreviewData,
      totalCount: 75,
      validRecipientsCount: 60
    };

    render(<SendConfirmationModal {...defaultProps} previewData={largeGroupData} />);
    
    expect(screen.getByText('Large Group Alert')).toBeInTheDocument();
    expect(screen.getByText(/60 recipients/)).toBeInTheDocument();
  });

  it('prevents send when no delivery method selected', () => {
    render(<SendConfirmationModal {...defaultProps} />);
    
    // Uncheck push notification
    const pushCheckbox = screen.getByLabelText(/Push Notification/);
    fireEvent.click(pushCheckbox);
    
    expect(screen.getByText('❌ Please select at least one delivery method')).toBeInTheDocument();
    
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
        sendViaSms: false
      });
    });
  });

  it('shows message preview with expand/collapse functionality', () => {
    const longMessage = 'A'.repeat(200); // Long message
    render(<SendConfirmationModal {...defaultProps} messageContent={longMessage} />);
    
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
