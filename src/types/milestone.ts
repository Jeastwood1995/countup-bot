export interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  image?: { url: string };
  thumbnail?: { url: string };
  footer?: { text: string };
  timestamp?: string;
}

export interface MilestoneCalculation {
  content?: string;
  embeds?: DiscordEmbed[];
  totalDays?: number;
  totalWeeks?: number;
  remainingDays?: number;
  unixSeconds?: number;
  error?: string;
}

export interface ICountupService {
  calculate(
    dateStr: string,
    label?: string | null,
    isTracked?: boolean,
    imageUrls?: string[] | null
  ): MilestoneCalculation;
}

