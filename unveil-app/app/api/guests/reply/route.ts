import { NextResponse } from 'next/server';

/**
 * Defensive API route - blocks guest replies for MVP
 * 
 * This route exists to catch any attempts to send guest replies
 * and redirect them appropriately. MVP is read-only announcements only.
 */
export async function POST() {
  return NextResponse.json(
    { 
      error: 'Guest replies are not available in this version',
      message: 'This event shows announcements from your hosts only.',
      code: 'GUEST_REPLIES_DISABLED'
    }, 
    { status: 403 }
  );
}

export async function GET() {
  return NextResponse.json(
    { 
      error: 'Guest reply interface not available',
      message: 'This event shows announcements from your hosts only.',
      code: 'GUEST_REPLIES_DISABLED'
    }, 
    { status: 404 }
  );
}
