import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

import { env } from '@/env';

import { BASE_URL } from './base-url';

export const unsubscribeBucketValues = ['newsletter', 'product_tips', 'transaction_receipts', 'manage'] as const;
export type UnsubscribeBucket = (typeof unsubscribeBucketValues)[number];

const DEFAULT_UNSUBSCRIBE_TOKEN_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days

const unsubscribeTokenPayloadSchema = z.object({
  sub: z.string().uuid(),
  bucket: z.enum(unsubscribeBucketValues),
  emailHash: z.string().min(1),
  purpose: z.literal('unsubscribe'),
  iat: z.number().int().positive(),
  exp: z.number().int().positive()
});

export type UnsubscribeTokenPayload = z.infer<typeof unsubscribeTokenPayloadSchema>;

export function createUnsubscribeToken({
  userId,
  email,
  bucket,
  ttlSeconds = DEFAULT_UNSUBSCRIBE_TOKEN_TTL_SECONDS
}: {
  userId: string;
  email: string;
  bucket: UnsubscribeBucket;
  ttlSeconds?: number;
}) {
  const now = Math.floor(Date.now() / 1000);

  const payload: UnsubscribeTokenPayload = {
    sub: userId,
    bucket,
    emailHash: createEmailHash(email),
    purpose: 'unsubscribe',
    iat: now,
    exp: now + ttlSeconds
  };

  const payloadSegment = encodeBase64Url(JSON.stringify(payload));
  const signature = sign(payloadSegment);

  return `${payloadSegment}.${signature}`;
}

export function verifyUnsubscribeToken(token: string): UnsubscribeTokenPayload | null {
  const [payloadSegment, signatureSegment] = token.split('.');
  if (!payloadSegment || !signatureSegment) return null;

  const expectedSignature = sign(payloadSegment);
  if (!safeEqual(expectedSignature, signatureSegment)) return null;

  const payloadString = decodeBase64Url(payloadSegment);
  if (!payloadString) return null;

  const parsedJSON = safeParseJson(payloadString);
  if (!parsedJSON) return null;

  const parsedPayload = unsubscribeTokenPayloadSchema.safeParse(parsedJSON);
  if (!parsedPayload.success) return null;

  const payload = parsedPayload.data;
  const now = Math.floor(Date.now() / 1000);

  if (payload.exp < now) return null;

  return payload;
}

export function doesUnsubscribeTokenMatchEmail({
  payload,
  email
}: {
  payload: UnsubscribeTokenPayload;
  email: string;
}) {
  return safeEqual(payload.emailHash, createEmailHash(email));
}

export function buildUnsubscribeUrl({
  userId,
  email,
  bucket
}: {
  userId: string;
  email: string;
  bucket: UnsubscribeBucket;
}) {
  const token = createUnsubscribeToken({ userId, email, bucket });
  return `${BASE_URL}/unsubscribe?token=${encodeURIComponent(token)}`;
}

export function buildOneClickUnsubscribeUrl({ userId, email }: { userId: string; email: string }) {
  const token = createUnsubscribeToken({ userId, email, bucket: 'product_tips' });
  return `${BASE_URL}/api/unsubscribe/one-click?token=${encodeURIComponent(token)}`;
}

function sign(payloadSegment: string) {
  return createHmac('sha256', env.UNSUBSCRIBE_TOKEN_SECRET).update(payloadSegment).digest('base64url');
}

function createEmailHash(email: string) {
  return createHmac('sha256', env.UNSUBSCRIBE_TOKEN_SECRET)
    .update(`email:${normalizeEmail(email)}`)
    .digest('base64url');
}

function safeEqual(valueA: string, valueB: string) {
  const a = Buffer.from(valueA);
  const b = Buffer.from(valueB);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function encodeBase64Url(value: string) {
  return Buffer.from(value).toString('base64url');
}

function decodeBase64Url(value: string) {
  try {
    return Buffer.from(value, 'base64url').toString('utf8');
  } catch {
    return null;
  }
}

function safeParseJson(value: string): unknown | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
