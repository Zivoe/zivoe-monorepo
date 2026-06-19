import { drizzle } from 'drizzle-orm/postgres-js';
import { type Sql } from 'postgres';

import * as schema from './schema/index';

export { schema };

export function createDatabase(connection: Sql) {
  return drizzle(connection, { schema });
}

export type Database = ReturnType<typeof createDatabase>;
