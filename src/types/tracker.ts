import { UpdateJobResult } from './jobs';

export interface Tracker {
  id: string;
  guild_id: string | null;
  channel_id: string;
  message_id: string;
  target_date: string;
  label: string | null;
  created_at: number;
  last_updated_at: number | null;
}

export interface NewTracker {
  id?: string;
  guildId: string | null;
  channelId: string;
  messageId: string;
  targetDate: string;
  label?: string | null;
}

export interface ITrackerRepository {
  save(tracker: NewTracker): Promise<void>;
  findAll(): Promise<Tracker[]>;
  findByGuild(guildId: string, limit?: number): Promise<Tracker[]>;
  deleteByMessageId(messageId: string): Promise<boolean>;
  deleteById(id: string): Promise<boolean>;
  updateLastUpdated(id: string, timestamp?: number): Promise<void>;
}

export interface TrackExistingParams {
  guildId: string | null;
  channelId: string;
  messageId: string;
  dateStr: string;
  label?: string | null;
}

export interface ServiceResult {
  success: boolean;
  message: string;
  flags?: number;
}

export interface ITrackerService {
  trackExisting(params: TrackExistingParams): Promise<ServiceResult>;
  trackOriginalInteraction(
    interaction: any,
    dateStr: string,
    label?: string | null
  ): Promise<void>;
  syncAll(): Promise<UpdateJobResult>;
  list(guildId: string): Promise<ServiceResult>;
  untrack(messageId: string): Promise<ServiceResult>;
}
