import { DiscordEndpoints } from './discord.endpoints';
import { EditMessageResult, IDiscordService, IDiscordEndpoints, MessagePayload } from '../types/discord';

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
    payload: MessagePayload,
    maxRetries: number = 3
  ): Promise<EditMessageResult> {
    const url = this.endpoints.channelMessage(channelId, messageId);
    const requestBody = typeof payload === 'string' ? { content: payload } : payload;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'PATCH',
          headers: {
            Authorization: `Bot ${this.botToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (res.ok) {
          return { success: true };
        }

        const errorText = await res.text();

        // If rate limited, wait and retry
        if (res.status === 429 && attempt < maxRetries) {
          let retryAfterMs = 1000;
          try {
            const data = JSON.parse(errorText);
            if (data.retry_after) {
              retryAfterMs = Math.ceil(Number(data.retry_after) * 1000);
            }
          } catch {}
          console.warn(`[DiscordService] 429 Rate limited editing message ${messageId}. Retrying in ${retryAfterMs}ms...`);
          await new Promise((r) => setTimeout(r, retryAfterMs));
          continue;
        }

        return {
          success: false,
          notFound: res.status === 404 || res.status === 403,
          errorText,
          status: res.status,
        };
      } catch (err: any) {
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 500 * attempt));
          continue;
        }
        return {
          success: false,
          notFound: false,
          errorText: err?.message || 'Network error',
          status: 0,
        };
      }
    }

    return {
      success: false,
      notFound: false,
      errorText: 'Max retries exceeded',
      status: 0,
    };
  }

  /**
   * Edit the original interaction response message via webhook URL
   */
  async editOriginalMessage(
    applicationId: string,
    interactionToken: string,
    payload: MessagePayload
  ): Promise<boolean> {
    const url = this.endpoints.originalMessage(applicationId, interactionToken);
    const requestBody = typeof payload === 'string' ? { content: payload } : payload;
    try {
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      return res.ok;
    } catch (err) {
      console.error('[DiscordService] Failed to edit original interaction response:', err);
      return false;
    }
  }
}
