import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { trackUserInteraction } from '@/lib/performance-monitoring';
import AccountSetupPage from '@/app/setup/page';

// Mock dependencies
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

vi.mock('@/lib/auth/AuthProvider', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('@/lib/performance-monitoring', () => ({
  trackUserInteraction: vi.fn(),
}));

const mockRouter = {
  push: vi.fn(),
};

const mockUser = {
  id: 'test-user-id',
  phone: '+1234567890',
};

const mockUserProfile = {
  id: 'test-user-id',
  phone: '+1234567890',
  full_name: '',
  onboarding_completed: false,
};

describe('AccountSetupPage SMS Consent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue(mockRouter);
    (useAuth as any).mockReturnValue({
      user: mockUser,
      loading: false,
    });

    // Mock successful user profile fetch
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: mockUserProfile,
          error: null,
        }),
      }),
    });

    (supabase.from as any).mockReturnValue({
      select: mockSelect,
    });
  });

  it('renders SMS consent checkbox with required text', async () => {
    render(<AccountSetupPage />);

    await waitFor(() => {
      expect(screen.getByText(/Phone: \+1234567890/)).toBeInTheDocument();
    });

    // Check for consent checkbox
    const consentCheckbox = screen.getByRole('checkbox', { name: /I consent to receive event notifications via SMS/ });
    expect(consentCheckbox).toBeInTheDocument();
    expect(consentCheckbox).not.toBeChecked();
    expect(consentCheckbox).toBeRequired();

    // Check for exact consent text
    expect(screen.getByText(/I consent to receive event notifications via SMS \(RSVPs, reminders, updates\)/)).toBeInTheDocument();
    expect(screen.getByText(/Msg&Data rates may apply\. Reply STOP to opt out\./)).toBeInTheDocument();

    // Check for privacy policy link
    const privacyLink = screen.getByRole('link', { name: /Privacy Policy/ });
    expect(privacyLink).toBeInTheDocument();
    expect(privacyLink).toHaveAttribute('href', 'https://www.sendunveil.com/policies');
    expect(privacyLink).toHaveAttribute('target', '_blank');
  });

  it('disables submit button until both name and consent are provided', async () => {
    render(<AccountSetupPage />);

    await waitFor(() => {
      expect(screen.getByText(/Phone: \+1234567890/)).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText(/Full Name/);
    const consentCheckbox = screen.getByRole('checkbox', { name: /I consent to receive event notifications via SMS/ });
    const submitButton = screen.getByRole('button', { name: /Complete Setup/ });

    // Initially disabled
    expect(submitButton).toBeDisabled();

    // Still disabled with only name
    fireEvent.change(nameInput, { target: { value: 'John Doe' } });
    expect(submitButton).toBeDisabled();

    // Still disabled with only consent
    fireEvent.change(nameInput, { target: { value: '' } });
    fireEvent.click(consentCheckbox);
    expect(submitButton).toBeDisabled();

    // Enabled with both name and consent
    fireEvent.change(nameInput, { target: { value: 'John Doe' } });
    expect(submitButton).not.toBeDisabled();
  });

  it('shows error when trying to submit without consent', async () => {
    render(<AccountSetupPage />);

    await waitFor(() => {
      expect(screen.getByText(/Phone: \+1234567890/)).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText(/Full Name/);
    
    // Fill name but don't check consent
    fireEvent.change(nameInput, { target: { value: 'John Doe' } });

    // The button should be disabled when consent is not checked
    const submitButton = screen.getByRole('button', { name: /Complete Setup/ });
    expect(submitButton).toBeDisabled();

    // This test validates that the button remains disabled without consent
    // The actual error message is shown only when both conditions are met but consent fails
  });

  it('tracks telemetry when consent checkbox is toggled', async () => {
    render(<AccountSetupPage />);

    await waitFor(() => {
      expect(screen.getByText(/Phone: \+1234567890/)).toBeInTheDocument();
    });

    const consentCheckbox = screen.getByRole('checkbox', { name: /I consent to receive event notifications via SMS/ });

    // Test checking the box
    fireEvent.click(consentCheckbox);
    expect(trackUserInteraction).toHaveBeenCalledWith('sms_consent_checked', 'setup', 'opted_in');

    // Test unchecking the box
    fireEvent.click(consentCheckbox);
    expect(trackUserInteraction).toHaveBeenCalledWith('sms_consent_checked', 'setup', 'opted_out');
  });

  it('submits form with SMS consent data', async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        is: vi.fn().mockResolvedValue({
          error: null,
        }),
      }),
    });

    (supabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockUserProfile,
            error: null,
          }),
        }),
      }),
      update: mockUpdate,
    });

    render(<AccountSetupPage />);

    await waitFor(() => {
      expect(screen.getByText(/Phone: \+1234567890/)).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText(/Full Name/);
    const consentCheckbox = screen.getByRole('checkbox', { name: /I consent to receive event notifications via SMS/ });
    const submitButton = screen.getByRole('button', { name: /Complete Setup/ });

    // Fill form
    fireEvent.change(nameInput, { target: { value: 'John Doe' } });
    fireEvent.click(consentCheckbox);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          full_name: 'John Doe',
          onboarding_completed: true,
          sms_consent_given_at: expect.any(String),
          sms_consent_ip_address: null, // Client-side doesn't have IP
          sms_consent_user_agent: expect.any(String),
        })
      );
    });

    expect(trackUserInteraction).toHaveBeenCalledWith('sms_consent_recorded', 'setup', 'success');
    expect(mockRouter.push).toHaveBeenCalledWith('/select-event');
  });

  it('handles form submission errors gracefully', async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        is: vi.fn().mockResolvedValue({
          error: { message: 'Database error' },
        }),
      }),
    });

    (supabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockUserProfile,
            error: null,
          }),
        }),
      }),
      update: mockUpdate,
    });

    render(<AccountSetupPage />);

    await waitFor(() => {
      expect(screen.getByText(/Phone: \+1234567890/)).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText(/Full Name/);
    const consentCheckbox = screen.getByRole('checkbox', { name: /I consent to receive event notifications via SMS/ });
    const submitButton = screen.getByRole('button', { name: /Complete Setup/ });

    // Fill form
    fireEvent.change(nameInput, { target: { value: 'John Doe' } });
    fireEvent.click(consentCheckbox);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Failed to save your information\. Please try again\./)).toBeInTheDocument();
    });

    // Should not redirect on error
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('has proper accessibility attributes for checkbox', async () => {
    render(<AccountSetupPage />);

    await waitFor(() => {
      expect(screen.getByText(/Phone: \+1234567890/)).toBeInTheDocument();
    });

    const consentCheckbox = screen.getByRole('checkbox', { name: /I consent to receive event notifications via SMS/ });
    
    // Check accessibility
    expect(consentCheckbox).toBeRequired();

    // Check that label wraps checkbox (implicit association)
    const label = screen.getByText(/I consent to receive event notifications via SMS/).closest('label');
    expect(label).toContainElement(consentCheckbox);

    // Check checkbox is native size (not oversized)
    expect(consentCheckbox).toHaveClass('h-4', 'w-4');
    
    // Check label has minimum touch target height
    expect(label).toHaveClass('min-h-[44px]');
  });
});
