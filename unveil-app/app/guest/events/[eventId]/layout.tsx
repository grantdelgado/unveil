import { ReactNode } from 'react';

// Prevent caching of guest event pages to ensure fresh UI (dev⇄prod parity)
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface GuestEventLayoutProps {
  children: ReactNode;
  params: { eventId: string };
}

export default function GuestEventLayout({ 
  children,
  params 
}: GuestEventLayoutProps) {
  return (
    <>
      <meta name="x-build" content={process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'dev'} />
      {children}
    </>
  );
}
