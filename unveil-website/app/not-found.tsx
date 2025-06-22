'use client'

import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-white/95 backdrop-blur">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-rose-500 to-purple-600">
                <span className="text-white text-sm">♥</span>
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-rose-500 to-purple-600 bg-clip-text text-transparent">Unveil</span>
            </Link>
          </div>
        </div>
      </header>

      {/* 404 Content */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto text-center">
          <div className="mb-8">
            <div className="w-24 h-24 bg-gradient-to-r from-rose-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-white text-4xl">♥</span>
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Page Not Found</h1>
            <p className="text-lg text-gray-600 mb-8">
              Sorry, we couldn&apos;t find the page you&apos;re looking for. 
              It might have been moved or doesn&apos;t exist.
            </p>
          </div>

          <div className="space-y-4">
            <Link href="/" className="block">
              <button className="w-full bg-gradient-to-r from-rose-500 to-purple-600 text-white font-medium px-8 py-4 rounded-lg hover:shadow-lg transition-all duration-300 hover:scale-105 flex items-center justify-center gap-2">
                <span className="text-sm">🏠</span>
                Back to Home
              </button>
            </Link>
            
            <button 
              className="w-full border border-gray-300 text-gray-700 font-medium px-8 py-4 rounded-lg hover:bg-gray-50 transition-all duration-300 flex items-center justify-center gap-2"
              onClick={() => window.history.back()}
            >
              <span className="text-sm">←</span>
              Go Back
            </button>
          </div>

          {/* Help Links */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <p className="text-sm text-gray-500 mb-4">Looking for something specific?</p>
            <div className="space-y-2">
              <Link 
                href="/policies#guest-consent" 
                className="block text-sm text-blue-600 hover:text-blue-800"
              >
                Guest Consent Documentation
              </Link>
              <Link 
                href="/policies" 
                className="block text-sm text-blue-600 hover:text-blue-800"
              >
                Privacy & SMS Policies
              </Link>
              <a 
                href="mailto:hello@sendunveil.com" 
                className="block text-sm text-blue-600 hover:text-blue-800"
              >
                Contact Support
              </a>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-gray-50 py-6">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-sm text-gray-600">
            © {new Date().getFullYear()} Unveil. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
} 