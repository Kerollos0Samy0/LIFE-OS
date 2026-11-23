export type Language = 'ar' | 'en';

export type NavDestination =
  | 'home'
  | 'finance'
  | 'time'
  | 'health'
  | 'ai'
  | 'wellbeing'
  | 'goals'
  | 'reports'
  | 'connections'
  | 'settings';

export type PeakConcentration = 'morning' | 'afternoon' | 'evening';
export type AiModelId = 'gemini-3.1-flash-lite' | 'gemini-4-hydrogen';

export interface UserProfile {
  userId: string;
  displayName: string;
  email: string;
  language: Language;
  currency: 'EGP';
  dailyWorkHours: number;
  workStartHour: number;
  workEndHour: number;
  targetSleepHours: number;
  peakConcentration: PeakConcentration;
  financialGoal: string;
  smartphone: string;
  smartwatch: string;
  dailyStepTarget: number;
  aiDefaultModel: AiModelId;
  aiDailyLimit: number;
  liabilitiesPiasters: number;
  customCategories?: string[];
}

export type IncomeSource = 'fixed_salary' | 'freelance' | 'additional';
export type IncomeStatus = 'expected' | 'invoiced' | 'partially_paid' | 'fully_paid' | 'overdue';

export interface IncomeRecord {
  id: string;
  userId: string;
  title: string;
  amountPiasters: number;
  paidAmountPiasters: number;
  currency: 'EGP';
  source: IncomeSource;
  status: IncomeStatus;
  dateReceived?: string;
  expectedPaymentDate: string;
  projectName?: string;
  notes?: string;
}

export type DefaultExpenseCategory =
  | 'food'
  | 'transportation'
  | 'housing'
  | 'utilities'
  | 'internet_mobile'
  | 'shopping'
  | 'health'
  | 'entertainment'
  | 'education'
  | 'family'
  | 'church_activities'
  | 'work_expenses'
  | 'subscriptions'
  | 'other';

export type PaymentMethod = 'cash' | 'card' | 'instapay' | 'wallet' | 'bank_transfer';
export type EntrySource = 'manual' | 'voice' | 'receipt' | 'notification' | 'email_import';

export interface ExpenseRecord {
  id: string;
  userId: string;
  description: string;
  amountPiasters: number;
  currency: 'EGP';
  category: string;
  date: string; // YYYY-MM-DD
  paymentMethod: PaymentMethod;
  entrySource: EntrySource;
  recurring: boolean;
  notes?: string;
}

export interface Budget {
  id: string;
  userId: string;
  category: string; // 'overall' or category key
  monthKey: string; // YYYY-MM
  limitPiasters: number;
}

export type SavingsCategory = 'emergency' | 'purchases' | 'education' | 'travel' | 'investments' | 'custom';

export interface SavingsGoal {
  id: string;
  userId: string;
  title: string;
  category: SavingsCategory;
  targetPiasters: number;
  currentPiasters: number;
  targetDate: string; // YYYY-MM-DD
}

export type InvestmentCategory = 'gold' | 'stocks' | 'mutual_funds' | 'etfs' | 'other';
export type ValuationSource = 'manual' | 'verified_market';

export interface InvestmentAsset {
  id: string;
  userId: string;
  name: string;
  category: InvestmentCategory;
  quantity: number;
  purchasePricePiasters: number;
  currentValuationPiasters: number;
  feesPiasters: number;
  realizedPnlPiasters: number;
  purchaseDate: string;
  valuationSource: ValuationSource;
}

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type TaskCategory = 'deep_work' | 'admin' | 'meetings' | 'personal' | 'rest' | 'commute';
export type TaskStatus = 'todo' | 'in_progress' | 'completed';

export interface TaskItem {
  id: string;
  userId: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  category: TaskCategory;
  status: TaskStatus;
  deadline: string;
  scheduledStart?: string; // HH:mm
  estimatedMinutes: number;
  actualMinutes: number;
  project?: string;
}

export interface CalendarEvent {
  id: string;
  userId: string;
  title: string;
  calendarType: 'work' | 'personal';
  date: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  notes?: string;
}

export interface FocusSession {
  id: string;
  userId: string;
  label: string;
  durationMinutes: number;
  distractions: number;
  date: string;
}

export type HealthSource = 'manual' | 'health_connect' | 'xiaomi_band';

export interface HealthLog {
  id: string;
  userId: string;
  date: string;
  sleepHours?: number;
  sleepBedtime?: string;
  steps?: number;
  activeCalories?: number;
  restingHeartRate?: number;
  source: HealthSource;
}

export interface AppUsageLog {
  id: string;
  userId: string;
  date: string;
  productivityMinutes: number;
  communicationMinutes: number;
  socialMediaMinutes: number;
  entertainmentMinutes: number;
  educationMinutes: number;
  otherMinutes: number;
  nighttimeMinutes: number;
  interruptions: number;
  source: 'manual' | 'usage_stats';
}

export interface EnergyLog {
  id: string;
  userId: string;
  date: string;
  energyLevel: number; // 1-10
  moodLevel: number; // 1-10
  focusLevel: number; // 1-10
  stressLevel: number; // 1-10
  notes?: string;
}

export type GoalCategory = 'financial' | 'professional' | 'educational' | 'health' | 'personal' | 'social';

export interface GoalMilestone {
  id: string;
  title: string;
  completed: boolean;
}

export interface PersonalGoal {
  id: string;
  userId: string;
  title: string;
  description?: string;
  category: GoalCategory;
  targetLabel: string;
  startDate: string;
  deadline: string;
  progress: number; // 0-100
  milestones: GoalMilestone[];
}

export type MicroGoalCategory = 'focus' | 'finance' | 'health' | 'wellbeing' | 'personal';

export interface DailyMicroGoal {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  title: string;
  category: MicroGoalCategory;
  targetValue: number;
  currentValue: number;
  unit: string;
  completed: boolean;
}

export interface ParsedExpenseProposal {
  description: string;
  amountEgp: number;
  category: string;
  date: string;
  paymentMethod: PaymentMethod;
  confidence: number;
  notes?: string;
}

export interface AiChatActionProposal {
  type: 'add_expense' | 'add_task';
  summary: string;
  payload: Record<string, unknown>;
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  model?: AiModelId;
  timestamp: string;
  tokensUsed?: number;
  proposal?: AiChatActionProposal;
  proposalApplied?: boolean;
}

export interface AiUsageStats {
  dateKey: string;
  requestsToday: number;
  tokensThisMonth: number;
  flashLiteCalls: number;
  flashCalls: number;
}

export interface LifeOsDataset {
  profile: UserProfile;
  incomeRecords: IncomeRecord[];
  expenseRecords: ExpenseRecord[];
  budgets: Budget[];
  savingsGoals: SavingsGoal[];
  investments: InvestmentAsset[];
  tasks: TaskItem[];
  calendarEvents: CalendarEvent[];
  focusSessions: FocusSession[];
  healthLogs: HealthLog[];
  appUsageLogs: AppUsageLog[];
  energyLogs: EnergyLog[];
  goals: PersonalGoal[];
  dailyMicroGoals: DailyMicroGoal[];
  aiUsage: AiUsageStats;
}
