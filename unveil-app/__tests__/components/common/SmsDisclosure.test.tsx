import { render, screen } from '@testing-library/react';
import { SmsDisclosure } from '@/components/common/SmsDisclosure';

describe('SmsDisclosure', () => {
  it('renders the SMS consent notice with correct text', () => {
    render(<SmsDisclosure />);
    
    // Check for key text elements
    expect(screen.getByText(/By continuing, you agree to receive SMS passcodes/)).toBeInTheDocument();
    expect(screen.getByText(/Msg&Data rates may apply/)).toBeInTheDocument();
    expect(screen.getByText(/Reply STOP to unsubscribe or HELP for help/)).toBeInTheDocument();
  });

  it('includes a link to the privacy policy', () => {
    render(<SmsDisclosure />);
    
    const privacyLink = screen.getByRole('link', { name: /Privacy Policy/i });
    expect(privacyLink).toBeInTheDocument();
    expect(privacyLink).toHaveAttribute('href', 'https://www.sendunveil.com/policies');
    expect(privacyLink).toHaveAttribute('target', '_blank');
    expect(privacyLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('has proper accessibility attributes', () => {
    render(<SmsDisclosure />);
    
    const notice = screen.getByRole('note');
    expect(notice).toBeInTheDocument();
    expect(notice).toHaveAttribute('aria-label', 'SMS consent notice');
  });

  it('applies custom className when provided', () => {
    render(<SmsDisclosure className="custom-class" />);
    
    const notice = screen.getByRole('note');
    expect(notice).toHaveClass('custom-class');
  });

  it('includes STOP and HELP language for carrier compliance', () => {
    render(<SmsDisclosure />);
    
    expect(screen.getByText(/STOP/)).toBeInTheDocument();
    expect(screen.getByText(/HELP/)).toBeInTheDocument();
  });
});
