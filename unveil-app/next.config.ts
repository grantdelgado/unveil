import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'wvhtbqvnamerdkkjknuv.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Prevent cross-imports from other workspace packages
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      // Prevent importing from the website package
      '@unveil-website': false,
    };
    return config;
  },
  // PWA and mobile optimizations
  experimental: {
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },
  // Mobile-first performance
  generateEtags: false,
  poweredByHeader: false,
  compress: true,
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: [
          // PWA and mobile optimizations
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Preload',
            value: 'prefetch',
          },
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://wvhtbqvnamerdkkjknuv.supabase.co https://avatars.githubusercontent.com",
              "media-src 'self' blob: https://wvhtbqvnamerdkkjknuv.supabase.co",
              "connect-src 'self' https://wvhtbqvnamerdkkjknuv.supabase.co wss://wvhtbqvnamerdkkjknuv.supabase.co https://api.twilio.com https://*.ingest.sentry.io",
              "frame-src 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              'upgrade-insecure-requests',
              "manifest-src 'self'", // PWA manifest support
            ].join('; '),
          },
          // Security headers
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: [
              'camera=(),',
              'microphone=(),',
              'geolocation=(),',
              'interest-cohort=()',
            ].join(' '),
          },
        ],
      },
      {
        // PWA manifest with proper caching
        source: '/manifest.json',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/manifest+json',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400', // 24 hours
          },
        ],
      },
      {
        // Service worker
        source: '/sw.js',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=0', // No cache for SW
          },
        ],
      },
      {
        // Static assets optimization
        source: '/icons/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable', // 1 year
          },
        ],
      },
      {
        // Additional headers for API routes
        source: '/api/(.*)',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex',
          },
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      // PWA offline support
      {
        source: '/offline',
        destination: '/offline.html',
      },
    ];
  },
};

// Wrap with Sentry config for error tracking and performance monitoring
export default withSentryConfig(nextConfig, {
  // Sentry build-time configuration
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  
  // Upload source maps in production for better error tracking
  silent: process.env.NODE_ENV === 'production',
  widenClientFileUpload: true,
  reactComponentAnnotation: {
    enabled: true,
  },
  tunnelRoute: '/monitoring',
  sourcemaps: {
    disable: true,
  },
  disableLogger: process.env.NODE_ENV === 'production',
});
