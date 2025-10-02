import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UserAvatar } from '@/components/common/UserAvatar';

// Mock the avatar utilities
vi.mock('@/lib/avatar', () => ({
  getInitialGrapheme: vi.fn((name) => name ? name.charAt(0).toUpperCase() : '?'),
  getAvatarColor: vi.fn(() => ({ bg: '#6B5B95', fg: '#FFFFFF', idx: 0 })),
  logAvatarEvent: vi.fn(),
  normalizeName: vi.fn((name) => name?.trim() || ''),
}));

describe('Avatar Integration Tests', () => {
  describe('UserAvatar Component', () => {
    it('renders with correct data-testid for DOM verification', () => {
      render(
        <UserAvatar
          id="test-user-123"
          name="Grant Delgado"
          size="md"
        />
      );
      
      const avatar = screen.getByTestId('user-avatar');
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveTextContent('G');
    });

    it('applies correct size classes for different sizes', () => {
      const { rerender } = render(
        <UserAvatar id="test" name="Test" size="sm" />
      );
      expect(screen.getByTestId('user-avatar')).toHaveClass('w-6', 'h-6');

      rerender(<UserAvatar id="test" name="Test" size="md" />);
      expect(screen.getByTestId('user-avatar')).toHaveClass('w-8', 'h-8');

      rerender(<UserAvatar id="test" name="Test" size="lg" />);
      expect(screen.getByTestId('user-avatar')).toHaveClass('w-10', 'h-10');

      rerender(<UserAvatar id="test" name="Test" size="xl" />);
      expect(screen.getByTestId('user-avatar')).toHaveClass('w-16', 'h-16');
    });

    it('handles missing names with fallback', () => {
      render(
        <UserAvatar
          id="test-user"
          name={null}
          size="md"
        />
      );
      
      const avatar = screen.getByTestId('user-avatar');
      expect(avatar).toHaveTextContent('?');
    });

    it('shows image when imageUrl provided', () => {
      render(
        <UserAvatar
          id="test-user"
          name="Test User"
          imageUrl="https://example.com/avatar.jpg"
          size="md"
        />
      );
      
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg');
      expect(img).toHaveAttribute('alt', 'Test User');
    });

    it('has proper accessibility attributes', () => {
      render(
        <UserAvatar
          id="test-user"
          name="John Doe"
          size="md"
        />
      );

      const avatar = screen.getByLabelText('Account: John Doe');
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute('data-testid', 'user-avatar');
    });

    it('applies custom className', () => {
      render(
        <UserAvatar
          id="test-user"
          name="Test User"
          size="md"
          className="custom-test-class"
        />
      );

      const avatar = screen.getByTestId('user-avatar');
      expect(avatar).toHaveClass('custom-test-class');
    });
  });

  describe('Avatar System Integration', () => {
    it('can be found by data-testid selector for Playwright tests', () => {
      render(
        <div>
          <UserAvatar id="user1" name="User One" size="sm" />
          <UserAvatar id="user2" name="User Two" size="md" />
          <UserAvatar id="user3" name="User Three" size="lg" />
        </div>
      );

      const avatars = screen.getAllByTestId('user-avatar');
      expect(avatars).toHaveLength(3);
      
      // Verify they all have the expected structure
      avatars.forEach(avatar => {
        expect(avatar).toBeInTheDocument();
        expect(avatar).toHaveClass('rounded-full');
      });
    });
  });
});