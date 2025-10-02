'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/common/UserAvatar';
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
  LoadingSpinner,
} from '@/components/ui';

interface UserProfile {
  id: string;
  full_name: string | null;
  phone: string;
  avatar_url: string | null;
}

interface UserEvent {
  id: string;
  title: string;
}

export default function ProfilePage() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userEvents, setUserEvents] = useState<UserEvent[]>([]);

  const router = useRouter();

  // Phone-only MVP - email validation removed

  // Check if there are any changes to enable/disable save button
  const hasChanges =
    userProfile &&
    displayName !== (userProfile.full_name || '');

  // Check if form is valid
  const isFormValid = displayName.trim();

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

        // 🚀 PERFORMANCE: Parallel queries for profile and events
        const [profileResult, eventsResult] = await Promise.allSettled([
          // Fetch user profile from users table
          supabase
            .from('users')
            .select('id, full_name, phone, avatar_url')
            .eq('id', user.id)
            .single(),

          // Fetch user events
          supabase
            .from('events')
            .select('id, title')
            .eq('host_user_id', user.id),
        ]);

        if (signal.aborted) return;

        // Handle profile result
        if (
          profileResult.status === 'rejected' ||
          profileResult.value.error ||
          !profileResult.value.data
        ) {
          const error =
            profileResult.status === 'rejected'
              ? profileResult.reason
              : profileResult.value.error;
          console.error('Profile fetch error:', error);
          setMessage('Unable to load profile data. Please try again.');
          setIsLoading(false);
          return;
        }

        const profile = profileResult.value.data;
        setUserProfile(profile);
        setDisplayName(profile.full_name || '');

        // Handle events result
        if (eventsResult.status === 'fulfilled' && !eventsResult.value.error) {
          const events = eventsResult.value.data || [];
          setUserEvents(events);
        }
        // Events error is non-critical, don't block profile loading
      } catch (error) {
        if (signal.aborted) return;
        console.error('Unexpected error fetching profile:', error);
        setMessage(
          'Something went wrong loading your profile. Please try again.',
        );
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
      // Update the users table with full_name only (phone-only MVP)
      const { error: dbError } = await supabase
        .from('users')
        .update({
          full_name: displayName.trim(),
        })
        .eq('id', userProfile.id);

      if (dbError) {
        console.error('Database update error:', dbError);
        setMessage('Unable to save changes. Please try again.');
        setIsSaving(false);
        return;
      }

      // Also update auth metadata for consistency
      await supabase.auth.updateUser({
        data: { full_name: displayName.trim() },
      });

      // Update local state
      setUserProfile((prev) =>
        prev
          ? {
              ...prev,
              full_name: displayName.trim(),
            }
          : null,
      );
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
              <svg
                className="mx-auto h-12 w-12"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <PageTitle>Profile Not Found</PageTitle>
            <SubTitle>We couldn&apos;t load your profile information.</SubTitle>
            {message && <p className="text-sm text-red-600">{message}</p>}
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
    <div className="min-h-mobile bg-[#FAFAFA] flex flex-col safe-x">
      {/* Header with safe area */}
      <header className="safe-top flex-shrink-0 px-6 py-4 bg-[#FAFAFA]/95 backdrop-blur-sm border-b border-gray-200/50">
        <BackButton
          href="/select-event"
          variant="subtle"
          className="text-gray-900 hover:text-gray-700"
        >
          Back to Events
        </BackButton>
      </header>

      {/* Scrollable content */}
      <main className="flex-1 min-h-0 overflow-auto scroll-container">
        <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
          {/* Profile Section */}
          <CardContainer maxWidth="xl">
            <div className="space-y-8">
              <div className="text-center space-y-4">
                <div className="mx-auto">
                  <UserAvatar
                    id={userProfile.id}
                    name={userProfile.full_name}
                    imageUrl={userProfile.avatar_url}
                    size="xl"
                    ariaLabel="Your profile picture"
                  />
                </div>
                <div className="space-y-2">
                  <PageTitle>Your Profile</PageTitle>
                  <SubTitle>
                    Manage your account settings and preferences
                  </SubTitle>
                </div>
              </div>

              <form onSubmit={handleUpdate} className="space-y-5">
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

                {/* Email field removed for phone-only MVP */}

                {message && (
                  <div
                    className={`p-4 rounded-lg text-center text-sm ${
                      message.includes('wrong') ||
                      message.includes('Unable') ||
                      message.includes('already taken')
                        ? 'bg-red-100 text-red-800 border border-red-200 shadow-sm'
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
              {userEvents.length > 0 ? (
                // User has existing events - show manage option
                <div className="text-center space-y-2">
                  <SectionTitle>Your Wedding</SectionTitle>
                  <SubTitle>Manage your wedding event and guests.</SubTitle>
                </div>
              ) : (
                // User has no events - show create option
                <div className="text-center space-y-2">
                  <SectionTitle>Planning Your Wedding?</SectionTitle>
                  <SubTitle>Create your wedding event here.</SubTitle>
                </div>
              )}

              <div className="space-y-4">
                {userEvents.length > 0 ? (
                  // Show manage button for existing events
                  <Link href={`/host/events/${userEvents[0].id}/dashboard`}>
                    <PrimaryButton className="w-full flex items-center justify-center gap-2">
                      <span>📋</span>
                      Manage Your Wedding Page
                    </PrimaryButton>
                  </Link>
                ) : (
                  // Show create button for new users
                  <Link href="/host/events/create">
                    <PrimaryButton className="w-full flex items-center justify-center gap-2">
                      <span>+</span>
                      Create Your Wedding
                    </PrimaryButton>
                  </Link>
                )}
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
      </main>

      {/* Sticky form actions - keyboard-safe */}
      <footer className="safe-bottom sticky bottom-0 flex-shrink-0 bg-[#FAFAFA]/95 backdrop-blur-sm border-t border-gray-200/50">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <PrimaryButton
            type="submit"
            onClick={handleUpdate}
            disabled={isSaving || !isFormValid || !hasChanges}
            loading={isSaving}
            className={cn(
              'w-full',
              !hasChanges
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed hover:bg-gray-300'
                : '',
            )}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </PrimaryButton>
        </div>
      </footer>
    </div>
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
