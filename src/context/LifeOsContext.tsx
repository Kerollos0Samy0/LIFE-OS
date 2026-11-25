import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  signInWithGooglePopup,
  signOutFirebase,
} from '../lib/firebase';
import { createEmptyDataset, createInitialSeedDataset, TODAY_ISO } from '../data/seedData';
import type {
  AiModelId,
  AppUsageLog,
  Budget,
  CalendarEvent,
  DailyMicroGoal,
  EnergyLog,
  ExpenseRecord,
  FocusSession,
  HabitRecord,
  HealthLog,
  IncomeRecord,
  InvestmentAsset,
  Language,
  LifeOsDataset,
  PersonalGoal,
  SavingsGoal,
  TaskItem,
  UserProfile,
} from '../types/lifeos';

const LOCAL_STORAGE_KEY = 'kyvora_workspace_v2';

function makeSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

function loadLocalDataset(): LifeOsDataset {
  try {
    // If old v1 exists, remove it so user starts fresh on clean slate
    if (localStorage.getItem('life_os_workspace_v1')) {
      localStorage.removeItem('life_os_workspace_v1');
    }
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LifeOsDataset>;
      // If the stored data still contains the legacy sample mock dataset, discard it
      const hasLegacyDemoSeed =
        (Array.isArray(parsed.habits) && parsed.habits.some((h) => h.id === 'habit-1')) ||
        (Array.isArray(parsed.incomeRecords) && parsed.incomeRecords.some((i) => i.id === 'inc-salary-nov')) ||
        (parsed.profile && parsed.profile.displayName === 'كريم سامي');

      if (!hasLegacyDemoSeed) {
        const fallback = createEmptyDataset();
        return {
          ...fallback,
          ...parsed,
          profile: { ...fallback.profile, ...(parsed.profile || {}) },
          dailyMicroGoals: Array.isArray(parsed.dailyMicroGoals) ? parsed.dailyMicroGoals : fallback.dailyMicroGoals,
          habits: Array.isArray(parsed.habits) ? parsed.habits : fallback.habits,
          aiUsage: { ...fallback.aiUsage, ...(parsed.aiUsage || {}) },
        };
      }
    }
  } catch {
    // Fallback to clean empty dataset
  }
  const clean = createEmptyDataset();
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(clean));
  } catch {
    // Ignore storage quota
  }
  return clean;
}

interface LifeOsContextValue {
  data: LifeOsDataset;
  user: User | null;
  authReady: boolean;
  isCloudMode: boolean;
  syncError: string | null;
  lang: Language;
  setLanguage: (lang: Language) => void;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  seedCloudFromSample: () => Promise<void>;
  // Profile
  updateProfile: (patch: Partial<UserProfile>) => Promise<void>;
  addCustomCategory: (name: string) => Promise<void>;
  // Finance
  addExpense: (item: Omit<ExpenseRecord, 'id' | 'userId'>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  addIncome: (item: Omit<IncomeRecord, 'id' | 'userId'>) => Promise<void>;
  updateIncomeStatus: (id: string, status: IncomeRecord['status'], paidAmountPiasters: number) => Promise<void>;
  deleteIncome: (id: string) => Promise<void>;
  upsertBudget: (item: Omit<Budget, 'id' | 'userId'> & { id?: string }) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;
  addSavingsGoal: (item: Omit<SavingsGoal, 'id' | 'userId'>) => Promise<void>;
  contributeSavingsGoal: (id: string, addPiasters: number) => Promise<void>;
  deleteSavingsGoal: (id: string) => Promise<void>;
  addInvestment: (item: Omit<InvestmentAsset, 'id' | 'userId'>) => Promise<void>;
  updateInvestmentValuation: (id: string, currentValuationPiasters: number) => Promise<void>;
  deleteInvestment: (id: string) => Promise<void>;
  // Time
  addTask: (item: Omit<TaskItem, 'id' | 'userId'>) => Promise<void>;
  toggleTaskStatus: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  addCalendarEvent: (item: Omit<CalendarEvent, 'id' | 'userId'>) => Promise<void>;
  deleteCalendarEvent: (id: string) => Promise<void>;
  addFocusSession: (item: Omit<FocusSession, 'id' | 'userId'>) => Promise<void>;
  // Health, Wellbeing, Energy
  upsertHealthLog: (item: Omit<HealthLog, 'id' | 'userId'>) => Promise<void>;
  upsertAppUsageLog: (item: Omit<AppUsageLog, 'id' | 'userId'>) => Promise<void>;
  addEnergyLog: (item: Omit<EnergyLog, 'id' | 'userId'>) => Promise<void>;
  // Goals
  addGoal: (item: Omit<PersonalGoal, 'id' | 'userId'>) => Promise<void>;
  toggleGoalMilestone: (goalId: string, milestoneId: string) => Promise<void>;
  appendGoalMilestones: (goalId: string, titles: string[]) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  // Daily Micro-Goal
  upsertDailyMicroGoal: (item: Omit<DailyMicroGoal, 'id' | 'userId'>) => Promise<void>;
  updateDailyMicroGoalProgress: (id: string, currentValue: number) => Promise<void>;
  deleteDailyMicroGoal: (id: string) => Promise<void>;
  // Habits
  addHabit: (item: Omit<HabitRecord, 'id' | 'userId' | 'streak' | 'bestStreak' | 'completedDates' | 'createdAt'>) => Promise<void>;
  toggleHabitForDate: (habitId: string, dateStr?: string) => Promise<void>;
  editHabit: (habitId: string, patch: Partial<Omit<HabitRecord, 'id' | 'userId'>>) => Promise<void>;
  deleteHabit: (habitId: string) => Promise<void>;
  // AI Usage tracking
  recordAiUsage: (model: AiModelId, tokens: number) => void;
  // Backup / Reset
  exportJsonBackup: () => string;
  importJsonBackup: (jsonStr: string) => boolean;
  resetAllData: () => Promise<void>;
}

function computeHabitStreaks(dates: string[]): { streak: number; bestStreak: number } {
  if (!dates || dates.length === 0) return { streak: 0, bestStreak: 0 };
  const uniqueSorted = Array.from(new Set(dates)).sort();
  let maxRun = 1;
  let currentRun = 1;
  for (let i = 1; i < uniqueSorted.length; i++) {
    const prev = new Date(uniqueSorted[i - 1]).getTime();
    const curr = new Date(uniqueSorted[i]).getTime();
    const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      currentRun++;
      if (currentRun > maxRun) maxRun = currentRun;
    } else if (diffDays > 1) {
      currentRun = 1;
    }
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const datesSet = new Set(dates);
  let streak = 0;
  const d = new Date(todayStr);

  if (!datesSet.has(todayStr)) {
    d.setDate(d.getDate() - 1);
  }

  while (datesSet.has(d.toISOString().slice(0, 10))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }

  return { streak, bestStreak: Math.max(maxRun, streak) };
}

const LifeOsContext = createContext<LifeOsContextValue | null>(null);

export const LifeOsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<LifeOsDataset>(() => loadLocalDataset());
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const isCloudMode = Boolean(user && user.emailVerified);
  const lang: Language = data.profile.language;

  // Sync HTML lang & dir attribute with active language
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  // Persist local mode dataset to localStorage
  useEffect(() => {
    if (!isCloudMode) {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
      } catch {
        // Ignore storage quota issues
      }
    }
  }, [data, isCloudMode]);

  // Listen to Firebase Authentication state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (!firebaseUser) {
        setData(loadLocalDataset());
      }
    });
    return () => unsub();
  }, []);

  // Attach real-time Firestore listeners ONLY when authenticated & email verified
  useEffect(() => {
    if (!authReady || !user || !user.emailVerified) return;

    const uid = user.uid;
    const unsubscribers: Array<() => void> = [];

    // Ensure user root document exists
    const ensureProfileDoc = async () => {
      const profileRef = doc(db, 'users', uid);
      try {
        const snap = await getDoc(profileRef);
        if (!snap.exists()) {
          const defaults = createEmptyDataset(uid).profile;
          await setDoc(profileRef, {
            userId: uid,
            displayName: (user.displayName || defaults.displayName).slice(0, 120),
            email: (user.email || '').slice(0, 200),
            language: defaults.language,
            currency: 'EGP',
            dailyWorkHours: defaults.dailyWorkHours,
            workStartHour: defaults.workStartHour,
            workEndHour: defaults.workEndHour,
            targetSleepHours: defaults.targetSleepHours,
            peakConcentration: defaults.peakConcentration,
            financialGoal: defaults.financialGoal,
            smartphone: defaults.smartphone,
            smartwatch: defaults.smartwatch,
            dailyStepTarget: defaults.dailyStepTarget,
            aiDefaultModel: defaults.aiDefaultModel,
            aiDailyLimit: defaults.aiDailyLimit,
            liabilitiesPiasters: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        setSyncError(err instanceof Error ? err.message : String(err));
        handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
      }
    };

    void ensureProfileDoc();

    // Listen to profile doc
    unsubscribers.push(
      onSnapshot(
        doc(db, 'users', uid),
        (snap) => {
          if (snap.exists()) {
            const raw = snap.data() as Partial<UserProfile>;
            setData((prev) => ({
              ...prev,
              profile: {
                ...prev.profile,
                ...raw,
                userId: uid,
                currency: 'EGP',
              },
            }));
          }
        },
        (err) => {
          setSyncError(err.message);
          handleFirestoreError(err, OperationType.GET, `users/${uid}`);
        },
      ),
    );

    const bindCollection = <T extends { id: string }>(
      subcol: string,
      key: keyof LifeOsDataset,
    ) => {
      const colPath = `users/${uid}/${subcol}`;
      const q = query(collection(db, 'users', uid, subcol), where('userId', '==', uid));
      const unsub = onSnapshot(
        q,
        (snapshot) => {
          const rows = snapshot.docs.map((d) => ({ ...(d.data() as Omit<T, 'id'>), id: d.id }) as T);
          setData((prev) => ({ ...prev, [key]: rows }));
        },
        (err) => {
          setSyncError(err.message);
          handleFirestoreError(err, OperationType.LIST, colPath);
        },
      );
      unsubscribers.push(unsub);
    };

    bindCollection<IncomeRecord>('income_records', 'incomeRecords');
    bindCollection<ExpenseRecord>('expense_records', 'expenseRecords');
    bindCollection<Budget>('budgets', 'budgets');
    bindCollection<SavingsGoal>('savings_goals', 'savingsGoals');
    bindCollection<InvestmentAsset>('investments', 'investments');
    bindCollection<TaskItem>('tasks', 'tasks');
    bindCollection<CalendarEvent>('calendar_events', 'calendarEvents');
    bindCollection<FocusSession>('focus_sessions', 'focusSessions');
    bindCollection<HealthLog>('health_logs', 'healthLogs');
    bindCollection<AppUsageLog>('app_usage', 'appUsageLogs');
    bindCollection<EnergyLog>('energy_logs', 'energyLogs');
    bindCollection<PersonalGoal>('goals', 'goals');
    bindCollection<DailyMicroGoal>('daily_micro_goals', 'dailyMicroGoals');
    bindCollection<HabitRecord>('habits', 'habits');

    return () => {
      unsubscribers.forEach((fn) => fn());
    };
  }, [authReady, user]);

  const signInWithGoogle = useCallback(async () => {
    setSyncError(null);
    try {
      await signInWithGooglePopup();
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Sign-in failed');
    }
  }, []);

  const signOut = useCallback(async () => {
    await signOutFirebase();
    setData(loadLocalDataset());
  }, []);

  const seedCloudFromSample = useCallback(async () => {
    if (!user || !user.emailVerified) return;
    const uid = user.uid;
    const sample = createInitialSeedDataset(uid);
    const batch = writeBatch(db);
    const ts = serverTimestamp();

    sample.incomeRecords.forEach(({ id, ...rest }) => {
      batch.set(doc(db, 'users', uid, 'income_records', id), { ...rest, userId: uid, createdAt: ts, updatedAt: ts });
    });
    sample.expenseRecords.forEach(({ id, ...rest }) => {
      batch.set(doc(db, 'users', uid, 'expense_records', id), { ...rest, userId: uid, createdAt: ts, updatedAt: ts });
    });
    sample.budgets.forEach(({ id, ...rest }) => {
      batch.set(doc(db, 'users', uid, 'budgets', id), { ...rest, userId: uid, createdAt: ts, updatedAt: ts });
    });
    sample.savingsGoals.forEach(({ id, ...rest }) => {
      batch.set(doc(db, 'users', uid, 'savings_goals', id), { ...rest, userId: uid, createdAt: ts, updatedAt: ts });
    });
    sample.investments.forEach(({ id, ...rest }) => {
      batch.set(doc(db, 'users', uid, 'investments', id), { ...rest, userId: uid, createdAt: ts, updatedAt: ts });
    });
    sample.tasks.forEach(({ id, ...rest }) => {
      batch.set(doc(db, 'users', uid, 'tasks', id), { ...rest, userId: uid, createdAt: ts, updatedAt: ts });
    });
    sample.calendarEvents.forEach(({ id, ...rest }) => {
      batch.set(doc(db, 'users', uid, 'calendar_events', id), { ...rest, userId: uid, createdAt: ts, updatedAt: ts });
    });
    sample.focusSessions.forEach(({ id, ...rest }) => {
      batch.set(doc(db, 'users', uid, 'focus_sessions', id), { ...rest, userId: uid, createdAt: ts });
    });
    sample.healthLogs.forEach(({ id, ...rest }) => {
      batch.set(doc(db, 'users', uid, 'health_logs', id), { ...rest, userId: uid, createdAt: ts, updatedAt: ts });
    });
    sample.appUsageLogs.forEach(({ id, ...rest }) => {
      batch.set(doc(db, 'users', uid, 'app_usage', id), { ...rest, userId: uid, createdAt: ts, updatedAt: ts });
    });
    sample.energyLogs.forEach(({ id, ...rest }) => {
      batch.set(doc(db, 'users', uid, 'energy_logs', id), { ...rest, userId: uid, createdAt: ts });
    });
    sample.goals.forEach(({ id, ...rest }) => {
      batch.set(doc(db, 'users', uid, 'goals', id), { ...rest, userId: uid, createdAt: ts, updatedAt: ts });
    });
    sample.dailyMicroGoals.forEach(({ id, ...rest }) => {
      batch.set(doc(db, 'users', uid, 'daily_micro_goals', id), { ...rest, userId: uid, createdAt: ts, updatedAt: ts });
    });
    (sample.habits || []).forEach(({ id, ...rest }) => {
      batch.set(doc(db, 'users', uid, 'habits', id), { ...rest, userId: uid, createdAt: ts, updatedAt: ts });
    });

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${uid}/batch_seed`);
    }
  }, [user]);

  const updateProfile = useCallback(
    async (patch: Partial<UserProfile>) => {
      const sanitized: Partial<UserProfile> = { ...patch };
      delete sanitized.customCategories; // stored locally to stay within strict schema allowlist
      setData((prev) => ({ ...prev, profile: { ...prev.profile, ...patch } }));
      if (isCloudMode && user) {
        const path = `users/${user.uid}`;
        try {
          await updateDoc(doc(db, 'users', user.uid), {
            ...sanitized,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      }
    },
    [isCloudMode, user],
  );

  const setLanguage = useCallback(
    (language: Language) => {
      void updateProfile({ language });
    },
    [updateProfile],
  );

  const addCustomCategory = useCallback(async (name: string) => {
    const clean = name.trim().slice(0, 40);
    if (!clean) return;
    setData((prev) => {
      const existing = prev.profile.customCategories || [];
      if (existing.includes(clean)) return prev;
      return {
        ...prev,
        profile: { ...prev.profile, customCategories: [...existing, clean] },
      };
    });
  }, []);

  // --- Finance CRUD ---
  const addExpense = useCallback(
    async (item: Omit<ExpenseRecord, 'id' | 'userId'>) => {
      const id = makeSafeId('exp');
      const uid = user?.uid || 'local-demo-user';
      const record: ExpenseRecord = {
        ...item,
        id,
        userId: uid,
        description: item.description.trim().slice(0, 200),
        amountPiasters: Math.max(0, Math.round(item.amountPiasters)),
        notes: item.notes?.trim().slice(0, 500) || undefined,
      };
      if (isCloudMode && user) {
        const path = `users/${user.uid}/expense_records/${id}`;
        try {
          const payload: Record<string, unknown> = {
            userId: user.uid,
            description: record.description,
            amountPiasters: record.amountPiasters,
            currency: 'EGP',
            category: record.category.slice(0, 60),
            date: record.date.slice(0, 32),
            paymentMethod: record.paymentMethod,
            entrySource: record.entrySource,
            recurring: Boolean(record.recurring),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          if (record.notes) payload.notes = record.notes;
          await setDoc(doc(db, 'users', user.uid, 'expense_records', id), payload);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, path);
        }
      } else {
        setData((prev) => ({ ...prev, expenseRecords: [record, ...prev.expenseRecords] }));
      }
    },
    [isCloudMode, user],
  );

  const deleteExpense = useCallback(
    async (id: string) => {
      if (isCloudMode && user) {
        const path = `users/${user.uid}/expense_records/${id}`;
        try {
          await deleteDoc(doc(db, 'users', user.uid, 'expense_records', id));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, path);
        }
      } else {
        setData((prev) => ({
          ...prev,
          expenseRecords: prev.expenseRecords.filter((e) => e.id !== id),
        }));
      }
    },
    [isCloudMode, user],
  );

  const addIncome = useCallback(
    async (item: Omit<IncomeRecord, 'id' | 'userId'>) => {
      const id = makeSafeId('inc');
      const uid = user?.uid || 'local-demo-user';
      const amount = Math.max(0, Math.round(item.amountPiasters));
      const paid =
        item.status === 'fully_paid'
          ? amount
          : item.status === 'partially_paid'
            ? Math.min(amount, Math.max(0, Math.round(item.paidAmountPiasters)))
            : 0;
      const record: IncomeRecord = {
        ...item,
        id,
        userId: uid,
        title: item.title.trim().slice(0, 160),
        amountPiasters: amount,
        paidAmountPiasters: paid,
      };
      if (isCloudMode && user) {
        const path = `users/${user.uid}/income_records/${id}`;
        try {
          const payload: Record<string, unknown> = {
            userId: user.uid,
            title: record.title,
            amountPiasters: record.amountPiasters,
            paidAmountPiasters: record.paidAmountPiasters,
            currency: 'EGP',
            source: record.source,
            status: record.status,
            expectedPaymentDate: record.expectedPaymentDate.slice(0, 32),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          if (record.dateReceived) payload.dateReceived = record.dateReceived.slice(0, 32);
          if (record.projectName) payload.projectName = record.projectName.slice(0, 120);
          if (record.notes) payload.notes = record.notes.slice(0, 500);
          await setDoc(doc(db, 'users', user.uid, 'income_records', id), payload);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, path);
        }
      } else {
        setData((prev) => ({ ...prev, incomeRecords: [record, ...prev.incomeRecords] }));
      }
    },
    [isCloudMode, user],
  );

  const updateIncomeStatus = useCallback(
    async (id: string, status: IncomeRecord['status'], paidAmountPiasters: number) => {
      const dateReceived = status === 'fully_paid' || status === 'partially_paid' ? TODAY_ISO : undefined;
      if (isCloudMode && user) {
        const path = `users/${user.uid}/income_records/${id}`;
        try {
          const updatePayload: Record<string, unknown> = {
            status,
            paidAmountPiasters: Math.max(0, Math.round(paidAmountPiasters)),
            updatedAt: serverTimestamp(),
          };
          if (dateReceived) updatePayload.dateReceived = dateReceived;
          await updateDoc(doc(db, 'users', user.uid, 'income_records', id), updatePayload);
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      } else {
        setData((prev) => ({
          ...prev,
          incomeRecords: prev.incomeRecords.map((r) =>
            r.id === id ? { ...r, status, paidAmountPiasters, dateReceived: dateReceived ?? r.dateReceived } : r,
          ),
        }));
      }
    },
    [isCloudMode, user],
  );

  const deleteIncome = useCallback(
    async (id: string) => {
      if (isCloudMode && user) {
        try {
          await deleteDoc(doc(db, 'users', user.uid, 'income_records', id));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/income_records/${id}`);
        }
      } else {
        setData((prev) => ({ ...prev, incomeRecords: prev.incomeRecords.filter((r) => r.id !== id) }));
      }
    },
    [isCloudMode, user],
  );

  const upsertBudget = useCallback(
    async (item: Omit<Budget, 'id' | 'userId'> & { id?: string }) => {
      const id = item.id || makeSafeId('bud');
      const uid = user?.uid || 'local-demo-user';
      const limit = Math.max(100, Math.round(item.limitPiasters));
      if (isCloudMode && user) {
        const path = `users/${user.uid}/budgets/${id}`;
        try {
          if (item.id) {
            await updateDoc(doc(db, 'users', user.uid, 'budgets', id), {
              category: item.category.slice(0, 60),
              monthKey: item.monthKey.slice(0, 10),
              limitPiasters: limit,
              updatedAt: serverTimestamp(),
            });
          } else {
            await setDoc(doc(db, 'users', user.uid, 'budgets', id), {
              userId: user.uid,
              category: item.category.slice(0, 60),
              monthKey: item.monthKey.slice(0, 10),
              limitPiasters: limit,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, path);
        }
      } else {
        setData((prev) => {
          const exists = prev.budgets.some((b) => b.id === id);
          const nextRecord: Budget = { id, userId: uid, category: item.category, monthKey: item.monthKey, limitPiasters: limit };
          return {
            ...prev,
            budgets: exists ? prev.budgets.map((b) => (b.id === id ? nextRecord : b)) : [...prev.budgets, nextRecord],
          };
        });
      }
    },
    [isCloudMode, user],
  );

  const deleteBudget = useCallback(
    async (id: string) => {
      if (isCloudMode && user) {
        try {
          await deleteDoc(doc(db, 'users', user.uid, 'budgets', id));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/budgets/${id}`);
        }
      } else {
        setData((prev) => ({ ...prev, budgets: prev.budgets.filter((b) => b.id !== id) }));
      }
    },
    [isCloudMode, user],
  );

  const addSavingsGoal = useCallback(
    async (item: Omit<SavingsGoal, 'id' | 'userId'>) => {
      const id = makeSafeId('sav');
      const uid = user?.uid || 'local-demo-user';
      const goal: SavingsGoal = {
        ...item,
        id,
        userId: uid,
        title: item.title.trim().slice(0, 140),
        targetPiasters: Math.max(100, Math.round(item.targetPiasters)),
        currentPiasters: Math.max(0, Math.round(item.currentPiasters)),
      };
      if (isCloudMode && user) {
        try {
          await setDoc(doc(db, 'users', user.uid, 'savings_goals', id), {
            userId: user.uid,
            title: goal.title,
            category: goal.category,
            targetPiasters: goal.targetPiasters,
            currentPiasters: goal.currentPiasters,
            targetDate: goal.targetDate.slice(0, 32),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/savings_goals/${id}`);
        }
      } else {
        setData((prev) => ({ ...prev, savingsGoals: [...prev.savingsGoals, goal] }));
      }
    },
    [isCloudMode, user],
  );

  const contributeSavingsGoal = useCallback(
    async (id: string, addPiasters: number) => {
      const target = data.savingsGoals.find((g) => g.id === id);
      if (!target) return;
      const nextAmount = Math.max(0, target.currentPiasters + Math.round(addPiasters));
      if (isCloudMode && user) {
        try {
          await updateDoc(doc(db, 'users', user.uid, 'savings_goals', id), {
            currentPiasters: nextAmount,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/savings_goals/${id}`);
        }
      } else {
        setData((prev) => ({
          ...prev,
          savingsGoals: prev.savingsGoals.map((g) => (g.id === id ? { ...g, currentPiasters: nextAmount } : g)),
        }));
      }
    },
    [data.savingsGoals, isCloudMode, user],
  );

  const deleteSavingsGoal = useCallback(
    async (id: string) => {
      if (isCloudMode && user) {
        try {
          await deleteDoc(doc(db, 'users', user.uid, 'savings_goals', id));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/savings_goals/${id}`);
        }
      } else {
        setData((prev) => ({ ...prev, savingsGoals: prev.savingsGoals.filter((g) => g.id !== id) }));
      }
    },
    [isCloudMode, user],
  );

  const addInvestment = useCallback(
    async (item: Omit<InvestmentAsset, 'id' | 'userId'>) => {
      const id = makeSafeId('inv');
      const uid = user?.uid || 'local-demo-user';
      const asset: InvestmentAsset = { ...item, id, userId: uid, name: item.name.trim().slice(0, 140) };
      if (isCloudMode && user) {
        try {
          await setDoc(doc(db, 'users', user.uid, 'investments', id), {
            userId: user.uid,
            name: asset.name,
            category: asset.category,
            quantity: asset.quantity,
            purchasePricePiasters: Math.round(asset.purchasePricePiasters),
            currentValuationPiasters: Math.round(asset.currentValuationPiasters),
            feesPiasters: Math.round(asset.feesPiasters),
            realizedPnlPiasters: Math.round(asset.realizedPnlPiasters),
            purchaseDate: asset.purchaseDate.slice(0, 32),
            valuationSource: asset.valuationSource,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/investments/${id}`);
        }
      } else {
        setData((prev) => ({ ...prev, investments: [...prev.investments, asset] }));
      }
    },
    [isCloudMode, user],
  );

  const updateInvestmentValuation = useCallback(
    async (id: string, currentValuationPiasters: number) => {
      const cleanVal = Math.max(0, Math.round(currentValuationPiasters));
      if (isCloudMode && user) {
        try {
          await updateDoc(doc(db, 'users', user.uid, 'investments', id), {
            currentValuationPiasters: cleanVal,
            valuationSource: 'manual',
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/investments/${id}`);
        }
      } else {
        setData((prev) => ({
          ...prev,
          investments: prev.investments.map((i) =>
            i.id === id ? { ...i, currentValuationPiasters: cleanVal, valuationSource: 'manual' } : i,
          ),
        }));
      }
    },
    [isCloudMode, user],
  );

  const deleteInvestment = useCallback(
    async (id: string) => {
      if (isCloudMode && user) {
        try {
          await deleteDoc(doc(db, 'users', user.uid, 'investments', id));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/investments/${id}`);
        }
      } else {
        setData((prev) => ({ ...prev, investments: prev.investments.filter((i) => i.id !== id) }));
      }
    },
    [isCloudMode, user],
  );

  // --- Time CRUD ---
  const addTask = useCallback(
    async (item: Omit<TaskItem, 'id' | 'userId'>) => {
      const id = makeSafeId('task');
      const uid = user?.uid || 'local-demo-user';
      const task: TaskItem = { ...item, id, userId: uid, title: item.title.trim().slice(0, 200) };
      if (isCloudMode && user) {
        try {
          const payload: Record<string, unknown> = {
            userId: user.uid,
            title: task.title,
            priority: task.priority,
            category: task.category,
            status: task.status,
            deadline: task.deadline.slice(0, 32),
            estimatedMinutes: Math.max(1, Math.round(task.estimatedMinutes)),
            actualMinutes: Math.max(0, Math.round(task.actualMinutes)),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          if (task.description) payload.description = task.description.slice(0, 600);
          if (task.scheduledStart) payload.scheduledStart = task.scheduledStart.slice(0, 16);
          if (task.project) payload.project = task.project.slice(0, 120);
          await setDoc(doc(db, 'users', user.uid, 'tasks', id), payload);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/tasks/${id}`);
        }
      } else {
        setData((prev) => ({ ...prev, tasks: [task, ...prev.tasks] }));
      }
    },
    [isCloudMode, user],
  );

  const toggleTaskStatus = useCallback(
    async (id: string) => {
      const existing = data.tasks.find((t) => t.id === id);
      if (!existing) return;
      const nextStatus: TaskItem['status'] = existing.status === 'completed' ? 'todo' : 'completed';
      const nextActual = nextStatus === 'completed' ? Math.max(existing.actualMinutes, existing.estimatedMinutes) : existing.actualMinutes;
      if (isCloudMode && user) {
        try {
          await updateDoc(doc(db, 'users', user.uid, 'tasks', id), {
            status: nextStatus,
            actualMinutes: nextActual,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/tasks/${id}`);
        }
      } else {
        setData((prev) => ({
          ...prev,
          tasks: prev.tasks.map((t) => (t.id === id ? { ...t, status: nextStatus, actualMinutes: nextActual } : t)),
        }));
      }
    },
    [data.tasks, isCloudMode, user],
  );

  const deleteTask = useCallback(
    async (id: string) => {
      if (isCloudMode && user) {
        try {
          await deleteDoc(doc(db, 'users', user.uid, 'tasks', id));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/tasks/${id}`);
        }
      } else {
        setData((prev) => ({ ...prev, tasks: prev.tasks.filter((t) => t.id !== id) }));
      }
    },
    [isCloudMode, user],
  );

  const addCalendarEvent = useCallback(
    async (item: Omit<CalendarEvent, 'id' | 'userId'>) => {
      const id = makeSafeId('evt');
      const uid = user?.uid || 'local-demo-user';
      const evt: CalendarEvent = { ...item, id, userId: uid, title: item.title.trim().slice(0, 200) };
      if (isCloudMode && user) {
        try {
          const payload: Record<string, unknown> = {
            userId: user.uid,
            title: evt.title,
            calendarType: evt.calendarType,
            date: evt.date.slice(0, 32),
            startTime: evt.startTime.slice(0, 16),
            endTime: evt.endTime.slice(0, 16),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          if (evt.notes) payload.notes = evt.notes.slice(0, 400);
          await setDoc(doc(db, 'users', user.uid, 'calendar_events', id), payload);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/calendar_events/${id}`);
        }
      } else {
        setData((prev) => ({ ...prev, calendarEvents: [...prev.calendarEvents, evt] }));
      }
    },
    [isCloudMode, user],
  );

  const deleteCalendarEvent = useCallback(
    async (id: string) => {
      if (isCloudMode && user) {
        try {
          await deleteDoc(doc(db, 'users', user.uid, 'calendar_events', id));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/calendar_events/${id}`);
        }
      } else {
        setData((prev) => ({ ...prev, calendarEvents: prev.calendarEvents.filter((e) => e.id !== id) }));
      }
    },
    [isCloudMode, user],
  );

  const addFocusSession = useCallback(
    async (item: Omit<FocusSession, 'id' | 'userId'>) => {
      const id = makeSafeId('foc');
      const uid = user?.uid || 'local-demo-user';
      const session: FocusSession = { ...item, id, userId: uid, label: item.label.trim().slice(0, 140) };
      if (isCloudMode && user) {
        try {
          await setDoc(doc(db, 'users', user.uid, 'focus_sessions', id), {
            userId: user.uid,
            label: session.label,
            durationMinutes: Math.max(1, Math.round(session.durationMinutes)),
            distractions: Math.max(0, Math.round(session.distractions)),
            date: session.date.slice(0, 32),
            createdAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/focus_sessions/${id}`);
        }
      } else {
        setData((prev) => ({ ...prev, focusSessions: [session, ...prev.focusSessions] }));
      }
    },
    [isCloudMode, user],
  );

  // --- Health / Wellbeing / Energy ---
  const upsertHealthLog = useCallback(
    async (item: Omit<HealthLog, 'id' | 'userId'>) => {
      const id = `hl-${item.date.replace(/[^0-9]/g, '')}`;
      const uid = user?.uid || 'local-demo-user';
      const existing = data.healthLogs.find((h) => h.date === item.date);
      const record: HealthLog = { ...existing, ...item, id: existing?.id || id, userId: uid };
      if (isCloudMode && user) {
        try {
          const payload: Record<string, unknown> = {
            userId: user.uid,
            date: record.date,
            source: record.source,
            updatedAt: serverTimestamp(),
          };
          if (typeof record.sleepHours === 'number') payload.sleepHours = record.sleepHours;
          if (record.sleepBedtime) payload.sleepBedtime = record.sleepBedtime;
          if (typeof record.steps === 'number') payload.steps = Math.round(record.steps);
          if (typeof record.activeCalories === 'number') payload.activeCalories = Math.round(record.activeCalories);
          if (typeof record.restingHeartRate === 'number') payload.restingHeartRate = Math.round(record.restingHeartRate);
          if (existing) {
            await updateDoc(doc(db, 'users', user.uid, 'health_logs', record.id), payload);
          } else {
            await setDoc(doc(db, 'users', user.uid, 'health_logs', record.id), { ...payload, createdAt: serverTimestamp() });
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/health_logs/${record.id}`);
        }
      } else {
        setData((prev) => ({
          ...prev,
          healthLogs: existing
            ? prev.healthLogs.map((h) => (h.id === record.id ? record : h))
            : [record, ...prev.healthLogs],
        }));
      }
    },
    [data.healthLogs, isCloudMode, user],
  );

  const upsertAppUsageLog = useCallback(
    async (item: Omit<AppUsageLog, 'id' | 'userId'>) => {
      const id = `au-${item.date.replace(/[^0-9]/g, '')}`;
      const uid = user?.uid || 'local-demo-user';
      const existing = data.appUsageLogs.find((a) => a.date === item.date);
      const record: AppUsageLog = { ...item, id: existing?.id || id, userId: uid };
      if (isCloudMode && user) {
        try {
          const payload = {
            userId: user.uid,
            date: record.date,
            productivityMinutes: Math.round(record.productivityMinutes),
            communicationMinutes: Math.round(record.communicationMinutes),
            socialMediaMinutes: Math.round(record.socialMediaMinutes),
            entertainmentMinutes: Math.round(record.entertainmentMinutes),
            educationMinutes: Math.round(record.educationMinutes),
            otherMinutes: Math.round(record.otherMinutes),
            nighttimeMinutes: Math.round(record.nighttimeMinutes),
            interruptions: Math.round(record.interruptions),
            source: record.source,
            updatedAt: serverTimestamp(),
          };
          if (existing) {
            await updateDoc(doc(db, 'users', user.uid, 'app_usage', record.id), payload);
          } else {
            await setDoc(doc(db, 'users', user.uid, 'app_usage', record.id), { ...payload, createdAt: serverTimestamp() });
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/app_usage/${record.id}`);
        }
      } else {
        setData((prev) => ({
          ...prev,
          appUsageLogs: existing
            ? prev.appUsageLogs.map((a) => (a.id === record.id ? record : a))
            : [record, ...prev.appUsageLogs],
        }));
      }
    },
    [data.appUsageLogs, isCloudMode, user],
  );

  const addEnergyLog = useCallback(
    async (item: Omit<EnergyLog, 'id' | 'userId'>) => {
      const id = makeSafeId('en');
      const uid = user?.uid || 'local-demo-user';
      const record: EnergyLog = { ...item, id, userId: uid };
      if (isCloudMode && user) {
        try {
          const payload: Record<string, unknown> = {
            userId: user.uid,
            date: record.date,
            energyLevel: record.energyLevel,
            moodLevel: record.moodLevel,
            focusLevel: record.focusLevel,
            stressLevel: record.stressLevel,
            createdAt: serverTimestamp(),
          };
          if (record.notes) payload.notes = record.notes.slice(0, 300);
          await setDoc(doc(db, 'users', user.uid, 'energy_logs', id), payload);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/energy_logs/${id}`);
        }
      } else {
        setData((prev) => ({ ...prev, energyLogs: [record, ...prev.energyLogs] }));
      }
    },
    [isCloudMode, user],
  );

  // --- Goals ---
  const addGoal = useCallback(
    async (item: Omit<PersonalGoal, 'id' | 'userId'>) => {
      const id = makeSafeId('goal');
      const uid = user?.uid || 'local-demo-user';
      const goal: PersonalGoal = { ...item, id, userId: uid, milestones: item.milestones.slice(0, 20) };
      if (isCloudMode && user) {
        try {
          const payload: Record<string, unknown> = {
            userId: user.uid,
            title: goal.title.slice(0, 180),
            category: goal.category,
            targetLabel: goal.targetLabel.slice(0, 120),
            startDate: goal.startDate.slice(0, 32),
            deadline: goal.deadline.slice(0, 32),
            progress: goal.progress,
            milestones: goal.milestones,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          if (goal.description) payload.description = goal.description.slice(0, 500);
          await setDoc(doc(db, 'users', user.uid, 'goals', id), payload);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/goals/${id}`);
        }
      } else {
        setData((prev) => ({ ...prev, goals: [goal, ...prev.goals] }));
      }
    },
    [isCloudMode, user],
  );

  const toggleGoalMilestone = useCallback(
    async (goalId: string, milestoneId: string) => {
      const target = data.goals.find((g) => g.id === goalId);
      if (!target) return;
      const nextMilestones = target.milestones.map((m) =>
        m.id === milestoneId ? { ...m, completed: !m.completed } : m,
      );
      const completedCount = nextMilestones.filter((m) => m.completed).length;
      const nextProgress =
        nextMilestones.length > 0 ? Math.round((completedCount / nextMilestones.length) * 100) : target.progress;
      if (isCloudMode && user) {
        try {
          await updateDoc(doc(db, 'users', user.uid, 'goals', goalId), {
            milestones: nextMilestones,
            progress: nextProgress,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/goals/${goalId}`);
        }
      } else {
        setData((prev) => ({
          ...prev,
          goals: prev.goals.map((g) =>
            g.id === goalId ? { ...g, milestones: nextMilestones, progress: nextProgress } : g,
          ),
        }));
      }
    },
    [data.goals, isCloudMode, user],
  );

  const appendGoalMilestones = useCallback(
    async (goalId: string, titles: string[]) => {
      const target = data.goals.find((g) => g.id === goalId);
      if (!target) return;
      const newItems = titles.map((title) => ({ id: makeSafeId('ms'), title: title.slice(0, 120), completed: false }));
      const nextMilestones = [...target.milestones, ...newItems].slice(0, 20);
      const completedCount = nextMilestones.filter((m) => m.completed).length;
      const nextProgress =
        nextMilestones.length > 0 ? Math.round((completedCount / nextMilestones.length) * 100) : target.progress;
      if (isCloudMode && user) {
        try {
          await updateDoc(doc(db, 'users', user.uid, 'goals', goalId), {
            milestones: nextMilestones,
            progress: nextProgress,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/goals/${goalId}`);
        }
      } else {
        setData((prev) => ({
          ...prev,
          goals: prev.goals.map((g) =>
            g.id === goalId ? { ...g, milestones: nextMilestones, progress: nextProgress } : g,
          ),
        }));
      }
    },
    [data.goals, isCloudMode, user],
  );

  const deleteGoal = useCallback(
    async (id: string) => {
      if (isCloudMode && user) {
        try {
          await deleteDoc(doc(db, 'users', user.uid, 'goals', id));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/goals/${id}`);
        }
      } else {
        setData((prev) => ({ ...prev, goals: prev.goals.filter((g) => g.id !== id) }));
      }
    },
    [isCloudMode, user],
  );

  // --- Daily Micro-Goals ---
  const upsertDailyMicroGoal = useCallback(
    async (item: Omit<DailyMicroGoal, 'id' | 'userId'>) => {
      const cleanDate = item.date.trim().slice(0, 32) || TODAY_ISO;
      const id = `mg-${cleanDate.replace(/[^0-9]/g, '') || 'today'}`;
      const uid = user?.uid || 'local-demo-user';
      const existing = data.dailyMicroGoals.find((g) => g.date === cleanDate || g.id === id);
      const cleanTitle = item.title.trim().slice(0, 140);
      if (!cleanTitle) return;
      const cleanUnit = item.unit.trim().slice(0, 32) || 'units';
      const cleanTarget = Math.min(100000, Math.max(1, Math.round(item.targetValue)));
      const cleanCurrent = Math.min(100000, Math.max(0, Math.round(item.currentValue)));
      const completed = Boolean(item.completed || cleanCurrent >= cleanTarget);

      const record: DailyMicroGoal = {
        id: existing?.id || id,
        userId: uid,
        date: cleanDate,
        title: cleanTitle,
        category: item.category,
        targetValue: cleanTarget,
        currentValue: cleanCurrent,
        unit: cleanUnit,
        completed,
      };

      if (isCloudMode && user) {
        const path = `users/${user.uid}/daily_micro_goals/${record.id}`;
        try {
          const payload = {
            userId: user.uid,
            date: record.date,
            title: record.title,
            category: record.category,
            targetValue: record.targetValue,
            currentValue: record.currentValue,
            unit: record.unit,
            completed: record.completed,
            updatedAt: serverTimestamp(),
          };
          if (existing) {
            await updateDoc(doc(db, 'users', user.uid, 'daily_micro_goals', record.id), {
              date: record.date,
              title: record.title,
              category: record.category,
              targetValue: record.targetValue,
              currentValue: record.currentValue,
              unit: record.unit,
              completed: record.completed,
              updatedAt: serverTimestamp(),
            });
          } else {
            await setDoc(doc(db, 'users', user.uid, 'daily_micro_goals', record.id), {
              ...payload,
              createdAt: serverTimestamp(),
            });
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, path);
        }
      } else {
        setData((prev) => ({
          ...prev,
          dailyMicroGoals: existing
            ? prev.dailyMicroGoals.map((g) => (g.id === record.id ? record : g))
            : [record, ...prev.dailyMicroGoals],
        }));
      }
    },
    [data.dailyMicroGoals, isCloudMode, user],
  );

  const updateDailyMicroGoalProgress = useCallback(
    async (id: string, currentValue: number) => {
      const target = data.dailyMicroGoals.find((g) => g.id === id);
      if (!target) return;
      const nextCurrent = Math.min(100000, Math.max(0, Math.round(currentValue)));
      const nextCompleted = nextCurrent >= target.targetValue;
      if (isCloudMode && user) {
        const path = `users/${user.uid}/daily_micro_goals/${id}`;
        try {
          await updateDoc(doc(db, 'users', user.uid, 'daily_micro_goals', id), {
            currentValue: nextCurrent,
            completed: nextCompleted,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      } else {
        setData((prev) => ({
          ...prev,
          dailyMicroGoals: prev.dailyMicroGoals.map((g) =>
            g.id === id ? { ...g, currentValue: nextCurrent, completed: nextCompleted } : g,
          ),
        }));
      }
    },
    [data.dailyMicroGoals, isCloudMode, user],
  );

  const deleteDailyMicroGoal = useCallback(
    async (id: string) => {
      if (isCloudMode && user) {
        const path = `users/${user.uid}/daily_micro_goals/${id}`;
        try {
          await deleteDoc(doc(db, 'users', user.uid, 'daily_micro_goals', id));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, path);
        }
      } else {
        setData((prev) => ({
          ...prev,
          dailyMicroGoals: prev.dailyMicroGoals.filter((g) => g.id !== id),
        }));
      }
    },
    [isCloudMode, user],
  );

  const addHabit = useCallback(
    async (item: Omit<HabitRecord, 'id' | 'userId' | 'streak' | 'bestStreak' | 'completedDates' | 'createdAt'>) => {
      const id = makeSafeId('habit');
      const uid = user?.uid || 'local-demo-user';
      const nowStr = new Date().toISOString().slice(0, 10);
      const record: HabitRecord = {
        ...item,
        id,
        userId: uid,
        streak: 0,
        bestStreak: 0,
        completedDates: [],
        createdAt: nowStr,
        color: item.color || 'emerald',
      };
      if (isCloudMode && user) {
        const path = `users/${user.uid}/habits/${id}`;
        try {
          await setDoc(doc(db, 'users', user.uid, 'habits', id), {
            ...record,
            createdAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, path);
        }
      } else {
        setData((prev) => ({
          ...prev,
          habits: [record, ...(prev.habits || [])],
        }));
      }
    },
    [isCloudMode, user],
  );

  const toggleHabitForDate = useCallback(
    async (habitId: string, dateStr?: string) => {
      const targetDate = dateStr || new Date().toISOString().slice(0, 10);
      const existing = (data.habits || []).find((h) => h.id === habitId);
      if (!existing) return;

      const hasDate = existing.completedDates.includes(targetDate);
      const nextDates = hasDate
        ? existing.completedDates.filter((d) => d !== targetDate)
        : [...existing.completedDates, targetDate];

      const { streak, bestStreak } = computeHabitStreaks(nextDates);
      const updatedBestStreak = Math.max(existing.bestStreak, bestStreak);

      if (isCloudMode && user) {
        const path = `users/${user.uid}/habits/${habitId}`;
        try {
          await updateDoc(doc(db, 'users', user.uid, 'habits', habitId), {
            completedDates: nextDates,
            streak,
            bestStreak: updatedBestStreak,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, path);
        }
      } else {
        setData((prev) => ({
          ...prev,
          habits: (prev.habits || []).map((h) =>
            h.id === habitId
              ? { ...h, completedDates: nextDates, streak, bestStreak: updatedBestStreak }
              : h,
          ),
        }));
      }
    },
    [data.habits, isCloudMode, user],
  );

  const editHabit = useCallback(
    async (habitId: string, patch: Partial<Omit<HabitRecord, 'id' | 'userId'>>) => {
      if (isCloudMode && user) {
        const path = `users/${user.uid}/habits/${habitId}`;
        try {
          await updateDoc(doc(db, 'users', user.uid, 'habits', habitId), {
            ...patch,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, path);
        }
      } else {
        setData((prev) => ({
          ...prev,
          habits: (prev.habits || []).map((h) => (h.id === habitId ? { ...h, ...patch } : h)),
        }));
      }
    },
    [isCloudMode, user],
  );

  const deleteHabit = useCallback(
    async (habitId: string) => {
      if (isCloudMode && user) {
        const path = `users/${user.uid}/habits/${habitId}`;
        try {
          await deleteDoc(doc(db, 'users', user.uid, 'habits', habitId));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, path);
        }
      } else {
        setData((prev) => ({
          ...prev,
          habits: (prev.habits || []).filter((h) => h.id !== habitId),
        }));
      }
    },
    [isCloudMode, user],
  );

  const recordAiUsage = useCallback((model: AiModelId, tokens: number) => {
    setData((prev) => ({
      ...prev,
      aiUsage: {
        dateKey: TODAY_ISO,
        requestsToday: prev.aiUsage.requestsToday + 1,
        tokensThisMonth: prev.aiUsage.tokensThisMonth + Math.max(0, tokens),
        flashLiteCalls: prev.aiUsage.flashLiteCalls + (model === 'gemini-3.1-flash-lite' ? 1 : 0),
        flashCalls: prev.aiUsage.flashCalls + (model === 'gemini-4-hydrogen' ? 1 : 0),
      },
    }));
  }, []);

  const exportJsonBackup = useCallback(() => {
    return JSON.stringify(
      {
        version: 'LIFE_OS_BACKUP_1.0',
        exportedAt: new Date().toISOString(),
        dataset: data,
      },
      null,
      2,
    );
  }, [data]);

  const importJsonBackup = useCallback((jsonStr: string): boolean => {
    try {
      const parsed = JSON.parse(jsonStr);
      const next = parsed?.dataset as LifeOsDataset | undefined;
      if (!next || !next.profile || !Array.isArray(next.expenseRecords)) {
        return false;
      }
      setData(next);
      return true;
    } catch {
      return false;
    }
  }, []);

  const resetAllData = useCallback(async () => {
    const uid = user?.uid;
    const clean = createEmptyDataset(uid || 'local-demo-user');
    if (user?.displayName) {
      clean.profile.displayName = user.displayName;
    }
    if (user?.email) {
      clean.profile.email = user.email;
    }

    try {
      localStorage.removeItem('life_os_workspace_v1');
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(clean));
    } catch {
      // ignore quota
    }
    setData(clean);

    if (uid && isCloudMode) {
      try {
        const subcollections = [
          'income_records',
          'expense_records',
          'budgets',
          'savings_goals',
          'investments',
          'tasks',
          'calendar_events',
          'focus_sessions',
          'health_logs',
          'app_usage',
          'energy_logs',
          'goals',
          'daily_micro_goals',
          'habits',
        ];

        for (const subcol of subcollections) {
          const colRef = collection(db, 'users', uid, subcol);
          const snap = await getDocs(colRef);
          if (!snap.empty) {
            const batch = writeBatch(db);
            snap.docs.forEach((d) => batch.delete(d.ref));
            await batch.commit();
          }
        }
      } catch (err) {
        console.error('Error clearing cloud subcollections:', err);
      }
    }
  }, [user, isCloudMode]);

  return (
    <LifeOsContext.Provider
      value={{
        data,
        user,
        authReady,
        isCloudMode,
        syncError,
        lang,
        setLanguage,
        signInWithGoogle,
        signOut,
        seedCloudFromSample,
        updateProfile,
        addCustomCategory,
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
        addTask,
        toggleTaskStatus,
        deleteTask,
        addCalendarEvent,
        deleteCalendarEvent,
        addFocusSession,
        upsertHealthLog,
        upsertAppUsageLog,
        addEnergyLog,
        addGoal,
        toggleGoalMilestone,
        appendGoalMilestones,
        deleteGoal,
        upsertDailyMicroGoal,
        updateDailyMicroGoalProgress,
        deleteDailyMicroGoal,
        addHabit,
        toggleHabitForDate,
        editHabit,
        deleteHabit,
        recordAiUsage,
        exportJsonBackup,
        importJsonBackup,
        resetAllData,
      }}
    >
      {children}
    </LifeOsContext.Provider>
  );
};

export function useLifeOs(): LifeOsContextValue {
  const ctx = useContext(LifeOsContext);
  if (!ctx) throw new Error('useLifeOs must be used within LifeOsProvider');
  return ctx;
}
