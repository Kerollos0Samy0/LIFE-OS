import type {
  DefaultExpenseCategory,
  GoalCategory,
  IncomeSource,
  IncomeStatus,
  InvestmentCategory,
  Language,
  PaymentMethod,
  SavingsCategory,
  TaskCategory,
  TaskPriority,
} from '../types/lifeos';

export const DEFAULT_EXPENSE_CATEGORIES: DefaultExpenseCategory[] = [
  'food',
  'transportation',
  'housing',
  'utilities',
  'internet_mobile',
  'shopping',
  'health',
  'entertainment',
  'education',
  'family',
  'church_activities',
  'work_expenses',
  'subscriptions',
  'other',
];

export const CATEGORY_LABELS: Record<string, { ar: string; en: string }> = {
  overall: { ar: 'الميزانية الشهرية الكلية', en: 'Monthly Overall Budget' },
  food: { ar: 'أكل وشرب', en: 'Food & Dining' },
  transportation: { ar: 'مواصلات', en: 'Transportation' },
  housing: { ar: 'سكن وإيجار', en: 'Housing' },
  utilities: { ar: 'فواتير ومرافق', en: 'Utilities' },
  internet_mobile: { ar: 'إنترنت وموبايل', en: 'Internet & Mobile' },
  shopping: { ar: 'مشتريات وتسوق', en: 'Shopping' },
  health: { ar: 'صحة وعلاج', en: 'Health' },
  entertainment: { ar: 'ترفيه وخروجات', en: 'Entertainment' },
  education: { ar: 'تعليم وكورسات', en: 'Education' },
  family: { ar: 'الأسرة والبيت', en: 'Family' },
  church_activities: { ar: 'الكنيسة والأنشطة', en: 'Church & Activities' },
  work_expenses: { ar: 'مصاريف الشغل', en: 'Work Expenses' },
  subscriptions: { ar: 'اشتراكات شهرية', en: 'Subscriptions' },
  other: { ar: 'أخرى', en: 'Other' },
};

export function getCategoryLabel(cat: string, lang: Language): string {
  return CATEGORY_LABELS[cat]?.[lang] ?? cat;
}

export const INCOME_SOURCE_LABELS: Record<IncomeSource, { ar: string; en: string }> = {
  fixed_salary: { ar: 'مرتب ثابت', en: 'Fixed Salary' },
  freelance: { ar: 'شغل حر (فريلانس)', en: 'Freelance Project' },
  additional: { ar: 'دخل إضافي', en: 'Additional Income' },
};

export const INCOME_STATUS_LABELS: Record<IncomeStatus, { ar: string; en: string }> = {
  expected: { ar: 'متوقع', en: 'Expected' },
  invoiced: { ar: 'تم إرسال الفاتورة', en: 'Invoiced' },
  partially_paid: { ar: 'مدفوع جزئياً', en: 'Partially Paid' },
  fully_paid: { ar: 'مدفوع بالكامل', en: 'Fully Paid' },
  overdue: { ar: 'متأخر', en: 'Overdue' },
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, { ar: string; en: string }> = {
  cash: { ar: 'كاش', en: 'Cash' },
  card: { ar: 'كارت بنكي', en: 'Bank Card' },
  instapay: { ar: 'إنستاباي', en: 'InstaPay' },
  wallet: { ar: 'محفظة إلكترونية', en: 'Mobile Wallet' },
  bank_transfer: { ar: 'تحويل بنكي', en: 'Bank Transfer' },
};

export const SAVINGS_CATEGORY_LABELS: Record<SavingsCategory, { ar: string; en: string }> = {
  emergency: { ar: 'صندوق طوارئ', en: 'Emergency Fund' },
  purchases: { ar: 'مشتريات شخصية', en: 'Personal Purchases' },
  education: { ar: 'تعليم وتطوير', en: 'Education' },
  travel: { ar: 'سفر', en: 'Travel' },
  investments: { ar: 'استثمار', en: 'Investments' },
  custom: { ar: 'هدف مخصص', en: 'Custom Goal' },
};

export const INVESTMENT_CATEGORY_LABELS: Record<InvestmentCategory, { ar: string; en: string }> = {
  gold: { ar: 'ذهب', en: 'Gold' },
  stocks: { ar: 'أسهم', en: 'Stocks' },
  mutual_funds: { ar: 'صناديق استثمار', en: 'Mutual Funds' },
  etfs: { ar: 'صناديق مؤشرات ETFs', en: 'ETFs' },
  other: { ar: 'أصول أخرى', en: 'Other Assets' },
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, { ar: string; en: string }> = {
  critical: { ar: 'حرجة', en: 'Critical' },
  high: { ar: 'عالية', en: 'High' },
  medium: { ar: 'متوسطة', en: 'Medium' },
  low: { ar: 'منخفضة', en: 'Low' },
};

export const TASK_CATEGORY_LABELS: Record<TaskCategory, { ar: string; en: string }> = {
  deep_work: { ar: 'تركيز عميق', en: 'Deep Work' },
  admin: { ar: 'مهام إدارية', en: 'Admin' },
  meetings: { ar: 'اجتماعات', en: 'Meetings' },
  personal: { ar: 'شخصي', en: 'Personal' },
  rest: { ar: 'راحة', en: 'Rest' },
  commute: { ar: 'مواصلات', en: 'Commute' },
};

export const GOAL_CATEGORY_LABELS: Record<GoalCategory, { ar: string; en: string }> = {
  financial: { ar: 'مالي', en: 'Financial' },
  professional: { ar: 'مهني', en: 'Professional' },
  educational: { ar: 'تعليمي', en: 'Educational' },
  health: { ar: 'صحي', en: 'Health' },
  personal: { ar: 'شخصي', en: 'Personal' },
  social: { ar: 'اجتماعي', en: 'Social' },
};

export const UI_TEXT = {
  ar: {
    brandTagline: 'افهم حياتك. أدر مستقبلك.',
    nav: {
      home: 'الرئيسية',
      finance: 'الماليات',
      time: 'الوقت',
      health: 'الصحة',
      ai: 'LIFE AI',
      wellbeing: 'الرفاهية الرقمية',
      goals: 'الأهداف',
      reports: 'التقارير',
      connections: 'الحسابات المتصلة',
      settings: 'الإعدادات',
      more: 'المزيد',
    },
    auth: {
      signInGoogle: 'تسجيل الدخول بـ Google',
      signOut: 'تسجيل الخروج',
      cloudSynced: 'متصل بـ Cloud Firestore',
      localSampleMode: 'وضع تجريبي محلي',
      syncNotice: 'البيانات المعروضة تجريبية ومحفوظة محلياً. سجّل الدخول بحساب Google للمزامنة السحابية الآمنة عبر Firestore.',
    },
    common: {
      unavailable: 'غير متاح',
      save: 'حفظ',
      cancel: 'إلغاء',
      confirm: 'تأكيد',
      delete: 'حذف',
      edit: 'تعديل',
      add: 'إضافة',
      close: 'إغلاق',
      today: 'النهارده',
      loading: 'جاري التحميل...',
      egp: 'ج.م',
      hours: 'ساعة',
      minutes: 'دقيقة',
      manualEntry: 'إدخال يدوي',
      nonMedicalNotice: 'مؤشر تقديري شخصي لأغراض التنظيم اليومي فقط، وليس تشخيصاً أو قياساً طبياً.',
    },
  },
  en: {
    brandTagline: 'Understand Your Life. Manage Your Future.',
    nav: {
      home: 'Home',
      finance: 'Finance',
      time: 'Time',
      health: 'Health',
      ai: 'LIFE AI',
      wellbeing: 'Wellbeing',
      goals: 'Goals',
      reports: 'Reports',
      connections: 'Connections',
      settings: 'Settings',
      more: 'More',
    },
    auth: {
      signInGoogle: 'Sign in with Google',
      signOut: 'Sign out',
      cloudSynced: 'Synced with Cloud Firestore',
      localSampleMode: 'Local Sample Mode',
      syncNotice: 'Showing sample local workspace data. Sign in with Google for encrypted cloud sync via Firestore.',
    },
    common: {
      unavailable: 'Unavailable',
      save: 'Save',
      cancel: 'Cancel',
      confirm: 'Confirm',
      delete: 'Delete',
      edit: 'Edit',
      add: 'Add',
      close: 'Close',
      today: 'Today',
      loading: 'Loading...',
      egp: 'EGP',
      hours: 'h',
      minutes: 'min',
      manualEntry: 'Manual entry',
      nonMedicalNotice: 'Personal estimation for daily planning only — not a medical measurement or diagnosis.',
    },
  },
} as const;
