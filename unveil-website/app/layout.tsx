import type { Metadata, Viewport } from 'next'
import Link from 'next/link'
import './globals.css'

export const metadata: Metadata = {
  title: 'Unveil - Wedding Communication Made Simple',
  description: 'Streamline wedding communication and preserve shared memories in one elegant space.',
  keywords: 'wedding, communication, photo sharing, event planning, guests, memories',
  authors: [{ name: 'Unveil Team' }],
  creator: 'Unveil',
  publisher: 'Unveil',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://www.sendunveil.com',
    siteName: 'Unveil',
    title: 'Unveil - Wedding Communication Made Simple',
    description: 'Streamline wedding communication and preserve shared memories in one elegant space.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Unveil - Wedding Communication Made Simple',
    description: 'Streamline wedding communication and preserve shared memories in one elegant space.',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

// Simple Header Component (Server)
function SimpleHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200/50 bg-white/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-rose-500 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm">♥</span>
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-rose-500 to-purple-600 bg-clip-text text-transparent">Unveil</span>
          </Link>
          <div className="flex items-center space-x-4">
            <nav className="hidden md:flex items-center space-x-8">
              <Link href="/" className="text-gray-700 hover:text-gray-900 font-medium">Home</Link>
              <Link href="/how-it-works" className="text-gray-700 hover:text-gray-900 font-medium">How It Works</Link>
              <Link href="/policies" className="text-gray-700 hover:text-gray-900 font-medium">Policies</Link>
            </nav>
            <a
              href="https://app.sendunveil.com"
              className="inline-flex items-center gap-1 bg-gradient-to-r from-rose-500 to-purple-600 text-white font-medium px-4 py-2 rounded-full text-sm shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105"
              id="cta-open-app-nav"
            >
              Open the App
              <span className="text-xs">→</span>
            </a>
          </div>
        </div>
      </div>
    </header>
  )
}

// Simple Footer Component (Server)
function SimpleFooter() {
  return (
    <footer className="bg-gradient-to-br from-gray-50 to-slate-100 border-t border-gray-200/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-6 h-6 bg-rose-500 rounded-md flex items-center justify-center">
              <span className="text-white text-xs">♥</span>
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-rose-500 to-purple-600 bg-clip-text text-transparent">Unveil</span>
          </div>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            Making wedding communication and memory sharing simple and elegant
          </p>
          <div className="h-px bg-gradient-to-r from-transparent via-rose-200 to-transparent max-w-xs mx-auto mb-8"></div>
          <div className="space-y-4 text-sm text-gray-500">
            <p>
              Questions? Contact us at{' '}
              <a href="mailto:hello@sendunveil.com" className="text-rose-600 hover:text-rose-700 underline">
                hello@sendunveil.com
              </a>
            </p>
            <div className="flex items-center justify-center gap-6">
              <Link href="/policies" className="hover:text-gray-700">Privacy Policy</Link>
              <span className="text-gray-300">•</span>
              <Link href="/how-it-works" className="hover:text-gray-700">How It Works</Link>
            </div>
            <p className="text-xs text-gray-400 pt-4">
              © 2025 Unveil Labs, Inc. Made with ♥ for couples everywhere.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="antialiased">
        <div className="min-h-screen flex flex-col">
          <SimpleHeader />
          <main className="flex-1">
            {children}
          </main>
          <SimpleFooter />
        </div>
      </body>
    </html>
  )
} 