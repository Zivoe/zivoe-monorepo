/**
 * Railway-style result: an operation either produced a value or one of a
 * finite set of typed errors the caller can map without a try-catch. Errors
 * are plain data — carry a `cause` field when an exception needs to travel.
 */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
