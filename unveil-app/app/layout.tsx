import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthSessionWatcher } from '@/components/features/auth/AuthSessionWatcher';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { NavigationLayout } from '@/components/features/navigation';
import { ReactQueryProvider } from '@/lib/react-query-client';
import { APP_CONFIG } from '@/lib/constants';
import { Suspense } from 'react';
import { PerformanceMonitor } from '@/components/monitoring/PerformanceMonitor';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NODE_ENV === 'production' ? 'https://unveil.app' : 'http://localhost:3000'),
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
  manifest: '/manifest.json',
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
    url: 'https://unveil.app',
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
    icon: [
      { url: '/icons/icon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      { rel: 'mask-icon', url: '/icons/safari-pinned-tab.svg', color: '#ff89a6' },
    ],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ff89a6' },
    { media: '(prefers-color-scheme: dark)', color: '#ff89a6' },
  ],
  colorScheme: 'light dark',
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
        <link rel="manifest" href="/manifest.json" />
        <meta name="application-name" content="Unveil" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Unveil" />
        <meta name="msapplication-TileColor" content="#ff89a6" />
        <meta name="msapplication-config" content="/icons/browserconfig.xml" />
        <meta name="theme-color" content="#ff89a6" />
        
        {/* Preload critical resources */}
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        <link rel="dns-prefetch" href="//wvhtbqvnamerdkkjknuv.supabase.co" />
      </head>
      <body className={`${inter.variable} antialiased font-sans touch-manipulation`}>
        <ReactQueryProvider>
          <ErrorBoundary>
            <PerformanceMonitor>
              <Suspense>
                <AuthSessionWatcher>
                  <NavigationLayout>{children}</NavigationLayout>
                </AuthSessionWatcher>
              </Suspense>
            </PerformanceMonitor>
          </ErrorBoundary>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
