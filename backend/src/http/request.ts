import type { CommonEvent } from 'commoneventframework/dist/types/commonEvent';
import { BadRequestError, PayloadTooLargeError, UnsupportedMediaTypeError } from '../core/errors';

export const MAX_BODY_BYTES = 64 * 1024;

/** Case-insensitive header lookup (Node lower-cases names, API Gateway v1 preserves them). */
export function getHeader(event: CommonEvent, name: string): string | undefined {
  const headers = event.headers ?? {};
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted) return value;
  }
  return undefined;
}

const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
};

/**
 * Query-string parameters as a plain object. Empty values are dropped so `?status=` behaves
 * like an absent filter. The CEF local dev server does not URL-decode values (API Gateway does),
 * so they are decoded here for that source only.
 */
export function readQuery(event: CommonEvent): Record<string, string> {
  const raw = event.queryStringParameters ?? {};
  const needsDecoding = event.version === 'commonEvent';
  const query: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined || value === '') continue;
    query[needsDecoding ? safeDecode(key) : key] = needsDecoding ? safeDecode(value) : value;
  }
  return query;
}

/** Parses a JSON request body, enforcing size and content-type. Empty bodies yield `{}`. */
export function readJsonBody(event: CommonEvent): unknown {
  if (!event.body) return {};
  const text = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  if (!text.trim()) return {};

  if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) {
    throw new PayloadTooLargeError(`Request body exceeds ${MAX_BODY_BYTES / 1024} KB`);
  }
  const contentType = getHeader(event, 'content-type');
  if (contentType && !/^application\/(.+\+)?json\b/i.test(contentType)) {
    throw new UnsupportedMediaTypeError('Request body must be application/json');
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new BadRequestError('Request body is not valid JSON', 'MALFORMED_JSON');
  }
}
