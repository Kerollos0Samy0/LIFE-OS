import React, { useState } from 'react';
import { Check, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useLifeOs } from '../context/LifeOsContext';
import { TODAY_ISO } from '../data/seedData';
import { GOAL_CATEGORY_LABELS } from '../i18n/translations';
import type { GoalCategory, PersonalGoal } from '../types/lifeos';

export const GoalsModule: React.FC = () => {
  const { data, lang, addGoal, toggleGoalMilestone, appendGoalMilestones, deleteGoal, recordAiUsage } = useLifeOs();
  const isAr = lang === 'ar';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<GoalCategory>('financial');
  const [targetLabel, setTargetLabel] = useState('');
  const [deadline, setDeadline] = useState('2027-06-01');
  const [suggestingGoalId, setSuggestingGoalId] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !targetLabel.trim()) return;
    await addGoal({
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      targetLabel: targetLabel.trim(),
      startDate: TODAY_ISO,
      deadline,
      progress: 0,
      milestones: [
        { id: `ms-init-${Date.now()}`, title: isAr ? 'تحديد خطة الأسبوع الأول' : 'Define week-1 action plan', completed: false },
      ],
    });
    setTitle('');
    setDescription('');
    setTargetLabel('');
  };

  const handleAiMilestones = async (goal: PersonalGoal) => {
    setSuggestingGoalId(goal.id);
    setAiError(null);
    try {
      const res = await fetch('/api/ai/goal-milestones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: goal.title,
          category: goal.category,
          targetLabel: goal.targetLabel,
          language: lang,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to suggest milestones');
      if (json.tokensUsed) recordAiUsage('gemini-3.1-flash-lite', json.tokensUsed);
      if (Array.isArray(json.milestones) && json.milestones.length > 0) {
        await appendGoalMilestones(goal.id, json.milestones);
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Error suggesting milestones');
    } finally {
      setSuggestingGoalId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#F4F6F8]">{isAr ? 'الأهداف الشخصية' : 'Personal Goals'}</h1>
        <p className="text-xs text-[#8E99A8] mt-1">
          {isAr
            ? 'إدارة أهدافك المالية والمهنية والتعليمية والصحية والشخصية مع اقتراح خطوات عملية عبر Gemini.'
            : 'Track financial, professional, educational, health, personal, and social goals with Gemini milestone suggestions.'}
        </p>
      </div>

      {aiError ? (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300">{aiError}</div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <form onSubmit={handleAddGoal} className="lg:col-span-4 bg-[#13171C] border border-[#232A33] rounded-2xl p-5 space-y-4 self-start">
          <h2 className="text-sm font-semibold text-[#F4F6F8]">{isAr ? 'إضافة هدف جديد' : 'Create Personal Goal'}</h2>
          <div>
            <label htmlFor="goal-title" className="block text-xs text-[#8E99A8] mb-1">{isAr ? 'عنوان الهدف' : 'Goal Title'}</label>
            <input
              id="goal-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isAr ? 'مثال: إتقان تطوير تطبيقات الموبايل' : 'e.g., Ship side project MVP'}
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm text-[#F4F6F8]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="goal-cat" className="block text-xs text-[#8E99A8] mb-1">{isAr ? 'الفئة' : 'Category'}</label>
              <select
                id="goal-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value as GoalCategory)}
                className="w-full min-h-[44px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm text-[#F4F6F8]"
              >
                {(Object.keys(GOAL_CATEGORY_LABELS) as GoalCategory[]).map((c) => (
                  <option key={c} value={c}>{GOAL_CATEGORY_LABELS[c][lang]}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="goal-dl" className="block text-xs text-[#8E99A8] mb-1">{isAr ? 'الموعد المستهدف' : 'Deadline'}</label>
              <input
                id="goal-dl"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-xs font-mono-nums text-[#F4F6F8]"
              />
            </div>
          </div>
          <div>
            <label htmlFor="goal-target" className="block text-xs text-[#8E99A8] mb-1">{isAr ? 'المعيار المستهدف' : 'Measurable Target'}</label>
            <input
              id="goal-target"
              type="text"
              value={targetLabel}
              onChange={(e) => setTargetLabel(e.target.value)}
              placeholder={isAr ? 'مثال: 50,000 ج.م أو 3 شهادات' : 'e.g., 50,000 EGP or 3 courses'}
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm text-[#F4F6F8]"
            />
          </div>
          <div>
            <label htmlFor="goal-desc" className="block text-xs text-[#8E99A8] mb-1">{isAr ? 'الوصف (اختياري)' : 'Description (Optional)'}</label>
            <textarea
              id="goal-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm text-[#F4F6F8]"
            />
          </div>
          <button type="submit" className="w-full min-h-[44px] rounded-xl bg-emerald-500 text-[#07110C] font-semibold text-sm hover:bg-emerald-400 flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" />
            {isAr ? 'حفظ الهدف' : 'Save Goal'}
          </button>
        </form>

        <div className="lg:col-span-8 space-y-4">
          {data.goals.map((goal) => (
            <div key={goal.id} className="bg-[#13171C] border border-[#232A33] rounded-2xl p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-[#8E99A8]">
                    {GOAL_CATEGORY_LABELS[goal.category][lang]} · {goal.targetLabel} ·{' '}
                    <span className="font-mono-nums">{goal.deadline}</span>
                  </p>
                  <h3 className="text-base font-semibold text-[#F4F6F8] mt-1">{goal.title}</h3>
                  {goal.description ? <p className="text-xs text-[#A9B3C1] mt-1">{goal.description}</p> : null}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={suggestingGoalId === goal.id}
                    onClick={() => void handleAiMilestones(goal)}
                    className="min-h-[36px] px-3 rounded-xl border border-[#2A3340] text-xs font-medium text-emerald-400 hover:bg-[#1A212B] flex items-center gap-1.5 whitespace-nowrap"
                  >
                    {suggestingGoalId === goal.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    {isAr ? 'اقتراح خطوات AI' : 'AI Milestones'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteGoal(goal.id)}
                    aria-label={`${isAr ? 'حذف هدف' : 'Delete goal'} ${goal.title}`}
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[#758091] hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono-nums">
                  <span className="text-[#8E99A8]">{isAr ? 'نسبة الإنجاز' : 'Progress'}</span>
                  <span className="text-emerald-400 font-semibold">{goal.progress}%</span>
                </div>
                <div className="h-2 rounded-full bg-[#0B0D10] overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${goal.progress}%` }} />
                </div>
              </div>

              <div className="pt-3 border-t border-[#232A33] space-y-2">
                {goal.milestones.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => void toggleGoalMilestone(goal.id, m.id)}
                    className="w-full flex items-center gap-2.5 text-start text-xs py-1.5 hover:text-[#F4F6F8] transition-colors"
                  >
                    <span
                      className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                        m.completed ? 'bg-emerald-500 border-emerald-500 text-[#07110C]' : 'border-[#33404F] text-transparent'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </span>
                    <span className={m.completed ? 'line-through text-[#6C7787]' : 'text-[#D2DAE5]'}>{m.title}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
