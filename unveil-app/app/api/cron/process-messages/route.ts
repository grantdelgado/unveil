import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    // Verify the request is authorized with cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Require valid cron secret for all environments
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.api('Cron job triggered: processing scheduled messages');

    // Call the message processor with proper authorization
    const processorUrl = new URL(
      '/api/messages/process-scheduled',
      request.url,
    );
    
    const processorHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Pass through authorization for internal calls
    if (cronSecret) {
      processorHeaders['authorization'] = `Bearer ${cronSecret}`;
    }
    
    const response = await fetch(processorUrl.toString(), {
      method: 'POST',
      headers: processorHeaders,
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(`Message processor failed: ${result.error}`);
    }

    logger.api('Cron job completed', result);

    // Extract metrics for response
    const responseData = {
      success: true,
      timestamp: new Date().toISOString(),
      result: {
        totalProcessed: result.totalProcessed,
        successful: result.successful,
        failed: result.failed,
        details: result.details,
      },
      metrics: result.metrics ? {
        sessionId: result.metrics.sessionId,
        processingDuration: result.metrics.endTime && result.metrics.startTime 
          ? Math.round((result.metrics.endTime.getTime() - result.metrics.startTime.getTime()) / 1000) 
          : null,
        throughputPerMinute: Math.round(result.metrics.throughputPerMinute * 100) / 100,
        averageProcessingTimeMs: Math.round(result.metrics.averageProcessingTimeMs),
        channelPerformance: {
          sms: {
            attempted: result.metrics.deliveryChannelStats.sms.attempted,
            successful: result.metrics.deliveryChannelStats.sms.successful,
            successRate: Math.round(result.metrics.deliveryChannelStats.sms.successRate * 100) / 100,
          },
          push: {
            attempted: result.metrics.deliveryChannelStats.push.attempted,
            successful: result.metrics.deliveryChannelStats.push.successful,
            successRate: Math.round(result.metrics.deliveryChannelStats.push.successRate * 100) / 100,
          },
          email: {
            attempted: result.metrics.deliveryChannelStats.email.attempted,
            successful: result.metrics.deliveryChannelStats.email.successful,
            successRate: Math.round(result.metrics.deliveryChannelStats.email.successRate * 100) / 100,
          },
        },
      } : null,
    };

    return NextResponse.json(responseData);
  } catch (error) {
    logger.apiError('Cron job failed', error);
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
