import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';

import { APP_CONFIG } from '@/lib/constants';
import { Suspense } from 'react';
import { LeanRootProvider } from '@/lib/providers/LeanRootProvider';

// Load auth debug utilities in development
if (process.env.NODE_ENV === 'development') {
  import('@/lib/auth/debugAuth');
}

const inter = localFont({
  src: [
    {
      path: '../public/fonts/inter-variable.woff2',
      style: 'normal',
    },
    {
      path: '../public/fonts/inter-variable-italic.woff2',
      style: 'italic',
    },
  ],
  variable: '--font-inter',
  display: 'swap', // Prevent layout shift
  preload: true, // Preload critical font for LCP text
  fallback: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NODE_ENV === 'production'
      ? process.env.NEXT_PUBLIC_APP_URL || 'https://app.sendunveil.com'
      : 'http://localhost:3000',
  ),
  title: APP_CONFIG.name,
  description: APP_CONFIG.description,
  applicationName: 'Unveil Wedding App',
  authors: [{ name: 'Unveil Team' }],
  generator: 'Next.js',
  keywords: ['wedding', 'photos', 'memories', 'sharing', 'gallery'],
  referrer: 'strict-origin-when-cross-origin',
  creator: 'Unveil Team',
  publisher: 'Unveil',
  robots: 'index, follow',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Unveil',
    startupImage: [
      '/icons/apple-splash-2048-2732.png',
      '/icons/apple-splash-1668-2224.png',
      '/icons/apple-splash-1536-2048.png',
      '/icons/apple-splash-1125-2436.png',
      '/icons/apple-splash-1242-2208.png',
      '/icons/apple-splash-750-1334.png',
      '/icons/apple-splash-828-1792.png',
    ],
  },
  openGraph: {
    type: 'website',
    siteName: 'Unveil Wedding App',
    title: 'Unveil - Your Wedding Memories',
    description: 'Beautifully preserve and share your wedding memories',
    url: process.env.NEXT_PUBLIC_APP_URL || 'https://app.sendunveil.com',
    images: [
      {
        url: '/icons/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Unveil Wedding App',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Unveil - Your Wedding Memories',
    description: 'Beautifully preserve and share your wedding memories',
    images: ['/icons/twitter-image.png'],
  },
  icons: {
    icon: '/icon.png', // served from app/icon.png
    apple: '/apple-icon.png', // served from app/apple-icon.png
    other: [
      {
        rel: 'mask-icon',
        url: '/icons/safari-pinned-tab.svg',
        color: '#E15B50',
      },
    ],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#E15B50',
  colorScheme: 'light',
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* PWA and mobile optimizations */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="application-name" content="Unveil" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Unveil" />

        {/* Explicit Apple touch icons for better iOS compatibility */}
        <link rel="apple-touch-icon" href="/apple-icon.png?v=1755746392" />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/apple-icon.png?v=1755746392"
        />
        <meta name="msapplication-TileColor" content="#E15B50" />
        <meta name="msapplication-config" content="/icons/browserconfig.xml" />
        <meta name="theme-color" content="#E15B50" />

        {/* Performance optimization: Preconnect to critical origins */}
        <link rel="preconnect" href="https://wvhtbqvnamerdkkjknuv.supabase.co" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://wvhtbqvnamerdkkjknuv.supabase.co" crossOrigin="use-credentials" />
        
        {/* DNS prefetch for less critical resources */}
        <link rel="dns-prefetch" href="//fonts.gstatic.com" />
        <link rel="dns-prefetch" href="//api.twilio.com" />
      </head>
      <body
        className={`${inter.variable} antialiased font-sans touch-manipulation`}
      >
        <LeanRootProvider>
          <Suspense
            fallback={
              <div className="flex items-center justify-center min-h-100dvh">
                Loading...
              </div>
            }
          >
{children}
          </Suspense>
        </LeanRootProvider>
      </body>
    </html>
  );
}
