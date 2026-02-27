-- Seed monitor cursors so that the first cron run starts from a recent block
-- instead of block 0, which would send emails for all historical transactions.
INSERT INTO "transaction_monitor_cursor" ("flow", "last_block_number", "last_log_index", "updated_at")
VALUES
  ('deposit', 24537602, -1, now()),
  ('redemption', 24537602, -1, now())
ON CONFLICT ("flow") DO NOTHING;
