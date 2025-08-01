'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';
import {
  PageWrapper,
  PageTitle,
  SubTitle,
  PrimaryButton,
  LoadingSpinner
} from '@/components/ui';
import { UnveilHeader, AuthCard } from '@/components/shared';

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check session and redirect if authenticated
    const checkAndRedirect = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        
        if (session?.user) {
          // User is authenticated, now check onboarding status
          const { data: userProfile, error } = await supabase
            .from('users')
            .select('id, onboarding_completed')
            .eq('id', session.user.id)
            .single();

          if (error) {
            console.error('Error fetching user profile:', error);
            // If user doesn't exist in our users table, redirect to setup
            router.replace('/setup');
            return;
          }

          if (userProfile.onboarding_completed) {
            // User has completed onboarding, redirect to select-event
            router.replace('/select-event');
          } else {
            // User hasn't completed onboarding, redirect to setup
            router.replace('/setup');
          }
        }
        // If not authenticated, stay on this page to show landing content
      } catch (error) {
        console.error('Error checking auth status:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAndRedirect();
  }, [router]);

  // Show loading spinner while checking auth status
  if (loading) {
    return (
      <PageWrapper>
        <LoadingSpinner size="lg" text="Loading..." />
      </PageWrapper>
    );
  }

  return (
    <PageWrapper centered={false}>
      <div className="flex flex-col justify-start items-center min-h-[100dvh] pt-16 sm:pt-20 md:pt-24 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-2xl text-center space-y-8 sm:space-y-10 md:space-y-12">
          {/* Prominent Brand Header */}
          <UnveilHeader 
            size="lg" 
            showTagline={true}
            className="mb-6 sm:mb-8"
          />

          {/* Enhanced Brand Message */}
          <div className="space-y-4 sm:space-y-6">
            <SubTitle className="max-w-2xl mx-auto text-lg sm:text-xl md:text-2xl leading-relaxed text-gray-600 font-light">
              Streamline wedding communication and preserve shared memories in one
              elegant space.
            </SubTitle>
          </div>

          {/* Prominent CTA */}
          <div className="pt-4 sm:pt-6">
            <Link href="/login">
              <PrimaryButton 
                className="px-8 py-4 sm:px-10 sm:py-5 text-lg sm:text-xl font-medium shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 w-full sm:w-auto min-w-[200px]"
                fullWidth={false}
              >
                Get Started
              </PrimaryButton>
            </Link>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
