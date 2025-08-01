import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

// Bundle analyzer for performance optimization
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

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
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
  experimental: {
    clientTraceMetadata: ['appDir', 'turbopack'],
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

// Wrap with bundle analyzer and Sentry config for performance optimization and error tracking
export default withBundleAnalyzer(
  withSentryConfig(nextConfig, {
    // Sentry build-time configuration
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    
    // Upload source maps in production for better error tracking
    silent: true, // Always silent to reduce console noise
    widenClientFileUpload: true,
    reactComponentAnnotation: {
      enabled: true,
    },
    tunnelRoute: '/monitoring',
    sourcemaps: {
      disable: true,
    },
    disableLogger: true, // Always disable logger
  })
);
