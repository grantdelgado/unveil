'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';
import {
  PageWrapper,
  CardContainer,
  PageTitle,
  SubTitle,
  PrimaryButton,
  DevModeBox
} from '@/components/ui';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Check session and redirect if authenticated
    // This runs after AuthSessionWatcher has initialized
    const checkAndRedirect = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      
      if (session) {
        // User is authenticated, redirect to select-event
        router.replace('/select-event');
      }
      // If not authenticated, stay on this page to show landing content
    };

    // Small delay to let AuthSessionWatcher finish initializing
    const timeoutId = setTimeout(checkAndRedirect, 100);
    
    return () => clearTimeout(timeoutId);
  }, [router]);

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

          <DevModeBox>
            <p><strong>Landing Page State:</strong></p>
            <p>Session Check: Redirects authenticated users to /select-event</p>
            <p>CTA: Directs to /login for unauthenticated users</p>
            <p>Component: Using PageWrapper and CardContainer</p>
          </DevModeBox>
        </CardContainer>
      </div>
    </PageWrapper>
  );
}
