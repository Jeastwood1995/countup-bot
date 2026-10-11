import {
  ITrackerService,
  TrackExistingParams,
  ServiceResult,
  ITrackerRepository,
  ICountupService,
  IDiscordService,
  IDiscordEndpoints,
  UpdateJobResult,
} from '../types';
import { DiscordEndpoints } from './discord.endpoints';

export class TrackerService implements ITrackerService {
  constructor(
    private readonly repository: ITrackerRepository,
    private readonly countupService: ICountupService,
    private readonly discordService: IDiscordService,
    private readonly endpoints: IDiscordEndpoints = new DiscordEndpoints()
  ) {}

  /**
   * Link an existing Discord countup message to D1 and update it immediately with today's count
   */
  async trackExisting(params: TrackExistingParams): Promise<ServiceResult> {
    if (!params.messageId || !params.dateStr) {
      return {
        success: false,
        message: '⚠️ Please provide both `message_id` and `date`.',
        flags: 64,
      };
    }

    const calculation = this.countupService.calculate(params.dateStr, params.label, true);
    if (calculation.error || !calculation.content) {
      return {
        success: false,
        message: calculation.error || '⚠️ Invalid date provided.',
        flags: 64,
      };
    }

    const editResult = await this.discordService.editMessage(
      params.channelId,
      params.messageId,
      calculation.content
    );

    if (!editResult.success) {
      return {
        success: false,
        message: `⚠️ Could not update message \`${params.messageId}\` in this channel (${editResult.status}).\nMake sure the bot has permissions in this channel and that the Message ID was posted in this channel.\nError: \`${editResult.errorText}\``,
        flags: 64,
      };
    }

    await this.repository.save({
      guildId: params.guildId,
      channelId: params.channelId,
      messageId: params.messageId,
      targetDate: params.dateStr,
      label: params.label || null,
    });

    return {
      success: true,
      message: `✅ Successfully linked and updated message \`${params.messageId}\`!\nIt now displays today's recalculated count and will automatically update every midnight at 00:00 UTC.`,
      flags: 64,
    };
  }

  /**
   * Background task to fetch the newly created interaction message ID and save it to the repository
   */
  async trackOriginalInteraction(
    interaction: any,
    dateStr: string,
    label?: string | null
  ): Promise<void> {
    const appId = interaction.application_id;
    const token = interaction.token;

    const msg = await this.discordService.fetchOriginalMessage(appId, token);
    if (!msg) {
      console.error('[TrackerService] Failed to retrieve @original message from Discord.');
      return;
    }

    const channelId = msg.channel_id || interaction.channel_id || interaction.channel?.id;
    const guildId = interaction.guild_id || null;

    try {
      await this.repository.save({
        guildId,
        channelId,
        messageId: msg.id,
        targetDate: dateStr,
        label: label || null,
      });
      console.log(`✅ [TrackerService] Successfully saved tracker for message ${msg.id} in channel ${channelId}.`);
    } catch (err) {
      console.error('[TrackerService] Error saving tracker to repository:', err);
    }
  }

  /**
   * Recalculate and update all active trackers in D1
   */
  async syncAll(): Promise<UpdateJobResult> {
    const trackers = await this.repository.findAll();
    if (trackers.length === 0) {
      console.log('[TrackerService] No active trackers in database.');
      return { total: 0, updated: 0, pruned: 0, failed: 0 };
    }

    // Deduplicate by message_id in case duplicate rows were created
    const uniqueTrackers = new Map<string, typeof trackers[0]>();
    const duplicateIdsToDelete: string[] = [];

    for (const tracker of trackers) {
      const existing = uniqueTrackers.get(tracker.message_id);
      if (!existing) {
        uniqueTrackers.set(tracker.message_id, tracker);
      } else {
        // If existing has no label but this duplicate does, keep this one
        if (!existing.label && tracker.label) {
          duplicateIdsToDelete.push(existing.id);
          uniqueTrackers.set(tracker.message_id, tracker);
        } else {
          duplicateIdsToDelete.push(tracker.id);
        }
      }
    }

    // Self-heal: automatically remove duplicate rows from D1
    for (const dupId of duplicateIdsToDelete) {
      console.log(`🧹 [TrackerService] Pruning duplicate tracker entry ID: ${dupId}`);
      await this.repository.deleteById(dupId);
    }

    const activeTrackers = Array.from(uniqueTrackers.values());
    console.log(`[TrackerService] Updating ${activeTrackers.length} active tracker(s)...`);
    let updated = 0;
    let pruned = 0;
    let failed = 0;

    for (const tracker of activeTrackers) {
      const calculation = this.countupService.calculate(tracker.target_date, tracker.label, true);
      if (!calculation.content) continue;

      const res = await this.discordService.editMessage(
        tracker.channel_id,
        tracker.message_id,
        calculation.content
      );

      if (res.success) {
        updated++;
        await this.repository.updateLastUpdated(tracker.id);
        console.log(`✅ [TrackerService] Updated tracker ${tracker.id} (msg: ${tracker.message_id})`);
      } else if (res.notFound) {
        pruned++;
        console.warn(`⚠️ [TrackerService] Message ${tracker.message_id} in channel ${tracker.channel_id} unavailable (${res.status}). Pruning.`);
        await this.repository.deleteById(tracker.id);
      } else {
        failed++;
        console.error(`❌ [TrackerService] Failed to update tracker ${tracker.id} (${res.status}): ${res.errorText}`);
      }

      // Delay to comfortably respect Discord rate limits
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    return { total: activeTrackers.length, updated, pruned, failed };
  }

  /**
   * List all active milestone trackers for a guild
   */
  async list(guildId: string): Promise<ServiceResult> {
    if (!guildId) {
      return {
        success: false,
        message: '⚠️ This command can only be used within a Discord server.',
        flags: 64,
      };
    }

    const trackers = await this.repository.findByGuild(guildId);
    if (trackers.length === 0) {
      return {
        success: true,
        message: 'ℹ️ There are no active milestone trackers in this server.\nUse `/countup ... track: True` or `/countup-track-existing` to start tracking!',
        flags: 64,
      };
    }

    // Deduplicate in list view
    const uniqueTrackers = new Map<string, typeof trackers[0]>();
    for (const t of trackers) {
      const existing = uniqueTrackers.get(t.message_id);
      if (!existing || (!existing.label && t.label)) {
        uniqueTrackers.set(t.message_id, t);
      }
    }
    const deduplicated = Array.from(uniqueTrackers.values());

    const trackerLines = deduplicated.map((t, idx) => {
      const title = t.label ? `**${t.label}**` : '*Untitled*';
      const link = this.endpoints.messageLink(t.guild_id, t.channel_id, t.message_id);
      return `${idx + 1}. ${title} (since \`${t.target_date}\`)\n   🔗 [Jump to Message](${link}) • ID: \`${t.message_id}\``;
    });

    return {
      success: true,
      message: `📋 **Active Milestone Trackers (${deduplicated.length})**:\n\n${trackerLines.join('\n\n')}\n\n*To stop tracking any milestone, run \`/countup-untrack message_id: <ID>\`.*`,
      flags: 64,
    };
  }

  /**
   * Remove tracking for a milestone message
   */
  async untrack(messageId: string): Promise<ServiceResult> {
    if (!messageId) {
      return {
        success: false,
        message: '⚠️ Please provide a valid Message ID to untrack.',
        flags: 64,
      };
    }

    const deleted = await this.repository.deleteByMessageId(messageId);
    return {
      success: deleted,
      message: deleted
        ? `✅ Tracker removed! Message \`${messageId}\` will no longer update automatically.`
        : `⚠️ No active tracker found with Message ID \`${messageId}\`.\nCheck \`/countup-list\` to see active trackers.`,
      flags: 64,
    };
  }
}
