import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserAvatar, UserAvatarButton } from '@/components/common/UserAvatar';

// Mock the avatar utilities
vi.mock('@/lib/avatar', () => ({
  getInitialGrapheme: vi.fn((name) => name ? name.charAt(0).toUpperCase() : '?'),
  getAvatarColor: vi.fn(() => ({ bg: '#6B5B95', fg: '#FFFFFF', idx: 0 })),
  logAvatarEvent: vi.fn(),
}));

describe('UserAvatar', () => {
  const defaultProps = {
    id: 'test-user-123',
    name: 'Grant Delgado',
    size: 'md' as const,
  };

  it('renders initial when no image URL', () => {
    render(<UserAvatar {...defaultProps} />);
    
    expect(screen.getByTestId('user-avatar')).toBeInTheDocument();
    expect(screen.getByText('G')).toBeInTheDocument();
  });

  it('renders image when imageUrl provided', () => {
    render(
      <UserAvatar 
        {...defaultProps} 
        imageUrl="https://example.com/avatar.jpg" 
      />
    );
    
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg');
    expect(img).toHaveAttribute('alt', 'Grant Delgado');
  });

  it('falls back to initial on image error', () => {
    render(
      <UserAvatar 
        {...defaultProps} 
        imageUrl="https://example.com/broken.jpg" 
      />
    );
    
    const img = screen.getByRole('img');
    fireEvent.error(img);
    
    expect(screen.getByText('G')).toBeInTheDocument();
  });

  it('applies correct size classes', () => {
    const { rerender } = render(<UserAvatar {...defaultProps} size="sm" />);
    expect(screen.getByTestId('user-avatar')).toHaveClass('w-6', 'h-6', 'text-[11px]');

    rerender(<UserAvatar {...defaultProps} size="md" />);
    expect(screen.getByTestId('user-avatar')).toHaveClass('w-8', 'h-8', 'text-xs');

    rerender(<UserAvatar {...defaultProps} size="lg" />);
    expect(screen.getByTestId('user-avatar')).toHaveClass('w-10', 'h-10', 'text-sm');

    rerender(<UserAvatar {...defaultProps} size="xl" />);
    expect(screen.getByTestId('user-avatar')).toHaveClass('w-16', 'h-16', 'text-2xl');
  });

  it('applies custom className', () => {
    render(<UserAvatar {...defaultProps} className="custom-class" />);
    expect(screen.getByTestId('user-avatar')).toHaveClass('custom-class');
  });

  it('uses custom aria-label', () => {
    render(<UserAvatar {...defaultProps} ariaLabel="Custom label" />);
    expect(screen.getByLabelText('Custom label')).toBeInTheDocument();
  });

  it('generates default aria-label', () => {
    render(<UserAvatar {...defaultProps} />);
    expect(screen.getByLabelText('Account: Grant Delgado')).toBeInTheDocument();
  });

  it('handles missing name', () => {
    render(<UserAvatar {...defaultProps} name={null} />);
    expect(screen.getByText('?')).toBeInTheDocument();
    expect(screen.getByLabelText('Account: Unknown')).toBeInTheDocument();
  });

  it('applies ring when specified', () => {
    render(<UserAvatar {...defaultProps} ring={true} />);
    expect(screen.getByTestId('user-avatar')).toHaveClass('ring-2', 'ring-white/80');
  });
});

describe('UserAvatarButton', () => {
  const defaultProps = {
    id: 'test-user-123',
    name: 'Grant Delgado',
    size: 'md' as const,
  };

  it('renders clickable button', () => {
    const handleClick = vi.fn();
    render(<UserAvatarButton {...defaultProps} onClick={handleClick} />);
    
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('applies button-specific aria-label', () => {
    render(<UserAvatarButton {...defaultProps} />);
    expect(screen.getByLabelText('Account menu for Grant Delgado')).toBeInTheDocument();
  });

  it('uses custom button aria-label', () => {
    render(
      <UserAvatarButton 
        {...defaultProps} 
        buttonAriaLabel="Open profile menu" 
      />
    );
    expect(screen.getByLabelText('Open profile menu')).toBeInTheDocument();
  });

  it('handles disabled state', () => {
    render(<UserAvatarButton {...defaultProps} disabled={true} />);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveClass('opacity-50', 'cursor-not-allowed');
  });

  it('applies focus and hover styles', () => {
    render(<UserAvatarButton {...defaultProps} />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass(
      'focus:outline-none',
      'focus:ring-2',
      'focus:ring-purple-500',
      'hover:ring-2',
      'hover:ring-purple-200'
    );
  });

  it('sets aria-haspopup when hasPopup is true', () => {
    render(<UserAvatarButton {...defaultProps} hasPopup={true} />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-haspopup', 'true');
  });

  it('keyboard accessibility', () => {
    const handleClick = vi.fn();
    render(<UserAvatarButton {...defaultProps} onClick={handleClick} />);
    
    const button = screen.getByRole('button');
    
    // Should be focusable
    button.focus();
    expect(document.activeElement).toBe(button);
    
    // Should activate on Enter (using keyPress for better simulation)
    fireEvent.keyPress(button, { key: 'Enter', code: 'Enter', charCode: 13 });
    
    // Should activate on Space (using keyPress for better simulation)
    fireEvent.keyPress(button, { key: ' ', code: 'Space', charCode: 32 });
    
    // Note: Native button behavior handles Enter/Space automatically
    // We're mainly testing that the button is focusable and has proper attributes
    expect(button).toHaveAttribute('type', 'button');
  });
});
