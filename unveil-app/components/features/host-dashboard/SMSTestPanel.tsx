'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

interface SMSTestPanelProps {
  eventId: string;
}

export function SMSTestPanel({ eventId }: SMSTestPanelProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');

  const testMessageProcessing = async () => {
    setLoading(true);
    setResult('');

    try {
      const response = await fetch('/api/messages/process-scheduled', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setResult(
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const testCronEndpoint = async () => {
    setLoading(true);
    setResult('');

    try {
      const response = await fetch('/api/cron/process-messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setResult(
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const sendTestAnnouncement = async () => {
    setLoading(true);
    setResult('');

    try {
      const {
        data: { session },
      } = await (await import('@/lib/supabase')).supabase.auth.getSession();
      if (!session?.access_token) {
        setResult('Error: Not authenticated');
        return;
      }

      const response = await fetch('/api/sms/send-announcement', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          eventId,
          message: `🧪 Test SMS from Unveil! This is a test message to verify SMS integration is working. Time: ${new Date().toLocaleTimeString()}`,
        }),
      });

      const data = await response.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setResult(
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      setLoading(false);
    }
  };

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mt-6">
      <h3 className="text-lg font-semibold text-yellow-800 mb-4">
        🧪 SMS Testing Panel (Development Only)
      </h3>

      <div className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={testMessageProcessing}
            disabled={loading}
            variant="outline"
            size="sm"
          >
            {loading ? 'Testing...' : 'Test Message Processing'}
          </Button>

          <Button
            onClick={testCronEndpoint}
            disabled={loading}
            variant="outline"
            size="sm"
          >
            {loading ? 'Testing...' : 'Test Cron Job'}
          </Button>

          <Button
            onClick={sendTestAnnouncement}
            disabled={loading}
            variant="outline"
            size="sm"
          >
            {loading ? 'Sending...' : 'Send Test SMS'}
          </Button>
        </div>

        {result && (
          <div className="mt-4">
            <h4 className="font-medium text-yellow-800 mb-2">Result:</h4>
            <pre className="bg-white p-3 rounded border text-sm overflow-auto max-h-64">
              {result}
            </pre>
          </div>
        )}

        <div className="text-sm text-yellow-700 space-y-1">
          <p>
            <strong>Setup Required:</strong> Add Twilio credentials to your
            .env.local file
          </p>
          <p>
            <strong>Test Order:</strong> 1) Create message in composer 2) Test
            processing 3) Check delivery
          </p>
          <p>
            <strong>Webhook Test:</strong> Configure Twilio webhook to point to
            /api/webhooks/twilio
          </p>
        </div>
      </div>
    </div>
  );
}
