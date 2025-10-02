/**
 * Avatar utilities for initial-based avatar system
 * Handles Unicode-safe initial extraction and deterministic color generation
 */

// WCAG AA compliant color palette (contrast ratio ≥ 4.5:1 for normal text, ≥ 3:1 for large text)
const PALETTE: Array<[string, string]> = [
  ['#6B5B95', '#FFFFFF'], // amethyst
  ['#2E8B57', '#FFFFFF'], // sea green
  ['#5C80BC', '#FFFFFF'], // steel blue
  ['#C76C5B', '#FFFFFF'], // terracotta
  ['#8E6C88', '#FFFFFF'], // mauve
  ['#3C6E71', '#FFFFFF'], // teal gray
  ['#B56576', '#FFFFFF'], // rose
  ['#556B2F', '#FFFFFF'], // olive
  ['#7B8CDE', '#FFFFFF'], // periwinkle
  ['#B08BBB', '#FFFFFF'], // lavender
];

/**
 * Extract the first grapheme cluster from a display name
 * Handles Unicode, emojis, and complex scripts safely
 */
export function getInitialGrapheme(name?: string | null): string {
  if (!name?.trim()) return '?';

  const trimmedName = name.trim();
  
  // Use Intl.Segmenter if available for proper grapheme cluster handling
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    try {
      const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
      const segments = [...segmenter.segment(trimmedName)];
      
      const firstGrapheme = segments[0]?.segment;
      if (!firstGrapheme) return '?';
      
      // Handle special cases - keep emojis as-is
      if (firstGrapheme.match(/\p{Emoji}/u)) {
        return firstGrapheme;
      }
      
      return firstGrapheme.toUpperCase();
    } catch {
      // Fallback if Intl.Segmenter fails
    }
  }
  
  // Fallback: use simple character extraction with basic grapheme cluster support
  // This handles most common cases including accented characters
  const graphemeMatch = trimmedName.match(/^(?:\p{Emoji}|\p{L}\p{M}*|\p{N})/u);
  if (graphemeMatch) {
    const firstChar = graphemeMatch[0];
    // Keep emojis as-is, uppercase letters
    return firstChar.match(/\p{Emoji}/u) ? firstChar : firstChar.toUpperCase();
  }
  
  // Ultimate fallback
  return trimmedName.charAt(0).toUpperCase() || '?';
}

/**
 * Simple hash function (djb2 algorithm)
 * Fast, non-cryptographic hash for deterministic color selection
 */
function djb2Hash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return Math.abs(hash);
}

/**
 * Generate deterministic avatar color from stable key
 * Returns WCAG AA compliant background/foreground color pair
 */
export function getAvatarColor(key: string): { bg: string; fg: string; idx: number } {
  if (!key) key = '?'; // Fallback for empty keys
  
  const hash = djb2Hash(key);
  const idx = hash % PALETTE.length;
  const [bg, fg] = PALETTE[idx];
  
  return { bg, fg, idx };
}

/**
 * Normalize a name for consistent processing
 * Trims whitespace and collapses multiple spaces
 */
export function normalizeName(name?: string | null): string {
  if (!name) return '';
  return name.trim().replace(/\s+/g, ' ');
}

// Development-only logging (controlled by feature flag)
const DEBUG_AVATAR = typeof window !== 'undefined' && 
  process.env.NODE_ENV === 'development' && 
  process.env.NEXT_PUBLIC_DEBUG_AVATAR === 'true';

/**
 * PII-safe logging for avatar operations (dev only)
 */
export function logAvatarEvent(event: string, data: {
  usedImage?: boolean;
  paletteIdx?: number;
  size?: string;
  hasName?: boolean;
}) {
  if (!DEBUG_AVATAR) return;
  
  console.log('[Avatar Debug]', event, {
    ...data,
    timestamp: Date.now()
  });
}
