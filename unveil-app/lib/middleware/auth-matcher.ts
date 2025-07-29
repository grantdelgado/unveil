import { NextRequest } from 'next/server';

/**
 * Route patterns for different auth requirements
 */
export const ROUTE_PATTERNS = {
  // Public routes that don't require authentication
  PUBLIC: [
    '/',
    '/login',
    '/reset-password',
    '/_next',
    '/favicon.ico',
    '/api/webhooks',
    '/offline.html',
  ],

  // Protected routes that require authentication
  PROTECTED: ['/select-event', '/profile', '/setup', '/no-events'],

  // Host-only routes
  HOST_ONLY: ['/host'],

  // Guest-only routes
  GUEST_ONLY: ['/guest'],

  // API routes (handled separately)
  API: ['/api'],
} as const;

/**
 * Route classification for auth decisions
 */
export type RouteType =
  | 'public'
  | 'protected'
  | 'host_only'
  | 'guest_only'
  | 'api';

/**
 * Auth requirements for a route
 */
export interface RouteAuthRequirement {
  type: RouteType;
  requiresAuth: boolean;
  requiresRole?: 'host' | 'guest';
  allowedWithoutProfile?: boolean;
}

/**
 * Determine if a path matches any pattern in a list
 */
function matchesPattern(
  pathname: string,
  patterns: readonly string[],
): boolean {
  return patterns.some((pattern) => {
    // Exact match
    if (pattern === pathname) return true;

    // Prefix match (for routes like /host/*, /guest/*, etc.)
    if (pattern.endsWith('/') && pathname.startsWith(pattern)) return true;
    if (!pattern.endsWith('/') && pathname.startsWith(pattern + '/'))
      return true;

    return false;
  });
}

/**
 * Classify a route based on its path
 */
export function classifyRoute(pathname: string): RouteAuthRequirement {
  // Check public routes first
  if (matchesPattern(pathname, ROUTE_PATTERNS.PUBLIC)) {
    return {
      type: 'public',
      requiresAuth: false,
    };
  }

  // Check API routes
  if (matchesPattern(pathname, ROUTE_PATTERNS.API)) {
    return {
      type: 'api',
      requiresAuth: true, // API middleware handles this separately
    };
  }

  // Check role-specific routes
  if (matchesPattern(pathname, ROUTE_PATTERNS.HOST_ONLY)) {
    return {
      type: 'host_only',
      requiresAuth: true,
      requiresRole: 'host',
    };
  }

  if (matchesPattern(pathname, ROUTE_PATTERNS.GUEST_ONLY)) {
    return {
      type: 'guest_only',
      requiresAuth: true,
      requiresRole: 'guest',
    };
  }

  // Check general protected routes
  if (matchesPattern(pathname, ROUTE_PATTERNS.PROTECTED)) {
    return {
      type: 'protected',
      requiresAuth: true,
      allowedWithoutProfile: pathname === '/setup', // Setup page allows incomplete profiles
    };
  }

  // Default: treat unknown routes as protected
  return {
    type: 'protected',
    requiresAuth: true,
  };
}

/**
 * Extract auth token from request
 */
export function extractAuthToken(request: NextRequest): string | null {
  // Check Authorization header first
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.replace('Bearer ', '');
  }

  // Check cookies for session token
  const sessionCookie = request.cookies.get('sb-access-token');
  if (sessionCookie?.value) {
    return sessionCookie.value;
  }

  return null;
}

/**
 * Generate redirect URL with preserved query params
 */
export function createRedirectUrl(
  request: NextRequest,
  targetPath: string,
  preserveReturnUrl: boolean = true,
): URL {
  const redirectUrl = new URL(targetPath, request.url);

  // Preserve original destination for post-login redirect
  if (preserveReturnUrl && request.nextUrl.pathname !== '/') {
    redirectUrl.searchParams.set(
      'returnUrl',
      request.nextUrl.pathname + request.nextUrl.search,
    );
  }

  return redirectUrl;
}

/**
 * Check if route should be skipped entirely by middleware
 */
export function shouldSkipRoute(pathname: string): boolean {
  const skipPatterns = [
    '/_next/static',
    '/_next/image',
    '/favicon.ico',
    '/manifest.json',
    '/offline.html',
    '/icons/',
    '/images/',
  ];

  return skipPatterns.some((pattern) => pathname.startsWith(pattern));
}

/**
 * Log auth decision for debugging
 */
export function logAuthDecision(
  pathname: string,
  decision: RouteAuthRequirement,
  hasAuth: boolean,
  action: 'allow' | 'redirect' | 'deny',
): void {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Auth Middleware] ${pathname}:`, {
      type: decision.type,
      requiresAuth: decision.requiresAuth,
      hasAuth,
      action,
      timestamp: new Date().toISOString(),
    });
  }
}
