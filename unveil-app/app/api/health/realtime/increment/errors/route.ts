import { NextResponse } from 'next/server';
import { realtimeHealthMetrics } from '@/lib/realtime/health-metrics';

export async function POST() {
  try {
    realtimeHealthMetrics.incrementErrors();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to increment' }, { status: 500 });
  }
}
