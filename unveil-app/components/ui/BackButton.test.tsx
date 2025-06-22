import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useRouter } from 'next/navigation';
import { BackButton } from './BackButton';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

const mockRouter = {
  push: vi.fn(),
  back: vi.fn(),
};

const mockedUseRouter = useRouter as ReturnType<typeof vi.fn>;

describe('BackButton', () => {
  beforeEach(() => {
    mockedUseRouter.mockReturnValue(mockRouter);
    mockRouter.push.mockClear();
    mockRouter.back.mockClear();
    
    // Mock window.history.length
    Object.defineProperty(window, 'history', {
      value: { length: 2 },
      writable: true,
    });
  });

  it('renders with default "Back" text', () => {
    render(<BackButton />);
    expect(screen.getByText('Back')).toBeInTheDocument();
  });

  it('renders with custom children text', () => {
    render(<BackButton>Custom Back Text</BackButton>);
    expect(screen.getByText('Custom Back Text')).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    render(<BackButton />);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Go back');
    expect(screen.getByText('Back')).toBeInTheDocument();
  });

  it('navigates to specific href when provided', () => {
    render(<BackButton href="/custom-path" />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(mockRouter.push).toHaveBeenCalledWith('/custom-path');
  });

  it('uses browser back when history exists and no href provided', () => {
    render(<BackButton />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('uses fallback URL when no history and no href provided', () => {
    // Mock no history
    Object.defineProperty(window, 'history', {
      value: { length: 1 },
    });

    render(<BackButton fallback="/fallback-path" />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(mockRouter.push).toHaveBeenCalledWith('/fallback-path');
  });

  it('uses default fallback when no custom fallback provided', () => {
    // Mock no history
    Object.defineProperty(window, 'history', {
      value: { length: 1 },
    });

    render(<BackButton />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(mockRouter.push).toHaveBeenCalledWith('/select-event');
  });

  it('applies subtle variant styling by default', () => {
    render(<BackButton />);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('text-gray-600');
  });

  it('applies prominent variant styling when specified', () => {
    render(<BackButton variant="prominent" />);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('text-[#FF6B6B]');
  });

  it('includes back arrow icon', () => {
    render(<BackButton />);
    const svg = screen.getByRole('button').querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('has proper touch target sizing', () => {
    render(<BackButton />);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('min-h-[44px]');
    expect(button).toHaveClass('min-w-[44px]');
  });

  it('applies custom className', () => {
    render(<BackButton className="custom-class" />);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
  });
}); 