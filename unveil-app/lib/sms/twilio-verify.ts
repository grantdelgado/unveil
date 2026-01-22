import { validateRequest } from 'twilio';
import { getPublicBaseUrl } from '@/lib/utils/url';

export interface VerifyTwilioRequestInput {
  reqHeaders: Headers | Record<string, string | undefined>;
  pathname: string;
  search?: string;
  requestUrl?: string;
  formParams: Record<string, string>;
}

export interface VerifyTwilioRequestResult {
  isValid: boolean;
  reason?: 'missing_signature' | 'missing_auth_token' | 'invalid_signature';
}

function getHeaderValue(
  headers: Headers | Record<string, string | undefined>,
  headerName: string,
): string | undefined {
  if (headers instanceof Headers) {
    return headers.get(headerName) ?? undefined;
  }

  const lowerName = headerName.toLowerCase();
  const direct = headers[headerName];
  if (direct) {
    return direct;
  }

  const byLower = headers[lowerName];
  if (byLower) {
    return byLower;
  }

  const foundKey = Object.keys(headers).find(
    (key) => key.toLowerCase() === lowerName,
  );
  return foundKey ? headers[foundKey] : undefined;
}

function normalizeForwardedValue(value?: string | null): string | undefined {
  if (!value) return undefined;
  return value.split(',')[0]?.trim() || undefined;
}

function buildCanonicalUrl(input: VerifyTwilioRequestInput): string {
  const proto = normalizeForwardedValue(
    getHeaderValue(input.reqHeaders, 'x-forwarded-proto'),
  );
  const host = normalizeForwardedValue(
    getHeaderValue(input.reqHeaders, 'x-forwarded-host'),
  );
  const search = input.search || '';

  if (proto && host) {
    return `${proto}://${host}${input.pathname}${search}`;
  }

  if (input.requestUrl) {
    try {
      const parsed = new URL(input.requestUrl);
      if (parsed.protocol && parsed.host) {
        return parsed.toString();
      }
    } catch {
      // Fall through to public base URL.
    }
  }

  const baseUrl = getPublicBaseUrl();
  return `${baseUrl}${input.pathname}${search}`;
}

export function verifyTwilioRequest(
  input: VerifyTwilioRequestInput,
): VerifyTwilioRequestResult {
  const signature = getHeaderValue(input.reqHeaders, 'x-twilio-signature');
  if (!signature) {
    return { isValid: false, reason: 'missing_signature' };
  }

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    return { isValid: false, reason: 'missing_auth_token' };
  }

  const canonicalUrl = buildCanonicalUrl(input);
  const isValid = validateRequest(
    authToken,
    signature,
    canonicalUrl,
    input.formParams,
  );

  return isValid
    ? { isValid: true }
    : { isValid: false, reason: 'invalid_signature' };
}
