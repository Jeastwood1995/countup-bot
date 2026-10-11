import { Tracker, NewTracker, ITrackerRepository } from '../types/tracker';

export class TrackerRepository implements ITrackerRepository {
  constructor(private readonly db: D1Database) {}

  /**
   * Find a tracker by its Discord message ID
   */
  async findByMessageId(messageId: string): Promise<Tracker | null> {
    const { results } = await this.db.prepare(
      `SELECT * FROM trackers WHERE message_id = ? LIMIT 1`
    ).bind(messageId).all<Tracker>();

    return results?.[0] || null;
  }

  /**
   * Insert or update a tracked milestone in D1 (upserts by message_id to prevent duplicates)
   */
  async save(tracker: NewTracker): Promise<void> {
    const now = Date.now();
    const existing = await this.findByMessageId(tracker.messageId);

    if (existing) {
      // Preserve existing label if newly provided label is undefined
      const label = tracker.label !== undefined ? tracker.label : existing.label;
      await this.db.prepare(
        `UPDATE trackers
         SET guild_id = ?, channel_id = ?, target_date = ?, label = ?, last_updated_at = ?
         WHERE message_id = ?`
      ).bind(
        tracker.guildId,
        tracker.channelId,
        tracker.targetDate,
        label || null,
        now,
        tracker.messageId
      ).run();
      return;
    }

    const id = tracker.id || crypto.randomUUID();
    await this.db.prepare(
      `INSERT INTO trackers (id, guild_id, channel_id, message_id, target_date, label, created_at, last_updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      tracker.guildId,
      tracker.channelId,
      tracker.messageId,
      tracker.targetDate,
      tracker.label || null,
      now,
      now
    ).run();
  }

  /**
   * Retrieve all active trackers across all guilds
   */
  async findAll(): Promise<Tracker[]> {
    const { results } = await this.db.prepare(
      `SELECT * FROM trackers`
    ).all<Tracker>();

    return results || [];
  }

  /**
   * Retrieve active trackers for a specific Discord guild
   */
  async findByGuild(guildId: string, limit: number = 25): Promise<Tracker[]> {
    const { results } = await this.db.prepare(
      `SELECT * FROM trackers WHERE guild_id = ? ORDER BY created_at DESC LIMIT ?`
    ).bind(guildId, limit).all<Tracker>();

    return results || [];
  }

  /**
   * Delete a tracker by its Discord message ID
   */
  async deleteByMessageId(messageId: string): Promise<boolean> {
    const result = await this.db.prepare(
      `DELETE FROM trackers WHERE message_id = ?`
    ).bind(messageId).run();

    return (result.meta?.changes ?? 0) > 0;
  }

  /**
   * Delete a tracker by its internal UUID
   */
  async deleteById(id: string): Promise<boolean> {
    const result = await this.db.prepare(
      `DELETE FROM trackers WHERE id = ?`
    ).bind(id).run();

    return (result.meta?.changes ?? 0) > 0;
  }

  /**
   * Update the last_updated_at timestamp of a tracker
   */
  async updateLastUpdated(id: string, timestamp: number = Date.now()): Promise<void> {
    await this.db.prepare(
      `UPDATE trackers SET last_updated_at = ? WHERE id = ?`
    ).bind(timestamp, id).run();
  }
}
