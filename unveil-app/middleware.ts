import { NextRequest, NextResponse } from 'next/server';
import { extractAuthToken, classifyRoute, logAuthDecision, createRedirectUrl } from '@/lib/middleware/auth-matcher';
import { checkApiRateLimit, getClientIdentifier } from '@/lib/rate-limit';

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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Handle obsolete route redirects (Phase 1 cleanup)
  if (pathname === '/dashboard') {
    return NextResponse.redirect(new URL('/select-event', request.url));
  }
  
  if (pathname === '/guest/home') {
    return NextResponse.redirect(new URL('/select-event', request.url));
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

  // Apply rate limiting to API routes using Upstash Redis
  if (pathname.startsWith('/api/')) {
    const clientId = getClientIdentifier(request.headers);
    const rateLimit = await checkApiRateLimit(clientId, pathname);

    if (!rateLimit.success) {
      const retryAfter = Math.ceil((rateLimit.reset - Date.now()) / 1000);

      const response = NextResponse.json(
        {
          error: 'Rate limit exceeded',
          retryAfter,
          message: `Too many requests. Please try again in ${retryAfter} seconds.`,
        },
        { status: 429 },
      );

      response.headers.set('Retry-After', retryAfter.toString());
      response.headers.set('X-RateLimit-Limit', rateLimit.limit.toString());
      response.headers.set('X-RateLimit-Remaining', '0');
      response.headers.set('X-RateLimit-Reset', rateLimit.reset.toString());

      return addSecurityHeaders(response);
    }

    // Add rate limit headers to successful responses
    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', rateLimit.limit.toString());
    response.headers.set(
      'X-RateLimit-Remaining',
      rateLimit.remaining.toString(),
    );
    response.headers.set('X-RateLimit-Reset', rateLimit.reset.toString());

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
