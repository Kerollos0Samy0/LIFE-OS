import React, { useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpLeft,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Loader2,
  Mic,
  Minus,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Target,
  Wallet,
  Zap,
} from 'lucide-react';
import { useLifeOs } from '../context/LifeOsContext';
import { DailyMicroGoalModal } from './DailyMicroGoalModal';
import { CURRENT_MONTH, TODAY_ISO } from '../data/seedData';
import {
  calculateAvailableCashPiasters,
  calculatePendingReceivablesPiasters,
  calculateSavingsRatePercent,
  calculateTotalExpensesPiasters,
  calculateTotalPaidIncomePiasters,
  formatEgp,
} from '../utils/finance';
import { calculateEnergyEstimate } from '../utils/energy';
import { UI_TEXT } from '../i18n/translations';
import type { MicroGoalCategory, NavDestination } from '../types/lifeos';

const MICRO_GOAL_CATEGORY_LABELS: Record<MicroGoalCategory, { ar: string; en: string }> = {
  focus: { ar: 'التركيز', en: 'Focus' },
  finance: { ar: 'الماليات', en: 'Finance' },
  health: { ar: 'الصحة', en: 'Health' },
  wellbeing: { ar: 'التوازن الرقمي', en: 'Wellbeing' },
  personal: { ar: 'شخصي', en: 'Personal' },
};

function getMicroGoalStep(targetValue: number): number {
  if (targetValue >= 2000) return 500;
  if (targetValue >= 500) return 100;
  if (targetValue >= 60) return 15;
  if (targetValue >= 20) return 5;
  return 1;
}

interface DailyBriefingResponse {
  financialObservation: string;
  productivityObservation: string;
  healthObservation: string;
  importantReminder: string;
  recommendations: string[];
}

interface HomeDashboardProps {
  onNavigate: (dest: NavDestination) => void;
  onOpenVoiceExpense: () => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({ onNavigate, onOpenVoiceExpense }) => {
  const {
    data,
    lang,
    recordAiUsage,
    isCloudMode,
    signInWithGoogle,
    seedCloudFromSample,
    updateDailyMicroGoalProgress,
  } = useLifeOs();
  const isAr = lang === 'ar';

  const [briefing, setBriefing] = useState<DailyBriefingResponse | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingError, setBriefingError] = useState<string | null>(null);
  const [microGoalModalOpen, setMicroGoalModalOpen] = useState(false);

  const todayMicroGoal = useMemo(
    () => data.dailyMicroGoals.find((g) => g.date === TODAY_ISO) || null,
    [data.dailyMicroGoals],
  );

  const microGoalPct = todayMicroGoal
    ? Math.min(100, Math.round((todayMicroGoal.currentValue / Math.max(1, todayMicroGoal.targetValue)) * 100))
    : 0;
  const microGoalStep = todayMicroGoal ? getMicroGoalStep(todayMicroGoal.targetValue) : 1;

  const metrics = useMemo(() => {
    const availableCash = calculateAvailableCashPiasters(data.incomeRecords, data.expenseRecords);
    const monthlyPaidIncome = calculateTotalPaidIncomePiasters(data.incomeRecords, CURRENT_MONTH);
    const monthlyExpenses = calculateTotalExpensesPiasters(data.expenseRecords, CURRENT_MONTH);
    const pendingReceivables = calculatePendingReceivablesPiasters(data.incomeRecords);
    const savingsRate = calculateSavingsRatePercent(monthlyPaidIncome, monthlyExpenses);

    const totalSavingsCurrent = data.savingsGoals.reduce((s, g) => s + g.currentPiasters, 0);
    const totalSavingsTarget = data.savingsGoals.reduce((s, g) => s + g.targetPiasters, 0);
    const savingsProgressPct = totalSavingsTarget > 0 ? Math.round((totalSavingsCurrent / totalSavingsTarget) * 100) : 0;

    const todayTasks = data.tasks.filter((t) => t.deadline === TODAY_ISO);
    const completedToday = todayTasks.filter((t) => t.status === 'completed').length;
    const remainingToday = todayTasks.length - completedToday;
    const todayEvents = data.calendarEvents.filter((e) => e.date === TODAY_ISO);
    const focusMinutesToday = data.focusSessions
      .filter((f) => f.date === TODAY_ISO)
      .reduce((s, f) => s + f.durationMinutes, 0);

    const latestHealth = [...data.healthLogs].sort((a, b) => b.date.localeCompare(a.date))[0] || null;
    const latestUsage = [...data.appUsageLogs].sort((a, b) => b.date.localeCompare(a.date))[0] || null;

    const energy = calculateEnergyEstimate({
      healthLogs: data.healthLogs,
      appUsageLogs: data.appUsageLogs,
      energyLogs: data.energyLogs,
      dailyStepTarget: data.profile.dailyStepTarget,
      targetSleepHours: data.profile.targetSleepHours,
      peakConcentration: data.profile.peakConcentration,
    });

    const overdueInvoices = data.incomeRecords.filter((i) => i.status === 'overdue');

    return {
      availableCash,
      monthlyPaidIncome,
      monthlyExpenses,
      pendingReceivables,
      savingsRate,
      savingsProgressPct,
      totalSavingsCurrent,
      todayTasks,
      completedToday,
      remainingToday,
      todayEvents,
      focusMinutesToday,
      latestHealth,
      latestUsage,
      energy,
      overdueInvoices,
    };
  }, [data]);

  const handleGenerateBriefing = async () => {
    setBriefingLoading(true);
    setBriefingError(null);
    try {
      const payload = {
        date: TODAY_ISO,
        availableCashEgp: metrics.availableCash / 100,
        monthlyPaidIncomeEgp: metrics.monthlyPaidIncome / 100,
        monthlyExpensesEgp: metrics.monthlyExpenses / 100,
        pendingFreelanceReceivablesEgp: metrics.pendingReceivables / 100,
        overdueInvoicesCount: metrics.overdueInvoices.length,
        savingsProgressPercent: metrics.savingsProgressPct,
        tasksCompletedToday: metrics.completedToday,
        tasksRemainingToday: metrics.remainingToday,
        focusMinutesToday: metrics.focusMinutesToday,
        sleepHours: metrics.latestHealth?.sleepHours ?? 'unavailable',
        steps: metrics.latestHealth?.steps ?? 'unavailable',
        restingHeartRate: metrics.latestHealth?.restingHeartRate ?? 'unavailable',
        nighttimeScreenMinutes: metrics.latestUsage?.nighttimeMinutes ?? 'unavailable',
        estimatedEnergyScore: metrics.energy.estimatedScore ?? 'unavailable',
        peakConcentration: data.profile.peakConcentration,
      };

      const res = await fetch('/api/ai/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: lang, summary: payload }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Could not generate daily briefing');
      }
      if (json.tokensUsed) {
        recordAiUsage('gemini-3.1-flash-lite', json.tokensUsed);
      }
      setBriefing(json.briefing as DailyBriefingResponse);
    } catch (err) {
      setBriefingError(err instanceof Error ? err.message : 'Failed to load AI briefing');
    } finally {
      setBriefingLoading(false);
    }
  };

  const ArrowIcon = isAr ? ArrowUpLeft : ArrowUpRight;

  return (
    <div className="space-y-6">
      {/* Greeting & Quick Actions Row */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs text-[#8E99A8] tabular-nums">
            {TODAY_ISO} · {isCloudMode ? UI_TEXT[lang].auth.cloudSynced : UI_TEXT[lang].auth.localSampleMode}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#F4F6F8] mt-1">
            {isAr ? `أهلاً يا ${data.profile.displayName}` : `Welcome back, ${data.profile.displayName}`}
          </h1>
          <p className="text-sm text-[#8E99A8] mt-1">
            {isAr
              ? 'ملخص حي لحالتك المالية، وقتك، صحتك، ومؤشر طاقتك اليوم.'
              : 'Live snapshot of your finances, time, health, and daily energy.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenVoiceExpense}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-500 text-[#07110C] font-semibold text-sm hover:bg-emerald-400 transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <Mic className="w-4 h-4" />
            {isAr ? 'سجّل مصروف بالصوت' : 'Voice Expense'}
          </button>
          <button
            type="button"
            onClick={() => setMicroGoalModalOpen(true)}
            data-testid="open-micro-goal-modal"
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#13171C] border border-[#232A33] text-sm font-medium text-[#E2E8F0] hover:border-emerald-500/50 transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <Target className="w-4 h-4 text-emerald-400" />
            {isAr ? 'هدف اليوم المصغّر' : 'Daily Micro-Goal'}
          </button>
          <button
            type="button"
            onClick={() => onNavigate('ai')}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#13171C] border border-[#232A33] text-sm font-medium text-[#E2E8F0] hover:border-emerald-500/50 transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
            {isAr ? 'اسأل LIFE AI' : 'Ask LIFE AI'}
          </button>
        </div>
      </section>

      {/* Daily Micro-Goal Progress Card (Top of HomeDashboard) */}
      <section
        aria-label={isAr ? 'هدف اليوم المصغّر' : 'Daily Micro-Goal'}
        data-testid="daily-micro-goal-card"
        className="bg-[#13171C] border border-[#232A33] rounded-2xl p-5 sm:p-6"
      >
        {todayMicroGoal ? (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#8E99A8] tabular-nums">
                  <span className="text-emerald-400 font-medium">
                    {isAr ? 'هدف اليوم المصغّر' : 'Daily Micro-Goal'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{MICRO_GOAL_CATEGORY_LABELS[todayMicroGoal.category][lang]}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {todayMicroGoal.completed
                      ? isAr
                        ? 'مكتمل'
                        : 'Completed'
                      : isAr
                        ? 'قيد التقدم'
                        : 'In Progress'}
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-semibold text-[#F4F6F8] break-words">
                  {todayMicroGoal.title}
                </h2>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    void updateDailyMicroGoalProgress(
                      todayMicroGoal.id,
                      Math.max(0, todayMicroGoal.currentValue - microGoalStep),
                    )
                  }
                  disabled={todayMicroGoal.currentValue <= 0}
                  aria-label={isAr ? `إنقاص ${microGoalStep}` : `Decrease by ${microGoalStep}`}
                  className="min-h-[40px] min-w-[40px] px-2.5 rounded-xl bg-[#0B0D10] border border-[#232A33] text-[#C8D0DC] hover:border-emerald-500/50 disabled:opacity-40 transition-colors flex items-center justify-center"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void updateDailyMicroGoalProgress(
                      todayMicroGoal.id,
                      Math.min(todayMicroGoal.targetValue, todayMicroGoal.currentValue + microGoalStep),
                    )
                  }
                  disabled={todayMicroGoal.currentValue >= todayMicroGoal.targetValue}
                  aria-label={isAr ? `زيادة ${microGoalStep}` : `Increase by ${microGoalStep}`}
                  className="min-h-[40px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-xs font-mono-nums font-semibold text-emerald-400 hover:border-emerald-500/60 disabled:opacity-40 transition-colors flex items-center gap-1 whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{microGoalStep}</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void updateDailyMicroGoalProgress(
                      todayMicroGoal.id,
                      todayMicroGoal.completed ? 0 : todayMicroGoal.targetValue,
                    )
                  }
                  className={`min-h-[40px] px-3 rounded-xl border text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                    todayMicroGoal.completed
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      : 'bg-[#0B0D10] border-[#232A33] text-[#E2E8F0] hover:border-emerald-500/50'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>
                    {todayMicroGoal.completed
                      ? isAr
                        ? 'مكتمل'
                        : 'Done'
                      : isAr
                        ? 'إكمال'
                        : 'Complete'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setMicroGoalModalOpen(true)}
                  aria-label={isAr ? 'تعديل هدف اليوم' : 'Edit daily micro-goal'}
                  className="min-h-[40px] min-w-[40px] px-2.5 rounded-xl bg-[#0B0D10] border border-[#232A33] text-[#8E99A8] hover:text-[#F4F6F8] hover:border-emerald-500/50 transition-colors flex items-center justify-center"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs tabular-nums">
                <span className="text-[#C8D0DC] font-medium" data-testid="micro-goal-progress-value">
                  {todayMicroGoal.currentValue.toLocaleString('en-US')} /{' '}
                  {todayMicroGoal.targetValue.toLocaleString('en-US')} {todayMicroGoal.unit}
                </span>
                <span className="font-mono-nums font-semibold text-emerald-400" data-testid="micro-goal-progress-pct">
                  {microGoalPct}%
                </span>
              </div>
              <div
                className="w-full h-2 rounded-full bg-[#1C222B] overflow-hidden"
                role="progressbar"
                aria-valuenow={microGoalPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={todayMicroGoal.title}
              >
                <div
                  className="h-full w-full rounded-full bg-emerald-500 transition-transform duration-200 ease-out ltr:origin-left rtl:origin-right"
                  style={{ transform: `scaleX(${microGoalPct / 100})` }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs text-[#8E99A8] flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-emerald-400" />
                {isAr ? 'هدف اليوم المصغّر' : 'Daily Micro-Goal'}
              </p>
              <p className="text-sm font-medium text-[#F4F6F8] mt-1">
                {isAr
                  ? 'لم تحدد هدفاً مصغّراً لليوم بعد — اختر خطوة واحدة واضحة لتركّز عليها.'
                  : 'No daily micro-goal set yet — pick one focused target to anchor your day.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMicroGoalModalOpen(true)}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-500 text-[#07110C] font-semibold text-xs sm:text-sm hover:bg-emerald-400 transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
            >
              {isAr ? 'تحديد هدف اليوم' : 'Set Daily Micro-Goal'}
            </button>
          </div>
        )}
      </section>

      {/* Honest Cloud Sync / Empty Cloud Notice */}
      {!isCloudMode ? (
        <div className="bg-[#13171C] border border-[#232A33] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs sm:text-sm text-[#A9B3C1] leading-relaxed">
            {UI_TEXT[lang].auth.syncNotice}
          </p>
          <button
            type="button"
            onClick={() => void signInWithGoogle()}
            className="min-h-[40px] px-4 py-2 rounded-xl border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            {UI_TEXT[lang].auth.signInGoogle}
          </button>
        </div>
      ) : data.expenseRecords.length === 0 && data.incomeRecords.length === 0 ? (
        <div className="bg-[#13171C] border border-[#232A33] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs sm:text-sm text-[#A9B3C1]">
            {isAr
              ? 'حسابك السحابي جاهز وفارغ حالياً. يمكنك البدء بإضافة سجلاتك أو استيراد بيانات بداية نموذجية لتجربة المنصة.'
              : 'Your cloud workspace is empty. Start adding records or load starter sample data to explore.'}
          </p>
          <button
            type="button"
            onClick={() => void seedCloudFromSample()}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-500 text-[#07110C] text-xs font-semibold hover:bg-emerald-400 transition-colors whitespace-nowrap shrink-0"
          >
            {isAr ? 'استيراد بيانات البداية' : 'Load Starter Data'}
          </button>
        </div>
      ) : null}

      {/* Focal Anchor: Financial Summary Hero Grid */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-[#13171C] border border-[#232A33] rounded-2xl p-6 flex flex-col justify-between gap-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-[#8E99A8] flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                {isAr ? 'الرصيد النقدي المتاح فعلياً' : 'Available Cash Balance'}
              </p>
              <p className="text-3xl sm:text-4xl font-bold font-mono-nums text-[#F4F6F8] mt-2" data-testid="home-available-cash">
                {formatEgp(metrics.availableCash, lang)}
              </p>
              <p className="text-xs text-[#8E99A8] mt-1.5">
                {isAr
                  ? 'لا يشمل فواتير الفريلانس غير المحصّلة'
                  : 'Strictly excludes unpaid freelance invoices'}
                {' · '}
                <span className="text-amber-400 font-mono-nums">
                  {isAr ? 'مستحقات معلقة:' : 'Pending:'} {formatEgp(metrics.pendingReceivables, lang)}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('finance')}
              className="min-h-[38px] px-3 rounded-xl text-xs font-medium text-emerald-400 hover:bg-[#1B222A] transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              {isAr ? 'التفاصيل' : 'Details'}
              <ArrowIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:gap-4 pt-5 border-t border-[#232A33]">
            <div>
              <p className="text-[11px] sm:text-xs text-[#8E99A8]">{isAr ? 'دخل الشهر المحصّل' : 'Monthly Paid Income'}</p>
              <p className="text-sm sm:text-lg font-semibold font-mono-nums text-emerald-400 mt-1 whitespace-nowrap">
                {formatEgp(metrics.monthlyPaidIncome, lang)}
              </p>
            </div>
            <div>
              <p className="text-[11px] sm:text-xs text-[#8E99A8]">{isAr ? 'مصاريف الشهر' : 'Monthly Expenses'}</p>
              <p className="text-sm sm:text-lg font-semibold font-mono-nums text-[#F4F6F8] mt-1 whitespace-nowrap" data-testid="home-monthly-expenses">
                {formatEgp(metrics.monthlyExpenses, lang)}
              </p>
            </div>
            <div>
              <p className="text-[11px] sm:text-xs text-[#8E99A8]">{isAr ? 'تقدم الادخار' : 'Savings Progress'}</p>
              <p className="text-sm sm:text-lg font-semibold font-mono-nums text-[#F4F6F8] mt-1 whitespace-nowrap">
                {metrics.savingsProgressPct}%
              </p>
            </div>
          </div>
        </div>

        {/* Energy & AI Daily Briefing Card */}
        <div className="lg:col-span-5 bg-[#13171C] border border-[#232A33] rounded-2xl p-6 flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-[#8E99A8] flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-emerald-400" />
                {isAr ? 'مؤشر الطاقة التقديري' : 'Estimated Energy Indicator'}
              </p>
              <div className="flex items-baseline gap-2.5 mt-2">
                <span className="text-3xl font-bold font-mono-nums text-[#F4F6F8]">
                  {metrics.energy.estimatedScore !== null ? `${metrics.energy.estimatedScore}%` : UI_TEXT[lang].common.unavailable}
                </span>
                <span className="text-xs text-[#8E99A8]">
                  {metrics.energy.level === 'high'
                    ? isAr ? 'طاقة مرتفعة' : 'High readiness'
                    : metrics.energy.level === 'moderate'
                      ? isAr ? 'طاقة متوسطة' : 'Moderate'
                      : metrics.energy.level === 'low'
                        ? isAr ? 'يُنصح بالراحة' : 'Prioritize recovery'
                        : ''}
                </span>
              </div>
            </div>
            <span className="text-xs text-[#8E99A8] tabular-nums whitespace-nowrap shrink-0">
              {metrics.energy.baselineDaysLogged}/{metrics.energy.baselineTargetDays} {isAr ? 'يوم أساس' : 'baseline d'}
            </span>
          </div>

          <div className="space-y-2 text-xs text-[#A9B3C1] pt-3 border-t border-[#232A33]">
            <p className="text-[#F4F6F8] font-medium">
              {isAr ? 'توصية التركيز:' : 'Focus recommendation:'}
            </p>
            <p className="leading-relaxed">
              {isAr ? metrics.energy.recommendationsAr[0] : metrics.energy.recommendationsEn[0]}
            </p>
            <p className="text-[11px] text-[#758091]">{UI_TEXT[lang].common.nonMedicalNotice}</p>
          </div>
        </div>
      </section>

      {/* Productivity & Health Summaries */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Productivity Summary */}
        <div className="bg-[#13171C] border border-[#232A33] rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#F4F6F8] flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-emerald-400" />
              {isAr ? 'ملخص الإنتاجية والوقت' : 'Productivity & Time'}
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('time')}
              className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
            >
              {isAr ? 'إدارة اليوم' : 'Open Time'}
              <ArrowIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-[#8E99A8]">{isAr ? 'المكتملة اليوم' : 'Completed'}</p>
              <p className="text-xl font-bold font-mono-nums text-emerald-400 mt-1">
                {metrics.completedToday}/{metrics.todayTasks.length}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#8E99A8]">{isAr ? 'المواعيد اليوم' : 'Events'}</p>
              <p className="text-xl font-bold font-mono-nums text-[#F4F6F8] mt-1">{metrics.todayEvents.length}</p>
            </div>
            <div>
              <p className="text-xs text-[#8E99A8]">{isAr ? 'وقت التركيز' : 'Focus Time'}</p>
              <p className="text-xl font-bold font-mono-nums text-[#F4F6F8] mt-1">
                {metrics.focusMinutesToday} {isAr ? 'د' : 'm'}
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-[#232A33] space-y-2">
            {metrics.todayTasks.slice(0, 3).map((t) => (
              <div key={t.id} className="flex items-center justify-between text-xs py-1">
                <span className={t.status === 'completed' ? 'line-through text-[#6C7787]' : 'text-[#E2E8F0]'}>
                  {t.title}
                </span>
                <span className="font-mono-nums text-[#8E99A8] shrink-0 ms-3">
                  {t.scheduledStart || '—'} · {t.estimatedMinutes}{isAr ? 'د' : 'm'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Health Summary */}
        <div className="bg-[#13171C] border border-[#232A33] rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#F4F6F8] flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              {isAr ? 'ملخص الصحة والنشاط' : 'Health & Activity'}
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('health')}
              className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
            >
              {isAr ? 'سجل الصحة' : 'Open Health'}
              <ArrowIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <p className="text-xs text-[#8E99A8]">{isAr ? 'النوم' : 'Sleep'}</p>
              <p className="text-lg font-bold font-mono-nums text-[#F4F6F8] mt-1">
                {metrics.latestHealth?.sleepHours != null
                  ? `${metrics.latestHealth.sleepHours} ${isAr ? 'س' : 'h'}`
                  : UI_TEXT[lang].common.unavailable}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#8E99A8]">{isAr ? 'الخطوات' : 'Steps'}</p>
              <p className="text-lg font-bold font-mono-nums text-[#F4F6F8] mt-1">
                {metrics.latestHealth?.steps != null
                  ? metrics.latestHealth.steps.toLocaleString('en-US')
                  : UI_TEXT[lang].common.unavailable}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#8E99A8]">{isAr ? 'سعرات نشطة' : 'Active kcal'}</p>
              <p className="text-lg font-bold font-mono-nums text-[#F4F6F8] mt-1">
                {metrics.latestHealth?.activeCalories != null
                  ? `${metrics.latestHealth.activeCalories}`
                  : UI_TEXT[lang].common.unavailable}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#8E99A8]">{isAr ? 'نبض الراحة' : 'Resting HR'}</p>
              <p className="text-lg font-bold font-mono-nums text-[#F4F6F8] mt-1">
                {metrics.latestHealth?.restingHeartRate != null
                  ? `${metrics.latestHealth.restingHeartRate} bpm`
                  : UI_TEXT[lang].common.unavailable}
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-[#232A33] flex items-center justify-between text-xs text-[#8E99A8]">
            <span>
              {isAr ? 'المصدر:' : 'Source:'}{' '}
              {metrics.latestHealth?.source === 'manual'
                ? isAr ? 'إدخال يدوي' : 'Manual log'
                : metrics.latestHealth?.source || UI_TEXT[lang].common.unavailable}
            </span>
            <span className="font-mono-nums">
              {isAr ? 'هدف الخطوات:' : 'Goal:'}{' '}
              {metrics.latestHealth?.steps
                ? `${Math.min(100, Math.round((metrics.latestHealth.steps / data.profile.dailyStepTarget) * 100))}%`
                : '0%'}
            </span>
          </div>
        </div>
      </section>

      {/* AI Daily Briefing Section */}
      <section className="bg-[#13171C] border border-[#232A33] rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#F4F6F8] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              {isAr ? 'الملخص اليومي الذكي (AI Daily Briefing)' : 'AI Daily Briefing'}
            </h2>
            <p className="text-xs text-[#8E99A8] mt-0.5">
              {isAr
                ? 'تحليل مختصر مبني فقط على أرقامك الفعلية عبر Gemini Flash-Lite — بدون بيانات مختلقة.'
                : 'Concise briefing grounded strictly in your recorded metrics via Gemini Flash-Lite.'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleGenerateBriefing}
            disabled={briefingLoading}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-[#191F27] border border-[#2A3340] hover:border-emerald-500/60 text-xs font-semibold text-[#F4F6F8] transition-colors flex items-center gap-2 whitespace-nowrap self-start sm:self-auto"
          >
            {briefingLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" /> : <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />}
            {briefing
              ? isAr ? 'تحديث الملخص' : 'Refresh Briefing'
              : isAr ? 'توليد ملخص اليوم' : 'Generate Today’s Briefing'}
          </button>
        </div>

        {briefingError ? (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300">
            {briefingError}
          </div>
        ) : null}

        {briefing ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[#232A33] text-sm">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-emerald-400">{isAr ? 'ملاحظة مالية' : 'Financial Observation'}</p>
              <p className="text-[#D2DAE5] leading-relaxed">{briefing.financialObservation}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-emerald-400">{isAr ? 'ملاحظة الإنتاجية' : 'Productivity Observation'}</p>
              <p className="text-[#D2DAE5] leading-relaxed">{briefing.productivityObservation}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-emerald-400">{isAr ? 'ملاحظة الصحة والطاقة' : 'Health Observation'}</p>
              <p className="text-[#D2DAE5] leading-relaxed">{briefing.healthObservation}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-amber-400">{isAr ? 'تذكير مهم' : 'Important Reminder'}</p>
              <p className="text-[#D2DAE5] leading-relaxed">{briefing.importantReminder}</p>
            </div>
            {briefing.recommendations?.length > 0 ? (
              <div className="md:col-span-2 pt-3 border-t border-[#232A33] space-y-2">
                <p className="text-xs font-semibold text-[#F4F6F8]">{isAr ? 'توصيات عملية لليوم' : 'Practical Recommendations'}</p>
                <ul className="space-y-1.5">
                  {briefing.recommendations.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-[#C8D0DC]">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="pt-3 border-t border-[#232A33] grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-[#A9B3C1]">
            <div>
              <p className="font-semibold text-[#F4F6F8] mb-1">{isAr ? 'الماليات' : 'Finance'}</p>
              <p>
                {isAr
                  ? `معدل الادخار الشهري الحالي ${metrics.savingsRate}% مع ${metrics.overdueInvoices.length} فاتورة فريلانس متأخرة تحتاج متابعة.`
                  : `Current monthly savings rate is ${metrics.savingsRate}% with ${metrics.overdueInvoices.length} overdue freelance invoice(s).`}
              </p>
            </div>
            <div>
              <p className="font-semibold text-[#F4F6F8] mb-1">{isAr ? 'الإنتاجية' : 'Productivity'}</p>
              <p>
                {isAr
                  ? `متبقي ${metrics.remainingToday} مهام اليوم — استغل الفترة الصباحية للمهام العميقة.`
                  : `${metrics.remainingToday} tasks remaining today — prioritize deep work during your morning peak.`}
              </p>
            </div>
            <div>
              <p className="font-semibold text-[#F4F6F8] mb-1">{isAr ? 'الصحة' : 'Health'}</p>
              <p>
                {isAr
                  ? `اضغط "توليد ملخص اليوم" للحصول على قراءة مخصصة من Gemini بناءً على كل بياناتك.`
                  : `Click "Generate Today's Briefing" for a live Gemini analysis grounded in your data.`}
              </p>
            </div>
          </div>
        )}
      </section>
      <DailyMicroGoalModal
        open={microGoalModalOpen}
        onClose={() => setMicroGoalModalOpen(false)}
        existingGoal={todayMicroGoal}
      />
    </div>
  );
};
