import { NextRequest, NextResponse } from 'next/server';
import { extractAuthToken, classifyRoute, logAuthDecision, createRedirectUrl } from '@/lib/middleware/auth-matcher';

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMITS = {
  '/api/auth': { requests: 10, window: RATE_LIMIT_WINDOW }, // 10 auth requests per minute
  '/api/sms': { requests: 5, window: RATE_LIMIT_WINDOW }, // 5 SMS requests per minute
  '/api/media': { requests: 20, window: RATE_LIMIT_WINDOW }, // 20 media requests per minute
  '/api': { requests: 100, window: RATE_LIMIT_WINDOW }, // 100 general API requests per minute
};

// In-memory rate limit store (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Get client identifier (IP + User Agent hash)
function getClientId(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwarded ? forwarded.split(',')[0] : realIp || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  // Simple hash for user agent to avoid storing full strings
  const uaHash = userAgent.split('').reduce((a, b) => {
    a = (a << 5) - a + b.charCodeAt(0);
    return a & a;
  }, 0);

  return `${ip}:${uaHash}`;
}

// Check rate limit for a given route
function checkRateLimit(
  clientId: string,
  route: string,
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();

  // Find matching rate limit config
  let config = RATE_LIMITS[route as keyof typeof RATE_LIMITS];
  if (!config) {
    // Check for partial matches (e.g., /api/auth/login matches /api/auth)
    const matchingRoute = Object.keys(RATE_LIMITS).find((key) =>
      route.startsWith(key),
    );
    config = matchingRoute
      ? RATE_LIMITS[matchingRoute as keyof typeof RATE_LIMITS]
      : RATE_LIMITS['/api'];
  }

  const key = `${clientId}:${route}`;
  const current = rateLimitStore.get(key);

  if (!current || now > current.resetTime) {
    // First request or window expired
    const resetTime = now + config.window;
    rateLimitStore.set(key, { count: 1, resetTime });
    return { allowed: true, remaining: config.requests - 1, resetTime };
  }

  if (current.count >= config.requests) {
    // Rate limit exceeded
    return { allowed: false, remaining: 0, resetTime: current.resetTime };
  }

  // Increment counter
  current.count++;
  rateLimitStore.set(key, current);

  return {
    allowed: true,
    remaining: config.requests - current.count,
    resetTime: current.resetTime,
  };
}

// Clean up expired entries periodically
function cleanupRateLimitStore() {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// Security headers for all responses
function addSecurityHeaders(response: NextResponse): NextResponse {
  // CSRF protection
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // Remove server information
  response.headers.delete('Server');
  response.headers.delete('X-Powered-By');

  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Clean up rate limit store occasionally
  if (Math.random() < 0.01) {
    // 1% chance per request
    cleanupRateLimitStore();
  }

  // Auth protection for non-API routes
  if (!pathname.startsWith('/api/')) {
    const route = classifyRoute(pathname);
    
    if (route.requiresAuth) {
      const token = extractAuthToken(request);
      
      if (!token) {
        const redirectUrl = createRedirectUrl(request, '/login', true);
        
        // Debug logging (no PII)
        logAuthDecision(pathname, route, false, 'redirect');
        
        return NextResponse.redirect(redirectUrl);
      }
      
      // Log successful auth check
      logAuthDecision(pathname, route, true, 'allow');
    }
  }

  // Apply rate limiting to API routes
  if (pathname.startsWith('/api/')) {
    const clientId = getClientId(request);
    const rateLimit = checkRateLimit(clientId, pathname);

    if (!rateLimit.allowed) {
      const retryAfter = Math.ceil((rateLimit.resetTime - Date.now()) / 1000);

      const response = NextResponse.json(
        {
          error: 'Rate limit exceeded',
          retryAfter,
          message: `Too many requests. Please try again in ${retryAfter} seconds.`,
        },
        { status: 429 },
      );

      response.headers.set('Retry-After', retryAfter.toString());
      response.headers.set('X-RateLimit-Limit', '100');
      response.headers.set('X-RateLimit-Remaining', '0');
      response.headers.set('X-RateLimit-Reset', rateLimit.resetTime.toString());

      return addSecurityHeaders(response);
    }

    // Add rate limit headers to successful responses
    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', '100');
    response.headers.set(
      'X-RateLimit-Remaining',
      rateLimit.remaining.toString(),
    );
    response.headers.set('X-RateLimit-Reset', rateLimit.resetTime.toString());

    return addSecurityHeaders(response);
  }

  // Add security headers to all responses
  return addSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
