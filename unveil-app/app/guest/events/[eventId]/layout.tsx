import { ReactNode } from 'react';

// Prevent caching of guest event pages to ensure fresh UI (dev⇄prod parity)
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface GuestEventLayoutProps {
  children: ReactNode;
  params: Promise<{ eventId: string }>;
}

export default async function GuestEventLayout({
  children,
  params,
}: GuestEventLayoutProps) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { eventId } = await params;

  return (
    <>
      <meta
        name="x-build"
        content={process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'dev'}
      />
      {children}
    </>
  );
}
