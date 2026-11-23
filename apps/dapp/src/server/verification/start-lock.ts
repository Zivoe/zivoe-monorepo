import { redis } from '@/server/clients/redis';

/**
 * The Redis key one start holds for its subject. Whatever a start depends on
 * changes under the same key: an organization's details, who is in it, whether
 * it exists.
 */
export const kycStartLockKey = (subjectId: string) => `kyc-start:lock:${subjectId}`;

const RELEASE_IF_OURS = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) end return 0`;

/**
 * Takes the key with a token of its own and returns how to give it back: only while it is still that
 * token. Work that outlives the key's TTL must not delete the key someone else took after it expired.
 * Null when it is held.
 */
export async function takeStartLock(subjectId: string, ttlSeconds: number) {
  const key = kycStartLockKey(subjectId);
  const token = crypto.randomUUID();
  if ((await redis.set(key, token, { nx: true, ex: ttlSeconds })) === null) return null;
  return { release: () => redis.eval(RELEASE_IF_OURS, [key], [token]) };
}

/**
 * Runs `work` unless a start holds the subject's key, so a details save cannot
 * land after the inquiry that freezes them, and nobody leaves between a start's
 * membership check and the record that names them its starter. `null` while a
 * start is running: try again in a moment.
 */
export async function whileNotStarting<T>(subjectId: string, work: () => Promise<T>): Promise<T | null> {
  const lock = await takeStartLock(subjectId, 30);
  if (!lock) return null;
  try {
    return await work();
  } finally {
    await lock.release().catch(() => undefined);
  }
}
