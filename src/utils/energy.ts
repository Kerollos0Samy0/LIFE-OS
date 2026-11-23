import type {
  AppUsageLog,
  EnergyLog,
  HealthLog,
  PeakConcentration,
  TaskItem,
} from '../types/lifeos';

export interface EnergyEstimateBreakdown {
  estimatedScore: number | null; // 0-100, null if zero inputs available
  level: 'high' | 'moderate' | 'low' | 'unavailable';
  baselineDaysLogged: number;
  baselineTargetDays: number;
  measuredFactors: {
    sleepHours: number | null;
    sleepConsistencyPercent: number | null;
    steps: number | null;
    nighttimeScreenMinutes: number | null;
    restingHeartRate: number | null;
  };
  selfReportedEnergy: number | null; // 1-10
  recommendationsAr: string[];
  recommendationsEn: string[];
}

/**
 * Transparent, non-medical personal energy estimator.
 * Gracefully re-weights only available metrics; never fabricates missing sensor data.
 */
export function calculateEnergyEstimate(params: {
  healthLogs: HealthLog[];
  appUsageLogs: AppUsageLog[];
  energyLogs: EnergyLog[];
  dailyStepTarget: number;
  targetSleepHours: number;
  peakConcentration: PeakConcentration;
}): EnergyEstimateBreakdown {
  const { healthLogs, appUsageLogs, energyLogs, dailyStepTarget, targetSleepHours, peakConcentration } = params;

  const sortedHealth = [...healthLogs].sort((a, b) => b.date.localeCompare(a.date));
  const sortedUsage = [...appUsageLogs].sort((a, b) => b.date.localeCompare(a.date));
  const sortedEnergy = [...energyLogs].sort((a, b) => b.date.localeCompare(a.date));

  const latestHealth = sortedHealth[0];
  const latestUsage = sortedUsage[0];
  const latestEnergy = sortedEnergy[0];

  const sleepHours = latestHealth?.sleepHours ?? null;
  const steps = latestHealth?.steps ?? null;
  const restingHeartRate = latestHealth?.restingHeartRate ?? null;
  const nighttimeScreenMinutes = latestUsage?.nighttimeMinutes ?? null;
  const selfReportedEnergy = latestEnergy?.energyLevel ?? null;

  // Sleep consistency based on standard deviation of recent sleep hours (up to 7 days)
  const recentSleeps = sortedHealth
    .slice(0, 7)
    .map((h) => h.sleepHours)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

  let sleepConsistencyPercent: number | null = null;
  if (recentSleeps.length >= 2) {
    const avg = recentSleeps.reduce((s, x) => s + x, 0) / recentSleeps.length;
    const variance = recentSleeps.reduce((s, x) => s + (x - avg) ** 2, 0) / recentSleeps.length;
    const stdDev = Math.sqrt(variance);
    sleepConsistencyPercent = Math.max(0, Math.min(100, Math.round(100 - stdDev * 25)));
  }

  let weightedSum = 0;
  let totalWeight = 0;

  // 1. Sleep duration (weight 30) — optimal ~7-8h, scaled thoughtfully for baseline
  if (sleepHours !== null) {
    const optimal = Math.max(7, targetSleepHours);
    const sleepScore = Math.max(0, Math.min(100, Math.round((sleepHours / optimal) * 100)));
    weightedSum += sleepScore * 30;
    totalWeight += 30;
  }

  // 2. Sleep consistency (weight 15)
  if (sleepConsistencyPercent !== null) {
    weightedSum += sleepConsistencyPercent * 15;
    totalWeight += 15;
  }

  // 3. Activity / Steps (weight 20)
  if (steps !== null) {
    const stepRatio = steps / Math.max(1000, dailyStepTarget);
    const activityScore = Math.max(0, Math.min(100, Math.round(stepRatio * 100)));
    weightedSum += activityScore * 20;
    totalWeight += 20;
  }

  // 4. Digital Wellbeing nighttime screen penalty (weight 15)
  if (nighttimeScreenMinutes !== null) {
    const digitalScore = Math.max(0, Math.min(100, Math.round(100 - nighttimeScreenMinutes * 1.1)));
    weightedSum += digitalScore * 15;
    totalWeight += 15;
  }

  // 5. Self-reported energy & stress check-in (weight 20)
  if (latestEnergy) {
    const selfScore = Math.max(
      0,
      Math.min(100, Math.round(((latestEnergy.energyLevel + latestEnergy.focusLevel + (11 - latestEnergy.stressLevel)) / 30) * 100)),
    );
    weightedSum += selfScore * 20;
    totalWeight += 20;
  }

  const estimatedScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : null;
  const level: EnergyEstimateBreakdown['level'] =
    estimatedScore === null
      ? 'unavailable'
      : estimatedScore >= 72
        ? 'high'
        : estimatedScore >= 48
          ? 'moderate'
          : 'low';

  const uniqueDates = new Set([
    ...healthLogs.map((h) => h.date),
    ...energyLogs.map((e) => e.date),
    ...appUsageLogs.map((u) => u.date),
  ]);

  const recommendationsAr: string[] = [];
  const recommendationsEn: string[] = [];

  if (peakConcentration === 'morning') {
    recommendationsAr.push('ابدأ بأصعب مهمة تركيز عميق قبل الساعة 11 صباحاً لاستغلال ذروة تركيزك الصباحية.');
    recommendationsEn.push('Schedule your hardest deep-work task before 11:00 AM to match your morning concentration peak.');
  }
  if (sleepHours !== null && sleepHours < 6) {
    recommendationsAr.push(`نومك الأخير (${sleepHours} ساعات) أقل من الموصى به — خُد استراحة قصيرة 15 دقيقة بعد الظهر وابتعد عن الشاشات قبل النوم.`);
    recommendationsEn.push(`Your recent sleep (${sleepHours}h) is short — plan a 15-minute afternoon break and wind down earlier tonight.`);
  }
  if (nighttimeScreenMinutes !== null && nighttimeScreenMinutes >= 45) {
    recommendationsAr.push(`استخدام الموبايل بالليل وصل ${nighttimeScreenMinutes} دقيقة — جرب تقليل السوشيال ميديا قبل النوم بساعة.`);
    recommendationsEn.push(`Nighttime phone usage reached ${nighttimeScreenMinutes} min — try silencing social apps 1 hour before bed.`);
  }
  if (recommendationsAr.length < 2) {
    recommendationsAr.push('حافظ على فواصل راحة قصيرة كل 25–50 دقيقة للحفاظ على ثبات طاقتك طوال ساعات الشغل.');
    recommendationsEn.push('Keep short recovery breaks every 25–50 minutes to sustain focus across your 8-hour workday.');
  }

  return {
    estimatedScore,
    level,
    baselineDaysLogged: uniqueDates.size,
    baselineTargetDays: 30,
    measuredFactors: {
      sleepHours,
      sleepConsistencyPercent,
      steps,
      nighttimeScreenMinutes,
      restingHeartRate,
    },
    selfReportedEnergy,
    recommendationsAr,
    recommendationsEn,
  };
}

/**
 * Checks whether a proposed task start time (HH:mm) falls outside configured working hours.
 */
export function isOutsideWorkingHours(
  scheduledStart: string | undefined,
  workStartHour: number,
  workEndHour: number,
): boolean {
  if (!scheduledStart || !/^\d{2}:\d{2}$/.test(scheduledStart)) return false;
  const [hh, mm] = scheduledStart.split(':').map(Number);
  const decimalHour = hh + mm / 60;
  return decimalHour < workStartHour || decimalHour >= workEndHour;
}

/**
 * Smart schedule ordering: places high-priority deep work first for morning-peak users.
 */
export function sortTasksForSmartSchedule(tasks: TaskItem[], peak: PeakConcentration): TaskItem[] {
  const priorityRank: Record<TaskItem['priority'], number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  return [...tasks].sort((a, b) => {
    if (a.status === 'completed' && b.status !== 'completed') return 1;
    if (a.status !== 'completed' && b.status === 'completed') return -1;

    const aDeepBoost = peak === 'morning' && a.category === 'deep_work' ? 1.5 : 0;
    const bDeepBoost = peak === 'morning' && b.category === 'deep_work' ? 1.5 : 0;

    const scoreA = priorityRank[a.priority] + aDeepBoost;
    const scoreB = priorityRank[b.priority] + bDeepBoost;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return (a.scheduledStart || '23:59').localeCompare(b.scheduledStart || '23:59');
  });
}
