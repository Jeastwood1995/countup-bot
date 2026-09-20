import { DiscordEndpoints } from './discord.endpoints';
import { EditMessageResult, IDiscordService, IDiscordEndpoints } from '../types/discord';

export { EditMessageResult };

export class DiscordService implements IDiscordService {
  private readonly endpoints: IDiscordEndpoints;
  private readonly botToken: string;

  constructor(botToken: string, endpointsOrBaseUrl?: string | IDiscordEndpoints) {
    this.botToken = botToken?.trim() || '';
    if (typeof endpointsOrBaseUrl === 'object' && endpointsOrBaseUrl !== null) {
      this.endpoints = endpointsOrBaseUrl;
    } else {
      this.endpoints = new DiscordEndpoints(endpointsOrBaseUrl);
    }
  }

  /**
   * Fetch the original interaction response message with retry backoff
   * Webhook requests authenticate via the interaction token in the URL (no Bot header needed)
   */
  async fetchOriginalMessage(
    applicationId: string,
    interactionToken: string
  ): Promise<{ id: string; channel_id: string } | null> {
    const url = this.endpoints.originalMessage(applicationId, interactionToken);

    for (let attempt = 1; attempt <= 5; attempt++) {
      await new Promise((r) => setTimeout(r, attempt * 400));

      try {
        const res = await fetch(url);
        if (res.ok) {
          const data = (await res.json()) as { id: string; channel_id: string };
          return data;
        } else {
          const err = await res.text();
          console.warn(`[DiscordService] Attempt ${attempt} fetch original failed (${res.status}): ${err}`);
        }
      } catch (err) {
        console.error(`[DiscordService] Attempt ${attempt} network error:`, err);
      }
    }

    return null;
  }

  /**
   * Edit a Discord message in a channel using the Bot token
   */
  async editMessage(
    channelId: string,
    messageId: string,
    content: string
  ): Promise<EditMessageResult> {
    const url = this.endpoints.channelMessage(channelId, messageId);

    try {
      const res = await fetch(url, {
        method: 'PATCH',
        headers: {
          Authorization: `Bot ${this.botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });

      if (res.ok) {
        return { success: true };
      }

      const errorText = await res.text();
      return {
        success: false,
        notFound: res.status === 404 || res.status === 403,
        errorText,
        status: res.status,
      };
    } catch (err: any) {
      return {
        success: false,
        notFound: false,
        errorText: err?.message || 'Network error',
        status: 0,
      };
    }
  }
}
