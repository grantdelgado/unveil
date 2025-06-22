export default function HowItWorksPage() {
  return (
    <div className="min-h-screen">
      {/* Page Header */}
      <section className="relative py-16 lg:py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white via-rose-50/20 to-purple-50/20"></div>
        
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6 tracking-tight">
              How <span className="bg-gradient-to-r from-rose-500 to-purple-600 bg-clip-text text-transparent">Unveil</span> Works
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
              A simple, elegant solution for wedding communication and memory sharing
            </p>
          </div>
          
          {/* Decorative divider */}
          <div className="mt-8">
            <div className="h-px bg-gradient-to-r from-transparent via-rose-200 to-transparent max-w-md mx-auto"></div>
          </div>
        </div>
      </section>

      {/* Simple Explanation Section */}
      <div className="py-16 lg:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* What Unveil Does */}
          <section className="mb-20">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-6">
                What <span className="bg-gradient-to-r from-rose-500 to-purple-600 bg-clip-text text-transparent">Unveil</span> Does
              </h2>
              <div className="h-px bg-gradient-to-r from-transparent via-rose-200 to-transparent max-w-xs mx-auto mb-8"></div>
            </div>
            
            <div className="bg-white rounded-2xl border border-gray-100 p-8 lg:p-12 shadow-lg">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-rose-100 to-purple-100 rounded-2xl mb-6">
                  <div className="w-8 h-8 bg-rose-500 rounded-lg flex items-center justify-center">
                    <span className="text-white">♥</span>
                  </div>
                </div>
              </div>
              
              <p className="text-base leading-relaxed text-gray-700 text-center max-w-3xl mx-auto">
                Unveil is a mobile app designed specifically for weddings. It creates a private space 
                where couples can communicate with their guests, share photos and memories, and coordinate 
                all the details of their special day. Think of it as your wedding&apos;s digital hub — 
                everything your guests need in one elegant, easy-to-use app.
              </p>
            </div>
          </section>

          {/* For Wedding Hosts */}
          <section className="mb-20">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-6">
                For Wedding <span className="bg-gradient-to-r from-rose-500 to-purple-600 bg-clip-text text-transparent">Hosts</span>
              </h2>
              <div className="h-px bg-gradient-to-r from-transparent via-rose-200 to-transparent max-w-xs mx-auto mb-8"></div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-lg">
                <div className="flex items-center mb-6">
                  <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl mr-4">
                    <span className="text-green-600 text-lg">💬</span>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900">Easy Communication</h3>
                </div>
                <ul className="space-y-3 text-gray-700">
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    Send updates and announcements to all guests instantly
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    Create group conversations for different wedding events
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    Share important details like venue changes or timing updates
                  </li>
                </ul>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-lg">
                <div className="flex items-center mb-6">
                  <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl mr-4">
                    <span className="text-blue-600 text-lg">👥</span>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900">Guest Management</h3>
                </div>
                <ul className="space-y-3 text-gray-700">
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    Track RSVPs and guest responses in real-time
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    Organize guests into groups (family, friends, wedding party)
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    Send targeted messages to specific guest groups
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* For Wedding Guests */}
          <section className="mb-20">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-6">
                For Wedding <span className="bg-gradient-to-r from-rose-500 to-purple-600 bg-clip-text text-transparent">Guests</span>
              </h2>
              <div className="h-px bg-gradient-to-r from-transparent via-rose-200 to-transparent max-w-xs mx-auto mb-8"></div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-lg">
                <div className="flex items-center mb-6">
                  <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl mr-4">
                    <span className="text-purple-600 text-lg">📸</span>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900">Photo Sharing</h3>
                </div>
                <ul className="space-y-3 text-gray-700">
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    Share photos and videos from the wedding instantly
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    View all shared memories in one beautiful gallery
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    Download photos to keep your favorite moments forever
                  </li>
                </ul>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-lg">
                <div className="flex items-center mb-6">
                  <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-rose-100 to-orange-100 rounded-xl mr-4">
                    <span className="text-rose-600 text-lg">✨</span>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900">Stay Connected</h3>
                </div>
                <ul className="space-y-3 text-gray-700">
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-rose-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    Receive real-time updates about wedding events
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-rose-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    Chat with other guests and the wedding party
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-rose-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    Access all wedding information in one convenient place
                  </li>
                </ul>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  )
} 