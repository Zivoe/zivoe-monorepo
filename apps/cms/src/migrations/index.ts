import * as migration_20260417_130943_initial_schema from './20260417_130943_initial_schema';
import * as migration_20261110_155417_payload_3_93_schema from './20261110_155417_payload_3_93_schema';

export const migrations = [
  {
    up: migration_20260417_130943_initial_schema.up,
    down: migration_20260417_130943_initial_schema.down,
    name: '20260417_130943_initial_schema',
  },
  {
    up: migration_20261110_155417_payload_3_93_schema.up,
    down: migration_20261110_155417_payload_3_93_schema.down,
    name: '20261110_155417_payload_3_93_schema'
  },
];
