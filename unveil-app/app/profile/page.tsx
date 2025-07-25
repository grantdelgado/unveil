'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getCurrentUserProfile } from '@/services/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
  DevModeBox
} from '@/components/ui';

export default function ProfilePage() {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasHostedEvents, setHasHostedEvents] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const router = useRouter();

  useEffect(() => {
    const fetchProfile = async () => {
      setIsLoading(true);
      
      try {
        // Use the getCurrentUserProfile service for consistent data loading
        const { data: userProfile, error: profileError } = await getCurrentUserProfile();
        
        if (profileError || !userProfile) {
          console.error('Failed to load user profile:', profileError);
          setMessage('Failed to load your profile. Please try logging in again.');
          setIsLoading(false);
          return;
        }

        // Set profile data from the service
        setUserId(userProfile.id);
        setEmail(userProfile.email || '');
        setDisplayName(userProfile.full_name || '');
        setPhone(userProfile.phone || '');

        // Check if user has hosted events
        const { data: hostedEvents } = await supabase
          .from('events')
          .select('id')
          .eq('host_user_id', userProfile.id);

        setHasHostedEvents((hostedEvents?.length || 0) > 0);
      } catch (err) {
        console.error('Error loading profile:', err);
        setMessage('An unexpected error occurred loading your profile.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userId) {
      setMessage('User profile not found. Please try logging in again.');
      return;
    }
    
    setIsLoading(true);
    setMessage('');

    try {
      // Update profile in users table
      const { error: updateError } = await supabase
        .from('users')
        .update({
          full_name: displayName.trim() || null,
          email: email.trim() || null,
        })
        .eq('id', userId);

      if (updateError) {
        console.error('Failed to update profile:', updateError);
        setMessage('Failed to save your information. Please try again.');
        return;
      }

      // Also update auth user metadata for consistency
      const { error: authUpdateError } = await supabase.auth.updateUser({
        data: { 
          display_name: displayName.trim(),
          full_name: displayName.trim(),
        },
      });

      if (authUpdateError) {
        console.warn('Failed to update auth metadata:', authUpdateError);
        // Don't fail the whole operation for this
      }

      setMessage('Profile updated successfully');
    } catch (err) {
      console.error('Update profile error:', err);
      setMessage('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !userId) {
    return (
      <PageWrapper>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500 mx-auto mb-4"></div>
            <p className="text-stone-600">Loading your profile...</p>
          </div>
        </div>
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
                <svg width="32" height="32" fill="white" viewBox="0 0 24 24">
                  <circle cx="12" cy="8" r="4" />
                  <ellipse cx="12" cy="17" rx="7" ry="4" />
                </svg>
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
                  value={email}
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
                  disabled={isLoading}
                />
              </div>

              <PrimaryButton
                type="submit"
                disabled={isLoading}
                loading={isLoading}
              >
                {isLoading ? 'Saving...' : 'Save Changes'}
              </PrimaryButton>

              {message && (
                <div
                  className={`p-4 rounded-lg text-center text-sm ${
                    message.includes('wrong')
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

        {/* Development Mode */}
        <DevModeBox>
          <p><strong>Profile State:</strong></p>
          <p>Email: {email || 'N/A'}</p>
          <p>Display Name: {displayName || '(empty)'}</p>
          <p>Has Hosted Events: {hasHostedEvents ? 'yes' : 'no'}</p>
          <p>Loading: {isLoading ? 'true' : 'false'}</p>
          {message && <p className="text-blue-600">Message: {message}</p>}
        </DevModeBox>
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
