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
  MicroCopy,
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
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasHostedEvents, setHasHostedEvents] = useState(false);

  const router = useRouter();

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

        // 🚀 PERFORMANCE: Parallel queries instead of sequential
        const [profileResult, eventsResult] = await Promise.allSettled([
          // Fetch user profile from users table
          supabase
            .from('users')
            .select('id, email, full_name, phone, avatar_url')
            .eq('id', user.id)
            .single(),
          
          // Check if user has hosted events
          supabase
            .from('events')
            .select('id')
            .eq('host_user_id', user.id)
        ]);

        if (signal.aborted) return;

        // Handle profile result
        if (profileResult.status === 'fulfilled' && !profileResult.value.error) {
          const profile = profileResult.value.data;
          if (profile) {
            setUserProfile(profile);
            setDisplayName(profile.full_name || '');
          }
        } else {
          const error = profileResult.status === 'fulfilled' 
            ? profileResult.value.error 
            : profileResult.reason;
          console.error('Profile fetch error:', error);
          setMessage('Unable to load profile data. Please try again.');
          setIsLoading(false);
          return;
        }

        // Handle events result
        if (eventsResult.status === 'fulfilled' && !eventsResult.value.error) {
          const hostedEvents = eventsResult.value.data;
          setHasHostedEvents((hostedEvents?.length || 0) > 0);
        }
        // Events error is non-critical, don't block profile loading

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
    
    setIsSaving(true);
    setMessage('');
    
    try {
      // Update the users table
      const { error: dbError } = await supabase
        .from('users')
        .update({ full_name: displayName })
        .eq('id', userProfile.id);

      if (dbError) {
        console.error('Database update error:', dbError);
        setMessage('Unable to save changes. Please try again.');
        setIsSaving(false);
        return;
      }

      // Also update auth metadata for consistency
      await supabase.auth.updateUser({
        data: { full_name: displayName },
      });

      // Update local state
      setUserProfile(prev => prev ? { ...prev, full_name: displayName } : null);
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
          <p className="text-muted-foreground">Loading your profile...</p>
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
        <CardContainer maxWidth="xl">
          <div className="flex items-center justify-between">
            <BackButton 
              href="/select-event"
              variant="subtle"
              className="text-gray-900 hover:text-gray-700"
            >
              Back to Events
            </BackButton>
          </div>
        </CardContainer>

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
                <FieldLabel htmlFor="email">Email Address</FieldLabel>
                <TextInput
                  type="email"
                  id="email"
                  value={userProfile.email || 'Not provided'}
                  disabled
                  className="bg-gray-50 text-gray-500"
                />
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
                <FieldLabel htmlFor="displayName">Display Name</FieldLabel>
                <TextInput
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your display name"
                  disabled={isSaving}
                />
              </div>

              <PrimaryButton
                type="submit"
                disabled={isSaving || !displayName.trim()}
                loading={isSaving}
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
              <SectionTitle>Event Management</SectionTitle>
              <SubTitle>Create and manage your wedding events</SubTitle>
            </div>

            <div className="space-y-4">
              {/* Create New Event Button */}
              <Link href="/host/events/create">
                <PrimaryButton className="w-full flex items-center justify-center gap-2">
                  <span>+</span>
                  Create New Event
                </PrimaryButton>
              </Link>

              {/* Show additional management options if user has hosted events */}
              {hasHostedEvents && (
                <div className="pt-4 border-t border-gray-200 space-y-4">
                  <MicroCopy className="text-center">
                    You have hosted events. You can create additional events or manage existing ones.
                  </MicroCopy>
                  <Link href="/host/events/create">
                    <SecondaryButton className="w-full">
                      Create Another Event
                    </SecondaryButton>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </CardContainer>

        {/* Account Actions */}
        <CardContainer maxWidth="xl">
          <div className="space-y-6">
            <SectionTitle>Account Actions</SectionTitle>

            <div className="space-y-3">
              <SecondaryButton
                onClick={() => router.push('/select-event')}
                className="w-full"
              >
                View All Events
              </SecondaryButton>

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
