import { describe, it, expect } from 'vitest';
import { getInitialGrapheme, getAvatarColor, normalizeName } from '@/lib/avatar';

describe('getInitialGrapheme', () => {
  it('handles basic Latin names', () => {
    expect(getInitialGrapheme('Grant Delgado')).toBe('G');
    expect(getInitialGrapheme('alice smith')).toBe('A');
    expect(getInitialGrapheme('Bob')).toBe('B');
  });

  it('handles accented characters', () => {
    expect(getInitialGrapheme('Élodie')).toBe('É');
    expect(getInitialGrapheme('José María')).toBe('J');
    expect(getInitialGrapheme('François')).toBe('F');
  });

  it('handles CJK characters', () => {
    expect(getInitialGrapheme('李小龙')).toBe('李');
    expect(getInitialGrapheme('田中太郎')).toBe('田');
    expect(getInitialGrapheme('김민수')).toBe('김');
  });

  it('handles emojis', () => {
    expect(getInitialGrapheme('🤖 Bot')).toBe('🤖');
    expect(getInitialGrapheme('👨‍💻 Developer')).toBe('👨‍💻');
    expect(getInitialGrapheme('🎉 Party')).toBe('🎉');
  });

  it('handles edge cases', () => {
    expect(getInitialGrapheme('')).toBe('?');
    expect(getInitialGrapheme('   ')).toBe('?');
    expect(getInitialGrapheme(null)).toBe('?');
    expect(getInitialGrapheme(undefined)).toBe('?');
  });

  it('handles special characters', () => {
    expect(getInitialGrapheme("O'Connor")).toBe('O');
    expect(getInitialGrapheme('van der Berg')).toBe('V');
    expect(getInitialGrapheme('D\'Angelo')).toBe('D');
  });

  it('trims whitespace', () => {
    expect(getInitialGrapheme('  alice  ')).toBe('A');
    expect(getInitialGrapheme('\n\tBob\n')).toBe('B');
  });

  it('handles RTL scripts', () => {
    expect(getInitialGrapheme('محمد علي')).toBe('م');
    expect(getInitialGrapheme('אברהם')).toBe('א');
  });
});

describe('getAvatarColor', () => {
  it('returns consistent colors for same key', () => {
    const userId = 'test-user-123';
    const color1 = getAvatarColor(userId);
    const color2 = getAvatarColor(userId);
    
    expect(color1).toEqual(color2);
    expect(color1.bg).toBeTruthy();
    expect(color1.fg).toBeTruthy();
    expect(typeof color1.idx).toBe('number');
  });

  it('returns different colors for different keys', () => {
    const color1 = getAvatarColor('user1');
    const color2 = getAvatarColor('user2');
    
    // Colors should be different (very high probability)
    expect(color1.idx).not.toBe(color2.idx);
  });

  it('handles empty keys', () => {
    const color = getAvatarColor('');
    expect(color.bg).toBeTruthy();
    expect(color.fg).toBeTruthy();
    expect(typeof color.idx).toBe('number');
  });

  it('returns valid hex colors', () => {
    const color = getAvatarColor('test-key');
    expect(color.bg).toMatch(/^#[0-9A-F]{6}$/i);
    expect(color.fg).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it('returns palette index within valid range', () => {
    const color = getAvatarColor('test-key');
    expect(color.idx).toBeGreaterThanOrEqual(0);
    expect(color.idx).toBeLessThan(10); // We have 10 colors in palette
  });

  it('distributes colors across palette', () => {
    const keys = Array.from({ length: 100 }, (_, i) => `user-${i}`);
    const colors = keys.map(key => getAvatarColor(key));
    const uniqueIndices = new Set(colors.map(c => c.idx));
    
    // Should use multiple colors from palette
    expect(uniqueIndices.size).toBeGreaterThan(1);
  });
});

describe('normalizeName', () => {
  it('trims whitespace', () => {
    expect(normalizeName('  alice  ')).toBe('alice');
    expect(normalizeName('\n\tBob\n')).toBe('Bob');
  });

  it('collapses multiple spaces', () => {
    expect(normalizeName('Grant    Delgado')).toBe('Grant Delgado');
    expect(normalizeName('Mary  Jane   Watson')).toBe('Mary Jane Watson');
  });

  it('handles empty inputs', () => {
    expect(normalizeName('')).toBe('');
    expect(normalizeName('   ')).toBe('');
    expect(normalizeName(null)).toBe('');
    expect(normalizeName(undefined)).toBe('');
  });

  it('preserves single spaces', () => {
    expect(normalizeName('Grant Delgado')).toBe('Grant Delgado');
    expect(normalizeName('José María')).toBe('José María');
  });
});
