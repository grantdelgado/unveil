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

      {/* Phone Authentication & Consent */}
      <section className="py-16 lg:py-20 bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-6">
              Phone Authentication & <span className="bg-gradient-to-r from-rose-500 to-purple-600 bg-clip-text text-transparent">Consent</span>
            </h2>
            <div className="h-px bg-gradient-to-r from-transparent via-blue-200 to-transparent max-w-xs mx-auto mb-8"></div>
          </div>
          
          <div className="bg-white rounded-2xl border border-gray-100 p-8 lg:p-12 shadow-lg">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl mb-6">
                <span className="text-blue-600 text-2xl">📱</span>
              </div>
            </div>
            
            <div className="prose prose-gray max-w-none text-center">
              <p className="text-lg leading-relaxed text-gray-700 mb-8">
                Unveil uses <strong>phone-based authentication</strong> to secure your account and enable event communication. 
                By providing your phone number during signup, you consent to receive SMS verification codes and event-related communications.
              </p>
              
              <div className="grid md:grid-cols-2 gap-8 text-left mt-12">
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-100">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                    <span className="text-green-600 mr-3">✓</span>
                    Clear Consent Process
                  </h3>
                  <ul className="space-y-3 text-gray-700">
                    <li>• Phone number provided during signup/login for account security</li>
                    <li>• Two-factor authentication via SMS verification codes</li>
                    <li>• Express consent obtained during account creation</li>
                    <li>• Clear explanation of SMS communication purposes</li>
                    <li>• No separate marketing opt-in required</li>
                  </ul>
                </div>
                
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border border-purple-100">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                    <span className="text-purple-600 mr-3">🔒</span>
                    Data Usage & Protection
                  </h3>
                  <ul className="space-y-3 text-gray-700">
                    <li>• Phone numbers used solely for account access and event communication</li>
                    <li>• No marketing use or promotional sharing</li>
                    <li>• All consent actions timestamped and logged</li>
                    <li>• Consent can be withdrawn at any time</li>
                    <li>• Data retention follows strict privacy guidelines</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SMS & Phone Verification Policy */}
      <section className="py-16 lg:py-20 bg-gradient-to-br from-white via-green-50/20 to-emerald-50/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-6">
              SMS & Phone <span className="bg-gradient-to-r from-rose-500 to-purple-600 bg-clip-text text-transparent">Verification</span>
            </h2>
            <div className="h-px bg-gradient-to-r from-transparent via-green-200 to-transparent max-w-xs mx-auto mb-8"></div>
          </div>
          
          <div className="space-y-8">
            {/* How It Works */}
            <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-lg">
              <div className="flex items-center mb-6">
                <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl mr-4">
                  <span className="text-blue-600 text-lg">⚡</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900">How Phone Verification Works</h3>
              </div>
              <div className="text-gray-700 leading-relaxed space-y-4">
                <p>
                  <strong>Account Security:</strong> Your phone number is required for secure account access via two-factor authentication. 
                  We send SMS verification codes to ensure only you can access your account.
                </p>
                <p>
                  <strong>Event Communication:</strong> Once verified, your phone number enables you to receive important 
                  event updates, RSVP confirmations, and communication from wedding hosts within the Unveil platform.
                </p>
                <p>
                  <strong>No Marketing Use:</strong> We do not use your phone number for marketing purposes, promotional 
                  messages, or share it with third parties for advertising.
                </p>
              </div>
            </div>

            {/* A2P 10DLC Compliance */}
            <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-lg">
              <div className="flex items-center mb-6">
                <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl mr-4">
                  <span className="text-green-600 text-lg">📋</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900">SMS Compliance & Your Rights</h3>
              </div>
              <div className="text-gray-700 leading-relaxed space-y-4">
                <p>
                  <strong>Message Types:</strong> You will receive transactional and account notification messages, including 
                  verification codes, RSVP confirmations, and event updates from wedding hosts.
                </p>
                <p>
                  <strong>Message Frequency:</strong> Message frequency varies based on your account activity and event participation. 
                  Verification codes are sent only when you log in or request account access.
                </p>
                <p>
                  <strong>Opt-Out Instructions:</strong> You can opt-out of SMS communications at any time by replying 
                  <strong> STOP</strong> to any message. Note that opting out may affect your ability to access your account 
                  and receive important event communications.
                </p>
                <p>
                  <strong>Data & Message Rates:</strong> Standard message and data rates may apply as determined by your mobile carrier. 
                  Unveil is not responsible for carrier charges.
                </p>
              </div>
            </div>

            {/* User Rights */}
            <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-lg">
              <div className="flex items-center mb-6">
                <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl mr-4">
                  <span className="text-purple-600 text-lg">⚖️</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Your Rights & Control</h3>
              </div>
              <div className="text-gray-700 leading-relaxed">
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    <strong>Consent Withdrawal:</strong> You can withdraw consent for SMS communications at any time by contacting support or replying STOP
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    <strong>Data Deletion:</strong> You can request deletion of your phone number and associated data by contacting our support team
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    <strong>Access Requirements:</strong> Account access requires phone verification for security purposes
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    <strong>Audit Trail:</strong> All consent actions and communications are logged with timestamps for compliance review
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Enhanced Policies Section */}
      <section className="py-16 lg:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-6">
              Our <span className="bg-gradient-to-r from-rose-500 to-purple-600 bg-clip-text text-transparent">Policies</span>
            </h2>
            <div className="h-px bg-gradient-to-r from-transparent via-rose-200 to-transparent max-w-xs mx-auto mb-8"></div>
          </div>
          
          <div className="space-y-8">
            {/* Enhanced Privacy Policy */}
            <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-lg">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Privacy Policy</h3>
              <div className="text-gray-700 leading-relaxed space-y-4">
                <p>
                  We are committed to protecting your privacy and personal information. We collect only the minimum 
                  data necessary to provide our wedding communication services, and we never sell or share your 
                  personal information with third parties for marketing purposes.
                </p>
                <p>
                  <strong>Phone Number Collection:</strong> We collect your phone number during account registration for 
                  security authentication and event communication purposes only. Phone numbers are used exclusively for 
                  SMS verification codes and wedding-related communications within our platform.
                </p>
                <p>
                  <strong>Data Retention:</strong> Phone numbers and associated authentication data are retained only as long 
                  as necessary to provide our services and comply with legal obligations. You can request deletion at any time.
                </p>
                <p>
                  <strong>Third-Party Sharing:</strong> We share phone numbers only with our SMS service provider (Twilio) 
                  for the sole purpose of delivering verification codes and event communications. No marketing or promotional use is permitted.
                </p>
              </div>
            </div>
            
            {/* Enhanced Terms of Service */}
            <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-lg">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Terms of Service</h3>
              <div className="text-gray-700 leading-relaxed space-y-4">
                <p>
                  By using Unveil, you agree to use our service responsibly and in accordance with our community 
                  guidelines. Our platform is designed for celebrating weddings and creating positive memories together.
                </p>
                <p>
                  <strong>Phone Number Requirement:</strong> A valid phone number is required for account access and security. 
                  By providing your phone number, you agree to receive SMS verification codes and event-related communications.
                </p>
                <p>
                  <strong>SMS Agreement:</strong> You consent to receive text messages for account verification and wedding event 
                  communications. You understand that standard message and data rates may apply, and you can opt-out at any time.
                </p>
                <p>
                  <strong>Communication Preferences:</strong> You have the right to control your communication preferences and 
                  can opt-out of non-essential communications while maintaining account security requirements.
                </p>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-lg">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Data Security</h3>
              <div className="text-gray-700 leading-relaxed space-y-4">
                <p>
                  All data transmitted through our platform is encrypted in transit and at rest. We use industry-standard 
                  security measures to protect your photos, messages, phone numbers, and personal information from unauthorized access.
                </p>
                <p>
                  <strong>Phone Number Security:</strong> Your phone number is encrypted and stored securely. Access is limited 
                  to authorized systems and personnel who require it for account verification and support purposes only.
                </p>
                <p>
                  <strong>SMS Security:</strong> All SMS communications are sent through secure, encrypted channels via our 
                  certified SMS provider to ensure the privacy and integrity of your verification codes and event communications.
                </p>
              </div>
            </div>

            {/* Contact Information */}
            <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-2xl border border-gray-100 p-8 shadow-lg">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">SMS Compliance & Contact</h3>
              <div className="text-gray-700 leading-relaxed space-y-3">
                <p>
                  <strong>Questions about SMS communications or consent?</strong> Contact our support team at{' '}
                  <a href="mailto:hello@sendunveil.com" className="text-rose-600 hover:text-rose-700 underline">
                    hello@sendunveil.com
                  </a>
                </p>
                <p>
                  <strong>Compliance inquiries:</strong> For verification purposes or compliance documentation, 
                                     please include &quot;SMS Compliance&quot; in your subject line.
                </p>
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> This documentation is maintained for A2P 10DLC compliance and carrier verification purposes. 
                    All consent mechanisms and user rights described above are auditable and documented in our systems.
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