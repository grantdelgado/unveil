'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';
import {
  PageWrapper,
  CardContainer,
  PageTitle,
  SubTitle,
  PrimaryButton,
  LoadingSpinner
} from '@/components/ui';

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
      <div className="max-w-2xl mx-auto text-center">
        <CardContainer maxWidth="lg" className="bg-gradient-to-br from-white via-rose-50/30 to-purple-50/30 border-rose-200/30">
          <div className="space-y-8">
            {/* Brand Logo/Wordmark */}
            <div className="space-y-4">
              <h1 className="text-5xl font-semibold text-gray-800 tracking-tight">
                unveil
              </h1>
              <div className="w-24 h-px bg-gradient-to-r from-transparent via-rose-300 to-transparent mx-auto"></div>
            </div>

            {/* Brand Message */}
            <div className="space-y-4">
              <PageTitle className="text-xl">Focus on presence, not logistics</PageTitle>
              <SubTitle className="max-w-lg mx-auto">
                Streamline wedding communication and preserve shared memories in one
                elegant space.
              </SubTitle>
            </div>

            {/* CTA */}
            <Link href="/login">
              <PrimaryButton className="px-8 py-4 text-lg font-medium shadow-md hover:shadow-lg">
                Get Started
              </PrimaryButton>
            </Link>
          </div>
        </CardContainer>
      </div>
    </PageWrapper>
  );
}
