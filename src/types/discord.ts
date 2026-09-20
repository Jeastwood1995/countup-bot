export type EditMessageResult =
  | { success: true }
  | { success: false; notFound: boolean; errorText: string; status: number };

export interface IDiscordEndpoints {
  originalMessage(applicationId: string, interactionToken: string): string;
  channelMessage(channelId: string, messageId: string): string;
  messageLink(guildId: string | null | undefined, channelId: string, messageId: string): string;
  globalCommands(applicationId: string): string;
  guildCommands(applicationId: string, guildId: string): string;
}

export interface IDiscordService {
  fetchOriginalMessage(
    applicationId: string,
    interactionToken: string
  ): Promise<{ id: string; channel_id: string } | null>;

  editMessage(
    channelId: string,
    messageId: string,
    content: string
  ): Promise<EditMessageResult>;
}
