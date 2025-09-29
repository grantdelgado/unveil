import { NextResponse } from 'next/server';
import { realtimeHealthMetrics } from '@/lib/realtime/health-metrics';

/**
 * Health endpoint for realtime connection monitoring
 * Returns PII-safe metrics for production visibility
 */
export async function GET() {
  try {
    const metrics = realtimeHealthMetrics.getMetrics();
    
    // Add server timestamp for external monitoring
    const response = {
      ...metrics,
      timestamp: new Date().toISOString(),
      status: metrics.healthScore > 80 ? 'healthy' : metrics.healthScore > 50 ? 'degraded' : 'unhealthy',
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Realtime health endpoint error:', error);
    return NextResponse.json(
      { error: 'Health check failed', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}

/**
 * Batch update endpoint for optimized health metrics
 */
export async function PATCH(request: Request) {
  try {
    const updates = await request.json();
    const { channelDelta = 0, messageCount = 0, errorCount = 0 } = updates;

    // Apply batched updates
    if (channelDelta > 0) {
      for (let i = 0; i < channelDelta; i++) {
        realtimeHealthMetrics.incrementActiveChannels();
      }
    } else if (channelDelta < 0) {
      for (let i = 0; i < Math.abs(channelDelta); i++) {
        realtimeHealthMetrics.decrementActiveChannels();
      }
    }

    for (let i = 0; i < messageCount; i++) {
      realtimeHealthMetrics.incrementMessages();
    }

    for (let i = 0; i < errorCount; i++) {
      realtimeHealthMetrics.incrementErrors();
    }

    return NextResponse.json({ success: true, applied: updates });
  } catch (error) {
    console.error('Batch health update error:', error);
    return NextResponse.json({ error: 'Batch update failed' }, { status: 500 });
  }
}

// Allow GET and PATCH methods
export async function POST() {
  return NextResponse.json({ error: 'Use PATCH for batch updates' }, { status: 405 });
}
