CREATE TABLE IF NOT EXISTS trackers (
  id TEXT PRIMARY KEY,
  guild_id TEXT,
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  target_date TEXT NOT NULL,
  label TEXT,
  created_at INTEGER NOT NULL,
  last_updated_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_trackers_channel_message ON trackers(channel_id, message_id);
CREATE INDEX IF NOT EXISTS idx_trackers_guild ON trackers(guild_id);
