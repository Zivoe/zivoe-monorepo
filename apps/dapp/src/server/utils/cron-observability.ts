import * as Sentry from '@sentry/nextjs';

export type CronFlow = 'deposits-cron' | 'redemptions-cron';

export type CronStage =
  | 'run_init'
  | 'fetch_events'
  | 'infer_input_details'
  | 'send_telegram'
  | 'get_users'
  | 'dedupe_check'
  | 'send_email'
  | 'record_email'
  | 'update_cursor'
  | 'run_finalize';

export type CronRunCounters = {
  fetchedEvents: number;
  processedEvents: number;
  skippedNoUserEvents: number;
  skippedAlreadySent: number;
  emailsSent: number;
  telegramFailures: number;
  cursorUpdates: number;
};

export type CronFailureDetails = {
  stage: CronStage;
  message: string;
  eventId?: string;
  txHash?: string;
  userId?: string;
  walletAddress?: string;
  blockNumber?: bigint;
  logIndex?: number;
};

export type CronRunWideEvent = {
  runId: string;
  flow: CronFlow;
  route: string;
  status: 'in_progress' | 'ok' | 'error';
  stage: CronStage;
  startedAt: string;
  durationMs?: number;
  latestBlockNumber?: bigint;
  safeBlockNumber?: bigint;
  cursorStartBlockNumber?: bigint;
  cursorStartLogIndex?: number;
  cursorEndBlockNumber?: bigint;
  cursorEndLogIndex?: number;
  qstashMessageId?: string;
  qstashScheduleId?: string;
  qstashRetried?: number;
  counters: CronRunCounters;
  samples: {
    skippedNoUserEventIds: string[];
    skippedAlreadySent: Array<{ eventId: string; userId: string }>;
  };
  failure?: CronFailureDetails;
};

function createRunId(flow: CronFlow): string {
  const prefix = flow === 'deposits-cron' ? 'dep' : 'red';
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export function parseQstashRetried(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function toSentrySafe<T>(value: T): T {
  if (typeof value === 'bigint') return value.toString() as T;

  if (Array.isArray(value)) return value.map((item) => toSentrySafe(item)) as T;

  if (value instanceof Date) return value.toISOString() as T;

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
      key,
      toSentrySafe(nestedValue)
    ]);
    return Object.fromEntries(entries) as T;
  }

  return value;
}

export function createCronRunWideEvent({
  flow,
  route,
  qstashMessageId,
  qstashScheduleId,
  qstashRetried
}: {
  flow: CronFlow;
  route: string;
  qstashMessageId?: string;
  qstashScheduleId?: string;
  qstashRetried?: number;
}): CronRunWideEvent {
  return {
    runId: createRunId(flow),
    flow,
    route,
    status: 'in_progress',
    stage: 'run_init',
    startedAt: new Date().toISOString(),
    qstashMessageId,
    qstashScheduleId,
    qstashRetried,
    counters: {
      fetchedEvents: 0,
      processedEvents: 0,
      skippedNoUserEvents: 0,
      skippedAlreadySent: 0,
      emailsSent: 0,
      telegramFailures: 0,
      cursorUpdates: 0
    },
    samples: {
      skippedNoUserEventIds: [],
      skippedAlreadySent: []
    }
  };
}

export function pushSample<T>(target: T[], value: T, maxSize: number = 10) {
  if (target.length >= maxSize) return;
  target.push(value);
}

export function logCronWideEvent(runEvent: CronRunWideEvent) {
  Sentry.logger.info(`${runEvent.flow}.run`, toSentrySafe(runEvent));
}
