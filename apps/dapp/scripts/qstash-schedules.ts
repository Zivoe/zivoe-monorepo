/**
 * QStash Schedule Manager
 *
 * Local dev:
 *   1. npx @upstash/qstash-cli@latest dev
 *   2. Update .env with Qstash tokens and APP_URL
 *   3. pnpm schedules:sync
 */
import { Client, CreateScheduleRequest } from '@upstash/qstash';

type ScheduleConfig = Required<Pick<CreateScheduleRequest, 'scheduleId' | 'cron' | 'retries' | 'failureCallback'>> & {
  destination: string;
};

const SCHEDULES: Array<ScheduleConfig> = [
  {
    destination: '/api/monitor/network/live',
    scheduleId: 'network-live-hourly',
    cron: '0 * * * *', // Every hour at minute 0
    retries: 3,
    failureCallback: '/api/qstash/failure'
  },
  {
    destination: '/api/monitor/refresh-holdings',
    scheduleId: 'wallet-holdings-refresh',
    cron: '0 */6 * * *', // Every 6 hours
    retries: 1,
    failureCallback: '/api/qstash/failure'
  },
  {
    destination: '/api/monitor/deposits',
    scheduleId: 'deposits-5min',
    cron: '*/5 * * * *', // Every 5 minutes
    retries: 1,
    failureCallback: '/api/qstash/failure'
  },
  {
    destination: '/api/monitor/redemptions',
    scheduleId: 'redemptions-5min',
    cron: '*/5 * * * *', // Every 5 minutes
    retries: 1,
    failureCallback: '/api/qstash/failure'
  }
];

const token = process.env.QSTASH_TOKEN;
if (!token) {
  console.error('Error: QSTASH_TOKEN environment variable required');
  process.exit(1);
}

const client = new Client({ token });

async function sync() {
  const baseUrl = process.env.APP_URL;

  if (!baseUrl) {
    console.error('Error: APP_URL environment variable required');
    process.exit(1);
  }

  console.log(`Syncing ${SCHEDULES.length} schedule(s) to ${baseUrl}...\n`);

  for (const schedule of SCHEDULES) {
    const destination = `${baseUrl}${schedule.destination}`;
    const failureCallback = `${baseUrl}${schedule.failureCallback}`;

    await client.schedules.create({
      scheduleId: schedule.scheduleId,
      destination,
      cron: schedule.cron,
      retries: schedule.retries,
      failureCallback
    });

    console.log(`  ${schedule.scheduleId}`);
    console.log(`    cron: ${schedule.cron}`);
    console.log(`    dest: ${destination}`);
    console.log(`    retries: ${schedule.retries}`);
    console.log(`    failureCallback: ${failureCallback}`);
    console.log();
  }

  console.log(`Done! ${SCHEDULES.length} schedule(s) synced.`);
}

async function list() {
  const schedules = await client.schedules.list();

  if (schedules.length === 0) {
    console.log('No schedules found.');
    return;
  }

  console.log(`Found ${schedules.length} schedule(s):\n`);
  for (const s of schedules) {
    console.log(`  ${s.scheduleId || '(no id)'}`);
    console.log(`    cron: ${s.cron}`);
    console.log(`    dest: ${s.destination}`);
    console.log(`    retries: ${s.retries}`);
    if (s.callback) console.log(`    callback: ${s.callback}`);
    console.log(`    paused: ${s.isPaused}`);
    console.log();
  }
}

async function remove(scheduleId: string) {
  await client.schedules.delete(scheduleId);
  console.log(`Deleted schedule: ${scheduleId}`);
}

// CLI
const command = process.argv[2];
const arg = process.argv[3];

switch (command) {
  case 'sync':
    sync().catch((err) => {
      console.error('Sync failed:', err.message);
      process.exit(1);
    });
    break;
  case 'list':
    list().catch((err) => {
      console.error('List failed:', err.message);
      process.exit(1);
    });
    break;
  case 'remove':
    if (!arg) {
      console.error('Usage: tsx qstash-schedules.ts remove <schedule-id>');
      process.exit(1);
    }
    remove(arg).catch((err) => {
      console.error('Remove failed:', err.message);
      process.exit(1);
    });
    break;
  default:
    console.log(`
QStash Schedule Manager

Usage:
  pnpm schedules:sync     Sync all schedules (idempotent)
  pnpm schedules:list     List current schedules
  pnpm schedules:remove <id>  Remove a schedule by ID

Environment variables:
  QSTASH_TOKEN   Required for all commands
  APP_URL        Required for sync (e.g., https://app.zivoe.com)
`);
}
