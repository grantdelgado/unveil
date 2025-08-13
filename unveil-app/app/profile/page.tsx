'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  PageWrapper,
  CardContainer,
  PageTitle,
  SubTitle,
  SectionTitle,
  FieldLabel,
  TextInput,
  PrimaryButton,
  SecondaryButton,
  BackButton,
  LoadingSpinner
} from '@/components/ui';

interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string;
  avatar_url: string | null;
}

export default function ProfilePage() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const router = useRouter();

  // Email validation helper
  const isValidEmail = (email: string): boolean => {
    if (!email.trim()) return true; // Empty email is valid since it's optional
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  // Check if there are any changes to enable/disable save button
  const hasChanges = userProfile && (
    displayName !== (userProfile.full_name || '') ||
    email !== (userProfile.email || '')
  );

  // Check if form is valid
  const isFormValid = displayName.trim() && isValidEmail(email);

  useEffect(() => {
    const abortController = new AbortController();
    const signal = abortController.signal;

    const fetchProfile = async () => {
      try {
        setIsLoading(true);
        setMessage('');
        
        // Get current auth user with timeout
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        
        if (signal.aborted) return;
        
        if (authError || !user) {
          setMessage('Unable to load your profile. Please sign in again.');
          setIsLoading(false);
          return;
        }

        // Fetch user profile from users table
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('id, email, full_name, phone, avatar_url')
          .eq('id', user.id)
          .single();

        if (signal.aborted) return;

        // Handle profile result
        if (profileError || !profile) {
          console.error('Profile fetch error:', profileError);
          setMessage('Unable to load profile data. Please try again.');
          setIsLoading(false);
          return;
        }

        setUserProfile(profile);
        setDisplayName(profile.full_name || '');
        setEmail(profile.email || '');

      } catch (error) {
        if (signal.aborted) return;
        console.error('Unexpected error fetching profile:', error);
        setMessage('Something went wrong loading your profile. Please try again.');
      } finally {
        if (!signal.aborted) {
          setIsLoading(false);
        }
      }
    };
    
    fetchProfile();

    // 🧹 CLEANUP: Abort requests when component unmounts or navigates away
    return () => {
      abortController.abort();
    };
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userProfile) {
      setMessage('Profile not loaded. Please refresh the page.');
      return;
    }

    if (!isFormValid) {
      setMessage('Please check that all fields are filled correctly.');
      return;
    }
    
    setIsSaving(true);
    setMessage('');
    
    try {
      // Prepare email value (null if empty, otherwise trimmed)
      const emailValue = email.trim() || null;

      // Check for email uniqueness if email is provided and different from current
      if (emailValue && emailValue !== userProfile.email) {
        const { data: existingUsers, error: checkError } = await supabase
          .from('users')
          .select('id')
          .eq('email', emailValue)
          .neq('id', userProfile.id); // Exclude current user

        if (checkError) {
          console.error('Email uniqueness check error:', checkError);
          setMessage('Unable to verify email availability. Please try again.');
          setIsSaving(false);
          return;
        }

        if (existingUsers && existingUsers.length > 0) {
          setMessage('This email address is already taken. Please use a different email.');
          setIsSaving(false);
          return;
        }
      }

      // Update the users table with both email and full_name
      const { error: dbError } = await supabase
        .from('users')
        .update({ 
          full_name: displayName.trim(),
          email: emailValue 
        })
        .eq('id', userProfile.id);

      if (dbError) {
        console.error('Database update error:', dbError);
        setMessage('Unable to save changes. Please try again.');
        setIsSaving(false);
        return;
      }

      // Also update auth metadata for consistency (only if email is provided)
      const authUpdateData: { data: { full_name: string }; email?: string } = {
        data: { full_name: displayName.trim() },
      };
      
      if (emailValue) {
        authUpdateData.email = emailValue;
      }

      await supabase.auth.updateUser(authUpdateData);

      // Update local state
      setUserProfile(prev => prev ? { 
        ...prev, 
        full_name: displayName.trim(),
        email: emailValue 
      } : null);
      setMessage('Profile updated successfully!');
      
    } catch (error) {
      console.error('Unexpected error updating profile:', error);
      setMessage('Something went wrong. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <PageWrapper centered={true}>
        <div className="flex flex-col items-center justify-center space-y-4">
          <LoadingSpinner size="lg" />
          <p className="text-gray-600">Loading your profile...</p>
        </div>
      </PageWrapper>
    );
  }

  // Show error state if no profile loaded
  if (!userProfile) {
    return (
      <PageWrapper centered={true}>
        <CardContainer maxWidth="md">
          <div className="text-center space-y-4">
            <div className="text-red-600">
              <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <PageTitle>Profile Not Found</PageTitle>
            <SubTitle>We couldn&apos;t load your profile information.</SubTitle>
            {message && (
              <p className="text-sm text-red-600">{message}</p>
            )}
            <div className="space-y-2">
              <PrimaryButton onClick={() => window.location.reload()}>
                Try Again
              </PrimaryButton>
              <SecondaryButton onClick={() => router.push('/select-event')}>
                Back to Events
              </SecondaryButton>
            </div>
          </div>
        </CardContainer>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper centered={false}>
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="mb-6">
          <BackButton 
            href="/select-event"
            variant="subtle"
            className="text-gray-900 hover:text-gray-700"
          >
            Back to Events
          </BackButton>
        </div>

        {/* Profile Section */}
        <CardContainer maxWidth="xl">
          <div className="space-y-8">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-gradient-to-r from-rose-400 to-purple-500 rounded-full flex items-center justify-center mx-auto">
                {userProfile.avatar_url ? (
                  <Image 
                    src={userProfile.avatar_url} 
                    alt="Profile" 
                    width={80}
                    height={80}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <svg width="32" height="32" fill="white" viewBox="0 0 24 24">
                    <circle cx="12" cy="8" r="4" />
                    <ellipse cx="12" cy="17" rx="7" ry="4" />
                  </svg>
                )}
              </div>
              <div className="space-y-2">
                <PageTitle>Your Profile</PageTitle>
                <SubTitle>Manage your account settings and preferences</SubTitle>
              </div>
            </div>

            <form onSubmit={handleUpdate} className="space-y-5">
              <div className="space-y-2">
                <FieldLabel htmlFor="email">Email Address (Optional)</FieldLabel>
                <TextInput
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address (optional)"
                  disabled={isSaving}
                  className={email && !isValidEmail(email) ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}
                />
                {email && !isValidEmail(email) && (
                  <p className="text-sm text-red-600">Please enter a valid email address</p>
                )}
              </div>

              <div className="space-y-2">
                <FieldLabel htmlFor="phone">Phone Number</FieldLabel>
                <TextInput
                  type="tel"
                  id="phone"
                  value={userProfile.phone}
                  disabled
                  className="bg-gray-50 text-gray-500"
                />
              </div>

              <div className="space-y-2">
                <FieldLabel htmlFor="displayName">Full Name</FieldLabel>
                <TextInput
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your full name"
                  disabled={isSaving}
                />
              </div>

              <PrimaryButton
                type="submit"
                disabled={isSaving || !isFormValid || !hasChanges}
                loading={isSaving}
                className={!hasChanges ? 'bg-gray-300 text-gray-500 cursor-not-allowed hover:bg-gray-300' : ''}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </PrimaryButton>

              {message && (
                <div
                  className={`p-4 rounded-lg text-center text-sm ${
                    message.includes('wrong') || message.includes('Unable')
                      ? 'bg-red-50 text-red-700 border border-red-100'
                      : 'bg-green-50 text-green-700 border border-green-100'
                  }`}
                >
                  {message}
                </div>
              )}
            </form>
          </div>
        </CardContainer>

        {/* Event Management Section */}
        <CardContainer maxWidth="xl">
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <SectionTitle>Planning Your Wedding?</SectionTitle>
              <SubTitle>Create your wedding event here.</SubTitle>
            </div>

            <div className="space-y-4">
              {/* Create Wedding Button */}
              <Link href="/host/events/create">
                <PrimaryButton className="w-full flex items-center justify-center gap-2">
                  <span>+</span>
                  Create Your Wedding
                </PrimaryButton>
              </Link>
            </div>
          </div>
        </CardContainer>

        {/* Account Actions */}
        <CardContainer maxWidth="xl">
          <div className="space-y-6">
            <SectionTitle>Account Actions</SectionTitle>

            <div className="space-y-3">
              <LogoutButtonStyled router={router} />
            </div>
          </div>
        </CardContainer>
      </div>
    </PageWrapper>
  );
}

function LogoutButtonStyled({
  router,
}: {
  router: ReturnType<typeof useRouter>;
}) {
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };
  return (
    <SecondaryButton
      onClick={handleLogout}
      className="w-full text-red-600 border-red-200 hover:bg-red-50"
    >
      Sign Out
    </SecondaryButton>
  );
}
