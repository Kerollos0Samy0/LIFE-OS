import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Mic, Plus, Trash2 } from 'lucide-react';
import { useLifeOs } from '../context/LifeOsContext';
import { CURRENT_MONTH, TODAY_ISO } from '../data/seedData';
import {
  DEFAULT_EXPENSE_CATEGORIES,
  getCategoryLabel,
  INCOME_SOURCE_LABELS,
  INCOME_STATUS_LABELS,
  INVESTMENT_CATEGORY_LABELS,
  PAYMENT_METHOD_LABELS,
  SAVINGS_CATEGORY_LABELS,
} from '../i18n/translations';
import {
  calculateAvailableCashPiasters,
  calculateBudgetProgress,
  calculateInvestmentMetrics,
  calculateNetWorthPiasters,
  calculatePendingReceivablesPiasters,
  calculateSavingsGoalProgress,
  calculateSavingsRatePercent,
  calculateTotalExpensesPiasters,
  calculateTotalPaidIncomePiasters,
  egpToPiasters,
  formatEgp,
  getPaidCashFromIncome,
  getUnpaidAmountFromIncome,
  piastersToEgp,
} from '../utils/finance';
import { ConfirmDialog } from './ConfirmDialog';
import type {
  IncomeSource,
  IncomeStatus,
  InvestmentCategory,
  PaymentMethod,
  SavingsCategory,
} from '../types/lifeos';

type FinanceTab = 'overview' | 'expenses' | 'income' | 'budgets' | 'savings' | 'investments';

const CHART_COLORS = ['#34D399', '#60A5FA', '#F59E0B', '#A78BFA', '#F472B6', '#38BDF8', '#94A3B8'];

interface FinanceModuleProps {
  onOpenVoiceExpense: () => void;
}

export const FinanceModule: React.FC<FinanceModuleProps> = ({ onOpenVoiceExpense }) => {
  const {
    data,
    lang,
    addExpense,
    deleteExpense,
    addIncome,
    updateIncomeStatus,
    deleteIncome,
    upsertBudget,
    deleteBudget,
    addSavingsGoal,
    contributeSavingsGoal,
    deleteSavingsGoal,
    addInvestment,
    updateInvestmentValuation,
    deleteInvestment,
    addCustomCategory,
  } = useLifeOs();

  const isAr = lang === 'ar';
  const [tab, setTab] = useState<FinanceTab>('overview');
  const [confirmDelete, setConfirmDelete] = useState<{ type: string; id: string; label: string } | null>(null);

  // Expense form state
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState('food');
  const [expDate, setExpDate] = useState(TODAY_ISO);
  const [expMethod, setExpMethod] = useState<PaymentMethod>('cash');
  const [expRecurring, setExpRecurring] = useState(false);
  const [expFilterCat, setExpFilterCat] = useState('all');
  const [expSearch, setExpSearch] = useState('');
  const [newCustomCat, setNewCustomCat] = useState('');
  const [expError, setExpError] = useState<string | null>(null);

  // Income form state
  const [incTitle, setIncTitle] = useState('');
  const [incAmount, setIncAmount] = useState('');
  const [incPaidAmount, setIncPaidAmount] = useState('');
  const [incSource, setIncSource] = useState<IncomeSource>('freelance');
  const [incStatus, setIncStatus] = useState<IncomeStatus>('invoiced');
  const [incDate, setIncDate] = useState(TODAY_ISO);
  const [incProject, setIncProject] = useState('');
  const [incError, setIncError] = useState<string | null>(null);

  // Budget form state
  const [budCat, setBudCat] = useState('food');
  const [budLimit, setBudLimit] = useState('');

  // Savings form state
  const [savTitle, setSavTitle] = useState('');
  const [savCat, setSavCat] = useState<SavingsCategory>('emergency');
  const [savTarget, setSavTarget] = useState('');
  const [savCurrent, setSavCurrent] = useState('0');
  const [savDate, setSavDate] = useState('2027-06-01');

  // Investment form state
  const [invName, setInvName] = useState('');
  const [invCat, setInvCat] = useState<InvestmentCategory>('gold');
  const [invQty, setInvQty] = useState('');
  const [invBuyPrice, setInvBuyPrice] = useState('');
  const [invCurPrice, setInvCurPrice] = useState('');
  const [invFees, setInvFees] = useState('0');

  const allCategories = [...DEFAULT_EXPENSE_CATEGORIES, ...(data.profile.customCategories || [])];

  const stats = useMemo(() => {
    const availableCash = calculateAvailableCashPiasters(data.incomeRecords, data.expenseRecords);
    const paidIncome = calculateTotalPaidIncomePiasters(data.incomeRecords, CURRENT_MONTH);
    const monthExpenses = calculateTotalExpensesPiasters(data.expenseRecords, CURRENT_MONTH);
    const pendingReceivables = calculatePendingReceivablesPiasters(data.incomeRecords);
    const savingsRate = calculateSavingsRatePercent(paidIncome, monthExpenses);
    const netWorth = calculateNetWorthPiasters({
      availableCashPiasters: availableCash,
      savingsGoals: data.savingsGoals,
      investments: data.investments,
      liabilitiesPiasters: data.profile.liabilitiesPiasters,
    });

    // Category spending breakdown
    const catMap = new Map<string, number>();
    data.expenseRecords
      .filter((e) => e.date.startsWith(CURRENT_MONTH))
      .forEach((e) => {
        catMap.set(e.category, (catMap.get(e.category) || 0) + e.amountPiasters);
      });
    const categoryChartData = Array.from(catMap.entries())
      .map(([cat, piasters]) => ({
        key: cat,
        name: getCategoryLabel(cat, lang),
        egp: Math.round(piastersToEgp(piasters)),
      }))
      .sort((a, b) => b.egp - a.egp);

    // Salary vs Freelance paid breakdown
    const salaryPaid = data.incomeRecords
      .filter((i) => i.source === 'fixed_salary')
      .reduce((s, r) => s + getPaidCashFromIncome(r), 0);
    const freelancePaid = data.incomeRecords
      .filter((i) => i.source === 'freelance')
      .reduce((s, r) => s + getPaidCashFromIncome(r), 0);
    const freelancePending = data.incomeRecords
      .filter((i) => i.source === 'freelance')
      .reduce((s, r) => s + getUnpaidAmountFromIncome(r), 0);

    const cashFlowChartData = [
      { name: isAr ? 'المرتب (محصّل)' : 'Salary (Paid)', value: Math.round(piastersToEgp(salaryPaid)) },
      { name: isAr ? 'فريلانس (محصّل)' : 'Freelance (Paid)', value: Math.round(piastersToEgp(freelancePaid)) },
      { name: isAr ? 'المصاريف' : 'Expenses', value: Math.round(piastersToEgp(monthExpenses)) },
      { name: isAr ? 'فريلانس معلق' : 'Unpaid Freelance', value: Math.round(piastersToEgp(freelancePending)) },
    ];

    return {
      availableCash,
      paidIncome,
      monthExpenses,
      pendingReceivables,
      savingsRate,
      netWorth,
      categoryChartData,
      cashFlowChartData,
    };
  }, [data, lang, isAr]);

  const filteredExpenses = useMemo(() => {
    return data.expenseRecords
      .filter((e) => (expFilterCat === 'all' ? true : e.category === expFilterCat))
      .filter((e) =>
        expSearch.trim()
          ? e.description.toLowerCase().includes(expSearch.trim().toLowerCase()) ||
            getCategoryLabel(e.category, lang).toLowerCase().includes(expSearch.trim().toLowerCase())
          : true,
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data.expenseRecords, expFilterCat, expSearch, lang]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(expAmount);
    if (!expDesc.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      setExpError(isAr ? 'أدخل وصفاً ومبلغاً صحيحاً أكبر من صفر.' : 'Enter a valid description and positive EGP amount.');
      return;
    }
    setExpError(null);
    await addExpense({
      description: expDesc.trim(),
      amountPiasters: egpToPiasters(numericAmount),
      currency: 'EGP',
      category: expCategory,
      date: expDate,
      paymentMethod: expMethod,
      entrySource: 'manual',
      recurring: expRecurring,
    });
    setExpDesc('');
    setExpAmount('');
    setExpRecurring(false);
  };

  const handleAddIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(incAmount);
    if (!incTitle.trim() || !Number.isFinite(amount) || amount <= 0) {
      setIncError(isAr ? 'أدخل عنوان الدخل ومبلغاً صحيحاً.' : 'Enter a valid title and positive EGP amount.');
      return;
    }
    setIncError(null);
    const paid = incStatus === 'fully_paid' ? amount : incStatus === 'partially_paid' ? Number(incPaidAmount || 0) : 0;
    await addIncome({
      title: incTitle.trim(),
      amountPiasters: egpToPiasters(amount),
      paidAmountPiasters: egpToPiasters(Math.min(amount, Math.max(0, paid))),
      currency: 'EGP',
      source: incSource,
      status: incStatus,
      dateReceived: incStatus === 'fully_paid' || incStatus === 'partially_paid' ? TODAY_ISO : undefined,
      expectedPaymentDate: incDate,
      projectName: incProject.trim() || undefined,
    });
    setIncTitle('');
    setIncAmount('');
    setIncPaidAmount('');
    setIncProject('');
  };

  const handleAddBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    const limit = Number(budLimit);
    if (!Number.isFinite(limit) || limit <= 0) return;
    const existing = data.budgets.find((b) => b.category === budCat && b.monthKey === CURRENT_MONTH);
    await upsertBudget({
      id: existing?.id,
      category: budCat,
      monthKey: CURRENT_MONTH,
      limitPiasters: egpToPiasters(limit),
    });
    setBudLimit('');
  };

  const handleAddSavings = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = Number(savTarget);
    const current = Number(savCurrent || 0);
    if (!savTitle.trim() || !Number.isFinite(target) || target <= 0) return;
    await addSavingsGoal({
      title: savTitle.trim(),
      category: savCat,
      targetPiasters: egpToPiasters(target),
      currentPiasters: egpToPiasters(Math.max(0, current)),
      targetDate: savDate,
    });
    setSavTitle('');
    setSavTarget('');
    setSavCurrent('0');
  };

  const handleAddInvestment = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Number(invQty);
    const buy = Number(invBuyPrice);
    const cur = Number(invCurPrice);
    const fees = Number(invFees || 0);
    if (!invName.trim() || qty <= 0 || buy <= 0 || cur <= 0) return;
    await addInvestment({
      name: invName.trim(),
      category: invCat,
      quantity: qty,
      purchasePricePiasters: egpToPiasters(buy),
      currentValuationPiasters: egpToPiasters(cur),
      feesPiasters: egpToPiasters(Math.max(0, fees)),
      realizedPnlPiasters: 0,
      purchaseDate: TODAY_ISO,
      valuationSource: 'manual',
    });
    setInvName('');
    setInvQty('');
    setInvBuyPrice('');
    setInvCurPrice('');
    setInvFees('0');
  };

  const executeConfirmedDelete = async () => {
    if (!confirmDelete) return;
    if (confirmDelete.type === 'expense') await deleteExpense(confirmDelete.id);
    if (confirmDelete.type === 'income') await deleteIncome(confirmDelete.id);
    if (confirmDelete.type === 'budget') await deleteBudget(confirmDelete.id);
    if (confirmDelete.type === 'savings') await deleteSavingsGoal(confirmDelete.id);
    if (confirmDelete.type === 'investment') await deleteInvestment(confirmDelete.id);
    setConfirmDelete(null);
  };

  const tabs: Array<{ id: FinanceTab; label: string }> = [
    { id: 'overview', label: isAr ? 'نظرة عامة وتحليلات' : 'Overview' },
    { id: 'expenses', label: isAr ? 'المصاريف' : 'Expenses' },
    { id: 'income', label: isAr ? 'الدخل والفريلانس' : 'Income' },
    { id: 'budgets', label: isAr ? 'الميزانيات' : 'Budgets' },
    { id: 'savings', label: isAr ? 'الادخار' : 'Savings' },
    { id: 'investments', label: isAr ? 'الاستثمارات' : 'Investments' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#F4F6F8]">{isAr ? 'الذكاء المالي' : 'Finance Intelligence'}</h1>
          <p className="text-xs text-[#8E99A8] mt-1">
            {isAr
              ? 'حسابات دقيقة بالقروش (EGP) — لا يُحسب الفريلانس غير المدفوع ضمن الرصيد المتاح.'
              : 'Exact minor-unit EGP tracking — unpaid freelance invoices never inflate cash balance.'}
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenVoiceExpense}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-500 text-[#07110C] font-semibold text-sm hover:bg-emerald-400 transition-colors flex items-center gap-2 whitespace-nowrap self-start sm:self-auto"
        >
          <Mic className="w-4 h-4" />
          {isAr ? 'مصروف بالصوت' : 'Voice Expense'}
        </button>
      </div>

      {/* Sub-navigation segmented bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              tab === item.id
                ? 'bg-emerald-500 text-[#07110C]'
                : 'bg-[#13171C] border border-[#232A33] text-[#A9B3C1] hover:text-[#F4F6F8]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Top Financial KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#13171C] border border-[#232A33] rounded-2xl p-4">
          <p className="text-xs text-[#8E99A8]">{isAr ? 'الرصيد النقدي المتاح' : 'Available Cash'}</p>
          <p className="text-xl font-bold font-mono-nums text-emerald-400 mt-1" data-testid="finance-available-cash">
            {formatEgp(stats.availableCash, lang)}
          </p>
        </div>
        <div className="bg-[#13171C] border border-[#232A33] rounded-2xl p-4">
          <p className="text-xs text-[#8E99A8]">{isAr ? 'صافي الثروة (أصول - التزامات)' : 'Net Worth'}</p>
          <p className="text-xl font-bold font-mono-nums text-[#F4F6F8] mt-1">
            {formatEgp(stats.netWorth.netWorthPiasters, lang)}
          </p>
        </div>
        <div className="bg-[#13171C] border border-[#232A33] rounded-2xl p-4">
          <p className="text-xs text-[#8E99A8]">{isAr ? 'مصاريف هذا الشهر' : 'Month Expenses'}</p>
          <p className="text-xl font-bold font-mono-nums text-[#F4F6F8] mt-1" data-testid="finance-month-expenses">
            {formatEgp(stats.monthExpenses, lang)}
          </p>
        </div>
        <div className="bg-[#13171C] border border-[#232A33] rounded-2xl p-4">
          <p className="text-xs text-[#8E99A8]">{isAr ? 'مستحقات غير محصّلة' : 'Pending Receivables'}</p>
          <p className="text-xl font-bold font-mono-nums text-amber-400 mt-1" data-testid="finance-pending-receivables">
            {formatEgp(stats.pendingReceivables, lang)}
          </p>
        </div>
      </div>

      {/* TAB 1: OVERVIEW & ANALYTICS */}
      {tab === 'overview' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-[#13171C] border border-[#232A33] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#F4F6F8]">
                {isAr ? 'التدفق النقدي: المرتب مقابل الفريلانس والمصاريف (ج.م)' : 'Cash Flow: Salary vs Freelance & Expenses (EGP)'}
              </h2>
              <span className="text-xs text-[#8E99A8] tabular-nums whitespace-nowrap">
                {isAr ? 'معدل الادخار:' : 'Savings Rate:'} {stats.savingsRate}%
              </span>
            </div>
            <div className="h-64 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.cashFlowChartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid stroke="#232A33" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#8E99A8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#8E99A8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0B0D10', border: '1px solid #232A33', borderRadius: 12, color: '#F4F6F8', fontSize: 12 }}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} isAnimationActive={false}>
                    {stats.cashFlowChartData.map((_, i) => (
                      <Cell key={i} fill={i === 2 ? '#EF4444' : i === 3 ? '#F59E0B' : '#34D399'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-[#13171C] border border-[#232A33] rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[#F4F6F8]">
              {isAr ? 'توزيع المصاريف حسب التصنيف (ج.م)' : 'Spending by Category (EGP)'}
            </h2>
            <div className="h-64 w-full grid grid-cols-1 sm:grid-cols-2 items-center gap-3">
              <div className="h-52 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.categoryChartData}
                      dataKey="egp"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={82}
                      paddingAngle={2}
                      isAnimationActive={false}
                    >
                      {stats.categoryChartData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0B0D10', border: '1px solid #232A33', borderRadius: 12, color: '#F4F6F8', fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {stats.categoryChartData.map((row, idx) => (
                  <div key={row.key} className="flex items-center justify-between text-xs py-1 border-b border-[#1D232C]">
                    <span className="flex items-center gap-2 text-[#D2DAE5]">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                      />
                      {row.name}
                    </span>
                    <span className="font-mono-nums text-[#F4F6F8]">{row.egp.toLocaleString('en-US')} {isAr ? 'ج.م' : 'EGP'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Net Worth Formula Breakdown */}
          <div className="lg:col-span-2 bg-[#13171C] border border-[#232A33] rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-[#F4F6F8] mb-4">
              {isAr ? 'تفصيل صافي الثروة (إجمالي الأصول − إجمالي الالتزامات)' : 'Net Worth Breakdown (Total Assets − Total Liabilities)'}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs">
              <div>
                <p className="text-[#8E99A8]">{isAr ? 'النقد المتاح' : 'Available Cash'}</p>
                <p className="text-sm font-semibold font-mono-nums text-[#F4F6F8] mt-1">{formatEgp(stats.availableCash, lang)}</p>
              </div>
              <div>
                <p className="text-[#8E99A8]">{isAr ? 'أرصدة الادخار' : 'Savings Buckets'}</p>
                <p className="text-sm font-semibold font-mono-nums text-[#F4F6F8] mt-1">{formatEgp(stats.netWorth.savingsTotalPiasters, lang)}</p>
              </div>
              <div>
                <p className="text-[#8E99A8]">{isAr ? 'الاستثمارات (تقييم يدوي)' : 'Investments (Manual)'}</p>
                <p className="text-sm font-semibold font-mono-nums text-[#F4F6F8] mt-1">{formatEgp(stats.netWorth.investmentsValuePiasters, lang)}</p>
              </div>
              <div>
                <p className="text-[#8E99A8]">{isAr ? 'الالتزامات والديون' : 'Liabilities'}</p>
                <p className="text-sm font-semibold font-mono-nums text-red-400 mt-1">-{formatEgp(stats.netWorth.totalLiabilitiesPiasters, lang)}</p>
              </div>
              <div>
                <p className="text-[#8E99A8]">{isAr ? 'صافي الثروة' : 'Net Worth'}</p>
                <p className="text-sm font-bold font-mono-nums text-emerald-400 mt-1">{formatEgp(stats.netWorth.netWorthPiasters, lang)}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* TAB 2: EXPENSES */}
      {tab === 'expenses' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <form onSubmit={handleAddExpense} className="lg:col-span-5 bg-[#13171C] border border-[#232A33] rounded-2xl p-5 space-y-4 self-start">
            <h2 className="text-sm font-semibold text-[#F4F6F8]">{isAr ? 'إضافة مصروف جديد' : 'Add Expense'}</h2>
            {expError ? <p className="text-xs text-red-400">{expError}</p> : null}

            <div>
              <label htmlFor="exp-desc" className="block text-xs text-[#8E99A8] mb-1">
                {isAr ? 'الوصف' : 'Description'}
              </label>
              <input
                id="exp-desc"
                type="text"
                value={expDesc}
                onChange={(e) => setExpDesc(e.target.value)}
                placeholder={isAr ? 'مثال: غداء مع الأصدقاء' : 'e.g., Lunch with friends'}
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm text-[#F4F6F8] focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="exp-amount" className="block text-xs text-[#8E99A8] mb-1">
                  {isAr ? 'المبلغ (ج.م)' : 'Amount (EGP)'}
                </label>
                <input
                  id="exp-amount"
                  type="number"
                  step="0.01"
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  placeholder="250"
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm font-mono-nums text-[#F4F6F8] focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label htmlFor="exp-date" className="block text-xs text-[#8E99A8] mb-1">
                  {isAr ? 'التاريخ' : 'Date'}
                </label>
                <input
                  id="exp-date"
                  type="date"
                  value={expDate}
                  onChange={(e) => setExpDate(e.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm font-mono-nums text-[#F4F6F8]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="exp-cat" className="block text-xs text-[#8E99A8] mb-1">
                  {isAr ? 'التصنيف' : 'Category'}
                </label>
                <select
                  id="exp-cat"
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm text-[#F4F6F8]"
                >
                  {allCategories.map((c) => (
                    <option key={c} value={c}>
                      {getCategoryLabel(c, lang)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="exp-method" className="block text-xs text-[#8E99A8] mb-1">
                  {isAr ? 'طريقة الدفع' : 'Payment Method'}
                </label>
                <select
                  id="exp-method"
                  value={expMethod}
                  onChange={(e) => setExpMethod(e.target.value as PaymentMethod)}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm text-[#F4F6F8]"
                >
                  {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
                    <option key={m} value={m}>
                      {PAYMENT_METHOD_LABELS[m][lang]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-[#A9B3C1] cursor-pointer">
              <input
                type="checkbox"
                checked={expRecurring}
                onChange={(e) => setExpRecurring(e.target.checked)}
                className="rounded border-[#232A33] bg-[#0B0D10]"
              />
              {isAr ? 'مصروف شهري متكرر' : 'Recurring monthly expense'}
            </label>

            <button
              type="submit"
              className="w-full min-h-[44px] rounded-xl bg-emerald-500 text-[#07110C] font-semibold text-sm hover:bg-emerald-400 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {isAr ? 'حفظ المصروف' : 'Save Expense'}
            </button>

            <div className="pt-3 border-t border-[#232A33] flex gap-2">
              <input
                type="text"
                value={newCustomCat}
                onChange={(e) => setNewCustomCat(e.target.value)}
                placeholder={isAr ? 'أضف تصنيف مخصص...' : 'Add custom category...'}
                aria-label={isAr ? 'تصنيف مخصص جديد' : 'New custom category'}
                className="flex-1 min-h-[38px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-xs text-[#F4F6F8]"
              />
              <button
                type="button"
                onClick={() => {
                  if (newCustomCat.trim()) {
                    void addCustomCategory(newCustomCat);
                    setExpCategory(newCustomCat.trim());
                    setNewCustomCat('');
                  }
                }}
                className="min-h-[38px] px-3 rounded-xl bg-[#191F27] border border-[#232A33] text-xs font-medium text-[#E2E8F0] hover:border-emerald-500/50 whitespace-nowrap"
              >
                {isAr ? 'إضافة تصنيف' : 'Add'}
              </button>
            </div>
          </form>

          <div className="lg:col-span-7 bg-[#13171C] border border-[#232A33] rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row gap-2.5 justify-between">
              <input
                type="search"
                value={expSearch}
                onChange={(e) => setExpSearch(e.target.value)}
                placeholder={isAr ? 'ابحث في المصاريف...' : 'Search expenses...'}
                aria-label={isAr ? 'بحث المصاريف' : 'Search expenses'}
                className="flex-1 min-h-[40px] px-3.5 rounded-xl bg-[#0B0D10] border border-[#232A33] text-xs text-[#F4F6F8]"
              />
              <select
                value={expFilterCat}
                onChange={(e) => setExpFilterCat(e.target.value)}
                aria-label={isAr ? 'تصفية حسب التصنيف' : 'Filter by category'}
                className="min-h-[40px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-xs text-[#F4F6F8]"
              >
                <option value="all">{isAr ? 'كل التصنيفات' : 'All categories'}</option>
                {allCategories.map((c) => (
                  <option key={c} value={c}>
                    {getCategoryLabel(c, lang)}
                  </option>
                ))}
              </select>
            </div>

            <div className="divide-y divide-[#1D232C]">
              {filteredExpenses.map((exp) => (
                <div key={exp.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#F4F6F8] truncate">{exp.description}</p>
                    <p className="text-xs text-[#8E99A8] mt-0.5">
                      {getCategoryLabel(exp.category, lang)} · {PAYMENT_METHOD_LABELS[exp.paymentMethod][lang]} ·{' '}
                      <span className="font-mono-nums">{exp.date}</span>
                      {exp.recurring ? (isAr ? ' · متكرر' : ' · Recurring') : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-semibold font-mono-nums text-[#F4F6F8]">
                      -{formatEgp(exp.amountPiasters, lang)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete({ type: 'expense', id: exp.id, label: exp.description })}
                      aria-label={`${isAr ? 'حذف' : 'Delete'} ${exp.description}`}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[#758091] hover:text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {filteredExpenses.length === 0 ? (
                <p className="py-8 text-center text-xs text-[#8E99A8]">
                  {isAr ? 'لا توجد مصاريف مطابقة.' : 'No matching expenses.'}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* TAB 3: INCOME & FREELANCE */}
      {tab === 'income' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <form onSubmit={handleAddIncome} className="lg:col-span-5 bg-[#13171C] border border-[#232A33] rounded-2xl p-5 space-y-4 self-start">
            <h2 className="text-sm font-semibold text-[#F4F6F8]">{isAr ? 'إضافة مصدر دخل / فاتورة فريلانس' : 'Add Income / Freelance Invoice'}</h2>
            {incError ? <p className="text-xs text-red-400">{incError}</p> : null}

            <div>
              <label htmlFor="inc-title" className="block text-xs text-[#8E99A8] mb-1">
                {isAr ? 'العنوان' : 'Title'}
              </label>
              <input
                id="inc-title"
                type="text"
                value={incTitle}
                onChange={(e) => setIncTitle(e.target.value)}
                placeholder={isAr ? 'مثال: تصميم موقع شركة النور' : 'e.g., Client Website Redesign'}
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm text-[#F4F6F8]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="inc-amount" className="block text-xs text-[#8E99A8] mb-1">
                  {isAr ? 'المبلغ الإجمالي (ج.م)' : 'Total Amount (EGP)'}
                </label>
                <input
                  id="inc-amount"
                  type="number"
                  value={incAmount}
                  onChange={(e) => setIncAmount(e.target.value)}
                  placeholder="8000"
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm font-mono-nums text-[#F4F6F8]"
                />
              </div>
              <div>
                <label htmlFor="inc-source" className="block text-xs text-[#8E99A8] mb-1">
                  {isAr ? 'المصدر' : 'Source'}
                </label>
                <select
                  id="inc-source"
                  value={incSource}
                  onChange={(e) => setIncSource(e.target.value as IncomeSource)}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm text-[#F4F6F8]"
                >
                  {(Object.keys(INCOME_SOURCE_LABELS) as IncomeSource[]).map((s) => (
                    <option key={s} value={s}>
                      {INCOME_SOURCE_LABELS[s][lang]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="inc-status" className="block text-xs text-[#8E99A8] mb-1">
                  {isAr ? 'حالة التحصيل' : 'Payment Status'}
                </label>
                <select
                  id="inc-status"
                  value={incStatus}
                  onChange={(e) => setIncStatus(e.target.value as IncomeStatus)}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm text-[#F4F6F8]"
                >
                  {(Object.keys(INCOME_STATUS_LABELS) as IncomeStatus[]).map((st) => (
                    <option key={st} value={st}>
                      {INCOME_STATUS_LABELS[st][lang]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="inc-date" className="block text-xs text-[#8E99A8] mb-1">
                  {isAr ? 'تاريخ الدفع المتوقع' : 'Expected Date'}
                </label>
                <input
                  id="inc-date"
                  type="date"
                  value={incDate}
                  onChange={(e) => setIncDate(e.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm font-mono-nums text-[#F4F6F8]"
                />
              </div>
            </div>

            {incStatus === 'partially_paid' ? (
              <div>
                <label htmlFor="inc-paid" className="block text-xs text-[#8E99A8] mb-1">
                  {isAr ? 'المبلغ المستلم فعلياً (ج.م)' : 'Amount Received So Far (EGP)'}
                </label>
                <input
                  id="inc-paid"
                  type="number"
                  value={incPaidAmount}
                  onChange={(e) => setIncPaidAmount(e.target.value)}
                  placeholder="3000"
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm font-mono-nums text-[#F4F6F8]"
                />
              </div>
            ) : null}

            <div>
              <label htmlFor="inc-project" className="block text-xs text-[#8E99A8] mb-1">
                {isAr ? 'المشروع (اختياري)' : 'Project (Optional)'}
              </label>
              <input
                id="inc-project"
                type="text"
                value={incProject}
                onChange={(e) => setIncProject(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm text-[#F4F6F8]"
              />
            </div>

            <button
              type="submit"
              className="w-full min-h-[44px] rounded-xl bg-emerald-500 text-[#07110C] font-semibold text-sm hover:bg-emerald-400 transition-colors"
            >
              {isAr ? 'حفظ سجل الدخل' : 'Save Income Record'}
            </button>
          </form>

          <div className="lg:col-span-7 bg-[#13171C] border border-[#232A33] rounded-2xl p-5 divide-y divide-[#1D232C]">
            {data.incomeRecords.map((rec) => {
              const paid = getPaidCashFromIncome(rec);
              const unpaid = getUnpaidAmountFromIncome(rec);
              return (
                <div key={rec.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#F4F6F8]">{rec.title}</p>
                    <p className="text-xs text-[#8E99A8] mt-0.5">
                      {INCOME_SOURCE_LABELS[rec.source][lang]} ·{' '}
                      <span
                        className={
                          rec.status === 'fully_paid'
                            ? 'text-emerald-400'
                            : rec.status === 'overdue'
                              ? 'text-red-400'
                              : 'text-amber-400'
                        }
                      >
                        {INCOME_STATUS_LABELS[rec.status][lang]}
                      </span>
                      {' · '}
                      <span className="font-mono-nums">{rec.expectedPaymentDate}</span>
                      {rec.projectName ? ` · ${rec.projectName}` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-end">
                      <p className="text-sm font-bold font-mono-nums text-[#F4F6F8]">{formatEgp(rec.amountPiasters, lang)}</p>
                      {unpaid > 0 ? (
                        <p className="text-[11px] font-mono-nums text-amber-400">
                          {isAr ? `محصّل ${formatEgp(paid, lang)} · معلق ${formatEgp(unpaid, lang)}` : `Paid ${formatEgp(paid, lang)} · Due ${formatEgp(unpaid, lang)}`}
                        </p>
                      ) : (
                        <p className="text-[11px] text-emerald-400">{isAr ? 'مضاف للرصيد المتاح' : 'In available cash'}</p>
                      )}
                    </div>
                    {rec.status !== 'fully_paid' ? (
                      <button
                        type="button"
                        onClick={() => void updateIncomeStatus(rec.id, 'fully_paid', rec.amountPiasters)}
                        className="min-h-[36px] px-2.5 rounded-lg border border-emerald-500/40 text-xs text-emerald-300 hover:bg-emerald-500/10 whitespace-nowrap"
                      >
                        {isAr ? 'تأكيد التحصيل' : 'Mark Paid'}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setConfirmDelete({ type: 'income', id: rec.id, label: rec.title })}
                      aria-label={`${isAr ? 'حذف' : 'Delete'} ${rec.title}`}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[#758091] hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* TAB 4: BUDGETS */}
      {tab === 'budgets' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <form onSubmit={handleAddBudget} className="lg:col-span-4 bg-[#13171C] border border-[#232A33] rounded-2xl p-5 space-y-4 self-start">
            <h2 className="text-sm font-semibold text-[#F4F6F8]">{isAr ? 'تحديد أو تعديل ميزانية الشهر' : 'Set Monthly Budget'}</h2>
            <div>
              <label htmlFor="bud-cat" className="block text-xs text-[#8E99A8] mb-1">
                {isAr ? 'النطاق / التصنيف' : 'Category'}
              </label>
              <select
                id="bud-cat"
                value={budCat}
                onChange={(e) => setBudCat(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm text-[#F4F6F8]"
              >
                <option value="overall">{getCategoryLabel('overall', lang)}</option>
                {allCategories.map((c) => (
                  <option key={c} value={c}>
                    {getCategoryLabel(c, lang)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="bud-limit" className="block text-xs text-[#8E99A8] mb-1">
                {isAr ? 'الحد الشهري (ج.م)' : 'Monthly Limit (EGP)'}
              </label>
              <input
                id="bud-limit"
                type="number"
                value={budLimit}
                onChange={(e) => setBudLimit(e.target.value)}
                placeholder="3500"
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm font-mono-nums text-[#F4F6F8]"
              />
            </div>
            <button
              type="submit"
              className="w-full min-h-[44px] rounded-xl bg-emerald-500 text-[#07110C] font-semibold text-sm hover:bg-emerald-400"
            >
              {isAr ? 'حفظ الميزانية' : 'Save Budget'}
            </button>
          </form>

          <div className="lg:col-span-8 bg-[#13171C] border border-[#232A33] rounded-2xl p-5 divide-y divide-[#1D232C]">
            {data.budgets.map((b) => {
              const prog = calculateBudgetProgress(b, data.expenseRecords);
              const barColor =
                prog.status === 'exceeded' ? 'bg-red-500' : prog.status === 'warning' ? 'bg-amber-400' : 'bg-emerald-500';
              return (
                <div key={b.id} className="py-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#F4F6F8]">{getCategoryLabel(b.category, lang)}</p>
                      <p className="text-xs text-[#8E99A8] font-mono-nums mt-0.5">
                        {formatEgp(prog.spentPiasters, lang)} / {formatEgp(b.limitPiasters, lang)} ·{' '}
                        <span
                          className={
                            prog.status === 'exceeded'
                              ? 'text-red-400 font-semibold'
                              : prog.status === 'warning'
                                ? 'text-amber-400 font-semibold'
                                : 'text-emerald-400'
                          }
                        >
                          {prog.percentUsed}%{' '}
                          {prog.status === 'exceeded'
                            ? isAr ? '(تجاوز الحد)' : '(Exceeded)'
                            : prog.status === 'warning'
                              ? isAr ? '(قرب الحد)' : '(Near limit)'
                              : isAr ? '(ضمن الخطة)' : '(On track)'}
                        </span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete({ type: 'budget', id: b.id, label: getCategoryLabel(b.category, lang) })}
                      aria-label={`${isAr ? 'حذف ميزانية' : 'Delete budget'} ${getCategoryLabel(b.category, lang)}`}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[#758091] hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="h-2 rounded-full bg-[#0B0D10] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${barColor}`}
                      style={{ width: `${Math.min(100, prog.percentUsed)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* TAB 5: SAVINGS GOALS */}
      {tab === 'savings' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <form onSubmit={handleAddSavings} className="lg:col-span-4 bg-[#13171C] border border-[#232A33] rounded-2xl p-5 space-y-4 self-start">
            <h2 className="text-sm font-semibold text-[#F4F6F8]">{isAr ? 'هدف ادخار جديد' : 'New Savings Goal'}</h2>
            <div>
              <label htmlFor="sav-title" className="block text-xs text-[#8E99A8] mb-1">{isAr ? 'اسم الهدف' : 'Goal Name'}</label>
              <input
                id="sav-title"
                type="text"
                value={savTitle}
                onChange={(e) => setSavTitle(e.target.value)}
                placeholder={isAr ? 'مثال: صندوق سفر' : 'e.g., Travel Fund'}
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm text-[#F4F6F8]"
              />
            </div>
            <div>
              <label htmlFor="sav-cat" className="block text-xs text-[#8E99A8] mb-1">{isAr ? 'التصنيف' : 'Category'}</label>
              <select
                id="sav-cat"
                value={savCat}
                onChange={(e) => setSavCat(e.target.value as SavingsCategory)}
                className="w-full min-h-[44px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm text-[#F4F6F8]"
              >
                {(Object.keys(SAVINGS_CATEGORY_LABELS) as SavingsCategory[]).map((c) => (
                  <option key={c} value={c}>{SAVINGS_CATEGORY_LABELS[c][lang]}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="sav-target" className="block text-xs text-[#8E99A8] mb-1">{isAr ? 'المستهدف (ج.م)' : 'Target (EGP)'}</label>
                <input
                  id="sav-target"
                  type="number"
                  value={savTarget}
                  onChange={(e) => setSavTarget(e.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm font-mono-nums text-[#F4F6F8]"
                />
              </div>
              <div>
                <label htmlFor="sav-cur" className="block text-xs text-[#8E99A8] mb-1">{isAr ? 'الحالي (ج.م)' : 'Current (EGP)'}</label>
                <input
                  id="sav-cur"
                  type="number"
                  value={savCurrent}
                  onChange={(e) => setSavCurrent(e.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm font-mono-nums text-[#F4F6F8]"
                />
              </div>
            </div>
            <div>
              <label htmlFor="sav-date" className="block text-xs text-[#8E99A8] mb-1">{isAr ? 'التاريخ المستهدف' : 'Target Date'}</label>
              <input
                id="sav-date"
                type="date"
                value={savDate}
                onChange={(e) => setSavDate(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm font-mono-nums text-[#F4F6F8]"
              />
            </div>
            <button type="submit" className="w-full min-h-[44px] rounded-xl bg-emerald-500 text-[#07110C] font-semibold text-sm hover:bg-emerald-400">
              {isAr ? 'إنشاء هدف الادخار' : 'Create Savings Goal'}
            </button>
          </form>

          <div className="lg:col-span-8 bg-[#13171C] border border-[#232A33] rounded-2xl p-5 divide-y divide-[#1D232C]">
            {data.savingsGoals.map((goal) => {
              const prog = calculateSavingsGoalProgress(goal, TODAY_ISO);
              return (
                <div key={goal.id} className="py-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#F4F6F8]">{goal.title}</p>
                      <p className="text-xs text-[#8E99A8] mt-0.5">
                        {SAVINGS_CATEGORY_LABELS[goal.category][lang]} · {isAr ? 'الموعد:' : 'Target:'}{' '}
                        <span className="font-mono-nums">{goal.targetDate}</span> · {isAr ? 'مقترح شهرياً:' : 'Suggested/mo:'}{' '}
                        <span className="font-mono-nums text-emerald-400">{formatEgp(prog.suggestedMonthlyContributionPiasters, lang)}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => void contributeSavingsGoal(goal.id, egpToPiasters(1000))}
                        className="min-h-[36px] px-3 rounded-lg border border-emerald-500/40 text-xs font-medium text-emerald-300 hover:bg-emerald-500/10 whitespace-nowrap"
                      >
                        {isAr ? '+ 1,000 ج.م' : '+ EGP 1,000'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete({ type: 'savings', id: goal.id, label: goal.title })}
                        aria-label={`${isAr ? 'حذف' : 'Delete'} ${goal.title}`}
                        className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[#758091] hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono-nums">
                    <span className="text-[#F4F6F8]">{formatEgp(goal.currentPiasters, lang)} / {formatEgp(goal.targetPiasters, lang)}</span>
                    <span className="text-emerald-400">{prog.progressPercent}% · {isAr ? 'متبقي' : 'Left'} {formatEgp(prog.remainingPiasters, lang)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#0B0D10] overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${prog.progressPercent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* TAB 6: INVESTMENT TRACKER */}
      {tab === 'investments' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <form onSubmit={handleAddInvestment} className="lg:col-span-4 bg-[#13171C] border border-[#232A33] rounded-2xl p-5 space-y-3.5 self-start">
            <div>
              <h2 className="text-sm font-semibold text-[#F4F6F8]">{isAr ? 'إضافة أصل استثماري (متابعة يدوية)' : 'Add Investment Holding'}</h2>
              <p className="text-[11px] text-[#8E99A8] mt-1">
                {isAr
                  ? 'تتبع يدوي للمحفظة فقط — لا ينفذ صفقات تلقائية ولا يقدم وعوداً بعوائد.'
                  : 'Manual portfolio tracker only — no automated execution or guaranteed returns.'}
              </p>
            </div>
            <div>
              <label htmlFor="inv-name" className="block text-xs text-[#8E99A8] mb-1">{isAr ? 'اسم الأصل' : 'Asset Name'}</label>
              <input
                id="inv-name"
                type="text"
                value={invName}
                onChange={(e) => setInvName(e.target.value)}
                placeholder={isAr ? 'مثال: سبيكة ذهب 5 جرام' : 'e.g., 24K Gold Bullion'}
                className="w-full min-h-[42px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm text-[#F4F6F8]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="inv-cat" className="block text-xs text-[#8E99A8] mb-1">{isAr ? 'الفئة' : 'Type'}</label>
                <select
                  id="inv-cat"
                  value={invCat}
                  onChange={(e) => setInvCat(e.target.value as InvestmentCategory)}
                  className="w-full min-h-[42px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm text-[#F4F6F8]"
                >
                  {(Object.keys(INVESTMENT_CATEGORY_LABELS) as InvestmentCategory[]).map((c) => (
                    <option key={c} value={c}>{INVESTMENT_CATEGORY_LABELS[c][lang]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="inv-qty" className="block text-xs text-[#8E99A8] mb-1">{isAr ? 'الكمية' : 'Quantity'}</label>
                <input
                  id="inv-qty"
                  type="number"
                  step="0.01"
                  value={invQty}
                  onChange={(e) => setInvQty(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm font-mono-nums text-[#F4F6F8]"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="inv-buy" className="block text-xs text-[#8E99A8] mb-1">{isAr ? 'سعر الشراء للوحدة' : 'Buy Price/Unit'}</label>
                <input
                  id="inv-buy"
                  type="number"
                  value={invBuyPrice}
                  onChange={(e) => setInvBuyPrice(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm font-mono-nums text-[#F4F6F8]"
                />
              </div>
              <div>
                <label htmlFor="inv-cur" className="block text-xs text-[#8E99A8] mb-1">{isAr ? 'التقييم الحالي للوحدة' : 'Current Val/Unit'}</label>
                <input
                  id="inv-cur"
                  type="number"
                  value={invCurPrice}
                  onChange={(e) => setInvCurPrice(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm font-mono-nums text-[#F4F6F8]"
                />
              </div>
            </div>
            <div>
              <label htmlFor="inv-fees" className="block text-xs text-[#8E99A8] mb-1">{isAr ? 'المصنعية / العمولات (ج.م)' : 'Fees (EGP)'}</label>
              <input
                id="inv-fees"
                type="number"
                value={invFees}
                onChange={(e) => setInvFees(e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm font-mono-nums text-[#F4F6F8]"
              />
            </div>
            <button type="submit" className="w-full min-h-[44px] rounded-xl bg-emerald-500 text-[#07110C] font-semibold text-sm hover:bg-emerald-400">
              {isAr ? 'إضافة للمحفظة' : 'Add Holding'}
            </button>
          </form>

          <div className="lg:col-span-8 bg-[#13171C] border border-[#232A33] rounded-2xl p-5 divide-y divide-[#1D232C]">
            {data.investments.map((asset) => {
              const m = calculateInvestmentMetrics(asset);
              return (
                <div key={asset.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#F4F6F8]">{asset.name}</p>
                    <p className="text-xs text-[#8E99A8] mt-0.5">
                      {INVESTMENT_CATEGORY_LABELS[asset.category][lang]} · {isAr ? 'الكمية:' : 'Qty:'}{' '}
                      <span className="font-mono-nums">{asset.quantity}</span> ·{' '}
                      <span className="text-amber-300">
                        {asset.valuationSource === 'manual'
                          ? isAr ? 'تقييم مُدخل يدوياً' : 'Manual valuation'
                          : isAr ? 'سعر سوق موثّق' : 'Verified market price'}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-end">
                      <p className="text-sm font-bold font-mono-nums text-[#F4F6F8]">{formatEgp(m.currentValuePiasters, lang)}</p>
                      <p className={`text-xs font-mono-nums ${m.unrealizedPnlPiasters >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {m.unrealizedPnlPiasters >= 0 ? '+' : ''}
                        {formatEgp(m.unrealizedPnlPiasters, lang)} ({m.unrealizedPnlPercent.toFixed(1)}%)
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        void updateInvestmentValuation(asset.id, Math.round(asset.currentValuationPiasters * 1.02))
                      }
                      className="min-h-[36px] px-2.5 rounded-lg border border-[#232A33] text-xs text-[#C8D0DC] hover:border-emerald-500/50 whitespace-nowrap"
                    >
                      {isAr ? '+2% تقييم' : '+2% Val'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete({ type: 'investment', id: asset.id, label: asset.name })}
                      aria-label={`${isAr ? 'حذف' : 'Delete'} ${asset.name}`}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[#758091] hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title={isAr ? 'تأكيد الحذف' : 'Confirm Deletion'}
        description={
          isAr
            ? `هل أنت متأكد من حذف "${confirmDelete?.label}"؟ لا يمكن التراجع عن هذا الإجراء.`
            : `Are you sure you want to delete "${confirmDelete?.label}"? This action cannot be undone.`
        }
        confirmLabel={isAr ? 'حذف نهائياً' : 'Delete'}
        cancelLabel={isAr ? 'إلغاء' : 'Cancel'}
        tone="danger"
        onConfirm={() => void executeConfirmedDelete()}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
};
