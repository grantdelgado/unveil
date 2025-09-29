import { NextResponse } from 'next/server';
import { realtimeHealthMetrics } from '@/lib/realtime/health-metrics';

export async function POST() {
  try {
    realtimeHealthMetrics.incrementActiveChannels();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to increment' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    realtimeHealthMetrics.decrementActiveChannels();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to decrement' }, { status: 500 });
  }
}
