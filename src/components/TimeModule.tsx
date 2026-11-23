import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Check, Pause, Play, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useLifeOs } from '../context/LifeOsContext';
import { TODAY_ISO } from '../data/seedData';
import { TASK_CATEGORY_LABELS, TASK_PRIORITY_LABELS } from '../i18n/translations';
import { isOutsideWorkingHours, sortTasksForSmartSchedule } from '../utils/energy';
import { ConfirmDialog } from './ConfirmDialog';
import type { TaskCategory, TaskPriority } from '../types/lifeos';

type TimeTab = 'tasks' | 'calendar' | 'focus' | 'analytics';

export const TimeModule: React.FC = () => {
  const {
    data,
    lang,
    addTask,
    toggleTaskStatus,
    deleteTask,
    addCalendarEvent,
    deleteCalendarEvent,
    addFocusSession,
  } = useLifeOs();

  const isAr = lang === 'ar';
  const [tab, setTab] = useState<TimeTab>('tasks');

  // Task form state
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('high');
  const [category, setCategory] = useState<TaskCategory>('deep_work');
  const [deadline, setDeadline] = useState(TODAY_ISO);
  const [scheduledStart, setScheduledStart] = useState('09:30');
  const [estimatedMinutes, setEstimatedMinutes] = useState('45');
  const [pendingOutOfHoursTask, setPendingOutOfHoursTask] = useState(false);

  // Calendar event form state
  const [evtTitle, setEvtTitle] = useState('');
  const [evtType, setEvtType] = useState<'work' | 'personal'>('work');
  const [evtDate, setEvtDate] = useState(TODAY_ISO);
  const [evtStart, setEvtStart] = useState('10:00');
  const [evtEnd, setEvtEnd] = useState('11:00');
  const [calFilter, setCalFilter] = useState<'all' | 'work' | 'personal'>('all');
  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState<{ id: string; title: string } | null>(null);

  // Focus Mode Pomodoro state
  const [focusLabel, setFocusLabel] = useState(isAr ? 'جلسة تركيز صباحية' : 'Morning Deep Work');
  const [presetMinutes, setPresetMinutes] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [distractions, setDistractions] = useState(0);

  useEffect(() => {
    setFocusLabel((prev) => {
      if (prev === 'جلسة تركيز صباحية' || prev === 'Morning Deep Work') {
        return isAr ? 'جلسة تركيز صباحية' : 'Morning Deep Work';
      }
      return prev;
    });
  }, [isAr]);

  useEffect(() => {
    if (!isRunning) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          void addFocusSession({
            label: focusLabel || 'Focus Session',
            durationMinutes: presetMinutes,
            distractions,
            date: TODAY_ISO,
          });
          return presetMinutes * 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isRunning, focusLabel, presetMinutes, distractions, addFocusSession]);

  const sortedTasks = useMemo(
    () => sortTasksForSmartSchedule(data.tasks, data.profile.peakConcentration),
    [data.tasks, data.profile.peakConcentration],
  );

  const filteredEvents = useMemo(() => {
    return data.calendarEvents
      .filter((e) => (calFilter === 'all' ? true : e.calendarType === calFilter))
      .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
  }, [data.calendarEvents, calFilter]);

  const timeAnalytics = useMemo(() => {
    const byCat = new Map<TaskCategory, { planned: number; actual: number }>();
    (Object.keys(TASK_CATEGORY_LABELS) as TaskCategory[]).forEach((c) => byCat.set(c, { planned: 0, actual: 0 }));
    data.tasks.forEach((t) => {
      const cur = byCat.get(t.category) || { planned: 0, actual: 0 };
      cur.planned += t.estimatedMinutes;
      cur.actual += t.actualMinutes;
      byCat.set(t.category, cur);
    });
    return Array.from(byCat.entries()).map(([cat, v]) => ({
      name: TASK_CATEGORY_LABELS[cat][lang],
      planned: v.planned,
      actual: v.actual,
    }));
  }, [data.tasks, lang]);

  const commitNewTask = async () => {
    await addTask({
      title: title.trim(),
      priority,
      category,
      status: 'todo',
      deadline,
      scheduledStart: scheduledStart || undefined,
      estimatedMinutes: Math.max(5, Number(estimatedMinutes) || 30),
      actualMinutes: 0,
    });
    setTitle('');
    setPendingOutOfHoursTask(false);
  };

  const handleTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (isOutsideWorkingHours(scheduledStart, data.profile.workStartHour, data.profile.workEndHour)) {
      setPendingOutOfHoursTask(true);
      return;
    }
    await commitNewTask();
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evtTitle.trim()) return;
    await addCalendarEvent({
      title: evtTitle.trim(),
      calendarType: evtType,
      date: evtDate,
      startTime: evtStart,
      endTime: evtEnd,
    });
    setEvtTitle('');
  };

  const selectPreset = (mins: number) => {
    setIsRunning(false);
    setPresetMinutes(mins);
    setSecondsLeft(mins * 60);
    setDistractions(0);
  };

  const logSessionNow = async () => {
    const elapsedMins = Math.max(1, Math.round((presetMinutes * 60 - secondsLeft) / 60) || presetMinutes);
    setIsRunning(false);
    await addFocusSession({
      label: focusLabel.trim() || (isAr ? 'جلسة تركيز' : 'Focus Session'),
      durationMinutes: elapsedMins,
      distractions,
      date: TODAY_ISO,
    });
    setSecondsLeft(presetMinutes * 60);
    setDistractions(0);
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  const tabs: Array<{ id: TimeTab; label: string }> = [
    { id: 'tasks', label: isAr ? 'المهام والجدولة الذكية' : 'Smart Tasks' },
    { id: 'calendar', label: isAr ? 'التقويم' : 'Calendar' },
    { id: 'focus', label: isAr ? 'وضع التركيز (Pomodoro)' : 'Focus Mode' },
    { id: 'analytics', label: isAr ? 'تحليلات الوقت' : 'Time Analytics' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#F4F6F8]">{isAr ? 'إدارة الوقت والإنتاجية' : 'Time Intelligence'}</h1>
        <p className="text-xs text-[#8E99A8] mt-1">
          {isAr
            ? `أولوية التركيز العميق في الصباح (${data.profile.workStartHour}:00 – ${data.profile.workEndHour}:00) مع تنبيه قبل الجدولة خارج ساعات العمل.`
            : `Deep work prioritized during your ${data.profile.peakConcentration} peak (${data.profile.workStartHour}:00–${data.profile.workEndHour}:00).`}
        </p>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              tab === t.id
                ? 'bg-emerald-500 text-[#07110C]'
                : 'bg-[#13171C] border border-[#232A33] text-[#A9B3C1] hover:text-[#F4F6F8]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: SMART TASKS */}
      {tab === 'tasks' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <form onSubmit={handleTaskSubmit} className="lg:col-span-4 bg-[#13171C] border border-[#232A33] rounded-2xl p-5 space-y-4 self-start">
            <h2 className="text-sm font-semibold text-[#F4F6F8]">{isAr ? 'إضافة مهمة جديدة' : 'Add Task'}</h2>
            <div>
              <label htmlFor="task-title" className="block text-xs text-[#8E99A8] mb-1">{isAr ? 'عنوان المهمة' : 'Task Title'}</label>
              <input
                id="task-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={isAr ? 'مثال: مراجعة خطة المشروع' : 'e.g., Review project roadmap'}
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm text-[#F4F6F8]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="task-priority" className="block text-xs text-[#8E99A8] mb-1">{isAr ? 'الأولوية' : 'Priority'}</label>
                <select
                  id="task-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm text-[#F4F6F8]"
                >
                  {(Object.keys(TASK_PRIORITY_LABELS) as TaskPriority[]).map((p) => (
                    <option key={p} value={p}>{TASK_PRIORITY_LABELS[p][lang]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="task-cat" className="block text-xs text-[#8E99A8] mb-1">{isAr ? 'النوع' : 'Category'}</label>
                <select
                  id="task-cat"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as TaskCategory)}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm text-[#F4F6F8]"
                >
                  {(Object.keys(TASK_CATEGORY_LABELS) as TaskCategory[]).map((c) => (
                    <option key={c} value={c}>{TASK_CATEGORY_LABELS[c][lang]}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label htmlFor="task-start" className="block text-xs text-[#8E99A8] mb-1">{isAr ? 'الوقت' : 'Time'}</label>
                <input
                  id="task-start"
                  type="time"
                  value={scheduledStart}
                  onChange={(e) => setScheduledStart(e.target.value)}
                  className="w-full min-h-[42px] px-2 rounded-xl bg-[#0B0D10] border border-[#232A33] text-xs font-mono-nums text-[#F4F6F8]"
                />
              </div>
              <div>
                <label htmlFor="task-mins" className="block text-xs text-[#8E99A8] mb-1">{isAr ? 'المدة (د)' : 'Mins'}</label>
                <input
                  id="task-mins"
                  type="number"
                  value={estimatedMinutes}
                  onChange={(e) => setEstimatedMinutes(e.target.value)}
                  className="w-full min-h-[42px] px-2.5 rounded-xl bg-[#0B0D10] border border-[#232A33] text-xs font-mono-nums text-[#F4F6F8]"
                />
              </div>
              <div>
                <label htmlFor="task-dl" className="block text-xs text-[#8E99A8] mb-1">{isAr ? 'التاريخ' : 'Date'}</label>
                <input
                  id="task-dl"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full min-h-[42px] px-2 rounded-xl bg-[#0B0D10] border border-[#232A33] text-xs font-mono-nums text-[#F4F6F8]"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full min-h-[44px] rounded-xl bg-emerald-500 text-[#07110C] font-semibold text-sm hover:bg-emerald-400 flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {isAr ? 'إضافة للجدول الذكي' : 'Add to Smart Schedule'}
            </button>
          </form>

          <div className="lg:col-span-8 bg-[#13171C] border border-[#232A33] rounded-2xl p-5 divide-y divide-[#1D232C]">
            {sortedTasks.map((task) => (
              <div key={task.id} className="py-3.5 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => void toggleTaskStatus(task.id)}
                    aria-label={`${isAr ? 'تبديل حالة' : 'Toggle status'} ${task.title}`}
                    className={`mt-0.5 min-h-[28px] min-w-[28px] rounded-lg border flex items-center justify-center transition-colors shrink-0 ${
                      task.status === 'completed'
                        ? 'bg-emerald-500 border-emerald-500 text-[#07110C]'
                        : 'border-[#33404F] text-transparent hover:border-emerald-400'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <div className="min-w-0">
                    <p className={`text-sm font-medium ${task.status === 'completed' ? 'line-through text-[#6C7787]' : 'text-[#F4F6F8]'}`}>
                      {task.title}
                    </p>
                    <p className="text-xs text-[#8E99A8] mt-0.5">
                      <span
                        className={
                          task.priority === 'critical'
                            ? 'text-red-400'
                            : task.priority === 'high'
                              ? 'text-amber-400'
                              : 'text-[#8E99A8]'
                        }
                      >
                        {TASK_PRIORITY_LABELS[task.priority][lang]}
                      </span>
                      {' · '}
                      {TASK_CATEGORY_LABELS[task.category][lang]}
                      {' · '}
                      <span className="font-mono-nums">
                        {task.scheduledStart || '—'} ({task.estimatedMinutes}{isAr ? 'د' : 'm'})
                      </span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void deleteTask(task.id)}
                  aria-label={`${isAr ? 'حذف' : 'Delete'} ${task.title}`}
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[#758091] hover:text-red-400 shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* TAB 2: CALENDAR */}
      {tab === 'calendar' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <form onSubmit={handleAddEvent} className="lg:col-span-4 bg-[#13171C] border border-[#232A33] rounded-2xl p-5 space-y-4 self-start">
            <h2 className="text-sm font-semibold text-[#F4F6F8]">{isAr ? 'إضافة موعد جديد' : 'Add Calendar Event'}</h2>
            <div>
              <label htmlFor="evt-title" className="block text-xs text-[#8E99A8] mb-1">{isAr ? 'اسم الموعد' : 'Event Title'}</label>
              <input
                id="evt-title"
                type="text"
                value={evtTitle}
                onChange={(e) => setEvtTitle(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm text-[#F4F6F8]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="evt-type" className="block text-xs text-[#8E99A8] mb-1">{isAr ? 'التقويم' : 'Calendar'}</label>
                <select
                  id="evt-type"
                  value={evtType}
                  onChange={(e) => setEvtType(e.target.value as 'work' | 'personal')}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm text-[#F4F6F8]"
                >
                  <option value="work">{isAr ? 'العمل' : 'Work'}</option>
                  <option value="personal">{isAr ? 'شخصي' : 'Personal'}</option>
                </select>
              </div>
              <div>
                <label htmlFor="evt-date" className="block text-xs text-[#8E99A8] mb-1">{isAr ? 'التاريخ' : 'Date'}</label>
                <input
                  id="evt-date"
                  type="date"
                  value={evtDate}
                  onChange={(e) => setEvtDate(e.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-xs font-mono-nums text-[#F4F6F8]"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="evt-start" className="block text-xs text-[#8E99A8] mb-1">{isAr ? 'من' : 'Start'}</label>
                <input
                  id="evt-start"
                  type="time"
                  value={evtStart}
                  onChange={(e) => setEvtStart(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-xs font-mono-nums text-[#F4F6F8]"
                />
              </div>
              <div>
                <label htmlFor="evt-end" className="block text-xs text-[#8E99A8] mb-1">{isAr ? 'إلى' : 'End'}</label>
                <input
                  id="evt-end"
                  type="time"
                  value={evtEnd}
                  onChange={(e) => setEvtEnd(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-xs font-mono-nums text-[#F4F6F8]"
                />
              </div>
            </div>
            <button type="submit" className="w-full min-h-[44px] rounded-xl bg-emerald-500 text-[#07110C] font-semibold text-sm hover:bg-emerald-400">
              {isAr ? 'إضافة للتقويم' : 'Create Event'}
            </button>
          </form>

          <div className="lg:col-span-8 bg-[#13171C] border border-[#232A33] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                {(['all', 'work', 'personal'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setCalFilter(f)}
                    className={`min-h-[34px] px-3 rounded-lg text-xs font-medium ${
                      calFilter === f ? 'bg-[#232A33] text-[#F4F6F8]' : 'text-[#8E99A8] hover:text-[#F4F6F8]'
                    }`}
                  >
                    {f === 'all' ? (isAr ? 'الكل' : 'All') : f === 'work' ? (isAr ? 'العمل' : 'Work') : (isAr ? 'شخصي' : 'Personal')}
                  </button>
                ))}
              </div>
              <span className="text-xs text-[#8E99A8]">
                {isAr ? 'مزامنة Google Calendar: متاحة من صفحة الحسابات المتصلة' : 'Google Calendar sync: configure in Connected Accounts'}
              </span>
            </div>

            <div className="divide-y divide-[#1D232C]">
              {filteredEvents.map((ev) => (
                <div key={ev.id} className="py-3.5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-[#F4F6F8]">{ev.title}</p>
                    <p className="text-xs text-[#8E99A8] font-mono-nums mt-0.5">
                      {ev.date} · {ev.startTime}–{ev.endTime} · {ev.calendarType === 'work' ? (isAr ? 'عمل' : 'Work') : (isAr ? 'شخصي' : 'Personal')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteEvent({ id: ev.id, title: ev.title })}
                    aria-label={`${isAr ? 'حذف موعد' : 'Delete event'} ${ev.title}`}
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[#758091] hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* TAB 3: FOCUS MODE */}
      {tab === 'focus' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-6 bg-[#13171C] border border-[#232A33] rounded-2xl p-6 flex flex-col items-center text-center space-y-5">
            <div className="flex items-center gap-2">
              {[25, 50, 15].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => selectPreset(m)}
                  className={`min-h-[38px] px-3.5 rounded-xl text-xs font-mono-nums font-semibold ${
                    presetMinutes === m ? 'bg-emerald-500 text-[#07110C]' : 'bg-[#0B0D10] border border-[#232A33] text-[#A9B3C1]'
                  }`}
                >
                  {m} {isAr ? 'دقيقة' : 'min'}
                </button>
              ))}
            </div>

            <input
              type="text"
              value={focusLabel}
              onChange={(e) => setFocusLabel(e.target.value)}
              aria-label={isAr ? 'عنوان جلسة التركيز' : 'Focus session label'}
              className="w-full max-w-xs text-center min-h-[40px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm text-[#F4F6F8]"
            />

            <p className="text-6xl font-bold font-mono-nums text-[#F4F6F8] tracking-tight" data-testid="focus-timer-display">
              {mm}:{ss}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setIsRunning((r) => !r)}
                className="min-h-[44px] px-6 rounded-xl bg-emerald-500 text-[#07110C] font-semibold text-sm hover:bg-emerald-400 flex items-center gap-2"
              >
                {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {isRunning ? (isAr ? 'إيقاف مؤقت' : 'Pause') : (isAr ? 'ابدأ التركيز' : 'Start Focus')}
              </button>
              <button
                type="button"
                onClick={() => selectPreset(presetMinutes)}
                aria-label={isAr ? 'إعادة ضبط المؤقت' : 'Reset timer'}
                className="min-h-[44px] min-w-[44px] rounded-xl bg-[#191F27] border border-[#232A33] text-[#C8D0DC] flex items-center justify-center"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setDistractions((d) => d + 1)}
                className="min-h-[44px] px-3.5 rounded-xl bg-[#191F27] border border-[#232A33] text-xs font-medium text-amber-300"
              >
                {isAr ? `تسجيل مقاطعة (${distractions})` : `Log Distraction (${distractions})`}
              </button>
            </div>

            <button
              type="button"
              onClick={() => void logSessionNow()}
              className="text-xs text-emerald-400 hover:underline pt-1"
            >
              {isAr ? 'إنهاء وتسجيل الجلسة في السجل' : 'Finish & Save Session to History'}
            </button>
          </div>

          <div className="lg:col-span-6 bg-[#13171C] border border-[#232A33] rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[#F4F6F8]">{isAr ? 'سجل جلسات التركيز' : 'Focus Session History'}</h2>
            <div className="divide-y divide-[#1D232C]">
              {data.focusSessions.map((s) => (
                <div key={s.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <p className="text-sm font-medium text-[#F4F6F8]">{s.label}</p>
                    <p className="text-[#8E99A8] font-mono-nums mt-0.5">
                      {s.date} · {isAr ? `${s.distractions} مقاطعات` : `${s.distractions} distractions`}
                    </p>
                  </div>
                  <span className="font-mono-nums font-semibold text-emerald-400">
                    {s.durationMinutes} {isAr ? 'دقيقة' : 'min'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* TAB 4: TIME ANALYTICS */}
      {tab === 'analytics' ? (
        <div className="bg-[#13171C] border border-[#232A33] rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[#F4F6F8]">
            {isAr ? 'الوقت المخطط مقابل الوقت الفعلي حسب النوع (بالدقائق)' : 'Planned vs Actual Time by Category (Minutes)'}
          </h2>
          <div className="h-72 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeAnalytics} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="#232A33" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#8E99A8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#8E99A8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0B0D10', border: '1px solid #232A33', borderRadius: 12, color: '#F4F6F8', fontSize: 12 }}
                />
                <Bar dataKey="planned" name={isAr ? 'المخطط' : 'Planned'} fill="#3B82F6" radius={[6, 6, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="actual" name={isAr ? 'الفعلي' : 'Actual'} fill="#34D399" radius={[6, 6, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={pendingOutOfHoursTask}
        title={isAr ? 'تأكيد جدولة خارج ساعات العمل' : 'Schedule Outside Working Hours?'}
        description={
          isAr
            ? `الموعد المختار (${scheduledStart}) يقع خارج ساعات عملك المحددة (${data.profile.workStartHour}:00 – ${data.profile.workEndHour}:00). هل تريد تأكيد جدولة المهمة في هذا الوقت؟`
            : `The selected time (${scheduledStart}) is outside your working hours (${data.profile.workStartHour}:00–${data.profile.workEndHour}:00). Confirm scheduling anyway?`
        }
        confirmLabel={isAr ? 'تأكيد الجدولة' : 'Confirm Schedule'}
        cancelLabel={isAr ? 'تعديل الوقت' : 'Adjust Time'}
        onConfirm={() => void commitNewTask()}
        onCancel={() => setPendingOutOfHoursTask(false)}
      />

      <ConfirmDialog
        open={Boolean(confirmDeleteEvent)}
        title={isAr ? 'حذف موعد من التقويم' : 'Delete Calendar Event'}
        description={
          isAr
            ? `هل تريد حذف "${confirmDeleteEvent?.title}" من التقويم؟`
            : `Delete "${confirmDeleteEvent?.title}" from your calendar?`
        }
        confirmLabel={isAr ? 'حذف الموعد' : 'Delete Event'}
        cancelLabel={isAr ? 'إلغاء' : 'Cancel'}
        tone="danger"
        onConfirm={async () => {
          if (confirmDeleteEvent) await deleteCalendarEvent(confirmDeleteEvent.id);
          setConfirmDeleteEvent(null);
        }}
        onCancel={() => setConfirmDeleteEvent(null)}
      />
    </div>
  );
};
