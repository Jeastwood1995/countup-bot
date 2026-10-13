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

export type MessagePayload = string | { content?: string; embeds?: any[] };

export interface IDiscordService {
  fetchOriginalMessage(
    applicationId: string,
    interactionToken: string
  ): Promise<{ id: string; channel_id: string } | null>;

  editMessage(
    channelId: string,
    messageId: string,
    payload: MessagePayload
  ): Promise<EditMessageResult>;

  editOriginalMessage(
    applicationId: string,
    interactionToken: string,
    payload: MessagePayload
  ): Promise<boolean>;
}

