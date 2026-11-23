import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAvailableCashPiasters,
  calculateBudgetProgress,
  calculateInvestmentMetrics,
  calculateNetWorthPiasters,
  calculatePendingReceivablesPiasters,
  calculateSavingsGoalProgress,
  calculateSavingsRatePercent,
  egpToPiasters,
  formatEgp,
  piastersToEgp,
} from './finance';
import type { Budget, ExpenseRecord, IncomeRecord, InvestmentAsset, SavingsGoal } from '../types/lifeos';

test('minor-unit EGP conversion avoids floating-point errors', () => {
  assert.equal(egpToPiasters(150.75), 15075);
  assert.equal(egpToPiasters(0.1 + 0.2), 30);
  assert.equal(piastersToEgp(15075), 150.75);
  assert.equal(egpToPiasters(-50), 0);
  assert.equal(formatEgp(150000, 'ar'), '1,500 ج.م');
  assert.equal(formatEgp(150000, 'en'), 'EGP 1,500');
});

test('available cash NEVER counts unpaid freelance invoices (expected, invoiced, overdue)', () => {
  const income: IncomeRecord[] = [
    {
      id: '1',
      userId: 'u1',
      title: 'Monthly Salary',
      amountPiasters: 1800000, // 18,000 EGP
      paidAmountPiasters: 1800000,
      currency: 'EGP',
      source: 'fixed_salary',
      status: 'fully_paid',
      dateReceived: '2026-11-01',
      expectedPaymentDate: '2026-11-01',
    },
    {
      id: '2',
      userId: 'u1',
      title: 'Freelance App Redesign',
      amountPiasters: 1200000, // 12,000 EGP (unpaid invoiced)
      paidAmountPiasters: 0,
      currency: 'EGP',
      source: 'freelance',
      status: 'invoiced',
      expectedPaymentDate: '2026-11-28',
    },
    {
      id: '3',
      userId: 'u1',
      title: 'Freelance Landing Page',
      amountPiasters: 800000, // 8,000 EGP (partially paid 3,000)
      paidAmountPiasters: 300000,
      currency: 'EGP',
      source: 'freelance',
      status: 'partially_paid',
      dateReceived: '2026-11-10',
      expectedPaymentDate: '2026-11-25',
    },
    {
      id: '4',
      userId: 'u1',
      title: 'Overdue Retainer',
      amountPiasters: 500000,
      paidAmountPiasters: 0,
      currency: 'EGP',
      source: 'freelance',
      status: 'overdue',
      expectedPaymentDate: '2026-10-30',
    },
  ];

  const expenses: ExpenseRecord[] = [
    {
      id: 'e1',
      userId: 'u1',
      description: 'Groceries',
      amountPiasters: 400000, // 4,000 EGP
      currency: 'EGP',
      category: 'food',
      date: '2026-11-05',
      paymentMethod: 'card',
      entrySource: 'manual',
      recurring: false,
    },
  ];

  // Paid cash = 18,000 + 3,000 = 21,000 EGP. Minus 4,000 expenses = 17,000 EGP (1,700,000 piasters)
  assert.equal(calculateAvailableCashPiasters(income, expenses), 1700000);
  // Pending receivables = 12,000 (invoiced) + 5,000 (partial remainder) + 5,000 (overdue) = 22,000 EGP
  assert.equal(calculatePendingReceivablesPiasters(income), 2200000);
});

test('net worth calculates Total Assets minus Total Liabilities accurately', () => {
  const savings: SavingsGoal[] = [
    {
      id: 's1',
      userId: 'u1',
      title: 'Emergency Fund',
      category: 'emergency',
      targetPiasters: 5000000,
      currentPiasters: 2000000, // 20,000 EGP
      targetDate: '2027-06-01',
    },
  ];
  const investments: InvestmentAsset[] = [
    {
      id: 'i1',
      userId: 'u1',
      name: 'Gold 24K',
      category: 'gold',
      quantity: 10,
      purchasePricePiasters: 400000, // 4,000 EGP/g
      currentValuationPiasters: 450000, // 4,500 EGP/g => 45,000 EGP value
      feesPiasters: 50000, // 500 EGP fees
      realizedPnlPiasters: 0,
      purchaseDate: '2026-05-01',
      valuationSource: 'manual',
    },
  ];

  const invMetrics = calculateInvestmentMetrics(investments[0]);
  assert.equal(invMetrics.totalCostPiasters, 4050000);
  assert.equal(invMetrics.currentValuePiasters, 4500000);
  assert.equal(invMetrics.unrealizedPnlPiasters, 450000);

  const nw = calculateNetWorthPiasters({
    availableCashPiasters: 1700000, // 17,000 EGP
    savingsGoals: savings, // 20,000 EGP
    investments, // 45,000 EGP
    liabilitiesPiasters: 1000000, // 10,000 EGP credit card installment
  });
  assert.equal(nw.totalAssetsPiasters, 8200000);
  assert.equal(nw.netWorthPiasters, 7200000);
});

test('budget utilization detects ok, warning (>=80%), and exceeded (>=100%)', () => {
  const budget: Budget = {
    id: 'b1',
    userId: 'u1',
    category: 'food',
    monthKey: '2026-11',
    limitPiasters: 500000, // 5,000 EGP
  };
  const baseExpense = (amountPiasters: number): ExpenseRecord => ({
    id: 'e',
    userId: 'u1',
    description: 'Food',
    amountPiasters,
    currency: 'EGP',
    category: 'food',
    date: '2026-11-12',
    paymentMethod: 'cash',
    entrySource: 'manual',
    recurring: false,
  });

  assert.equal(calculateBudgetProgress(budget, [baseExpense(250000)]).status, 'ok');
  assert.equal(calculateBudgetProgress(budget, [baseExpense(420000)]).status, 'warning');
  assert.equal(calculateBudgetProgress(budget, [baseExpense(550000)]).status, 'exceeded');
});

test('savings goal progress calculates remaining and suggested monthly contribution', () => {
  const goal: SavingsGoal = {
    id: 'g1',
    userId: 'u1',
    title: 'Emergency Fund',
    category: 'emergency',
    targetPiasters: 6000000,
    currentPiasters: 2400000,
    targetDate: '2027-05-01', // 6 months after 2026-11-22
  };
  const prog = calculateSavingsGoalProgress(goal, '2026-11-22');
  assert.equal(prog.remainingPiasters, 3600000);
  assert.equal(prog.progressPercent, 40);
  assert.equal(prog.monthsRemaining, 6);
  assert.equal(prog.suggestedMonthlyContributionPiasters, 600000);
  assert.equal(calculateSavingsRatePercent(2000000, 1200000), 40);
});
