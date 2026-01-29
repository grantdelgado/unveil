import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

// Validation schema for RUM events
interface RumEventPayload {
  route: string;
  metric: 'LCP' | 'INP' | 'CLS';
  value: number;
  device: 'mobile' | 'desktop';
  build_id?: string;
}

function validateRumEvent(data: unknown): RumEventPayload | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const obj = data as Record<string, unknown>;

  if (
    typeof obj.route !== 'string' ||
    !['LCP', 'INP', 'CLS'].includes(obj.metric as string) ||
    typeof obj.value !== 'number' ||
    obj.value < 0 ||
    !['mobile', 'desktop'].includes(obj.device as string)
  ) {
    return null;
  }

  return {
    route: obj.route.slice(0, 255), // Prevent very long routes
    metric: obj.metric as 'LCP' | 'INP' | 'CLS',
    value: Math.round(obj.value * 100) / 100, // Round to 2 decimal places
    device: obj.device as 'mobile' | 'desktop',
    build_id: obj.build_id ? String(obj.build_id).slice(0, 64) : undefined,
  };
}

// Sampling rate for RUM events (1.0 = 100%, 0.1 = 10%)
// In production, we sample to reduce database load while maintaining statistical significance
const RUM_SAMPLE_RATE = process.env.NODE_ENV === 'production' ? 0.5 : 1.0;

export async function POST(request: NextRequest) {
  try {
    // Skip auth check for RUM collection - anonymous performance data is acceptable
    // This enables performance monitoring during login/onboarding flows
    // We don't store PII and this data helps monitor login/signup performance

    // Apply sampling to reduce database load
    if (Math.random() > RUM_SAMPLE_RATE) {
      // Silently drop this sample but return success to avoid client retries
      return NextResponse.json({ success: true, sampled: false });
    }

    const body = await request.json();
    const rumEvent = validateRumEvent(body);

    if (!rumEvent) {
      logger.warn('Invalid RUM event payload', { body });
      return NextResponse.json(
        { error: 'Invalid RUM event data' },
        { status: 400 }
      );
    }

    // Insert RUM event (no user ID stored - PII-safe)
    // Use service role client for unauthenticated RUM collection
    const { createClient } = await import('@supabase/supabase-js');
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { error: insertError } = await serviceSupabase
      .from('rum_events')
      .insert([rumEvent]);

    if (insertError) {
      logger.error('Failed to insert RUM event', {
        error: insertError,
        rumEvent,
      });
      return NextResponse.json(
        { error: 'Failed to record RUM event' },
        { status: 500 }
      );
    }

    logger.debug('RUM event recorded', { 
      route: rumEvent.route, 
      metric: rumEvent.metric,
      value: rumEvent.value,
      device: rumEvent.device 
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    logger.error('RUM API error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient(request);
    
    // Verify user is authenticated for RUM data access
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const route = searchParams.get('route');
    const metric = searchParams.get('metric');

    let query = supabase.from('rum_p75_7d').select('*');

    if (route) {
      query = query.eq('route', route);
    }
    if (metric && ['LCP', 'INP', 'CLS'].includes(metric)) {
      query = query.eq('metric', metric);
    }

    const { data, error } = await query.order('route').order('metric');

    if (error) {
      logger.error('Failed to fetch RUM p75 data', { error });
      return NextResponse.json(
        { error: 'Failed to fetch RUM data' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });

  } catch (error) {
    logger.error('RUM API GET error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
