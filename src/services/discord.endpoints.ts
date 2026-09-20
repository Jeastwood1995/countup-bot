import { IDiscordEndpoints } from '../types/discord';

export class DiscordEndpoints implements IDiscordEndpoints {
  private readonly baseUrl: string;
  private readonly webBaseUrl: string;

  constructor(apiBaseUrl?: string, webBaseUrl?: string) {
    this.baseUrl = (apiBaseUrl?.trim() || 'https://discord.com/api/v10').replace(/\/+$/, '');
    this.webBaseUrl = (
      webBaseUrl?.trim() ||
      this.baseUrl.replace(/\/api(\/v\d+)?\/?$/, '') ||
      'https://discord.com'
    ).replace(/\/+$/, '');
  }

  /**
   * Discord client jump link to a specific message in a channel
   */
  messageLink(guildId: string | null | undefined, channelId: string, messageId: string): string {
    const targetGuild = guildId || '@me';
    return `${this.webBaseUrl}/channels/${targetGuild}/${channelId}/${messageId}`;
  }

  /**
   * Endpoint for fetching or editing the original interaction response
   */
  originalMessage(applicationId: string, interactionToken: string): string {
    return `${this.baseUrl}/webhooks/${applicationId}/${interactionToken}/messages/@original`;
  }

  /**
   * Endpoint for fetching, editing, or deleting a message in a specific channel
   */
  channelMessage(channelId: string, messageId: string): string {
    return `${this.baseUrl}/channels/${channelId}/messages/${messageId}`;
  }

  /**
   * Endpoint for global application slash commands
   */
  globalCommands(applicationId: string): string {
    return `${this.baseUrl}/applications/${applicationId}/commands`;
  }

  /**
   * Endpoint for guild-specific application slash commands
   */
  guildCommands(applicationId: string, guildId: string): string {
    return `${this.baseUrl}/applications/${applicationId}/guilds/${guildId}/commands`;
  }
}
