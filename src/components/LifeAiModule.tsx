import React, { useMemo, useState } from 'react';
import { Check, Loader2, Send, Sparkles } from 'lucide-react';
import { useLifeOs } from '../context/LifeOsContext';
import { CURRENT_MONTH, TODAY_ISO } from '../data/seedData';
import {
  calculateAvailableCashPiasters,
  calculatePendingReceivablesPiasters,
  calculateTotalExpensesPiasters,
  calculateTotalPaidIncomePiasters,
  egpToPiasters,
} from '../utils/finance';
import { calculateEnergyEstimate } from '../utils/energy';
import type { AiChatMessage, AiModelId, TaskCategory, TaskPriority } from '../types/lifeos';

type AiDomain = 'general' | 'finance' | 'productivity' | 'health';

export const LifeAiModule: React.FC = () => {
  const { data, lang, recordAiUsage, addExpense, addTask } = useLifeOs();
  const isAr = lang === 'ar';

  const [domain, setDomain] = useState<AiDomain>('general');
  const [model, setModel] = useState<AiModelId>(data.profile.aiDefaultModel);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiChatMessage[]>([
    {
      id: 'welcome-ai',
      role: 'assistant',
      content: isAr
        ? 'أهلاً بك في LIFE AI. بقرأ فقط البيانات المطلوبة لسؤالك (المالية، الإنتاجية، الصحة، أو المراجعة الأسبوعية) وبستأذنك قبل تنفيذ أي تعديل أو إضافة.'
        : 'Welcome to LIFE AI. I query only the minimum scoped context for your question and always ask for confirmation before saving any changes.',
      timestamp: TODAY_ISO,
    },
  ]);

  // Scoped minimal context selector (never dumps the entire database!)
  const scopedContext = useMemo(() => {
    const availableCashEgp = calculateAvailableCashPiasters(data.incomeRecords, data.expenseRecords) / 100;
    const paidIncomeEgp = calculateTotalPaidIncomePiasters(data.incomeRecords, CURRENT_MONTH) / 100;
    const monthExpensesEgp = calculateTotalExpensesPiasters(data.expenseRecords, CURRENT_MONTH) / 100;
    const pendingFreelanceEgp = calculatePendingReceivablesPiasters(data.incomeRecords) / 100;

    if (domain === 'finance') {
      return {
        currency: 'EGP',
        availableCashEgp,
        paidIncomeEgp,
        monthExpensesEgp,
        pendingFreelanceEgp,
        recentExpenses: data.expenseRecords.slice(0, 6).map((e) => ({
          desc: e.description,
          egp: e.amountPiasters / 100,
          cat: e.category,
          date: e.date,
        })),
        budgetsCount: data.budgets.length,
        savingsGoalsCount: data.savingsGoals.length,
      };
    }
    if (domain === 'productivity') {
      return {
        peakConcentration: data.profile.peakConcentration,
        workHours: `${data.profile.workStartHour}:00-${data.profile.workEndHour}:00`,
        pendingTasks: data.tasks
          .filter((t) => t.status !== 'completed')
          .slice(0, 6)
          .map((t) => ({ title: t.title, priority: t.priority, category: t.category, mins: t.estimatedMinutes })),
        focusSessionsToday: data.focusSessions.filter((f) => f.date === TODAY_ISO).length,
      };
    }
    if (domain === 'health') {
      const latestHealth = [...data.healthLogs].sort((a, b) => b.date.localeCompare(a.date))[0];
      const energy = calculateEnergyEstimate({
        healthLogs: data.healthLogs,
        appUsageLogs: data.appUsageLogs,
        energyLogs: data.energyLogs,
        dailyStepTarget: data.profile.dailyStepTarget,
        targetSleepHours: data.profile.targetSleepHours,
        peakConcentration: data.profile.peakConcentration,
      });
      return {
        sleepHours: latestHealth?.sleepHours ?? 'unavailable',
        steps: latestHealth?.steps ?? 'unavailable',
        restingHr: latestHealth?.restingHeartRate ?? 'unavailable',
        estimatedEnergyScore: energy.estimatedScore ?? 'unavailable',
        nighttimeScreenMins: energy.measuredFactors.nighttimeScreenMinutes ?? 'unavailable',
      };
    }
    return {
      availableCashEgp,
      monthExpensesEgp,
      pendingFreelanceEgp,
      openTasksCount: data.tasks.filter((t) => t.status !== 'completed').length,
      activeGoalsCount: data.goals.length,
      peakConcentration: data.profile.peakConcentration,
    };
  }, [data, domain]);

  const quotaReached = data.aiUsage.requestsToday >= data.profile.aiDailyLimit;

  const sendMessage = async (textToSend?: string) => {
    const cleanText = (textToSend ?? input).trim();
    if (!cleanText || loading) return;
    if (quotaReached) {
      setErrorMsg(
        isAr
          ? `وصلت للحد اليومي المحدد (${data.profile.aiDailyLimit} طلب). يمكنك تعديله من الإعدادات.`
          : `Daily AI request limit (${data.profile.aiDailyLimit}) reached. Adjust it in Settings.`,
      );
      return;
    }

    setErrorMsg(null);
    const userMsg: AiChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: cleanText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: cleanText,
          language: lang,
          domain,
          model,
          context: scopedContext,
          history: messages.slice(-5).map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'LIFE AI error');
      }

      const tokensUsed = Number(json.tokensUsed || 0);
      recordAiUsage(model, tokensUsed);

      const aiMsg: AiChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: json.reply || '',
        model,
        tokensUsed,
        proposal: json.proposal,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmProposal = async (msg: AiChatMessage) => {
    if (!msg.proposal || msg.proposalApplied) return;
    const p = msg.proposal;
    if (p.type === 'add_expense') {
      await addExpense({
        description: String(p.payload.description || 'Expense'),
        amountPiasters: egpToPiasters(Number(p.payload.amountEgp || 0)),
        currency: 'EGP',
        category: String(p.payload.category || 'other'),
        date: TODAY_ISO,
        paymentMethod: 'cash',
        entrySource: 'manual',
        recurring: false,
      });
    } else if (p.type === 'add_task') {
      await addTask({
        title: String(p.payload.title || 'New Task'),
        priority: (p.payload.priority as TaskPriority) || 'medium',
        category: (p.payload.category as TaskCategory) || 'deep_work',
        status: 'todo',
        deadline: TODAY_ISO,
        estimatedMinutes: Number(p.payload.estimatedMinutes || 45),
        actualMinutes: 0,
      });
    }
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, proposalApplied: true } : m)),
    );
  };

  const quickPrompts = isAr
    ? [
        'لخّص وضعي المالي هذا الشهر واقترح تحسين للميزانية',
        'رتّب مهامي المتبقية حسب ذروة تركيزي الصباحية',
        'سجّل مصروف 120 جنيه قهوة وشاي النهارده',
      ]
    : [
        'Summarize my monthly cash flow and budget improvements',
        'Prioritize my remaining tasks around my morning peak',
        'Add an expense of 120 EGP for coffee today',
      ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#F4F6F8] flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            LIFE AI
          </h1>
          <p className="text-xs text-[#8E99A8] mt-1">
            {isAr
              ? 'مساعدك الشخصي عبر Gemini API من الخادم — توجيه ذكي للنماذج وموافقة إلزامية قبل أي تعديل.'
              : 'Server-side Gemini personal assistant with model routing, minimal scoped context, and action confirmation.'}
          </p>
        </div>

        {/* AI Usage & Cost Quota Stats */}
        <div className="text-xs text-[#8E99A8] font-mono-nums flex flex-wrap items-center gap-3">
          <span>
            {isAr ? 'الطلبات اليوم:' : 'Today:'}{' '}
            <strong className="text-[#F4F6F8]">
              {data.aiUsage.requestsToday}/{data.profile.aiDailyLimit}
            </strong>
          </span>
          <span>·</span>
          <span>
            {isAr ? 'التوكنز هذا الشهر:' : 'Tokens/mo:'}{' '}
            <strong className="text-[#F4F6F8]">{data.aiUsage.tokensThisMonth.toLocaleString('en-US')}</strong>
          </span>
        </div>
      </div>

      {/* Domain & Model Routing Controls */}
      <div className="bg-[#13171C] border border-[#232A33] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {(
            [
              { id: 'general', label: isAr ? 'مراجعة عامة' : 'General' },
              { id: 'finance', label: isAr ? 'المالية' : 'Finance' },
              { id: 'productivity', label: isAr ? 'الإنتاجية' : 'Productivity' },
              { id: 'health', label: isAr ? 'الصحة' : 'Health' },
            ] as const
          ).map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setDomain(d.id)}
              className={`min-h-[36px] px-3 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                domain === d.id ? 'bg-emerald-500 text-[#07110C]' : 'text-[#A9B3C1] hover:bg-[#1B212A]'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label htmlFor="ai-model-select" className="text-xs text-[#8E99A8] whitespace-nowrap">
            {isAr ? 'النموذج:' : 'Model:'}
          </label>
          <select
            id="ai-model-select"
            value={model}
            onChange={(e) => setModel(e.target.value as AiModelId)}
            className="min-h-[36px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-xs font-mono-nums text-[#F4F6F8]"
          >
            <option value="gemini-3.1-flash-lite">Gemini Flash-Lite ({isAr ? 'سريع واقتصادي' : 'Fast / Low Cost'})</option>
            <option value="gemini-4-hydrogen">Gemini Flash ({isAr ? 'تحليل أعمق' : 'Deep Analysis'})</option>
          </select>
        </div>
      </div>

      {/* Chat Thread */}
      <div className="bg-[#13171C] border border-[#232A33] rounded-2xl p-5 flex flex-col gap-4 min-h-[380px] max-h-[540px]">
        <div className="flex-1 overflow-y-auto space-y-4 pe-1">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-[#F4F6F8]'
                    : 'bg-[#0B0D10] border border-[#232A33] text-[#DCE3EC]'
                }`}
              >
                <p>{msg.content}</p>
                {msg.proposal ? (
                  <div className="mt-3 pt-3 border-t border-[#232A33] space-y-2.5">
                    <p className="text-xs font-semibold text-amber-300">
                      {isAr ? 'إجراء مقترح يحتاج تأكيدك:' : 'Proposed action awaiting confirmation:'}
                    </p>
                    <p className="text-xs text-[#F4F6F8]">{msg.proposal.summary}</p>
                    <button
                      type="button"
                      disabled={msg.proposalApplied}
                      onClick={() => void handleConfirmProposal(msg)}
                      className="min-h-[36px] px-3.5 rounded-xl bg-emerald-500 text-[#07110C] text-xs font-semibold hover:bg-emerald-400 disabled:opacity-60 inline-flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {msg.proposalApplied
                        ? isAr ? 'تم التنفيذ والحفظ' : 'Confirmed & Saved'
                        : isAr ? 'تأكيد وتنفيذ' : 'Confirm & Apply'}
                    </button>
                  </div>
                ) : null}
              </div>
              <span className="text-[11px] text-[#6C7787] font-mono-nums mt-1 px-1">
                {msg.timestamp}
                {msg.model ? ` · ${msg.model}` : ''}
                {msg.tokensUsed ? ` · ${msg.tokensUsed} tok` : ''}
              </span>
            </div>
          ))}
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-[#8E99A8]">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
              {isAr ? 'LIFE AI يحلل بياناتك المحددة...' : 'LIFE AI is analyzing your scoped metrics...'}
            </div>
          ) : null}
        </div>

        {errorMsg ? (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300">
            {errorMsg}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 text-xs">
          {quickPrompts.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => void sendMessage(p)}
              className="px-3 py-1.5 rounded-xl bg-[#0B0D10] border border-[#232A33] text-[#A9B3C1] hover:text-emerald-400 hover:border-emerald-500/40 transition-colors"
            >
              {p}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage();
          }}
          className="flex gap-2 pt-2 border-t border-[#232A33]"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isAr ? 'اسأل عن مصاريفك، مهامك، نومك، أو اطلب مراجعة أسبوعية...' : 'Ask about spending, schedule, sleep, or weekly review...'}
            aria-label={isAr ? 'رسالة إلى LIFE AI' : 'Message LIFE AI'}
            className="flex-1 min-h-[44px] px-4 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm text-[#F4F6F8] focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label={isAr ? 'إرسال' : 'Send'}
            className="min-h-[44px] px-5 rounded-xl bg-emerald-500 text-[#07110C] font-semibold text-sm hover:bg-emerald-400 disabled:opacity-50 flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">{isAr ? 'إرسال' : 'Send'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
