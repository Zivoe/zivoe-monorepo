import { desc } from 'drizzle-orm';

import { type Database } from '../client';
import {
  type ProtocolDailySnapshot,
  protocolDailySnapshot,
  protocolDailySnapshotColumns
} from '../schema/protocol-daily-snapshot';

export async function getLatestProtocolDailySnapshot(db: Database): Promise<ProtocolDailySnapshot | null> {
  const rows = await db
    .select(protocolDailySnapshotColumns)
    .from(protocolDailySnapshot)
    .orderBy(desc(protocolDailySnapshot.timestamp))
    .limit(1);

  return rows[0] ?? null;
}
