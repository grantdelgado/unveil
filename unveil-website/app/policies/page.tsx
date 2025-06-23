import Image from 'next/image'

export default function PoliciesPage() {
  return (
    <div className="min-h-screen">
      {/* Page Header */}
      <section className="relative py-16 lg:py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white via-gray-50/30 to-slate-50/30"></div>
        
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6 tracking-tight">
              Privacy & <span className="bg-gradient-to-r from-rose-500 to-purple-600 bg-clip-text text-transparent">Policies</span>
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Your privacy and consent are our top priorities. Learn how we protect your data and ensure compliance.
            </p>
          </div>
          
          {/* Decorative divider */}
          <div className="mt-8">
            <div className="h-px bg-gradient-to-r from-transparent via-rose-200 to-transparent max-w-md mx-auto"></div>
          </div>
        </div>
      </section>

      {/* Guest Consent Proof */}
      <section className="py-16 lg:py-20 bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-6">
              Guest <span className="bg-gradient-to-r from-rose-500 to-purple-600 bg-clip-text text-transparent">Consent</span> Proof
            </h2>
            <div className="h-px bg-gradient-to-r from-transparent via-blue-200 to-transparent max-w-xs mx-auto mb-8"></div>
          </div>
          
          <div className="bg-white rounded-2xl border border-gray-100 p-8 lg:p-12 shadow-lg">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl mb-6">
                <span className="text-blue-600 text-2xl">🛡️</span>
              </div>
            </div>
            
            <div className="prose prose-gray max-w-none text-center">
              <p className="text-lg leading-relaxed text-gray-700 mb-8">
                Every guest using Unveil provides <strong>explicit consent</strong> for photo sharing and communication 
                within the wedding event. Here&apos;s how we ensure clear, documented consent:
              </p>
              
              {/* Guest Consent Screenshot */}
              <div className="mb-12 flex justify-center">
                <div className="max-w-sm mx-auto bg-gray-50 rounded-2xl p-4 shadow-lg">
                  <Image
                    src="/screenshots/guest-consent-mockup.png"
                    alt="Guest consent process showing the Add Guest form with clear SMS consent checkbox and explanation"
                    width={300}
                    height={600}
                    className="rounded-xl shadow-sm"
                    priority
                  />
                  <p className="text-sm text-gray-600 mt-3 text-center">
                    Example of clear consent process in Unveil
                  </p>
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-8 text-left mt-12">
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-100">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                    <span className="text-green-600 mr-3">✓</span>
                    Clear Consent Process
                  </h3>
                  <ul className="space-y-3 text-gray-700">
                    <li>• Guests receive clear invitation explaining app purpose</li>
                    <li>• Explicit agreement required before joining event</li>
                    <li>• Terms clearly outline photo sharing permissions</li>
                    <li>• Consent can be withdrawn at any time</li>
                  </ul>
                </div>
                
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border border-purple-100">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                    <span className="text-purple-600 mr-3">📋</span>
                    Documentation & Records
                  </h3>
                  <ul className="space-y-3 text-gray-700">
                    <li>• All consent actions are timestamped and logged</li>
                    <li>• Wedding hosts receive consent confirmation reports</li>
                    <li>• Audit trail available for compliance review</li>
                    <li>• Data retention follows strict privacy guidelines</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Policies Section */}
      <section className="py-16 lg:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-6">
              Our <span className="bg-gradient-to-r from-rose-500 to-purple-600 bg-clip-text text-transparent">Policies</span>
            </h2>
            <div className="h-px bg-gradient-to-r from-transparent via-rose-200 to-transparent max-w-xs mx-auto mb-8"></div>
          </div>
          
          <div className="space-y-8">
            <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-lg">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Privacy Policy</h3>
              <p className="text-gray-700 leading-relaxed">
                We are committed to protecting your privacy and personal information. We collect only the minimum 
                data necessary to provide our wedding communication services, and we never sell or share your 
                personal information with third parties for marketing purposes.
              </p>
            </div>
            
            <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-lg">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Terms of Service</h3>
              <p className="text-gray-700 leading-relaxed">
                By using Unveil, you agree to use our service responsibly and in accordance with our community 
                guidelines. Our platform is designed for celebrating weddings and creating positive memories 
                together.
              </p>
            </div>
            
            <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-lg">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Data Security</h3>
              <p className="text-gray-700 leading-relaxed">
                All data transmitted through our platform is encrypted in transit and at rest. We use industry-standard 
                security measures to protect your photos, messages, and personal information from unauthorized access.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
} 