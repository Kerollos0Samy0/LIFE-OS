import React, { useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { useLifeOs } from '../context/LifeOsContext';
import { CURRENT_MONTH, TODAY_ISO } from '../data/seedData';
import {
  calculateAvailableCashPiasters,
  calculateNetWorthPiasters,
  calculateSavingsRatePercent,
  calculateTotalExpensesPiasters,
  calculateTotalPaidIncomePiasters,
  formatEgp,
  piastersToEgp,
} from '../utils/finance';
import { getCategoryLabel } from '../i18n/translations';

type ReportPeriod = 'daily' | 'weekly' | 'monthly';

export const ReportsModule: React.FC = () => {
  const { data, lang, exportJsonBackup } = useLifeOs();
  const isAr = lang === 'ar';
  const [period, setPeriod] = useState<ReportPeriod>('monthly');

  const summary = useMemo(() => {
    const todayExpenses = data.expenseRecords.filter((e) => e.date === TODAY_ISO).reduce((s, e) => s + e.amountPiasters, 0);
    const monthExpenses = calculateTotalExpensesPiasters(data.expenseRecords, CURRENT_MONTH);
    const monthPaidIncome = calculateTotalPaidIncomePiasters(data.incomeRecords, CURRENT_MONTH);
    const availableCash = calculateAvailableCashPiasters(data.incomeRecords, data.expenseRecords);
    const netWorth = calculateNetWorthPiasters({
      availableCashPiasters: availableCash,
      savingsGoals: data.savingsGoals,
      investments: data.investments,
      liabilitiesPiasters: data.profile.liabilitiesPiasters,
    });
    const savingsRate = calculateSavingsRatePercent(monthPaidIncome, monthExpenses);
    const completedTasks = data.tasks.filter((t) => t.status === 'completed').length;
    const focusTotal = data.focusSessions.reduce((s, f) => s + f.durationMinutes, 0);
    const avgGoalProgress =
      data.goals.length > 0 ? Math.round(data.goals.reduce((s, g) => s + g.progress, 0) / data.goals.length) : 0;
    const sleepVals = data.healthLogs.map((h) => h.sleepHours).filter((v): v is number => typeof v === 'number');
    const avgSleep = sleepVals.length > 0 ? (sleepVals.reduce((s, x) => s + x, 0) / sleepVals.length).toFixed(1) : '—';

    return {
      todayExpenses,
      monthExpenses,
      monthPaidIncome,
      availableCash,
      netWorth,
      savingsRate,
      completedTasks,
      totalTasks: data.tasks.length,
      focusTotal,
      avgGoalProgress,
      avgSleep,
    };
  }, [data]);

  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    const headers = ['Date', 'Description', 'Category', 'Amount_EGP', 'PaymentMethod', 'Source'];
    const rows = data.expenseRecords.map((e) => [
      e.date,
      `"${e.description.replace(/"/g, '""')}"`,
      getCategoryLabel(e.category, lang),
      piastersToEgp(e.amountPiasters).toFixed(2),
      e.paymentMethod,
      e.entrySource,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    downloadFile(csv, `life-os-expenses-${CURRENT_MONTH}.csv`, 'text/csv;charset=utf-8');
  };

  const handleExportJson = () => {
    downloadFile(exportJsonBackup(), `life-os-backup-${TODAY_ISO}.json`, 'application/json');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold text-[#F4F6F8]">{isAr ? 'التقارير والرؤى' : 'Reports & Insights'}</h1>
          <p className="text-xs text-[#8E99A8] mt-1">
            {isAr
              ? 'تقارير يومية وأسبوعية وشهرية قابلة للطباعة كـ PDF أو التصدير كـ CSV ونسخة احتياطية JSON.'
              : 'Daily, weekly, and monthly reports with PDF print, CSV financial export, and JSON backup.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="min-h-[40px] px-3.5 rounded-xl bg-emerald-500 text-[#07110C] text-xs font-semibold hover:bg-emerald-400 flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            {isAr ? 'طباعة / PDF' : 'Print / PDF'}
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="min-h-[40px] px-3.5 rounded-xl bg-[#13171C] border border-[#232A33] text-xs font-medium text-[#E2E8F0] hover:border-emerald-500/50 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
          <button
            type="button"
            onClick={handleExportJson}
            className="min-h-[40px] px-3.5 rounded-xl bg-[#13171C] border border-[#232A33] text-xs font-medium text-[#E2E8F0] hover:border-emerald-500/50 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            JSON Backup
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1.5 no-print">
        {(
          [
            { id: 'daily', label: isAr ? 'التقرير اليومي' : 'Daily Report' },
            { id: 'weekly', label: isAr ? 'التقرير الأسبوعي' : 'Weekly Report' },
            { id: 'monthly', label: isAr ? 'التقرير الشهري' : 'Monthly Report' },
          ] as const
        ).map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriod(p.id)}
            className={`min-h-[40px] px-3.5 rounded-xl text-xs font-semibold transition-colors ${
              period === p.id
                ? 'bg-emerald-500 text-[#07110C]'
                : 'bg-[#13171C] border border-[#232A33] text-[#A9B3C1]'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="bg-[#13171C] border border-[#232A33] rounded-2xl p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-[#232A33] pb-4">
          <div>
            <h2 className="text-lg font-bold text-[#F4F6F8]">
              {period === 'daily'
                ? isAr ? `تقرير LIFE OS اليومي — ${TODAY_ISO}` : `LIFE OS Daily Report — ${TODAY_ISO}`
                : period === 'weekly'
                  ? isAr ? 'تقرير LIFE OS الأسبوعي' : 'LIFE OS Weekly Report'
                  : isAr ? `تقرير LIFE OS الشهري — ${CURRENT_MONTH}` : `LIFE OS Monthly Report — ${CURRENT_MONTH}`}
            </h2>
            <p className="text-xs text-[#8E99A8] mt-0.5">{data.profile.displayName} · {data.profile.currency}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          <div>
            <p className="text-xs text-[#8E99A8]">{period === 'daily' ? (isAr ? 'مصاريف اليوم' : 'Today Expenses') : (isAr ? 'مصاريف الشهر' : 'Monthly Expenses')}</p>
            <p className="text-xl font-bold font-mono-nums text-[#F4F6F8] mt-1">
              {formatEgp(period === 'daily' ? summary.todayExpenses : summary.monthExpenses, lang)}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#8E99A8]">{isAr ? 'الدخل المحصّل' : 'Paid Income'}</p>
            <p className="text-xl font-bold font-mono-nums text-emerald-400 mt-1">{formatEgp(summary.monthPaidIncome, lang)}</p>
          </div>
          <div>
            <p className="text-xs text-[#8E99A8]">{isAr ? 'صافي الثروة' : 'Net Worth'}</p>
            <p className="text-xl font-bold font-mono-nums text-[#F4F6F8] mt-1">{formatEgp(summary.netWorth.netWorthPiasters, lang)}</p>
          </div>
          <div>
            <p className="text-xs text-[#8E99A8]">{isAr ? 'معدل الادخار' : 'Savings Rate'}</p>
            <p className="text-xl font-bold font-mono-nums text-emerald-400 mt-1">{summary.savingsRate}%</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-5 border-t border-[#232A33] text-sm">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-emerald-400">{isAr ? 'الإنتاجية والتركيز' : 'Productivity & Focus'}</p>
            <p className="text-[#D2DAE5]">
              {isAr
                ? `إنجاز ${summary.completedTasks} من ${summary.totalTasks} مهام · إجمالي جلسات التركيز ${summary.focusTotal} دقيقة.`
                : `Completed ${summary.completedTasks}/${summary.totalTasks} tasks · Total focus logged: ${summary.focusTotal} minutes.`}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-emerald-400">{isAr ? 'اتجاه النوم والصحة' : 'Sleep & Health Trend'}</p>
            <p className="text-[#D2DAE5]">
              {isAr
                ? `متوسط النوم المسجل ${summary.avgSleep} ساعة مقابل الهدف (${data.profile.targetSleepHours} ساعات).`
                : `Average logged sleep is ${summary.avgSleep}h against your ${data.profile.targetSleepHours}h target.`}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-emerald-400">{isAr ? 'تقدم الأهداف الشخصية' : 'Personal Goals Progress'}</p>
            <p className="text-[#D2DAE5]">
              {isAr
                ? `متوسط التقدم عبر ${data.goals.length} أهداف نشطة: ${summary.avgGoalProgress}%.`
                : `Average progress across ${data.goals.length} active goals: ${summary.avgGoalProgress}%.`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
