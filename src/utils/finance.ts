import type {
  Budget,
  ExpenseRecord,
  IncomeRecord,
  InvestmentAsset,
  Language,
  SavingsGoal,
} from '../types/lifeos';

/**
 * Convert Egyptian Pounds (EGP) to integer minor units (piasters) safely.
 */
export function egpToPiasters(egp: number): number {
  if (!Number.isFinite(egp) || egp < 0) return 0;
  return Math.round(egp * 100);
}

/**
 * Convert integer piasters back to EGP numeric value.
 */
export function piastersToEgp(piasters: number): number {
  if (!Number.isFinite(piasters)) return 0;
  return piasters / 100;
}

/**
 * Format integer piasters into EGP currency string in Arabic or English.
 */
export function formatEgp(piasters: number, lang: Language = 'ar', showDecimals = false): string {
  const value = piastersToEgp(piasters);
  const absFormatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(Math.abs(value));
  const sign = value < 0 ? '-' : '';
  return lang === 'ar' ? `${sign}${absFormatted} ج.م` : `${sign}EGP ${absFormatted}`;
}

/**
 * Paid cash received from an income record.
 * CRITICAL BUSINESS RULE: Never count unpaid freelance invoices (`expected`, `invoiced`, `overdue`)
 * as available cash. Only `fully_paid` and the paid portion of `partially_paid` count.
 */
export function getPaidCashFromIncome(record: IncomeRecord): number {
  if (record.status === 'fully_paid') {
    return Math.max(0, Math.round(record.amountPiasters));
  }
  if (record.status === 'partially_paid') {
    return Math.max(0, Math.min(Math.round(record.amountPiasters), Math.round(record.paidAmountPiasters)));
  }
  return 0;
}

/**
 * Pending/unpaid receivables from income records (expected, invoiced, partially_paid remainder, overdue).
 */
export function getUnpaidAmountFromIncome(record: IncomeRecord): number {
  const total = Math.max(0, Math.round(record.amountPiasters));
  const paid = getPaidCashFromIncome(record);
  return Math.max(0, total - paid);
}

export function calculateTotalPaidIncomePiasters(incomeRecords: IncomeRecord[], monthKey?: string): number {
  return incomeRecords
    .filter((r) => {
      if (!monthKey) return true;
      const dateRef = r.dateReceived || r.expectedPaymentDate;
      return dateRef.startsWith(monthKey);
    })
    .reduce((sum, r) => sum + getPaidCashFromIncome(r), 0);
}

export function calculatePendingReceivablesPiasters(incomeRecords: IncomeRecord[]): number {
  return incomeRecords.reduce((sum, r) => sum + getUnpaidAmountFromIncome(r), 0);
}

export function calculateTotalExpensesPiasters(expenseRecords: ExpenseRecord[], monthKey?: string): number {
  return expenseRecords
    .filter((e) => (!monthKey ? true : e.date.startsWith(monthKey)))
    .reduce((sum, e) => sum + Math.max(0, Math.round(e.amountPiasters)), 0);
}

/**
 * Available cash balance = All received paid cash minus all recorded expenses.
 * Explicitly distinct from total billed income or net worth.
 */
export function calculateAvailableCashPiasters(
  incomeRecords: IncomeRecord[],
  expenseRecords: ExpenseRecord[],
): number {
  const totalReceived = calculateTotalPaidIncomePiasters(incomeRecords);
  const totalSpent = calculateTotalExpensesPiasters(expenseRecords);
  return totalReceived - totalSpent;
}

export interface InvestmentHoldingMetrics {
  totalCostPiasters: number;
  currentValuePiasters: number;
  unrealizedPnlPiasters: number;
  unrealizedPnlPercent: number;
  realizedPnlPiasters: number;
}

export function calculateInvestmentMetrics(asset: InvestmentAsset): InvestmentHoldingMetrics {
  const qty = Math.max(0, asset.quantity);
  const grossPurchase = Math.round(qty * asset.purchasePricePiasters);
  const totalCostPiasters = grossPurchase + Math.max(0, Math.round(asset.feesPiasters));
  const currentValuePiasters = Math.round(qty * asset.currentValuationPiasters);
  const unrealizedPnlPiasters = currentValuePiasters - totalCostPiasters;
  const unrealizedPnlPercent = totalCostPiasters > 0 ? (unrealizedPnlPiasters / totalCostPiasters) * 100 : 0;

  return {
    totalCostPiasters,
    currentValuePiasters,
    unrealizedPnlPiasters,
    unrealizedPnlPercent,
    realizedPnlPiasters: Math.round(asset.realizedPnlPiasters),
  };
}

/**
 * Net Worth = Total Assets (Available Cash + Dedicated Savings + Investment Portfolio Valuation) - Total Liabilities.
 */
export function calculateNetWorthPiasters(params: {
  availableCashPiasters: number;
  savingsGoals: SavingsGoal[];
  investments: InvestmentAsset[];
  liabilitiesPiasters: number;
}): {
  totalAssetsPiasters: number;
  totalLiabilitiesPiasters: number;
  netWorthPiasters: number;
  investmentsValuePiasters: number;
  savingsTotalPiasters: number;
} {
  const savingsTotalPiasters = params.savingsGoals.reduce((sum, g) => sum + Math.max(0, g.currentPiasters), 0);
  const investmentsValuePiasters = params.investments.reduce(
    (sum, a) => sum + calculateInvestmentMetrics(a).currentValuePiasters,
    0,
  );
  const totalAssetsPiasters = params.availableCashPiasters + savingsTotalPiasters + investmentsValuePiasters;
  const totalLiabilitiesPiasters = Math.max(0, Math.round(params.liabilitiesPiasters));
  return {
    totalAssetsPiasters,
    totalLiabilitiesPiasters,
    netWorthPiasters: totalAssetsPiasters - totalLiabilitiesPiasters,
    investmentsValuePiasters,
    savingsTotalPiasters,
  };
}

export type BudgetHealth = 'ok' | 'warning' | 'exceeded';

export interface BudgetProgress {
  budget: Budget;
  spentPiasters: number;
  remainingPiasters: number;
  percentUsed: number;
  status: BudgetHealth;
}

export function calculateBudgetProgress(budget: Budget, expenses: ExpenseRecord[]): BudgetProgress {
  const monthExpenses = expenses.filter((e) => e.date.startsWith(budget.monthKey));
  const spentPiasters = monthExpenses
    .filter((e) => (budget.category === 'overall' ? true : e.category === budget.category))
    .reduce((sum, e) => sum + e.amountPiasters, 0);

  const limit = Math.max(1, budget.limitPiasters);
  const percentUsed = Math.round((spentPiasters / limit) * 100);
  const remainingPiasters = budget.limitPiasters - spentPiasters;
  const status: BudgetHealth = percentUsed >= 100 ? 'exceeded' : percentUsed >= 80 ? 'warning' : 'ok';

  return {
    budget,
    spentPiasters,
    remainingPiasters,
    percentUsed,
    status,
  };
}

export interface SavingsGoalProgress {
  remainingPiasters: number;
  progressPercent: number;
  monthsRemaining: number;
  suggestedMonthlyContributionPiasters: number;
}

export function calculateSavingsGoalProgress(goal: SavingsGoal, referenceDateIso: string): SavingsGoalProgress {
  const remainingPiasters = Math.max(0, goal.targetPiasters - goal.currentPiasters);
  const progressPercent =
    goal.targetPiasters > 0
      ? Math.min(100, Math.round((goal.currentPiasters / goal.targetPiasters) * 100))
      : 0;

  const refDate = new Date(referenceDateIso);
  const targetDate = new Date(goal.targetDate);
  const diffMonths =
    (targetDate.getFullYear() - refDate.getFullYear()) * 12 +
    (targetDate.getMonth() - refDate.getMonth());
  const monthsRemaining = Math.max(1, diffMonths);
  const suggestedMonthlyContributionPiasters =
    remainingPiasters > 0 ? Math.ceil(remainingPiasters / monthsRemaining) : 0;

  return {
    remainingPiasters,
    progressPercent,
    monthsRemaining,
    suggestedMonthlyContributionPiasters,
  };
}

export function calculateSavingsRatePercent(paidIncomePiasters: number, expensesPiasters: number): number {
  if (paidIncomePiasters <= 0) return 0;
  const netSaved = paidIncomePiasters - expensesPiasters;
  return Math.round((netSaved / paidIncomePiasters) * 100);
}
