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
            
            {/* 1. Phone Number Collection & Initial Consent */}
            <div className="bg-white rounded-2xl border border-gray-100 p-8 lg:p-12 shadow-lg">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl mb-6">
                  <span className="text-blue-600 text-2xl">📱</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-4">
                  Phone Number Collection & <span className="bg-gradient-to-r from-rose-500 to-purple-600 bg-clip-text text-transparent">Initial Consent</span>
                </h2>
              </div>
              
              <div className="text-gray-700 leading-relaxed space-y-6">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                    <span className="text-blue-600 mr-3">🔐</span>
                    Step 1: Account Creation
                  </h3>
                  <p className="text-gray-700 mb-4">
                    When users create an Unveil account, they must provide their phone number for secure authentication. By entering their phone number, users consent to receive:
                  </p>
                  <ul className="space-y-2 text-gray-700">
                    <li>• SMS verification codes for account security</li>
                    <li>• Two-factor authentication messages</li>
                    <li>• Account-related security notifications</li>
                  </ul>
                  <p className="text-gray-700 mt-4 font-medium">
                    This initial consent enables secure phone-based authentication via SMS verification codes.
                  </p>
                </div>
                
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-100">
                    <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                      <span className="text-green-600 mr-3">⚡</span>
                      Authentication Process
                    </h3>
                    <ul className="space-y-2 text-gray-700">
                      <li>• Phone number required for account creation</li>
                      <li>• Immediate SMS verification code sent</li>
                      <li>• Secure two-factor authentication enabled</li>
                      <li>• Essential for account security and access</li>
                    </ul>
                  </div>
                  
                  <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-6 border border-amber-100">
                    <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                      <span className="text-amber-600 mr-3">📋</span>
                      Security Messages
                    </h3>
                    <ul className="space-y-2 text-gray-700">
                      <li>• Verification codes for login</li>
                      <li>• Account security alerts</li>
                      <li>• Password reset confirmations</li>
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
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-6 border border-purple-100">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                    <span className="text-purple-600 mr-3">✅</span>
                    Step 2: Account Setup & Event Notifications
                  </h3>
                  <p className="text-gray-700 mb-4">
                    After phone verification, users complete account setup where they must check a required consent checkbox with this exact language:
                  </p>
                  <div className="bg-white rounded-lg p-4 border border-purple-200">
                    <p className="text-gray-900 font-medium text-center">
                      &quot;I consent to receive event notifications via SMS (RSVPs, reminders, updates). Msg&amp;Data rates may apply. Reply STOP to opt out.&quot;
                    </p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-100">
                    <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                      <span className="text-green-600 mr-3">🔒</span>
                      Checkbox Requirements
                    </h3>
                    <ul className="space-y-2 text-gray-700">
                      <li>• <strong>Required for registration</strong> - Users cannot complete setup without checking it</li>
                      <li>• <strong>Links to this privacy policy</strong> for full SMS terms</li>
                      <li>• <strong>Cannot be bypassed</strong> - Registration fails without consent</li>
                      <li>• <strong>Logged with timestamp</strong> for compliance auditing</li>
                    </ul>
                  </div>
                  
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
                    <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                      <span className="text-blue-600 mr-3">🔄</span>
                      Two-Step Process
                    </h3>
                    <ul className="space-y-2 text-gray-700">
                      <li>• <strong>Step 1:</strong> Phone entry (authentication)</li>
                      <li>• <strong>Step 2:</strong> Setup checkbox (notifications)</li>
                      <li>• <strong>Clear disclosure:</strong> Exact message types and opt-out instructions</li>
                      <li>• <strong>Required interaction:</strong> Cannot skip or bypass consent</li>
                    </ul>
                  </div>
                </div>
                
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
                    Key Features of Our Consent Process
                  </h3>
                  <ul className="space-y-2 text-gray-700">
                    <li>• <strong>Two-step consent:</strong> Phone entry (authentication) + Setup checkbox (notifications)</li>
                    <li>• <strong>Clear disclosure:</strong> Exact message types and opt-out instructions</li>
                    <li>• <strong>Required interaction:</strong> Cannot skip or bypass consent</li>
                    <li>• <strong>Audit trail:</strong> All consent actions logged with timestamps</li>
                    <li>• <strong>No third-party sharing:</strong> Phone numbers never shared for marketing purposes</li>
                    <li>• <strong>Transparent disclosure:</strong> All consent language clearly presented during sign-up</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* 3. Message Types & Examples */}
            <div className="bg-white rounded-2xl border border-gray-100 p-8 lg:p-12 shadow-lg">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-100 to-emerald-100 rounded-2xl mb-6">
                  <span className="text-green-600 text-2xl">📨</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-4">
                  Message Types & <span className="bg-gradient-to-r from-rose-500 to-purple-600 bg-clip-text text-transparent">Examples</span>
                </h2>
              </div>
              
              <div className="text-gray-700 leading-relaxed space-y-8">
                <p className="text-lg text-center">
                  Users who complete our consent process receive these types of SMS messages:
                </p>
                
                <div className="space-y-6">
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
                    <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                      <span className="text-blue-600 mr-3">💌</span>
                      Event Invitations
                    </h3>
                    <div className="bg-white rounded-lg p-4 border border-blue-200">
                      <p className="text-gray-900 font-mono text-sm">
                        Unveil: You&apos;re invited to Sarah & David&apos;s Wedding! View details & RSVP: https://app.sendunveil.com/select-event Reply HELP for help or STOP to unsubscribe.
                      </p>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-100">
                    <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                      <span className="text-purple-600 mr-3">⏰</span>
                      Event Reminders
                    </h3>
                    <div className="bg-white rounded-lg p-4 border border-purple-200">
                      <p className="text-gray-900 font-mono text-sm">
                        Unveil Reminder: Wedding ceremony starts at 4:00 PM at Rose Garden. View details: https://app.sendunveil.com/select-event Reply HELP for help or STOP to unsubscribe.
                      </p>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-6 border border-amber-100">
                    <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                      <span className="text-amber-600 mr-3">📢</span>
                      Host Announcements
                    </h3>
                    <div className="bg-white rounded-lg p-4 border border-amber-200">
                      <p className="text-gray-900 font-mono text-sm">
                        Unveil: Update from Sarah - Ceremony moved indoors due to weather. New location in main ballroom. Reply HELP for help or STOP to unsubscribe.
                      </p>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-100">
                    <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                      <span className="text-green-600 mr-3">✅</span>
                      RSVP Confirmations
                    </h3>
                    <div className="bg-white rounded-lg p-4 border border-green-200">
                      <p className="text-gray-900 font-mono text-sm">
                        Unveil: Thanks for RSVPing! Your response has been recorded. View event details: https://app.sendunveil.com/select-event Reply HELP for help or STOP to unsubscribe.
                      </p>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-xl p-6 border border-rose-100">
                    <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                      <span className="text-rose-600 mr-3">🔔</span>
                      RSVP Reminders
                    </h3>
                    <div className="bg-white rounded-lg p-4 border border-rose-200">
                      <p className="text-gray-900 font-mono text-sm">
                        Unveil: RSVP reminder for Sarah & David&apos;s Wedding. Please respond by March 1st. Details: https://app.sendunveil.com/select-event Reply HELP for help or STOP to unsubscribe.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl p-6 border border-gray-100">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                    <span className="text-gray-600 mr-3">📋</span>
                    Message Characteristics
                  </h3>
                  <ul className="space-y-2 text-gray-700">
                    <li>• <strong>Clear sender identification</strong> - All messages start with &quot;Unveil&quot;</li>
                    <li>• <strong>Event context</strong> - Messages relate to specific wedding events</li>
                    <li>• <strong>Consistent opt-out</strong> - Every message includes STOP/HELP instructions</li>
                    <li>• <strong>Single-segment preferred</strong> - Optimized for 160-character SMS limits</li>
                    <li>• <strong>No marketing content</strong> - Strictly transactional and event-related</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* 4. Data Usage & Retention */}
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
                        <li>• <strong>Withdraw SMS consent by replying STOP</strong> - Immediate processing within minutes</li>
                        <li>• <strong>Confirmation message</strong> - Users receive confirmation of opt-out</li>
                        <li>• <strong>Account settings</strong> - Can also manage SMS preferences in app settings</li>
                        <li>• <strong>Granular control</strong> - Can opt out of notifications while keeping authentication SMS</li>
                        <li>• <strong>Request phone number and data deletion</strong> - Full data removal available</li>
                        <li>• <strong>Access your consent and communication history</strong> - Complete audit trail</li>
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