import { Tracker, NewTracker, ITrackerRepository } from '../types/tracker';

export class TrackerRepository implements ITrackerRepository {
  constructor(private readonly db: D1Database) {}

  /**
   * Insert or update a tracked milestone in D1
   */
  async save(tracker: NewTracker): Promise<void> {
    const id = tracker.id || crypto.randomUUID();
    const now = Date.now();

    await this.db.prepare(
      `INSERT OR REPLACE INTO trackers (id, guild_id, channel_id, message_id, target_date, label, created_at, last_updated_at)
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
