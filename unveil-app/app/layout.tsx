import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';

import { APP_CONFIG } from '@/lib/constants';
import { ProvidersStep1 } from './Providers-step1';

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
  display: 'swap',
  preload: true,
  fallback: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
});

export const metadata: Metadata = {
  title: APP_CONFIG.name,
  description: APP_CONFIG.description,
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

/**
 * SMOKE TEST LAYOUT - Minimal root layout for debugging
 * No providers, no complex imports, just basic HTML structure
 */
export default function SmokeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased font-sans touch-manipulation`}>
        <ProvidersStep1>
          {children}
        </ProvidersStep1>
      </body>
    </html>
  );
}
