import React, { useState, useMemo } from 'react';
import {
  Flame,
  Plus,
  Check,
  Calendar,
  Sparkles,
  Trophy,
  Trash2,
  Edit2,
  Clock,
  Tag,
  CheckCircle2,
  TrendingUp,
  X,
} from 'lucide-react';
import { useLifeOs } from '../context/LifeOsContext';
import {
  HABIT_CATEGORY_LABELS,
  HABIT_TIME_OF_DAY_LABELS,
} from '../i18n/translations';
import type { HabitCategory, HabitRecord, HabitTimeOfDay } from '../types/lifeos';

const PRESET_HABITS = [
  { title: '💧 شرب 2 لتر ماء', category: 'health', timeOfDay: 'anytime', color: 'emerald' },
  { title: '📖 قراءة 15 دقيقة', category: 'learning', timeOfDay: 'evening', color: 'violet' },
  { title: '🏃‍♂️ تمرين أو مشي 30 دقيقة', category: 'fitness', timeOfDay: 'afternoon', color: 'amber' },
  { title: '💻 جلسة تركيز عميق 45 دقيقة', category: 'productivity', timeOfDay: 'morning', color: 'blue' },
  { title: '🧘‍♂️ تأمل وتنفس عميق 10 دقائق', category: 'mindfulness', timeOfDay: 'morning', color: 'rose' },
  { title: '🛌 نوم مبكر قبل 12:00', category: 'health', timeOfDay: 'evening', color: 'cyan' },
];

export const HabitsModule: React.FC = () => {
  const { data, lang, addHabit, toggleHabitForDate, editHabit, deleteHabit } = useLifeOs();
  const isAr = lang === 'ar';

  const [filterTime, setFilterTime] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<HabitRecord | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<HabitCategory>('health');
  const [timeOfDay, setTimeOfDay] = useState<HabitTimeOfDay>('anytime');
  const [color, setColor] = useState('emerald');
  const [notes, setNotes] = useState('');

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Compute past 7 days dates
  const past7Days = useMemo(() => {
    const list: { dateStr: string; label: string; isToday: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayName = isAr
        ? ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'][d.getDay()]
        : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
      list.push({
        dateStr,
        label: i === 0 ? (isAr ? 'اليوم' : 'Today') : dayName,
        isToday: i === 0,
      });
    }
    return list;
  }, [isAr]);

  const habits = data.habits || [];

  // Filtered habits
  const filteredHabits = useMemo(() => {
    if (filterTime === 'all') return habits;
    return habits.filter((h) => h.timeOfDay === filterTime);
  }, [habits, filterTime]);

  // Daily statistics
  const totalCount = habits.length;
  const completedTodayCount = habits.filter((h) => h.completedDates.includes(todayStr)).length;
  const dailyPercentage = totalCount > 0 ? Math.round((completedTodayCount / totalCount) * 100) : 0;
  const bestOverallStreak = habits.reduce((max, h) => Math.max(max, h.bestStreak || h.streak || 0), 0);
  const activeStreakCount = habits.filter((h) => (h.streak || 0) > 0).length;

  const handleOpenAdd = () => {
    setEditingHabit(null);
    setTitle('');
    setCategory('health');
    setTimeOfDay('anytime');
    setColor('emerald');
    setNotes('');
    setModalOpen(true);
  };

  const handleOpenEdit = (habit: HabitRecord) => {
    setEditingHabit(habit);
    setTitle(habit.title);
    setCategory(habit.category);
    setTimeOfDay(habit.timeOfDay);
    setColor(habit.color || 'emerald');
    setNotes(habit.notes || '');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (editingHabit) {
      await editHabit(editingHabit.id, {
        title: title.trim(),
        category,
        timeOfDay,
        color,
        notes: notes.trim() || undefined,
      });
    } else {
      await addHabit({
        title: title.trim(),
        category,
        timeOfDay,
        frequency: 'daily',
        color,
        notes: notes.trim() || undefined,
      });
    }
    setModalOpen(false);
  };

  const handleSelectPreset = (p: typeof PRESET_HABITS[0]) => {
    setTitle(p.title);
    setCategory(p.category as HabitCategory);
    setTimeOfDay(p.timeOfDay as HabitTimeOfDay);
    setColor(p.color);
  };

  const getColorClasses = (c = 'emerald') => {
    switch (c) {
      case 'blue':
        return { badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30', glow: 'text-blue-400', activeBg: 'bg-blue-500' };
      case 'amber':
        return { badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30', glow: 'text-amber-400', activeBg: 'bg-amber-500' };
      case 'violet':
        return { badge: 'bg-violet-500/15 text-violet-400 border-violet-500/30', glow: 'text-violet-400', activeBg: 'bg-violet-500' };
      case 'rose':
        return { badge: 'bg-rose-500/15 text-rose-400 border-rose-500/30', glow: 'text-rose-400', activeBg: 'bg-rose-500' };
      case 'cyan':
        return { badge: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30', glow: 'text-cyan-400', activeBg: 'bg-cyan-500' };
      default:
        return { badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', glow: 'text-emerald-400', activeBg: 'bg-emerald-500' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#F4F6F8] flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Flame className="w-6 h-6 animate-pulse" />
            </span>
            {isAr ? 'العادات اليومية' : 'Daily Habits'}
          </h1>
          <p className="text-xs text-[#8E99A8] mt-1">
            {isAr
              ? 'ابنِ انضباطك وحافظ على استمرارية أهدافك يوماً بيوم مع عداد السلاسل المتتالية.'
              : 'Build lasting discipline and track your daily streaks day by day.'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="min-h-[44px] px-5 rounded-xl bg-emerald-500 text-[#07110C] font-semibold text-sm hover:bg-emerald-400 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>{isAr ? 'إضافة عادة جديدة' : 'New Habit'}</span>
        </button>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Today's Completion Card */}
        <div className="bg-[#13171C] border border-[#232A33] rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#8E99A8]">
              {isAr ? 'إنجاز اليوم' : "Today's Progress"}
            </span>
            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
              {dailyPercentage}%
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-[#F4F6F8]">
              {completedTodayCount}
            </span>
            <span className="text-xs text-[#6C7787]">/ {totalCount} {isAr ? 'عادات' : 'habits'}</span>
          </div>
          <div className="w-full bg-[#1F2630] h-2 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${dailyPercentage}%` }}
            />
          </div>
        </div>

        {/* Longest Streak Card */}
        <div className="bg-[#13171C] border border-[#232A33] rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#8E99A8]">
              {isAr ? 'أطول سلسلة متتالية' : 'Best Streak'}
            </span>
            <Trophy className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-amber-400">
              {bestOverallStreak}
            </span>
            <span className="text-xs text-[#8E99A8]">{isAr ? 'أيام متتالية' : 'days'}</span>
          </div>
          <p className="text-[11px] text-[#6C7787]">
            {isAr ? 'الاستمرارية أهم من الكمال' : 'Consistency over perfection'}
          </p>
        </div>

        {/* Active Streaks Card */}
        <div className="bg-[#13171C] border border-[#232A33] rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#8E99A8]">
              {isAr ? 'عادات مستمرة حالياً' : 'Active Streaks'}
            </span>
            <TrendingUp className="w-4 h-4 text-blue-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-blue-400">
              {activeStreakCount}
            </span>
            <span className="text-xs text-[#8E99A8]">{isAr ? 'عادة نشطة' : 'habits'}</span>
          </div>
          <p className="text-[11px] text-[#6C7787]">
            {isAr ? 'سلسلة يومية مشتعلة 🔥' : 'Fire daily streaks'}
          </p>
        </div>
      </div>

      {/* Time-of-Day Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        {[
          { id: 'all', label: isAr ? 'جميع العادات' : 'All Habits' },
          { id: 'morning', label: isAr ? '🌅 الصباح' : '🌅 Morning' },
          { id: 'afternoon', label: isAr ? '☀️ الظهيرة' : '☀️ Afternoon' },
          { id: 'evening', label: isAr ? '🌙 المساء' : '🌙 Evening' },
          { id: 'anytime', label: isAr ? '⚡ طوال اليوم' : '⚡ Anytime' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilterTime(tab.id)}
            className={`px-3.5 py-2 rounded-xl font-medium whitespace-nowrap transition-colors ${
              filterTime === tab.id
                ? 'bg-[#1C232D] text-emerald-400 border border-emerald-500/40 shadow-sm'
                : 'text-[#8E99A8] hover:text-[#F4F6F8] hover:bg-[#141920]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Habits List */}
      {filteredHabits.length === 0 ? (
        <div className="text-center py-16 bg-[#13171C] border border-[#232A33] rounded-2xl p-8 space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#F4F6F8]">
              {isAr ? 'لا توجد عادات مسجلة في هذا القسم' : 'No habits found in this section'}
            </h2>
            <p className="text-xs text-[#8E99A8] mt-1 max-w-sm mx-auto">
              {isAr
                ? 'ابدأ بإضافة أول عادة يومية لك مثل شرب الماء، القراءة، أو التركيز لتتبع تقدمك.'
                : 'Start by creating your first daily habit to build consistent streaks.'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-4 py-2 rounded-xl bg-emerald-500 text-[#07110C] font-semibold text-xs inline-flex items-center gap-2 hover:bg-emerald-400"
          >
            <Plus className="w-4 h-4" />
            <span>{isAr ? 'إضافة أول عادة' : 'Add First Habit'}</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredHabits.map((habit) => {
            const isDoneToday = habit.completedDates.includes(todayStr);
            const colorCls = getColorClasses(habit.color);

            return (
              <div
                key={habit.id}
                className={`bg-[#13171C] border rounded-2xl p-4 sm:p-5 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  isDoneToday ? 'border-emerald-500/30 bg-[#131A17]/40' : 'border-[#232A33] hover:border-[#333D4B]'
                }`}
              >
                {/* Left: Checkbox + Title + Meta */}
                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => void toggleHabitForDate(habit.id, todayStr)}
                    aria-label={isDoneToday ? (isAr ? 'إلغاء التحديد' : 'Unmark') : (isAr ? 'تحديد كمنجز' : 'Mark done')}
                    className={`min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center transition-all shrink-0 ${
                      isDoneToday
                        ? 'bg-emerald-500 text-[#07110C] shadow-lg shadow-emerald-500/25 scale-105'
                        : 'border-2 border-[#333E4D] text-transparent hover:border-emerald-500/50 hover:bg-[#1A222B]'
                    }`}
                  >
                    <Check className={`w-5 h-5 stroke-[3] ${isDoneToday ? 'block' : 'opacity-0'}`} />
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2
                        className={`text-base font-semibold transition-colors ${
                          isDoneToday ? 'line-through text-[#8E99A8]' : 'text-[#F4F6F8]'
                        }`}
                      >
                        {habit.title}
                      </h2>

                      {/* Streak Flame Badge */}
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-mono font-bold">
                        <Flame className="w-3.5 h-3.5" />
                        <span>{habit.streak || 0}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs text-[#8E99A8]">
                      <span className={`px-2 py-0.5 rounded-md border text-[11px] font-medium ${colorCls.badge}`}>
                        {HABIT_CATEGORY_LABELS[habit.category]?.[lang] || habit.category}
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#6C7787]" />
                        {HABIT_TIME_OF_DAY_LABELS[habit.timeOfDay]?.[lang] || habit.timeOfDay}
                      </span>
                      {habit.notes ? (
                        <>
                          <span>·</span>
                          <span className="truncate max-w-[200px] text-[#6C7787]">{habit.notes}</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Right: Past 7 Days History Grid + Edit/Delete */}
                <div className="flex items-center justify-between sm:justify-end gap-4 border-t md:border-t-0 border-[#1E252E] pt-3 md:pt-0 shrink-0">
                  {/* 7 Days Mini Dot Grid */}
                  <div className="flex items-center gap-1.5">
                    {past7Days.map((day) => {
                      const completed = habit.completedDates.includes(day.dateStr);
                      return (
                        <button
                          key={day.dateStr}
                          type="button"
                          onClick={() => void toggleHabitForDate(habit.id, day.dateStr)}
                          title={`${day.dateStr} — ${completed ? (isAr ? 'منجزة' : 'Done') : (isAr ? 'غير منجزة' : 'Missed')}`}
                          className={`flex flex-col items-center gap-1 group`}
                        >
                          <span className="text-[9px] font-mono text-[#6C7787] group-hover:text-[#A9B3C1]">
                            {day.label}
                          </span>
                          <div
                            className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all text-[10px] ${
                              completed
                                ? 'bg-emerald-500 text-[#07110C] font-bold shadow-sm shadow-emerald-500/20'
                                : day.isToday
                                ? 'border border-dashed border-[#3D4958] bg-[#171D24] text-[#6C7787]'
                                : 'bg-[#181E26] text-transparent hover:bg-[#202732]'
                            }`}
                          >
                            {completed ? '✓' : ''}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 ps-2 border-s border-[#232A33]">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(habit)}
                      aria-label={isAr ? 'تعديل العادة' : 'Edit habit'}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[#8E99A8] hover:text-[#F4F6F8] hover:bg-[#1A222B]"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(isAr ? 'هل أنت متأكد من حذف هذه العادة؟' : 'Delete this habit?')) {
                          void deleteHabit(habit.id);
                        }
                      }}
                      aria-label={isAr ? 'حذف العادة' : 'Delete habit'}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[#8E99A8] hover:text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Habit Modal */}
      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg bg-[#13171C] border border-[#232A33] rounded-3xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#232A33]">
              <h2 className="text-lg font-bold text-[#F4F6F8]">
                {editingHabit
                  ? isAr ? 'تعديل العادة' : 'Edit Habit'
                  : isAr ? 'إضافة عادة يومية جديدة' : 'Add Daily Habit'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-[#8E99A8] hover:text-[#F4F6F8]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Presets (Only when adding) */}
            {!editingHabit ? (
              <div className="space-y-2">
                <span className="text-xs font-medium text-[#8E99A8] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  {isAr ? 'أفكار سريعة بنقرة واحدة:' : 'Quick Presets:'}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_HABITS.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectPreset(p)}
                      className="px-2.5 py-1 rounded-lg bg-[#181E26] border border-[#232A33] text-xs text-[#C8D0DC] hover:border-emerald-500/40 hover:text-emerald-400 transition-colors"
                    >
                      {p.title}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#8E99A8] mb-1.5">
                  {isAr ? 'اسم العادة اليومية *' : 'Habit Title *'}
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={isAr ? 'مثال: 💧 شرب 2 لتر ماء' : 'e.g., Read for 15 minutes'}
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm text-[#F4F6F8] focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-[#8E99A8] mb-1.5">
                    {isAr ? 'التصنيف' : 'Category'}
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as HabitCategory)}
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm text-[#F4F6F8] focus:outline-none focus:border-emerald-500"
                  >
                    <option value="health">{isAr ? 'صحة' : 'Health'}</option>
                    <option value="fitness">{isAr ? 'لياقة ورياضة' : 'Fitness'}</option>
                    <option value="productivity">{isAr ? 'إنتاجية وعمل' : 'Productivity'}</option>
                    <option value="learning">{isAr ? 'تعلم وتطوير' : 'Learning'}</option>
                    <option value="mindfulness">{isAr ? 'هدوء وتأمل' : 'Mindfulness'}</option>
                    <option value="personal">{isAr ? 'شخصي' : 'Personal'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#8E99A8] mb-1.5">
                    {isAr ? 'وقت التنفيذ المفضل' : 'Preferred Time'}
                  </label>
                  <select
                    value={timeOfDay}
                    onChange={(e) => setTimeOfDay(e.target.value as HabitTimeOfDay)}
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm text-[#F4F6F8] focus:outline-none focus:border-emerald-500"
                  >
                    <option value="anytime">{isAr ? 'طوال اليوم' : 'Anytime'}</option>
                    <option value="morning">{isAr ? 'الصباح 🌅' : 'Morning'}</option>
                    <option value="afternoon">{isAr ? 'الظهيرة ☀️' : 'Afternoon'}</option>
                    <option value="evening">{isAr ? 'المساء 🌙' : 'Evening'}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#8E99A8] mb-1.5">
                  {isAr ? 'اللون المميز' : 'Highlight Color'}
                </label>
                <div className="flex items-center gap-3">
                  {[
                    { id: 'emerald', bg: 'bg-emerald-500' },
                    { id: 'blue', bg: 'bg-blue-500' },
                    { id: 'amber', bg: 'bg-amber-500' },
                    { id: 'violet', bg: 'bg-violet-500' },
                    { id: 'rose', bg: 'bg-rose-500' },
                    { id: 'cyan', bg: 'bg-cyan-500' },
                  ].map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setColor(c.id)}
                      className={`w-7 h-7 rounded-full ${c.bg} transition-all ${
                        color === c.id ? 'ring-2 ring-white ring-offset-2 ring-offset-[#13171C] scale-110' : 'opacity-70 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#8E99A8] mb-1.5">
                  {isAr ? 'ملاحظة أو تذكير (اختياري)' : 'Notes (optional)'}
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={isAr ? 'مثال: بعد صلاة الفجر أو مع كوب الشاي' : 'e.g., right after morning coffee'}
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm text-[#F4F6F8] focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#232A33]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="min-h-[42px] px-4 rounded-xl border border-[#232A33] text-xs font-semibold text-[#8E99A8] hover:text-[#F4F6F8]"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="min-h-[42px] px-6 rounded-xl bg-emerald-500 text-[#07110C] font-semibold text-xs hover:bg-emerald-400 shadow-md shadow-emerald-500/20"
                >
                  {editingHabit ? (isAr ? 'حفظ التعديلات' : 'Save Changes') : (isAr ? 'إضافة العادة' : 'Add Habit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};
