import {
  InteractionType,
  InteractionResponseType,
  verifyKey,
} from 'discord-interactions';
import { Env } from './types';
import { TrackerRepository } from './repositories/tracker.repository';
import { CountupService } from './services/countup.service';
import { DiscordEndpoints } from './services/discord.endpoints';
import { DiscordService } from './services/discord.service';
import { TrackerService } from './services/tracker.service';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // 1. Verify Ed25519 cryptographic signature
    const signature = request.headers.get('x-signature-ed25519');
    const timestamp = request.headers.get('x-signature-timestamp');
    const body = await request.text();

    if (!signature || !timestamp) {
      return new Response('Missing signature headers', { status: 401 });
    }

    const isValidRequest = await verifyKey(
      body,
      signature,
      timestamp,
      env.DISCORD_PUBLIC_KEY?.trim()
    );

    if (!isValidRequest) {
      return new Response('Invalid request signature', { status: 401 });
    }

    const interaction = JSON.parse(body);

    // 2. Handle Discord PING handshake
    if (interaction.type === InteractionType.PING) {
      return jsonResponse({ type: InteractionResponseType.PONG });
    }

    // 3. Handle Slash Commands
    if (interaction.type === InteractionType.APPLICATION_COMMAND) {
      const { name, options } = interaction.data;

      // Instantiate services and repositories conforming to their contracts
      const endpoints = new DiscordEndpoints(env.DISCORD_API_BASE, env.DISCORD_WEB_BASE);
      const trackerRepo = new TrackerRepository(env.DB);
      const countupService = new CountupService(env.GALLERY_ANCHOR_URL || env.DISCORD_WEB_BASE);
      const discordService = new DiscordService(env.DISCORD_BOT_TOKEN, endpoints);
      const trackerService = new TrackerService(trackerRepo, countupService, discordService, endpoints);

      // --- COMMAND: /countup ---
      if (name === 'countup') {
        const dateOption = options?.find((opt: any) => opt.name === 'date')?.value;
        const labelOption = options?.find((opt: any) => opt.name === 'label')?.value?.trim();
        const trackOption = Boolean(options?.find((opt: any) => opt.name === 'track')?.value);

        // Resolve up to 4 image attachments from interaction.data.resolved.attachments
        const imageKeys = ['image', 'image2', 'image3', 'image4'];
        const imageUrls: string[] = [];
        for (const key of imageKeys) {
          const attachmentId = options?.find((opt: any) => opt.name === key)?.value;
          if (attachmentId && interaction.data?.resolved?.attachments?.[attachmentId]) {
            const att = interaction.data.resolved.attachments[attachmentId];
            if (att?.url) {
              imageUrls.push(att.url);
            }
          }
        }

        const calculation = countupService.calculate(
          dateOption,
          labelOption,
          trackOption,
          imageUrls.length > 0 ? imageUrls : null
        );
        if (calculation.error) {
          return jsonResponse({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: calculation.error, flags: 64 },
          });
        }

        if (trackOption) {
          ctx.waitUntil(
            trackerService.trackOriginalInteraction(
              interaction,
              dateOption,
              labelOption,
              imageUrls.length > 0 ? imageUrls : null
            )
          );
        }

        const responseData: any = {};
        if (calculation.embeds && calculation.embeds.length > 0) {
          responseData.embeds = calculation.embeds;
        } else {
          responseData.content = calculation.content;
        }

        return jsonResponse({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: responseData,
        });
      }

      // --- COMMAND: /countup-track-existing ---
      if (name === 'countup-track-existing') {
        const messageId = options?.find((opt: any) => opt.name === 'message_id')?.value?.trim();
        const dateStr = options?.find((opt: any) => opt.name === 'date')?.value?.trim();
        const label = options?.find((opt: any) => opt.name === 'label')?.value?.trim();
        const channelId = interaction.channel_id || interaction.channel?.id;

        const imageKeys = ['image', 'image2', 'image3', 'image4'];
        const imageUrls: string[] = [];
        for (const key of imageKeys) {
          const attachmentId = options?.find((opt: any) => opt.name === key)?.value;
          if (attachmentId && interaction.data?.resolved?.attachments?.[attachmentId]) {
            const att = interaction.data.resolved.attachments[attachmentId];
            if (att?.url) {
              imageUrls.push(att.url);
            }
          }
        }

        const result = await trackerService.trackExisting({
          guildId: interaction.guild_id || null,
          channelId,
          messageId,
          dateStr,
          label,
          imageUrls: imageUrls.length > 0 ? imageUrls : null,
        });

        return jsonResponse({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: result.message, flags: result.flags },
        });
      }

      // --- COMMAND: /countup-sync ---
      if (name === 'countup-sync') {
        const appId = interaction.application_id;
        const token = interaction.token;

        ctx.waitUntil(
          (async () => {
            try {
              const stats = await trackerService.syncAll();
              await discordService.editOriginalMessage(
                appId,
                token,
                `🔄 **Manual Recalculation Sync Finished**:\n- Total Trackers in DB: **${stats.total}**\n- Successfully Updated: **${stats.updated}**\n- Pruned (Deleted/Inaccessible): **${stats.pruned}**\n- Failed: **${stats.failed}**`
              );
            } catch (err) {
              console.error('[CountupSync] Error during background sync:', err);
              await discordService.editOriginalMessage(
                appId,
                token,
                '⚠️ An error occurred during manual recalculation sync.'
              );
            }
          })()
        );

        return jsonResponse({
          type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
          data: { flags: 64 },
        });
      }

      // --- COMMAND: /countup-list ---
      if (name === 'countup-list') {
        const result = await trackerService.list(interaction.guild_id);
        return jsonResponse({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: result.message, flags: result.flags },
        });
      }

      // --- COMMAND: /countup-untrack ---
      if (name === 'countup-untrack') {
        const messageId = options?.find((opt: any) => opt.name === 'message_id')?.value?.trim();
        const result = await trackerService.untrack(messageId);
        return jsonResponse({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: result.message, flags: result.flags },
        });
      }
    }

    return new Response('Unhandled interaction type', { status: 400 });
  },

  // 4. Scheduled Handler (Cloudflare Cron Trigger runs daily at 00:00 UTC)
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log(`⏰ Daily Count-Up recalculation cron started at ${new Date(event.scheduledTime).toISOString()}`);

    const endpoints = new DiscordEndpoints(env.DISCORD_API_BASE, env.DISCORD_WEB_BASE);
    const trackerRepo = new TrackerRepository(env.DB);
    const countupService = new CountupService(env.GALLERY_ANCHOR_URL || env.DISCORD_WEB_BASE);
    const discordService = new DiscordService(env.DISCORD_BOT_TOKEN, endpoints);
    const trackerService = new TrackerService(trackerRepo, countupService, discordService, endpoints);

    await trackerService.syncAll();
    console.log('🏁 Daily Count-Up recalculation completed.');
  },
};

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
}
