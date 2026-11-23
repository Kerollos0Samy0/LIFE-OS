import React, { useEffect, useState } from 'react';
import { Check, Target, Trash2, X } from 'lucide-react';
import { useLifeOs } from '../context/LifeOsContext';
import { TODAY_ISO } from '../data/seedData';
import type { DailyMicroGoal, MicroGoalCategory } from '../types/lifeos';

interface DailyMicroGoalModalProps {
  open: boolean;
  onClose: () => void;
  existingGoal: DailyMicroGoal | null;
}

const CATEGORY_OPTIONS: Array<{ id: MicroGoalCategory; ar: string; en: string }> = [
  { id: 'focus', ar: 'التركيز', en: 'Focus' },
  { id: 'finance', ar: 'الماليات', en: 'Finance' },
  { id: 'health', ar: 'الصحة', en: 'Health' },
  { id: 'wellbeing', ar: 'التوازن الرقمي', en: 'Wellbeing' },
  { id: 'personal', ar: 'شخصي', en: 'Personal' },
];

interface MicroGoalTemplate {
  category: MicroGoalCategory;
  targetValue: number;
  titleAr: string;
  unitAr: string;
  titleEn: string;
  unitEn: string;
}

const QUICK_TEMPLATES: MicroGoalTemplate[] = [
  {
    category: 'focus',
    targetValue: 90,
    titleAr: 'إنجاز 90 دقيقة تركيز عميق قبل الظهر',
    unitAr: 'دقيقة',
    titleEn: 'Complete 90 minutes of deep work before noon',
    unitEn: 'min',
  },
  {
    category: 'health',
    targetValue: 8000,
    titleAr: 'المشي 8,000 خطوة اليوم',
    unitAr: 'خطوة',
    titleEn: 'Walk 8,000 steps today',
    unitEn: 'steps',
  },
  {
    category: 'finance',
    targetValue: 3,
    titleAr: 'مراجعة وتسجيل كل مصاريف اليوم بدون استثناء',
    unitAr: 'مراجعة',
    titleEn: 'Log and review all daily expenses',
    unitEn: 'checks',
  },
  {
    category: 'wellbeing',
    targetValue: 30,
    titleAr: 'قراءة 30 صفحة قبل النوم بدل السوشيال ميديا',
    unitAr: 'صفحة',
    titleEn: 'Read 30 pages before bed instead of scrolling',
    unitEn: 'pages',
  },
];

export const DailyMicroGoalModal: React.FC<DailyMicroGoalModalProps> = ({
  open,
  onClose,
  existingGoal,
}) => {
  const { lang, upsertDailyMicroGoal, deleteDailyMicroGoal } = useLifeOs();
  const isAr = lang === 'ar';

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<MicroGoalCategory>('focus');
  const [targetValue, setTargetValue] = useState<string>('90');
  const [currentValue, setCurrentValue] = useState<string>('0');
  const [unit, setUnit] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    if (existingGoal) {
      setTitle(existingGoal.title);
      setCategory(existingGoal.category);
      setTargetValue(String(existingGoal.targetValue));
      setCurrentValue(String(existingGoal.currentValue));
      setUnit(existingGoal.unit);
    } else {
      setTitle('');
      setCategory('focus');
      setTargetValue('60');
      setCurrentValue('0');
      setUnit(isAr ? 'دقيقة' : 'min');
    }
  }, [open, existingGoal, isAr]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const applyTemplate = (tpl: MicroGoalTemplate) => {
    setTitle(isAr ? tpl.titleAr : tpl.titleEn);
    setCategory(tpl.category);
    setTargetValue(String(tpl.targetValue));
    setUnit(isAr ? tpl.unitAr : tpl.unitEn);
    setCurrentValue('0');
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    const cleanUnit = unit.trim();
    const parsedTarget = Number(targetValue);
    const parsedCurrent = Number(currentValue);

    if (!cleanTitle) {
      setErrorMsg(isAr ? 'يرجى كتابة عنوان واضح لهدف اليوم المصغّر.' : 'Please enter a clear title for your daily micro-goal.');
      return;
    }
    if (!Number.isFinite(parsedTarget) || parsedTarget < 1 || parsedTarget > 100000) {
      setErrorMsg(isAr ? 'يجب أن يكون الرقم المستهدف بين 1 و 100,000.' : 'Target value must be between 1 and 100,000.');
      return;
    }
    if (!Number.isFinite(parsedCurrent) || parsedCurrent < 0 || parsedCurrent > 100000) {
      setErrorMsg(isAr ? 'يجب أن يكون التقدم الحالي رقماً صحيحاً غير سالب.' : 'Current progress must be a valid non-negative number.');
      return;
    }
    if (!cleanUnit) {
      setErrorMsg(isAr ? 'يرجى تحديد وحدة القياس (مثل: دقيقة، خطوة، صفحة).' : 'Please specify a unit (e.g. min, steps, pages).');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    try {
      await upsertDailyMicroGoal({
        date: TODAY_ISO,
        title: cleanTitle.slice(0, 140),
        category,
        targetValue: Math.round(parsedTarget),
        currentValue: Math.round(parsedCurrent),
        unit: cleanUnit.slice(0, 32),
        completed: Math.round(parsedCurrent) >= Math.round(parsedTarget),
      });
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : isAr ? 'تعذّر حفظ الهدف.' : 'Could not save micro-goal.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existingGoal) return;
    setIsSaving(true);
    try {
      await deleteDailyMicroGoal(existingGoal.id);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-micro-goal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg bg-[#13171C] border border-[#232A33] rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="daily-micro-goal-title"
              className="text-base font-semibold text-[#F4F6F8] flex items-center gap-2"
            >
              <Target className="w-4 h-4 text-emerald-400 shrink-0" />
              {existingGoal
                ? isAr
                  ? 'تعديل هدف اليوم المصغّر'
                  : 'Edit Daily Micro-Goal'
                : isAr
                  ? 'تحديد هدف اليوم المصغّر'
                  : 'Set Daily Micro-Goal'}
            </h2>
            <p className="text-xs text-[#8E99A8] mt-1">
              {isAr
                ? `هدف واحد قابل للقياس ليوم ${TODAY_ISO} يظهر أعلى لوحة التحكم لمتابعة تقدمك.`
                : `One focused, measurable target for ${TODAY_ISO} pinned to the top of your dashboard.`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={isAr ? 'إغلاق' : 'Close'}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#8E99A8] hover:text-[#F4F6F8] hover:bg-[#1C222B] transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Presets */}
        <div className="space-y-2">
          <p className="text-xs text-[#8E99A8]">
            {isAr ? 'اقتراحات سريعة لليوم' : 'Quick presets for today'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {QUICK_TEMPLATES.map((tpl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => applyTemplate(tpl)}
                className="min-h-[40px] px-3 py-2 rounded-xl bg-[#0B0D10] border border-[#232A33] hover:border-emerald-500/50 text-start transition-colors"
              >
                <p className="text-xs font-medium text-[#E2E8F0] truncate">
                  {isAr ? tpl.titleAr : tpl.titleEn}
                </p>
                <p className="text-[11px] text-[#758091] tabular-nums mt-0.5">
                  {tpl.targetValue.toLocaleString('en-US')} {isAr ? tpl.unitAr : tpl.unitEn}
                </p>
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category Segmented Control */}
          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-[#A9B3C1]">
              {isAr ? 'المجال' : 'Area'}
            </span>
            <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-[#0B0D10] border border-[#232A33]">
              {CATEGORY_OPTIONS.map((opt) => {
                const active = category === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setCategory(opt.id)}
                    aria-pressed={active}
                    className={`flex-1 min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'text-[#8E99A8] hover:text-[#F4F6F8]'
                    }`}
                  >
                    {isAr ? opt.ar : opt.en}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Goal Title */}
          <div>
            <label htmlFor="micro-goal-title-input" className="block text-xs font-medium text-[#A9B3C1] mb-1.5">
              {isAr ? 'عنوان الهدف المصغّر' : 'Micro-Goal Title'}
            </label>
            <input
              id="micro-goal-title-input"
              type="text"
              maxLength={140}
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                isAr
                  ? 'مثال: إنهاء 90 دقيقة تركيز عميق بدون مقاطعة'
                  : 'e.g., Complete 90 minutes of uninterrupted deep work'
              }
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm text-[#F4F6F8] placeholder:text-[#5E6877] focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Target, Current & Unit */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="micro-goal-target" className="block text-xs text-[#8E99A8] mb-1.5">
                {isAr ? 'المستهدف' : 'Target'}
              </label>
              <input
                id="micro-goal-target"
                type="number"
                min={1}
                max={100000}
                required
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm font-mono-nums text-[#F4F6F8] focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label htmlFor="micro-goal-current" className="block text-xs text-[#8E99A8] mb-1.5">
                {isAr ? 'الحالي' : 'Current'}
              </label>
              <input
                id="micro-goal-current"
                type="number"
                min={0}
                max={100000}
                required
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm font-mono-nums text-[#F4F6F8] focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label htmlFor="micro-goal-unit" className="block text-xs text-[#8E99A8] mb-1.5">
                {isAr ? 'الوحدة' : 'Unit'}
              </label>
              <input
                id="micro-goal-unit"
                type="text"
                maxLength={32}
                required
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder={isAr ? 'دقيقة' : 'min'}
                className="w-full min-h-[44px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm text-[#F4F6F8] placeholder:text-[#5E6877] focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {errorMsg ? (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300">
              {errorMsg}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3 pt-2 border-t border-[#232A33]">
            {existingGoal ? (
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={isSaving}
                className="min-h-[44px] px-3.5 rounded-xl border border-red-500/30 text-red-300 hover:bg-red-500/10 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isAr ? 'مسح الهدف' : 'Clear Goal'}
              </button>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-4 rounded-xl border border-[#232A33] text-sm text-[#C8D0DC] hover:bg-[#1B212A] transition-colors whitespace-nowrap"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="min-h-[44px] px-5 rounded-xl bg-emerald-500 text-[#07110C] font-semibold text-sm hover:bg-emerald-400 disabled:opacity-50 transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                <Check className="w-4 h-4" />
                {isAr ? 'حفظ هدف اليوم' : 'Save Micro-Goal'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
