import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { validateRequest } from 'twilio';
import { verifyTwilioRequest } from '@/lib/sms/twilio-verify';

const validateRequestMock = validateRequest as unknown as ReturnType<
  typeof vi.fn
>;

vi.mock('@/lib/utils/url', () => ({
  getPublicBaseUrl: () => 'https://public.example.com',
}));

describe('verifyTwilioRequest', () => {
  const originalToken = process.env.TWILIO_AUTH_TOKEN;

  beforeEach(() => {
    process.env.TWILIO_AUTH_TOKEN = 'test-token';
    validateRequestMock.mockReset();
  });

  afterEach(() => {
    if (originalToken) {
      process.env.TWILIO_AUTH_TOKEN = originalToken;
    } else {
      delete process.env.TWILIO_AUTH_TOKEN;
    }
  });

  it('returns valid when signature matches and uses forwarded headers', () => {
    validateRequestMock.mockReturnValue(true);

    const result = verifyTwilioRequest({
      reqHeaders: {
        'x-twilio-signature': 'sig',
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'webhook.example.com',
      },
      pathname: '/api/webhooks/twilio',
      search: '?foo=bar',
      requestUrl: 'http://localhost:3000/api/webhooks/twilio?foo=bar',
      formParams: { MessageSid: 'SM123', MessageStatus: 'delivered' },
    });

    expect(result).toEqual({ isValid: true });
    expect(validateRequestMock).toHaveBeenCalledWith(
      'test-token',
      'sig',
      'https://webhook.example.com/api/webhooks/twilio?foo=bar',
      { MessageSid: 'SM123', MessageStatus: 'delivered' },
    );
  });

  it('returns invalid when signature header is missing', () => {
    const result = verifyTwilioRequest({
      reqHeaders: {},
      pathname: '/api/webhooks/twilio',
      search: '',
      requestUrl: 'https://webhook.example.com/api/webhooks/twilio',
      formParams: { MessageSid: 'SM123' },
    });

    expect(result).toEqual({ isValid: false, reason: 'missing_signature' });
    expect(validateRequestMock).not.toHaveBeenCalled();
  });

  it('fails closed when TWILIO_AUTH_TOKEN is missing', () => {
    delete process.env.TWILIO_AUTH_TOKEN;

    const result = verifyTwilioRequest({
      reqHeaders: { 'x-twilio-signature': 'sig' },
      pathname: '/api/webhooks/twilio',
      search: '',
      requestUrl: 'https://webhook.example.com/api/webhooks/twilio',
      formParams: { MessageSid: 'SM123' },
    });

    expect(result).toEqual({ isValid: false, reason: 'missing_auth_token' });
    expect(validateRequestMock).not.toHaveBeenCalled();
  });

  it('falls back to requestUrl when forwarded headers are missing', () => {
    validateRequestMock.mockReturnValue(true);

    const result = verifyTwilioRequest({
      reqHeaders: { 'x-twilio-signature': 'sig' },
      pathname: '/api/webhooks/twilio',
      search: '?x=1',
      requestUrl: 'https://fallback.example.com/api/webhooks/twilio?x=1',
      formParams: { MessageSid: 'SM123' },
    });

    expect(result.isValid).toBe(true);
    expect(validateRequestMock).toHaveBeenCalledWith(
      'test-token',
      'sig',
      'https://fallback.example.com/api/webhooks/twilio?x=1',
      { MessageSid: 'SM123' },
    );
  });

  it('falls back to public base URL when requestUrl is invalid', () => {
    validateRequestMock.mockReturnValue(true);

    const result = verifyTwilioRequest({
      reqHeaders: { 'x-twilio-signature': 'sig' },
      pathname: '/api/webhooks/twilio',
      search: '?y=2',
      requestUrl: 'not-a-url',
      formParams: { MessageSid: 'SM123' },
    });

    expect(result.isValid).toBe(true);
    expect(validateRequestMock).toHaveBeenCalledWith(
      'test-token',
      'sig',
      'https://public.example.com/api/webhooks/twilio?y=2',
      { MessageSid: 'SM123' },
    );
  });
});
