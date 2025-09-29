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

// Only allow GET method
export async function POST() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
