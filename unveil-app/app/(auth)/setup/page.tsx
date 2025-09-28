'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
// Note: Auth functionality handled via centralized useAuth hook
import { useAuth } from '@/lib/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import type { User } from '@/lib/supabase/types';
import { trackUserInteraction } from '@/lib/performance-monitoring';
import { SMS_NOTIF_CHECKBOX_COPY, PRIVACY_URL } from '@/lib/compliance/smsConsent';
import {
  PageWrapper,
  CardContainer,
  PageTitle,
  SubTitle,
  FieldLabel,
  TextInput,
  PrimaryButton,
  MicroCopy,
  LoadingSpinner,
} from '@/components/ui';
import { ArrowLeft } from 'lucide-react';

export default function AccountSetupPage() {
  const [fullName, setFullName] = useState('');
  const [smsConsent, setSmsConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const router = useRouter();

  // Simplified: Using useAuth hook instead
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        // Wait for auth to finish loading
        if (authLoading) return;

        // Redirect if not authenticated
        if (!user?.id) {
          console.error('No authenticated user found');
          router.push('/login');
          return;
        }

        // Fetch user profile from users table using Supabase Auth user ID
        const { data: profile, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          // PGRST116 = No rows found (expected for new users)
          console.error('Error fetching user profile:', error);
          router.push('/login');
          return;
        }

        if (!profile) {
          // User doesn't exist in our users table, create them
          const { data: newProfile, error: createError } = await supabase
            .from('users')
            .insert({
              id: user.id,
              phone: user.phone || user.user_metadata?.phone,
              onboarding_completed: false,
            })
            .select('*')
            .single();

          if (createError) {
            console.error('Error creating user profile:', createError);
            setError('Failed to create user profile. Please try again.');
            return;
          }

          setUserProfile(newProfile);
        } else {
          setUserProfile(profile);

          // Pre-fill form if user already has some data
          if (
            profile.full_name &&
            profile.full_name !== `User ${profile.phone?.slice(-4)}`
          ) {
            setFullName(profile.full_name);
          }
        }
      } catch (err) {
        console.error('Error loading profile:', err);
        router.push('/login');
      }
    };

    loadUserProfile();
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!fullName.trim()) {
      setError('Please enter your full name');
      return;
    }

    if (!smsConsent) {
      setError('Please consent to receive SMS event notifications to continue');
      return;
    }

    setLoading(true);

    try {
      if (!userProfile?.id) {
        setError('User profile not found. Please try logging in again.');
        return;
      }

      // Update user profile and mark onboarding as completed
      // Only mark as complete if full_name is provided and not empty
      const trimmedFullName = fullName.trim();

      if (!trimmedFullName) {
        setError('Full name is required to complete setup.');
        return;
      }

      // Capture consent metadata
      const consentTimestamp = new Date().toISOString();
      const ipAddress = typeof window !== 'undefined' ? 
        // Note: IP will be captured server-side in production
        null : null;
      const userAgent = typeof window !== 'undefined' ? 
        navigator.userAgent : null;

      const { error: updateError } = await supabase
        .from('users')
        .update({
          full_name: trimmedFullName,
          onboarding_completed: true,
          // Set consent fields only if not already set (idempotent)
          sms_consent_given_at: consentTimestamp,
          sms_consent_ip_address: ipAddress,
          sms_consent_user_agent: userAgent,
        })
        .eq('id', userProfile.id)
        // Only update consent if not already given
        .is('sms_consent_given_at', null);

      if (updateError) {
        console.error('Failed to update profile:', updateError);
        setError('Failed to save your information. Please try again.');
        return;
      }

      console.log('✅ Profile setup completed');

      // Track successful SMS consent recording (PII-safe)
      trackUserInteraction('sms_consent_recorded', 'setup', 'success');

      // Redirect to select-event page
      router.push('/select-event');
    } catch (err) {
      console.error('Setup error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutAndRedirect = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
      setError('Failed to sign out. Please try again.');
    }
  };

  if (!userProfile) {
    return (
      <PageWrapper>
        <LoadingSpinner size="lg" text="Loading your account..." />
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <CardContainer>
        <div className="space-y-6">
          {/* Back Navigation */}
          <div className="flex justify-start">
            <button
              onClick={handleLogoutAndRedirect}
              className="inline-flex items-center gap-2 p-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all duration-200 rounded-md focus:outline-none focus:ring-2 focus:ring-rose-300 focus:ring-offset-2 min-h-[44px] min-w-[44px]"
              disabled={loading}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>
                ← Cancel and Start Over (you&apos;ll need to re-enter your phone
                number)
              </span>
            </button>
          </div>

          <div className="text-center space-y-4">
            <div className="text-4xl">👋</div>
            <PageTitle>Welcome to Unveil!</PageTitle>
            <SubTitle>Let&apos;s set up your account to get started</SubTitle>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <FieldLabel htmlFor="fullName" required>
                Full Name
              </FieldLabel>
              <TextInput
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
                disabled={loading}
                autoFocus={true}
                autoComplete="name"
                required
                className="min-h-[44px]" // Touch-friendly height
              />
            </div>

            {/* Email field removed for phone-only MVP */}

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            {/* SMS Consent Checkbox */}
            <div className="space-y-3">
              <label htmlFor="smsConsent" className="flex items-start gap-2 min-h-[44px] cursor-pointer">
                <input
                  id="smsConsent"
                  type="checkbox"
                  checked={smsConsent}
                  onChange={(e) => {
                    setSmsConsent(e.target.checked);
                    // Track consent checkbox interaction (PII-safe)
                    trackUserInteraction('sms_consent_checked', 'setup', e.target.checked ? 'opted_in' : 'opted_out');
                  }}
                  required
                  disabled={loading}
                  className="mt-1 h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500 focus:ring-offset-2 flex-shrink-0"
                />
                <span className="text-sm text-gray-700 leading-relaxed select-none">
                  {SMS_NOTIF_CHECKBOX_COPY.split('Privacy Policy')[0]}
                  <a 
                    href={PRIVACY_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-600 underline hover:text-purple-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1 rounded-sm"
                  >
                    Privacy Policy
                  </a>
                  {SMS_NOTIF_CHECKBOX_COPY.split('Privacy Policy')[1] || '.'}
                </span>
              </label>
            </div>

            <div className="space-y-3">
              <PrimaryButton
                type="submit"
                disabled={loading || !fullName.trim() || !smsConsent}
                loading={loading}
                className="min-h-[44px]" // Touch-friendly height
              >
                {loading ? 'Setting up...' : 'Complete Setup'}
              </PrimaryButton>
            </div>
          </form>

          <div className="text-center space-y-1">
            <MicroCopy>Phone: {userProfile.phone}</MicroCopy>
            <MicroCopy>
              This is your verified phone number. You can update your name
              anytime in your profile.
            </MicroCopy>
          </div>
        </div>
      </CardContainer>
    </PageWrapper>
  );
}
