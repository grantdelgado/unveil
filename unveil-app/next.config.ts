import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

// Bundle analyzer for performance optimization
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  // Enhanced image optimization for performance
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'wvhtbqvnamerdkkjknuv.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
    // Enable modern image formats for better performance
    formats: ['image/avif', 'image/webp'],
    // Optimize image loading
    minimumCacheTTL: 86400, // 24 hours
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Bundle size budgets for performance optimization
  experimental: {
    optimizePackageImports: ['lucide-react', '@tanstack/react-query'],
    clientTraceMetadata: ['appDir', 'turbopack'],
  },
  // Enhanced modular imports for better tree-shaking
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{member}}',
      skipDefaultConversion: true,
    },
    'lodash': {
      transform: 'lodash/{{member}}',
    },
    'lodash-es': {
      transform: 'lodash-es/{{member}}',
    },
    'date-fns': {
      transform: 'date-fns/{{member}}',
    },
  },
  // Consolidated webpack configuration
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      // Prevent importing from the website package
      '@unveil-website': false,
    };

    // Suppress Supabase realtime warnings about dynamic imports
    config.ignoreWarnings = [
      {
        module: /@supabase\/realtime-js/,
        message:
          /Critical dependency: the request of a dependency is an expression/,
      },
    ];

    // Add bundle size warnings for client-side bundles in production
    if (process.env.NODE_ENV === 'production' && !isServer) {
      config.performance = {
        ...config.performance,
        maxAssetSize: 220000, // 220KB warning threshold
        maxEntrypointSize: 250000, // 250KB error threshold
        hints: 'warning',
      };

      // Keep default Next.js chunk splitting - it's already optimized
    }

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

  // Mobile-first performance
  generateEtags: false,
  poweredByHeader: false,
  compress: true,
  async headers() {
    // CSP is stricter in production (no unsafe-eval)
    // Development needs unsafe-eval for hot reloading
    const isDev = process.env.NODE_ENV === 'development';
    
    // Build script-src based on environment
    // Production: Remove unsafe-eval for better XSS protection
    // Development: Keep unsafe-eval for hot reload, debugging
    const scriptSrc = isDev
      ? "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com"
      : "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com";

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
          // Note: unsafe-inline for styles is required for Tailwind and most CSS-in-JS
          // Note: unsafe-inline for scripts is kept for Next.js inline scripts (nonces would be better but require middleware)
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              scriptSrc,
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
        // Apple App Site Association for Universal Links
        source: '/.well-known/apple-app-site-association',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/json',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=300, s-maxage=300, stale-while-revalidate=60', // 5 minutes
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
        // Next.js static assets optimization
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable', // 1 year
          },
        ],
      },
      {
        // Image optimization with longer cache
        source: '/_next/image(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400', // 24 hours
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
  }),
);
