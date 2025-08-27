/**
 * Realtime Error Normalizer
 * 
 * Classifies and normalizes realtime/WebSocket errors for better logging.
 * Distinguishes between expected connection events vs actual errors.
 * PII-safe: truncates raw error strings and excludes sensitive data.
 */

export type RTErrorContext = {
  /** Which phase of the subscription lifecycle */
  phase: 'subscribe' | 'join' | 'message' | 'heartbeat' | 'cleanup';
  /** Channel identifier for sampling (e.g., eventId:stream:type) */
  channelKey?: string;
  /** Current manager/connection state */
  state?: string;
  /** Network online status */
  online?: boolean;
  /** Tab visibility status */
  visible?: boolean;
};

export type NormalizedRTError = {
  /** Error classification */
  kind: 'connection' | 'timeout' | 'offline' | 'auth' | 'unknown';
  /** Human-readable summary */
  summary: string;
  /** Whether this is expected/transient (should be warn-level) */
  ignorable: boolean;
  /** Sampling key for deduplication */
  key: string;
  /** Truncated raw error payload (PII-safe) */
  raw?: string;
  /** Context information */
  ctx: RTErrorContext;
};

/**
 * Normalize a realtime error for consistent logging and classification
 */
export function normalizeRealtimeError(
  err: unknown, 
  ctx: RTErrorContext, 
  tunables = { max: 200 }
): NormalizedRTError {
  // Get current online/visibility state if not provided
  const online = ctx.online ?? (typeof navigator !== 'undefined' ? navigator.onLine : undefined);
  const visible = ctx.visible ?? (typeof document !== 'undefined' ? !document.hidden : undefined);

  // Empty/undefined error → connection/timeout bucket
  // This is the most common case from WebSocket disconnects
  // Note: Don't treat Error objects as empty even if they have no enumerable properties
  if (err == null || (typeof err === 'object' && !(err instanceof Error) && Object.keys(err as object).length === 0)) {
    const kind = online === false ? 'offline' : 'connection';
    const summary = kind === 'offline' 
      ? 'Offline: lost network; realtime paused' 
      : 'Connection change: socket closed/restarting';
    
    return {
      kind,
      summary,
      ignorable: true, // These are expected
      key: `${kind}:${ctx.phase}:${visible ? 'fg' : 'bg'}`,
      ctx: { ...ctx, online, visible },
    };
  }

  // Convert error to string for analysis
  const raw = String(err);
  const rawTrunc = raw.length > (tunables.max ?? 200) 
    ? raw.slice(0, tunables.max) + '…' 
    : raw;

  // Heuristics for common error types
  const isTimeout = /timeout|timed out|ETIMEDOUT/i.test(raw);
  const isAuth = /auth|token|jwt|unauthorized|forbidden/i.test(raw);
  const isNetwork = /network|connection|socket|websocket|disconnect/i.test(raw);

  let kind: NormalizedRTError['kind'];
  let summary: string;
  let ignorable: boolean;

  if (isTimeout) {
    kind = 'timeout';
    summary = 'Join/handshake timeout';
    ignorable = true; // Timeouts are expected, especially in background
  } else if (isAuth) {
    kind = 'auth';
    summary = 'Auth refresh required';
    ignorable = false; // Auth issues need attention
  } else if (isNetwork || online === false) {
    kind = online === false ? 'offline' : 'connection';
    summary = kind === 'offline' 
      ? 'Network offline detected'
      : 'Socket/connection event';
    ignorable = true; // Network issues are expected
  } else {
    kind = 'unknown';
    summary = 'Unclassified realtime error';
    ignorable = false; // Unknown errors need investigation
  }

  return {
    kind,
    summary,
    ignorable,
    key: `${kind}:${ctx.phase}:${visible ? 'fg' : 'bg'}`,
    raw: rawTrunc,
    ctx: { ...ctx, online, visible },
  };
}

/**
 * Check if an error should be treated as ignorable based on context
 */
export function isIgnorableError(err: unknown, ctx: RTErrorContext): boolean {
  const normalized = normalizeRealtimeError(err, ctx);
  return normalized.ignorable;
}

/**
 * Get a sampling key for error deduplication
 */
export function getErrorSamplingKey(err: unknown, ctx: RTErrorContext): string {
  const normalized = normalizeRealtimeError(err, ctx);
  return normalized.key;
}
