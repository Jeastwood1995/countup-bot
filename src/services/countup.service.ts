import { MilestoneCalculation, ICountupService } from '../types/milestone';

export class CountupService implements ICountupService {
  /**
   * Calculate elapsed days/weeks from target date and build the formatted markdown content
   */
  calculate(
    dateStr: string,
    label?: string | null,
    isTracked: boolean = false
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

    const title = label ? `💖 **${label}**` : '⏳ **Count-up**';
    const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const totalWeeks = Math.floor(totalDays / 7);
    const remainingDays = totalDays % 7;

    let breakdown = `It has been **${totalDays.toLocaleString()} days** since <t:${unixSeconds}:D>!`;
    if (totalWeeks > 0) {
      breakdown += `\n*(That's approx **${totalWeeks.toLocaleString()} week${totalWeeks === 1 ? '' : 's'}**${remainingDays > 0 ? ` and **${remainingDays} day${remainingDays === 1 ? '' : 's'}**` : ''})*`;
    }

    const lines = [
      title,
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
}
