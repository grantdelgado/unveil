import { NextRequest, NextResponse } from 'next/server';
// Note: Complex message processing functionality has been simplified
// This endpoint now provides basic scheduled message processing status
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    logger.api('Processing scheduled messages API called');

    // Verify the request is authorized (internal calls only)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Require valid cron secret for all environments
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Simplified implementation - scheduled message processing now handled by useMessages hook
    logger.api('Processing completed (simplified implementation)');

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      processing: {
        processed: 0,
        failed: 0,
        message: 'Scheduled message processing simplified - use useMessages hook for client-side operations'
      },
      stats: {
        pending: 0,
        processed: 0,
        failed: 0
      },
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

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      stats: {
        pending: 0,
        processed: 0,
        failed: 0,
        message: 'Use useMessages hook for real-time message data'
      },
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