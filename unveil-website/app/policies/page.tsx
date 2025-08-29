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
              Your privacy and consent are our top priorities. Learn how we protect your data, handle phone authentication, and ensure SMS compliance.
            </p>
          </div>
          
          {/* Decorative divider */}
          <div className="mt-8">
            <div className="h-px bg-gradient-to-r from-transparent via-rose-200 to-transparent max-w-md mx-auto"></div>
          </div>
        </div>
      </section>

      {/* Consolidated Policies */}
      <section className="py-16 lg:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-12">
            
            {/* 1. Phone Authentication & SMS Verification */}
            <div className="bg-white rounded-2xl border border-gray-100 p-8 lg:p-12 shadow-lg">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl mb-6">
                  <span className="text-blue-600 text-2xl">📱</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-4">
                  Phone Authentication & <span className="bg-gradient-to-r from-rose-500 to-purple-600 bg-clip-text text-transparent">SMS Verification</span>
                </h2>
              </div>
              
              <div className="text-gray-700 leading-relaxed space-y-6">
                <p className="text-lg text-center">
                  <strong>By providing your phone number during signup, you consent to receive SMS verification codes and event-related communications.</strong> 
                  Your phone number is required for secure account access via two-factor authentication.
                </p>
                
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-100">
                    <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                      <span className="text-green-600 mr-3">⚡</span>
                      How It Works
                    </h3>
                    <ul className="space-y-2 text-gray-700">
                      <li>• Express consent obtained during account creation</li>
                      <li>• SMS verification codes for secure account access</li>
                      <li>• Event updates and RSVP confirmations from wedding hosts</li>
                      <li>• No separate marketing opt-in required</li>
                    </ul>
                  </div>
                  
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
                    <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                      <span className="text-blue-600 mr-3">📋</span>
                      Message Details
                    </h3>
                    <ul className="space-y-2 text-gray-700">
                      <li>• Transactional and account notification messages only</li>
                      <li>• Message frequency varies based on account activity</li>
                      <li>• Reply <strong>STOP</strong> to opt-out at any time</li>
                      <li>• Standard message and data rates may apply</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. SMS Consent During Sign-Up */}
            <div className="bg-white rounded-2xl border border-gray-100 p-8 lg:p-12 shadow-lg">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl mb-6">
                  <span className="text-indigo-600 text-2xl">💬</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-4">
                  SMS Consent During <span className="bg-gradient-to-r from-rose-500 to-purple-600 bg-clip-text text-transparent">Sign-Up</span>
                </h2>
              </div>
              
              <div className="text-gray-700 leading-relaxed space-y-8">
                <p className="text-lg text-center">
                  When signing up for Unveil, users are prompted to enter their phone number and agree to receive SMS messages. This screen includes a disclosure stating: <strong>&quot;I consent to receive event notifications via SMS (RSVPs, reminders, updates). Msg &amp; Data rates may apply. Reply STOP to opt out.&quot;</strong>
                </p>
                
                <div className="flex justify-center">
                  <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl p-6 border border-gray-200 max-w-sm">
                    <Image
                      src="/screenshots/signup-consent-mockup.png"
                      alt="Screenshot of Unveil mobile app phone number entry screen during sign-up"
                      width={300}
                      height={600}
                      className="rounded-lg shadow-md mx-auto"
                      priority={false}
                    />
                    <p className="text-sm text-gray-600 text-center mt-4">
                      Sign-up consent screen showing SMS opt-in disclosure
                    </p>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-6 border border-amber-100">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                    <span className="text-amber-600 mr-3">📋</span>
                    Key Privacy Protections
                  </h3>
                  <ul className="space-y-2 text-gray-700">
                    <li>• <strong>No third-party sharing:</strong> Phone numbers are never shared with third parties for marketing purposes</li>
                    <li>• <strong>Transactional only:</strong> Messages are strictly for identity verification and account login</li>
                    <li>• <strong>Clear opt-out:</strong> Users can reply STOP at any time to unsubscribe from SMS</li>
                    <li>• <strong>Transparent disclosure:</strong> All consent language is clearly presented during sign-up</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* 3. Data Usage & Retention */}
            <div className="bg-white rounded-2xl border border-gray-100 p-8 lg:p-12 shadow-lg">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-100 to-pink-100 rounded-2xl mb-6">
                  <span className="text-purple-600 text-2xl">🔒</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-4">
                  Data Usage & <span className="bg-gradient-to-r from-rose-500 to-purple-600 bg-clip-text text-transparent">Retention</span>
                </h2>
              </div>
              
              <div className="text-gray-700 leading-relaxed space-y-6">
                <p className="text-lg text-center">
                  We collect only the minimum data necessary to provide our wedding communication services. 
                  <strong> Phone numbers are used exclusively for account verification and wedding event communication—never for marketing.</strong>
                </p>
                
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold text-gray-900 flex items-center">
                      <span className="text-purple-600 mr-3">📞</span>
                      Phone Number Usage
                    </h3>
                    <ul className="space-y-2 text-gray-700">
                      <li>• Account security and two-factor authentication</li>
                      <li>• Wedding event coordination and communication</li>
                      <li>• RSVP confirmations and important updates</li>
                      <li>• No marketing, promotional, or advertising use</li>
                    </ul>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold text-gray-900 flex items-center">
                      <span className="text-purple-600 mr-3">🛡️</span>
                      Security & Sharing
                    </h3>
                    <ul className="space-y-2 text-gray-700">
                      <li>• All data encrypted in transit and at rest</li>
                      <li>• Shared only with Twilio for SMS delivery</li>
                      <li>• Retained only as long as necessary for service</li>
                      <li>• Industry-standard security measures applied</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. User Rights & Control */}
            <div className="bg-white rounded-2xl border border-gray-100 p-8 lg:p-12 shadow-lg">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-100 to-emerald-100 rounded-2xl mb-6">
                  <span className="text-green-600 text-2xl">⚖️</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-4">
                  User Rights & <span className="bg-gradient-to-r from-rose-500 to-purple-600 bg-clip-text text-transparent">Control</span>
                </h2>
              </div>
              
              <div className="text-gray-700 leading-relaxed space-y-6">
                <p className="text-lg text-center">
                  You have full control over your data and communications. 
                  <strong> You can withdraw consent, request data deletion, or modify preferences at any time.</strong>
                </p>
                
                <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl p-8">
                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <h3 className="text-xl font-semibold text-gray-900 flex items-center">
                        <span className="text-green-600 mr-3">✓</span>
                        Your Rights
                      </h3>
                      <ul className="space-y-2 text-gray-700">
                        <li>• Withdraw SMS consent by replying <strong>STOP</strong></li>
                        <li>• Request phone number and data deletion</li>
                        <li>• Access your consent and communication history</li>
                        <li>• Control communication preferences</li>
                      </ul>
                    </div>
                    
                    <div className="space-y-4">
                      <h3 className="text-xl font-semibold text-gray-900 flex items-center">
                        <span className="text-green-600 mr-3">📋</span>
                        Terms & Conditions
                      </h3>
                      <ul className="space-y-2 text-gray-700">
                        <li>• Phone verification required for account access</li>
                        <li>• Platform designed for wedding celebration use</li>
                        <li>• All consent actions logged with timestamps</li>
                        <li>• Audit trail available for compliance review</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Compliance & Contact */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-8 lg:p-12 shadow-lg">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-rose-100 to-orange-100 rounded-2xl mb-6">
                  <span className="text-rose-600 text-2xl">📧</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-4">
                  Compliance & <span className="bg-gradient-to-r from-rose-500 to-purple-600 bg-clip-text text-transparent">Contact</span>
                </h2>
              </div>
              
              <div className="text-gray-700 leading-relaxed space-y-6">
                <p className="text-lg text-center">
                  Questions about SMS communications, consent, or data usage? 
                  <strong> We&apos;re here to help and ensure full transparency.</strong>
                </p>
                
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="bg-white rounded-xl p-6 border border-gray-100">
                    <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                      <span className="text-rose-600 mr-3">💬</span>
                      Get Support
                    </h3>
                    <div className="space-y-3 text-gray-700">
                      <p>
                        <strong>General inquiries:</strong>{' '}
                        <a href="mailto:hello@sendunveil.com" className="text-rose-600 hover:text-rose-700 underline">
                          hello@sendunveil.com
                        </a>
                      </p>
                      <p>
                        <strong>SMS compliance:</strong> Include &quot;SMS Compliance&quot; in your subject line
                      </p>
                      <p>
                        <strong>Data requests:</strong> We respond to all privacy requests within 30 days
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-xl p-6 border border-gray-100">
                    <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                      <span className="text-rose-600 mr-3">📋</span>
                      Legal Notice
                    </h3>
                    <div className="space-y-3 text-gray-700">
                      <p>
                        <strong>A2P 10DLC Compliance:</strong> All SMS practices meet carrier requirements
                      </p>
                      <p>
                        <strong>Documentation:</strong> Consent mechanisms are auditable and logged
                      </p>
                      <p>
                        <strong>Carrier Disclaimer:</strong> Unveil is not responsible for carrier charges
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-blue-100 rounded-lg p-4 border border-blue-200">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> This documentation is maintained for A2P 10DLC compliance and carrier verification. 
                    All consent mechanisms and user rights are auditable and documented in our systems.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>
    </div>
  )
} 