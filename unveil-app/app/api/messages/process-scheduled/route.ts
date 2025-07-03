import { NextRequest, NextResponse } from 'next/server';
import { processScheduledMessages, getProcessingStats } from '@/services/messaging/processor';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    logger.api('Processing scheduled messages API called');

    // Verify the request is authorized (internal calls only)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const isDevelopment = process.env.NODE_ENV === 'development';

    // Allow access if it's development mode or has valid cron secret
    if (!isDevelopment && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Process all ready scheduled messages
    const result = await processScheduledMessages();

    // Get current processing stats for context
    const stats = await getProcessingStats(1); // Last hour

    logger.api('Processing completed', {
      result,
      stats,
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      processing: result,
      stats,
    });
  } catch (error) {
    logger.apiError('Error processing scheduled messages', error);
    
    return NextResponse.json(
      {
        error: 'Failed to process scheduled messages',
        timestamp: new Date().toISOString(),
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Also support GET for status checks
export async function GET() {
  try {
    logger.api('Scheduled messages status check');

    // Get processing stats
    const stats = await getProcessingStats(24); // Last 24 hours

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      stats,
    });
  } catch (error) {
    logger.apiError('Error getting processing stats', error);
    
    return NextResponse.json(
      {
        error: 'Failed to get processing stats',
        timestamp: new Date().toISOString(),
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
} 