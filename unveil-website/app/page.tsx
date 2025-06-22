import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative py-20 lg:py-32 overflow-hidden">
        {/* Enhanced background */}
        <div className="absolute inset-0 bg-gradient-to-br from-white via-rose-50/30 to-purple-50/30"></div>
        
        {/* Floating decorative elements */}
        <div className="absolute top-20 left-10 w-20 h-20 bg-rose-100 rounded-full opacity-20"></div>
        <div className="absolute bottom-20 right-10 w-16 h-16 bg-purple-100 rounded-full opacity-20"></div>
        
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Logo section */}
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl shadow-lg mb-6">
              <div className="w-10 h-10 bg-rose-500 rounded-lg flex items-center justify-center">
                <span className="text-white text-lg">♥</span>
              </div>
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6 tracking-tight">
              <span className="bg-gradient-to-r from-rose-500 to-purple-600 bg-clip-text text-transparent">Unveil</span>
            </h1>
          </div>

          {/* Value proposition */}
          <div className="mb-8">
            <p className="text-lg sm:text-xl text-gray-700 leading-relaxed mb-8 max-w-2xl mx-auto">
              Streamline wedding communication and preserve shared memories in one elegant space
            </p>
          </div>

          {/* CTA Button */}
          <div className="mb-12">
            <Link 
              href="/how-it-works" 
              className="inline-flex items-center gap-2 bg-gradient-to-r from-rose-500 to-purple-600 text-white font-medium px-8 py-4 rounded-full text-lg shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105"
            >
              Learn How It Works
              <span>→</span>
            </Link>
          </div>

          {/* Subtle brand accent line */}
          <div className="mt-12">
            <div className="h-px bg-gradient-to-r from-transparent via-rose-200 to-transparent max-w-xs mx-auto"></div>
          </div>
        </div>
      </section>

      {/* Enhanced divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-purple-200 to-transparent max-w-2xl mx-auto"></div>
    </div>
  )
} 