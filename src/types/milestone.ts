export interface MilestoneCalculation {
  content?: string;
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
    isTracked?: boolean
  ): MilestoneCalculation;
}
