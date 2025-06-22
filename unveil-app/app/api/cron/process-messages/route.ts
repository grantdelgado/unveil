import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Verify the request is authorized (cron secret OR development mode)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const isDevelopment = process.env.NODE_ENV === 'development';

    // Allow access if it's development mode or has valid cron secret
    if (!isDevelopment && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🕒 Cron job triggered: processing scheduled messages');

    // Call the message processor
    const processorUrl = new URL(
      '/api/messages/process-scheduled',
      request.url,
    );
    const response = await fetch(processorUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(`Message processor failed: ${result.error}`);
    }

    console.log('✅ Cron job completed:', result);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result,
    });
  } catch (error) {
    console.error('❌ Cron job failed:', error);
    return NextResponse.json(
      {
        error: 'Cron job failed',
        timestamp: new Date().toISOString(),
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

// Also support POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request);
}
