'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import {
  PageWrapper,
  CardContainer,
  PageTitle,
  SubTitle,
  FieldLabel,
  TextInput,
  PrimaryButton,
  LoadingSpinner,
  DevModeBox
} from '@/components/ui';

function ResetPasswordForm() {
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    // Only redirect to login if access token is missing
    if (!searchParams.get('access_token')) {
      router.replace('/login');
    }
  }, [searchParams, router]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage('Error updating password: ' + error.message);
    } else {
      setMessage('Password updated! You can now log in.');
      setTimeout(() => router.replace('/login'), 2000);
    }
    setIsLoading(false);
  };

  return (
    <PageWrapper>
      <CardContainer>
        <div className="space-y-6">
          <div className="text-center space-y-3">
            <div className="text-4xl">🔒</div>
            <PageTitle>Set a New Password</PageTitle>
            <SubTitle>Enter your new password below</SubTitle>
          </div>

          <form onSubmit={handleUpdate} className="space-y-5">
            <div className="space-y-2">
              <FieldLabel htmlFor="password" required>
                New Password
              </FieldLabel>
              <TextInput
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your new password"
                disabled={isLoading}
                required
              />
            </div>

            <PrimaryButton
              type="submit"
              disabled={isLoading}
              loading={isLoading}
            >
              {isLoading ? 'Updating...' : 'Update Password'}
            </PrimaryButton>

            {message && (
              <div
                className={`p-4 rounded-lg text-center text-sm ${
                  message.includes('Error')
                    ? 'bg-red-50 text-red-700 border border-red-100'
                    : 'bg-green-50 text-green-700 border border-green-100'
                }`}
              >
                {message}
              </div>
            )}
          </form>
        </div>

        <DevModeBox>
          <p><strong>Reset Password State:</strong></p>
          <p>Access Token: {searchParams.get('access_token') ? 'present' : 'missing'}</p>
          <p>Loading: {isLoading ? 'true' : 'false'}</p>
          <p>Message: {message || 'none'}</p>
          <p>Password Length: {password.length} characters</p>
        </DevModeBox>
      </CardContainer>
    </PageWrapper>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <PageWrapper>
        <LoadingSpinner size="lg" text="Loading password reset..." />
      </PageWrapper>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
