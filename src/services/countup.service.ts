import { MilestoneCalculation, ICountupService, DiscordEmbed } from '../types/milestone';

export class CountupService implements ICountupService {
  private readonly galleryUrl: string;

  constructor(galleryUrl?: string) {
    this.galleryUrl = (galleryUrl?.trim() || 'https://discord.com').replace(/\/+$/, '');
  }

  /**
   * Calculate elapsed days/weeks from target date and build the formatted markdown content or embed gallery
   */
  calculate(
    dateStr: string,
    label?: string | null,
    isTracked: boolean = false,
    imageUrls?: string[] | null
  ): MilestoneCalculation {
    const targetDate = new Date(dateStr);
    if (isNaN(targetDate.getTime())) {
      return {
        error: `⚠️ Could not parse the date \`${dateStr}\`.\nPlease provide a valid date in **YYYY-MM-DD** format (for example: \`2023-05-18\`).`,
      };
    }

    const now = Date.now();
    const targetMs = targetDate.getTime();
    const unixSeconds = Math.floor(targetMs / 1000);
    const diffMs = now - targetMs;

    if (diffMs < 0) {
      return {
        error: `⏳ That date hasn't happened yet! It starts in <t:${unixSeconds}:R> (<t:${unixSeconds}:D>).`,
      };
    }

    const rawTitle = label ? `💖 ${label}` : '⏳ Count-up';
    const textTitle = label ? `💖 **${label}**` : '⏳ **Count-up**';
    const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const totalWeeks = Math.floor(totalDays / 7);
    const remainingDays = totalDays % 7;

    let breakdown = `It has been **${totalDays.toLocaleString()} days** since <t:${unixSeconds}:D>!`;
    if (totalWeeks > 0) {
      breakdown += `\n*(That's approx **${totalWeeks.toLocaleString()} week${totalWeeks === 1 ? '' : 's'}**${remainingDays > 0 ? ` and **${remainingDays} day${remainingDays === 1 ? '' : 's'}**` : ''})*`;
    }

    const validUrls = (imageUrls || [])
      .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
      .slice(0, 4);

    // If images are provided, format as Discord Embed card / gallery
    if (validUrls.length > 0) {
      return {
        embeds: this.buildEmbedGallery(rawTitle, breakdown, unixSeconds, isTracked, validUrls),
        totalDays,
        totalWeeks,
        remainingDays,
        unixSeconds,
      };
    }

    // Default: Plain markdown content exactly as previously rendered
    const lines = [
      textTitle,
      breakdown,
      `✨ Discord relative clock: <t:${unixSeconds}:R>`,
    ];

    if (isTracked) {
      lines.push(`📌 *Live Tracker: Automatically updates daily at 00:00 UTC.*`);
    }

    return {
      content: lines.join('\n'),
      totalDays,
      totalWeeks,
      remainingDays,
      unixSeconds,
    };
  }

  /**
   * Build Discord embeds for a single image card or a multi-image gallery grid
   */
  private buildEmbedGallery(
    title: string,
    breakdown: string,
    unixSeconds: number,
    isTracked: boolean,
    imageUrls: string[]
  ): DiscordEmbed[] {
    const descLines = [
      breakdown,
      `✨ Discord relative clock: <t:${unixSeconds}:R>`,
    ];
    if (isTracked) {
      descLines.push(`📌 *Live Tracker: Automatically updates daily at 00:00 UTC.*`);
    }

    const description = descLines.join('\n\n');
    const accentColor = 0xeb459e; // Pink / magenta milestone accent

    if (imageUrls.length === 1) {
      return [
        {
          title,
          description,
          color: accentColor,
          image: { url: imageUrls[0] },
        },
      ];
    }

    // Multi-image gallery: Discord renders a collage grid when embeds share the same url
    const primaryEmbed: DiscordEmbed = {
      title,
      description,
      url: this.galleryUrl,
      color: accentColor,
      image: { url: imageUrls[0] },
    };

    const secondaryEmbeds: DiscordEmbed[] = imageUrls.slice(1).map((url) => ({
      url: this.galleryUrl,
      image: { url },
    }));

    return [primaryEmbed, ...secondaryEmbeds];
  }
}

