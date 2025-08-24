import { createServerSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { flags } from '@/config/flags';
import { 
  incrementFormatterFallback, 
  incrementFormatterPrefetchUsed, 
  incrementFormatterPrefetchMissed 
} from '@/lib/metrics/messaging';

/**
 * Telemetry functions for SMS formatter (no PII)
 */
function emitFormatterTelemetry(metric: string, path: string, value: number = 1) {
  // For now, use structured logging. In future, can integrate with metrics service
  logger.info(`SMS formatter telemetry: ${metric}`, {
    metric,
    path,
    value,
    timestamp: new Date().toISOString(),
  });
}

function emitFallbackUsed(path: string) {
  emitFormatterTelemetry('messaging.formatter.fallback_used', path);
}

function emitHeaderMissing(path: string) {
  emitFormatterTelemetry('messaging.formatter.header_missing', path);
}

function emitFirstSmsIncludesStop(path: string, included: boolean) {
  emitFormatterTelemetry('messaging.formatter.first_sms_includes_stop', path, included ? 1 : 0);
}

/**
 * SMS Text Formatting Utility for Event Tag Branding + A2P Footer
 * 
 * Formats SMS messages with:
 * - EventTag: prefix for immediate event recognition
 * - One-time A2P "Reply STOP to opt out" footer per guest/event
 * - GSM-7 normalization and length management for single-segment preference
 */

export interface SmsFormatOptions {
  /** Optional short link to include */
  link?: string;
  /** Force include STOP notice even if already sent */
  forceStopNotice?: boolean;
  /** Pre-fetched event SMS tag (avoids DB query) */
  eventSmsTag?: string | null;
  /** Pre-fetched event title (avoids DB query) */
  eventTitle?: string | null;
}

export interface SmsFormatResult {
  /** Final formatted SMS text ready for Twilio */
  text: string;
  /** Whether STOP notice was included in this message */
  includedStopNotice: boolean;
  /** Final character count */
  length: number;
  /** Number of SMS segments (for monitoring) */
  segments: number;
  /** Whether link was dropped due to length constraints */
  droppedLink: boolean;
  /** Whether body was truncated */
  truncatedBody: boolean;
  /** Explicit signals for what was included in the final SMS */
  included: {
    /** Whether event header EventTag: was included */
    header: boolean;
    /** Whether brand line "via Unveil" was included */
    brand: boolean;
    /** Whether STOP notice was included */
    stop: boolean;
  };
  /** Reason for fallback behavior, if any */
  reason?: 'fallback' | 'kill_switch' | 'first_sms=false';
}

/**
 * Core SMS text formatter with event tag branding and A2P compliance
 * 
 * @param eventId - Event UUID
 * @param guestId - Guest UUID (optional, for A2P tracking)
 * @param body - Raw message content
 * @param options - Formatting options including pre-fetched event data
 */
export async function composeSmsText(
  eventId: string,
  guestId: string | undefined,
  body: string,
  options: SmsFormatOptions = {}
): Promise<SmsFormatResult> {
  try {
    // Emergency kill-switch check (defaults to branding ON)
    // Kill switch should preserve event header but remove brand/STOP
    const killSwitchActive = flags.ops.smsBrandingDisabled;
    
    if (killSwitchActive) {
      // Use pre-fetched event data if available, otherwise fetch for header
      let event: { sms_tag: string | null; title: string } | null = null;

      if (options.eventSmsTag != null || options.eventTitle != null) {
        // Use pre-fetched event data
        event = {
          sms_tag: options.eventSmsTag || null,
          title: options.eventTitle || 'Event'
        };
      } else {
        // Fetch event data for header (kill switch still needs header)
        let supabase: any;
        try {
          supabase = await createServerSupabaseClient();
        } catch (error) {
          const { supabase: adminClient } = await import('@/lib/supabase/admin');
          supabase = adminClient;
        }

        const { data: eventData, error: eventError } = await supabase
          .from('events')
          .select('sms_tag, title')
          .eq('id', eventId)
          .maybeSingle();

        if (eventError || !eventData) {
          // Complete fallback if can't get event data
                  emitFallbackUsed('kill_switch_event_fetch_failed');
        emitHeaderMissing('kill_switch_event_fetch_failed');
        // Enhanced monitoring: Track fallback usage
        incrementFormatterFallback('kill_switch_event_fetch_failed');
        return {
          text: body,
          includedStopNotice: false,
          length: body.length,
          segments: calculateSmsSegments(body),
          droppedLink: false,
          truncatedBody: false,
          included: { header: false, brand: false, stop: false },
          reason: 'fallback',
        };
        }

        event = eventData;
      }

      // Generate event tag and format with header only
      const eventTag = generateEventTag(event?.sms_tag || null, event?.title || 'Event');
      const headerOnlyText = `${eventTag}: ${normalizeToGsm7(body.trim())}`;
      
      const killSwitchResult = {
        text: headerOnlyText,
        includedStopNotice: false,
        length: headerOnlyText.length,
        segments: calculateSmsSegments(headerOnlyText),
        droppedLink: false,
        truncatedBody: false,
        included: { header: true, brand: false, stop: false },
        reason: 'kill_switch' as const,
      };

      // Log kill switch result with prefetch status
      logger.info('SMS formatter result', {
        eventId,
        hasGuestId: !!guestId,
        included: killSwitchResult.included,
        reason: killSwitchResult.reason,
        usedPrefetchedEvent: (options.eventSmsTag != null || options.eventTitle != null),
        segments: killSwitchResult.segments,
        timestamp: new Date().toISOString()
      });

      return killSwitchResult;
    }

    // Try to get Supabase client - fallback to admin client if server client fails
    let supabase: any;
    try {
      supabase = await createServerSupabaseClient();
    } catch (error) {
      // Fallback to admin client for scheduled worker context
      const { supabase: adminClient } = await import('@/lib/supabase/admin');
      supabase = adminClient;
      logger.info('SMS formatter using admin client fallback', { eventId });
    }

    // Use pre-fetched event data if available, otherwise fetch from DB
    let event: { sms_tag: string | null; title: string } | null = null;
    let guest: { a2p_notice_sent_at: string | null } | null = null;
    let usedPrefetchedEvent = false;

    if (options.eventSmsTag != null || options.eventTitle != null) {


      // Use pre-fetched event data (from scheduled worker)
      event = {
        sms_tag: options.eventSmsTag || null,
        title: options.eventTitle || 'Event'
      };
      usedPrefetchedEvent = true;
      
      // Enhanced monitoring: Track prefetch usage
      incrementFormatterPrefetchUsed();

      // No need to fetch guest A2P status since we don't use it anymore
      guest = null;
    } else {
      // Fetch event data from DB (Send-Now path)
      const eventResult = await supabase
        .from('events')
        .select('sms_tag, title')
        .eq('id', eventId)
        .maybeSingle();

      if (eventResult.error) {
        logger.warn('Failed to fetch event for SMS formatting', {
          eventId,
          error: eventResult.error.message,
        });
        // Emit counter metric for event fetch miss
        logger.info('SMS formatter telemetry: messaging.formatter.event_fetch_miss', {
          metric: 'messaging.formatter.event_fetch_miss',
          path: 'db_query_failed',
          value: 1,
          timestamp: new Date().toISOString(),
        });
        // Fallback to unformatted message
        emitFallbackUsed('event_fetch_failed');
        emitHeaderMissing('event_fetch_failed');
        // Enhanced monitoring: Track fallback usage
        incrementFormatterFallback('event_fetch_failed');
        return {
          text: body,
          includedStopNotice: false,
          length: body.length,
          segments: calculateSmsSegments(body),
          droppedLink: false,
          truncatedBody: false,
          included: { header: false, brand: false, stop: false },
          reason: 'fallback',
        };
      }

      if (!eventResult.data) {
        logger.warn('Event not found for SMS formatting', { eventId });
        // Emit counter metric for event fetch miss
        logger.info('SMS formatter telemetry: messaging.formatter.event_fetch_miss', {
          metric: 'messaging.formatter.event_fetch_miss',
          path: 'event_not_found',
          value: 1,
          timestamp: new Date().toISOString(),
        });
        emitFallbackUsed('event_not_found');
        emitHeaderMissing('event_not_found');
        // Enhanced monitoring: Track fallback usage
        incrementFormatterFallback('event_not_found');
        return {
          text: body,
          includedStopNotice: false,
          length: body.length,
          segments: calculateSmsSegments(body),
          droppedLink: false,
          truncatedBody: false,
          included: { header: false, brand: false, stop: false },
          reason: 'fallback',
        };
      }

      event = eventResult.data;
      guest = null; // No longer needed since A2P logic is disabled
      
      // Enhanced monitoring: Track prefetch miss (had to fetch from DB)
      incrementFormatterPrefetchMissed();
    }

    // Generate event tag
    const eventTag = generateEventTag(event?.sms_tag || null, event?.title || 'Event');

    // Determine if STOP notice needed
    // POLICY: Only include A2P STOP notice when explicitly forced
    // Regular Send Now and Scheduled messages should NOT include STOP notice
    // as it's already included in the initial invite/welcome message
    const needsStopNotice = Boolean(options.forceStopNotice);



    // Normalize body to GSM-7
    const normalizedBody = normalizeToGsm7(body.trim());

    // Assemble components for multiline format
    const STOP_TEXT = 'Reply STOP to opt out.';
    const BRAND_TEXT = 'via Unveil';
    const components = {
      header: `${eventTag}:`,
      body: normalizedBody,
      link: options.link ? ` ${options.link}` : '',
      brand: needsStopNotice ? BRAND_TEXT : '', // Brand line only on first message
      stop: needsStopNotice ? STOP_TEXT : '',
    };

    // Calculate lengths and apply budget constraints
    const result = applyLengthBudget(components);

    const finalResult = {
      text: result.finalText,
      includedStopNotice: needsStopNotice && (result.includedStop ?? false),
      length: result.finalText.length,
      segments: calculateSmsSegments(result.finalText),
      droppedLink: options.link ? !result.includedLink : false,
      truncatedBody: result.truncatedBody,
      included: {
        header: true, // Header is always included in normal flow
        brand: result.includedBrand ?? false,
        stop: result.includedStop ?? false,
      },
      reason: (needsStopNotice && !result.includedStop ? 'first_sms=false' : undefined) as 'fallback' | 'kill_switch' | 'first_sms=false' | undefined,
    };

    return finalResult;
  } catch (error) {
    logger.error('Error in composeSmsText', {
      eventId,
      guestId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Fallback to unformatted message on any error
    emitFallbackUsed('exception_caught');
    emitHeaderMissing('exception_caught');
    // Enhanced monitoring: Track fallback usage
    incrementFormatterFallback('exception_caught');
    return {
      text: body,
      includedStopNotice: false,
      length: body.length,
      segments: calculateSmsSegments(body),
      droppedLink: false,
      truncatedBody: false,
      included: { header: false, brand: false, stop: false },
      reason: 'fallback',
    };
  }
}

/**
 * Generate event tag from sms_tag or title fallback
 * @deprecated Use generateEventTagExtended for new 24-char limit
 */
export function generateEventTag(smsTag: string | null, eventTitle: string): string {
  if (smsTag && smsTag.trim()) {
    return normalizeToAscii(smsTag.trim()).slice(0, 14);
  }

  // Generate from title: "Grant's Wedding" -> "Grant+Wed"
  const words = normalizeToAscii(eventTitle)
    .split(/\s+/)
    .filter(w => w.length > 0);

  if (words.length === 0) return 'Event';
  if (words.length === 1) return words[0].slice(0, 14);

  // Take first word + abbreviated others
  const firstWord = words[0];
  const remaining = words
    .slice(1)
    .map(w => w.slice(0, 3))
    .join('+');

  const combined = `${firstWord}+${remaining}`;
  return combined.slice(0, 14);
}

/**
 * Generate event tag with extended 24-character limit for new invite format
 * Returns tag without brackets, suitable for "EventTag: message" format
 */
export function generateEventTagExtended(smsTag: string | null, eventTitle: string, maxLength: number = 24): string {
  if (smsTag && smsTag.trim()) {
    return normalizeToAscii(smsTag.trim()).slice(0, maxLength);
  }

  // Generate from title with more space for longer tags
  const words = normalizeToAscii(eventTitle)
    .split(/\s+/)
    .filter(w => w.length > 0);

  if (words.length === 0) return 'Event';
  if (words.length === 1) return words[0].slice(0, maxLength);

  // For longer limit, use more descriptive abbreviation
  const firstWord = words[0];
  const remaining = words
    .slice(1)
    .map(w => w.slice(0, Math.max(3, Math.floor((maxLength - firstWord.length - words.length + 1) / (words.length - 1)))))
    .join(' ');

  const combined = `${firstWord} ${remaining}`;
  return combined.slice(0, maxLength);
}

/**
 * Normalize text to GSM-7 character set (preserves newlines)
 */
function normalizeToGsm7(text: string): string {
  return text
    // Smart quotes to regular quotes
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    // Em/en dashes to hyphen
    .replace(/[—–]/g, '-')
    // Ellipsis to three dots
    .replace(/…/g, '...')
    // Remove other non-GSM-7 characters (emojis, etc.) but preserve newlines
    .replace(/[^\x20-\x7E\n\r\t]/g, '')
    // Collapse multiple whitespace but preserve newlines
    .replace(/[ \t]+/g, ' ')
    // Normalize line endings
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
}

/**
 * Normalize to ASCII for tags
 */
function normalizeToAscii(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-zA-Z0-9\s+]/g, '') // Keep only alphanumeric, space, +
    .trim();
}

/**
 * Apply length budget constraints with multiline format:
 * 1. Header (always included on its own line)
 * 2. STOP notice (high priority if needed, on separate paragraph)
 * 3. Brand line (dropped if tight, only on first message)
 * 4. Body (truncated if necessary)
 * 5. Link (dropped first if tight)
 */
function applyLengthBudget(components: {
  header: string;
  body: string;
  link: string;
  brand: string;
  stop: string;
}): {
  finalText: string;
  includedLink: boolean;
  includedBrand: boolean;
  includedStop: boolean;
  truncatedBody: boolean;
} {
  const SMS_SINGLE_SEGMENT_LIMIT = 160;
  const TRUNCATION_SUFFIX = '…';

  const headerLen = components.header.length;
  const linkLen = components.link.length;
  const brandLen = components.brand.length;
  const stopLen = components.stop.length;
  
  // Calculate multiline format lengths
  const headerNewlineLen = 1; // \n after header

  // Try full message first with colon format including brand
  const bodyWithLink = components.body + components.link;
  const fullText = components.stop
    ? `${components.header} ${bodyWithLink}\n\n${components.brand}\n${components.stop}`
    : `${components.header} ${bodyWithLink}`;
    
  if (fullText.length <= SMS_SINGLE_SEGMENT_LIMIT) {
    return {
      finalText: fullText,
      includedLink: linkLen > 0,
      includedBrand: brandLen > 0,
      includedStop: stopLen > 0,
      truncatedBody: false,
    };
  }

  // Drop link first if over budget (keep brand line)
  const bodyWithoutLink = components.body;
  const withoutLinkText = components.stop
    ? `${components.header} ${bodyWithoutLink}\n\n${components.brand}\n${components.stop}`
    : `${components.header} ${bodyWithoutLink}`;
    
  if (withoutLinkText.length <= SMS_SINGLE_SEGMENT_LIMIT) {
    return {
      finalText: withoutLinkText,
      includedLink: false,
      includedBrand: brandLen > 0,
      includedStop: stopLen > 0,
      truncatedBody: false,
    };
  }

  // Drop brand line next if still over budget (keep STOP)
  const withoutBrandText = components.stop
    ? `${components.header} ${bodyWithoutLink}\n\n${components.stop}`
    : `${components.header} ${bodyWithoutLink}`;
    
  if (withoutBrandText.length <= SMS_SINGLE_SEGMENT_LIMIT) {
    return {
      finalText: withoutBrandText,
      includedLink: false,
      includedBrand: false,
      includedStop: stopLen > 0,
      truncatedBody: false,
    };
  }

  // Truncate body if still over budget (no brand, keep STOP)
  const spaceAfterHeader = 1; // space after colon
  const fixedOverhead = headerLen + spaceAfterHeader + stopLen + (stopLen > 0 ? 2 : 0) + TRUNCATION_SUFFIX.length;
  const availableBodySpace = SMS_SINGLE_SEGMENT_LIMIT - fixedOverhead;
  
  if (availableBodySpace > 10) { // Ensure minimum viable body
    const truncatedBody = components.body.slice(0, availableBodySpace) + TRUNCATION_SUFFIX;
    const finalText = components.stop
      ? `${components.header} ${truncatedBody}\n\n${components.stop}`
      : `${components.header} ${truncatedBody}`;
    
    return {
      finalText,
      includedLink: false,
      includedBrand: false,
      includedStop: stopLen > 0,
      truncatedBody: true,
    };
  }

  // Emergency fallback: header + minimal body only (no brand, no STOP)
  const emergencyOverhead = headerLen + spaceAfterHeader + TRUNCATION_SUFFIX.length;
  const emergencyBodySpace = SMS_SINGLE_SEGMENT_LIMIT - emergencyOverhead;
  const emergencyBody = components.body.slice(0, Math.max(10, emergencyBodySpace)) + TRUNCATION_SUFFIX;
  
  return {
    finalText: `${components.header} ${emergencyBody}`,
    includedLink: false,
    includedBrand: false,
    includedStop: false,
    truncatedBody: true,
  };
}

/**
 * Calculate SMS segment count (GSM-7 encoding assumed)
 */
function calculateSmsSegments(text: string): number {
  const length = text.length;
  if (length <= 160) return 1;
  if (length <= 306) return 2; // 153 * 2 (multipart overhead)
  return Math.ceil(length / 153);
}

/**
 * Format SMS invitation with single-segment length budgeting
 * Uses new format: "EventTag: message" without brackets
 */
export async function formatInviteSms(
  eventId: string,
  guestId: string | undefined,
  body: string,
  options: SmsFormatOptions = {}
): Promise<SmsFormatResult> {
  try {
    // Emergency kill-switch check
    const killSwitchActive = flags.ops.smsBrandingDisabled;
    
    if (killSwitchActive) {
      // Kill switch: return message without any formatting
      return {
        text: body,
        includedStopNotice: false,
        length: body.length,
        segments: calculateSmsSegments(body),
        droppedLink: false,
        truncatedBody: false,
        included: { header: false, brand: false, stop: false },
        reason: 'kill_switch',
      };
    }

    // Get Supabase client
    let supabase: any;
    try {
      supabase = await createServerSupabaseClient();
    } catch (error) {
      const { supabase: adminClient } = await import('@/lib/supabase/admin');
      supabase = adminClient;
    }

    // Use pre-fetched event data if available, otherwise fetch from DB
    let event: { sms_tag: string | null; title: string } | null = null;
    
    if (options.eventSmsTag != null || options.eventTitle != null) {
      event = {
        sms_tag: options.eventSmsTag || null,
        title: options.eventTitle || 'Event'
      };
      incrementFormatterPrefetchUsed();
    } else {
      const eventResult = await supabase
        .from('events')
        .select('sms_tag, title')
        .eq('id', eventId)
        .maybeSingle();

      if (eventResult.error || !eventResult.data) {
        // Fallback to unformatted message
        incrementFormatterFallback('event_fetch_failed');
        return {
          text: body,
          includedStopNotice: false,
          length: body.length,
          segments: calculateSmsSegments(body),
          droppedLink: false,
          truncatedBody: false,
          included: { header: false, brand: false, stop: false },
          reason: 'fallback',
        };
      }

      event = eventResult.data;
      incrementFormatterPrefetchMissed();
    }

    // Apply single-segment length budgeting for invites
    const result = applyInviteLengthBudget(event?.sms_tag || null, event?.title || 'Event', body);

    // Add observability logging
    if (process.env.NODE_ENV === 'development') {
      logger.info('Invite SMS formatted', {
        eventId,
        length: result.text.length,
        encoding: detectSmsEncoding(result.text),
        segments: result.segments,
        includedStop: result.includedStopNotice,
        truncated: result.truncatedBody,
        droppedWedding: result.droppedWedding,
      });
    }

    return result;
  } catch (error) {
    logger.error('Error in formatInviteSms', {
      eventId,
      guestId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Fallback to unformatted message
    incrementFormatterFallback('exception_caught');
    return {
      text: body,
      includedStopNotice: false,
      length: body.length,
      segments: calculateSmsSegments(body),
      droppedLink: false,
      truncatedBody: false,
      included: { header: false, brand: false, stop: false },
      reason: 'fallback',
    };
  }
}

/**
 * Apply length budget constraints for invite SMS to ensure single segment
 * Priority: 1. Trim EventTag if >24 chars, 2. Drop "wedding" if still too long
 */
function applyInviteLengthBudget(
  smsTag: string | null,
  eventTitle: string,
  body: string
): SmsFormatResult & { droppedWedding?: boolean } {
  const SMS_SINGLE_SEGMENT_LIMIT = 160;
  const TRUNCATION_SUFFIX = '…';

  // Start with full event tag (24 char limit)
  let eventTag = generateEventTagExtended(smsTag, eventTitle, 24);
  let processedBody = normalizeToGsm7(body.trim());
  let droppedWedding = false;

  // Try full message with colon format: "EventTag: message"
  let fullText = `${eventTag}: ${processedBody}`;
  
  if (fullText.length <= SMS_SINGLE_SEGMENT_LIMIT) {
    return {
      text: fullText,
      includedStopNotice: processedBody.includes('Reply STOP'),
      length: fullText.length,
      segments: calculateSmsSegments(fullText),
      droppedLink: false,
      truncatedBody: false,
      included: { header: true, brand: false, stop: processedBody.includes('Reply STOP') },
      droppedWedding,
    };
  }

  // If too long, try trimming event tag to make room
  const maxTagLength = Math.max(8, SMS_SINGLE_SEGMENT_LIMIT - processedBody.length - 2); // -2 for ": "
  if (eventTag.length > maxTagLength) {
    eventTag = generateEventTagExtended(smsTag, eventTitle, maxTagLength);
    fullText = `${eventTag}: ${processedBody}`;
    
    if (fullText.length <= SMS_SINGLE_SEGMENT_LIMIT) {
      return {
        text: fullText,
        includedStopNotice: processedBody.includes('Reply STOP'),
        length: fullText.length,
        segments: calculateSmsSegments(fullText),
        droppedLink: false,
        truncatedBody: false,
        included: { header: true, brand: false, stop: processedBody.includes('Reply STOP') },
        droppedWedding,
      };
    }
  }

  // If still too long, drop "wedding" from the message
  const weddingPattern = /\bwedding\b/gi;
  if (weddingPattern.test(processedBody)) {
    processedBody = processedBody.replace(weddingPattern, '').replace(/\s+/g, ' ').trim();
    droppedWedding = true;
    fullText = `${eventTag}: ${processedBody}`;
    
    if (fullText.length <= SMS_SINGLE_SEGMENT_LIMIT) {
      return {
        text: fullText,
        includedStopNotice: processedBody.includes('Reply STOP'),
        length: fullText.length,
        segments: calculateSmsSegments(fullText),
        droppedLink: false,
        truncatedBody: false,
        included: { header: true, brand: false, stop: processedBody.includes('Reply STOP') },
        droppedWedding,
      };
    }
  }

  // Last resort: truncate the body
  const availableBodySpace = SMS_SINGLE_SEGMENT_LIMIT - eventTag.length - 2 - TRUNCATION_SUFFIX.length; // -2 for ": "
  if (availableBodySpace > 20) { // Ensure minimum viable message
    const truncatedBody = processedBody.slice(0, availableBodySpace) + TRUNCATION_SUFFIX;
    fullText = `${eventTag}: ${truncatedBody}`;
    
    return {
      text: fullText,
      includedStopNotice: false, // STOP likely truncated
      length: fullText.length,
      segments: 1,
      droppedLink: false,
      truncatedBody: true,
      included: { header: true, brand: false, stop: false },
      droppedWedding,
    };
  }

  // Emergency fallback: just the message without tag
  return {
    text: processedBody,
    includedStopNotice: processedBody.includes('Reply STOP'),
    length: processedBody.length,
    segments: calculateSmsSegments(processedBody),
    droppedLink: false,
    truncatedBody: false,
    included: { header: false, brand: false, stop: processedBody.includes('Reply STOP') },
    droppedWedding,
  };
}

/**
 * Detect SMS encoding (GSM-7 vs UCS-2)
 */
function detectSmsEncoding(text: string): 'GSM-7' | 'UCS-2' {
  // Basic GSM-7 character set check
  const gsm7Pattern = /^[\x20-\x7E\n\r\t\^{}\\\[\]~|€]*$/;
  return gsm7Pattern.test(text) ? 'GSM-7' : 'UCS-2';
}

/**
 * Mark A2P notice as sent for a guest
 */
export async function markA2pNoticeSent(eventId: string, guestId: string): Promise<void> {
  try {
    // Try server client first, fallback to admin client
    let supabase: any;
    try {
      supabase = await createServerSupabaseClient();
    } catch (error) {
      const { supabase: adminClient } = await import('@/lib/supabase/admin');
      supabase = adminClient;
    }
    
    const { error } = await supabase.rpc('mark_a2p_notice_sent', {
      _event_id: eventId,
      _guest_id: guestId,
    });

    if (error) {
      logger.error('Failed to mark A2P notice sent', {
        eventId,
        guestId,
        error: error.message,
      });
    } else {
      logger.info('A2P notice marked as sent', {
        eventId,
        guestId,
      });
    }
  } catch (error) {
    logger.error('Exception marking A2P notice sent', {
      eventId,
      guestId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
