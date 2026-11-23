import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, Moon, Watch, Zap } from 'lucide-react';
import { useLifeOs } from '../context/LifeOsContext';
import { TODAY_ISO } from '../data/seedData';
import { calculateEnergyEstimate } from '../utils/energy';
import { UI_TEXT } from '../i18n/translations';

type HealthSubTab = 'overview' | 'energy' | 'band';

export const HealthEnergyModule: React.FC = () => {
  const { data, lang, upsertHealthLog, addEnergyLog } = useLifeOs();
  const isAr = lang === 'ar';
  const [subTab, setSubTab] = useState<HealthSubTab>('overview');

  // Health manual log form
  const [logDate, setLogDate] = useState(TODAY_ISO);
  const [sleepHours, setSleepHours] = useState('6.0');
  const [sleepBedtime, setSleepBedtime] = useState('01:00');
  const [steps, setSteps] = useState('7500');
  const [activeCalories, setActiveCalories] = useState('350');
  const [restingHr, setRestingHr] = useState('64');
  const [healthSaved, setHealthSaved] = useState(false);

  // Energy check-in form
  const [energyLevel, setEnergyLevel] = useState(7);
  const [moodLevel, setMoodLevel] = useState(7);
  const [focusLevel, setFocusLevel] = useState(8);
  const [stressLevel, setStressLevel] = useState(4);
  const [energyNotes, setEnergyNotes] = useState('');
  const [energySaved, setEnergySaved] = useState(false);

  const sortedHealth = useMemo(
    () => [...data.healthLogs].sort((a, b) => a.date.localeCompare(b.date)),
    [data.healthLogs],
  );
  const latestHealth = sortedHealth[sortedHealth.length - 1] || null;

  const avgSleep = useMemo(() => {
    const vals = sortedHealth.map((h) => h.sleepHours).filter((v): v is number => typeof v === 'number');
    if (vals.length === 0) return null;
    return Number((vals.reduce((s, x) => s + x, 0) / vals.length).toFixed(1));
  }, [sortedHealth]);

  const energyEstimate = useMemo(
    () =>
      calculateEnergyEstimate({
        healthLogs: data.healthLogs,
        appUsageLogs: data.appUsageLogs,
        energyLogs: data.energyLogs,
        dailyStepTarget: data.profile.dailyStepTarget,
        targetSleepHours: data.profile.targetSleepHours,
        peakConcentration: data.profile.peakConcentration,
      }),
    [data],
  );

  const handleSaveHealth = async (e: React.FormEvent) => {
    e.preventDefault();
    await upsertHealthLog({
      date: logDate,
      sleepHours: sleepHours !== '' ? Number(sleepHours) : undefined,
      sleepBedtime: sleepBedtime || undefined,
      steps: steps !== '' ? Number(steps) : undefined,
      activeCalories: activeCalories !== '' ? Number(activeCalories) : undefined,
      restingHeartRate: restingHr !== '' ? Number(restingHr) : undefined,
      source: 'manual',
    });
    setHealthSaved(true);
    setTimeout(() => setHealthSaved(false), 1800);
  };

  const handleSaveEnergy = async (e: React.FormEvent) => {
    e.preventDefault();
    await addEnergyLog({
      date: TODAY_ISO,
      energyLevel,
      moodLevel,
      focusLevel,
      stressLevel,
      notes: energyNotes.trim() || undefined,
    });
    setEnergyNotes('');
    setEnergySaved(true);
    setTimeout(() => setEnergySaved(false), 1800);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#F4F6F8]">
          {isAr ? 'الصحة واللياقة وذكاء الطاقة' : 'Health, Fitness & Energy Intelligence'}
        </h1>
        <p className="text-xs text-[#8E99A8] mt-1">{UI_TEXT[lang].common.nonMedicalNotice}</p>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {(
          [
            { id: 'overview', label: isAr ? 'النوم والنشاط' : 'Sleep & Activity' },
            { id: 'energy', label: isAr ? 'ذكاء الطاقة والتسجيل اليومي' : 'Energy Intelligence' },
            { id: 'band', label: isAr ? 'Xiaomi Band و Health Connect' : 'Xiaomi Band & Health Connect' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id)}
            className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              subTab === t.id
                ? 'bg-emerald-500 text-[#07110C]'
                : 'bg-[#13171C] border border-[#232A33] text-[#A9B3C1] hover:text-[#F4F6F8]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* SUBTAB 1: SLEEP & ACTIVITY */}
      {subTab === 'overview' ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#13171C] border border-[#232A33] rounded-2xl p-4">
              <p className="text-xs text-[#8E99A8] flex items-center gap-1.5">
                <Moon className="w-3.5 h-3.5 text-emerald-400" />
                {isAr ? 'متوسط النوم (7 أيام)' : 'Avg Sleep (7d)'}
              </p>
              <p className="text-xl font-bold font-mono-nums text-[#F4F6F8] mt-1">
                {avgSleep !== null ? `${avgSleep} ${isAr ? 'ساعة' : 'h'}` : UI_TEXT[lang].common.unavailable}
              </p>
              <p className="text-[11px] text-[#758091] mt-1">
                {isAr ? 'انتظام النوم:' : 'Consistency:'}{' '}
                {energyEstimate.measuredFactors.sleepConsistencyPercent !== null
                  ? `${energyEstimate.measuredFactors.sleepConsistencyPercent}%`
                  : UI_TEXT[lang].common.unavailable}
              </p>
            </div>
            <div className="bg-[#13171C] border border-[#232A33] rounded-2xl p-4">
              <p className="text-xs text-[#8E99A8] flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                {isAr ? 'خطوات آخر يوم' : 'Latest Steps'}
              </p>
              <p className="text-xl font-bold font-mono-nums text-[#F4F6F8] mt-1">
                {latestHealth?.steps != null ? latestHealth.steps.toLocaleString('en-US') : UI_TEXT[lang].common.unavailable}
              </p>
              <p className="text-[11px] text-[#758091] font-mono-nums mt-1">
                {isAr ? 'الهدف اليومي:' : 'Target:'} {data.profile.dailyStepTarget.toLocaleString('en-US')}
              </p>
            </div>
            <div className="bg-[#13171C] border border-[#232A33] rounded-2xl p-4">
              <p className="text-xs text-[#8E99A8]">{isAr ? 'سعرات نشطة (منفصلة عن الإجمالي)' : 'Active Calories Only'}</p>
              <p className="text-xl font-bold font-mono-nums text-[#F4F6F8] mt-1">
                {latestHealth?.activeCalories != null ? `${latestHealth.activeCalories} kcal` : UI_TEXT[lang].common.unavailable}
              </p>
              <p className="text-[11px] text-[#758091] mt-1">
                {isAr ? 'المصدر: إدخال يدوي' : 'Source: Manual log'}
              </p>
            </div>
            <div className="bg-[#13171C] border border-[#232A33] rounded-2xl p-4">
              <p className="text-xs text-[#8E99A8]">{isAr ? 'نبض الراحة' : 'Resting Heart Rate'}</p>
              <p className="text-xl font-bold font-mono-nums text-[#F4F6F8] mt-1">
                {latestHealth?.restingHeartRate != null ? `${latestHealth.restingHeartRate} bpm` : UI_TEXT[lang].common.unavailable}
              </p>
              <p className="text-[11px] text-[#758091] font-mono-nums mt-1">
                {latestHealth?.date || '—'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 space-y-5">
              <div className="bg-[#13171C] border border-[#232A33] rounded-2xl p-5 space-y-3">
                <h2 className="text-sm font-semibold text-[#F4F6F8]">{isAr ? 'منحنى ساعات النوم الأسبوعي' : 'Weekly Sleep Duration (Hours)'}</h2>
                <div className="h-52 w-full" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sortedHealth} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid stroke="#232A33" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} tick={{ fill: '#8E99A8', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 10]} tick={{ fill: '#8E99A8', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#0B0D10', border: '1px solid #232A33', borderRadius: 12, color: '#F4F6F8', fontSize: 12 }} />
                      <Area type="monotone" dataKey="sleepHours" stroke="#34D399" fill="#34D399" fillOpacity={0.18} strokeWidth={2} isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-[#13171C] border border-[#232A33] rounded-2xl p-5 space-y-3">
                <h2 className="text-sm font-semibold text-[#F4F6F8]">{isAr ? 'الخطوات اليومية' : 'Daily Steps Pattern'}</h2>
                <div className="h-52 w-full" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sortedHealth} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                      <CartesianGrid stroke="#232A33" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} tick={{ fill: '#8E99A8', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#8E99A8', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#0B0D10', border: '1px solid #232A33', borderRadius: 12, color: '#F4F6F8', fontSize: 12 }} />
                      <Bar dataKey="steps" fill="#34D399" radius={[6, 6, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveHealth} className="lg:col-span-5 bg-[#13171C] border border-[#232A33] rounded-2xl p-5 space-y-4 self-start">
              <div>
                <h2 className="text-sm font-semibold text-[#F4F6F8]">{isAr ? 'تسجيل قياسات اليوم يدوياً' : 'Log Daily Health Metrics'}</h2>
                <p className="text-xs text-[#8E99A8] mt-0.5">
                  {isAr ? 'يُحفظ بمصدر "إدخال يدوي" وتوقيت واضح لكل قياس.' : 'Saved with explicit manual source & date timestamp.'}
                </p>
              </div>
              <div>
                <label htmlFor="hl-date" className="block text-xs text-[#8E99A8] mb-1">{isAr ? 'التاريخ' : 'Date'}</label>
                <input id="hl-date" type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} className="w-full min-h-[42px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm font-mono-nums text-[#F4F6F8]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="hl-sleep" className="block text-xs text-[#8E99A8] mb-1">{isAr ? 'ساعات النوم' : 'Sleep Hours'}</label>
                  <input id="hl-sleep" type="number" step="0.1" value={sleepHours} onChange={(e) => setSleepHours(e.target.value)} className="w-full min-h-[42px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm font-mono-nums text-[#F4F6F8]" />
                </div>
                <div>
                  <label htmlFor="hl-bed" className="block text-xs text-[#8E99A8] mb-1">{isAr ? 'وقت النوم' : 'Bedtime'}</label>
                  <input id="hl-bed" type="time" value={sleepBedtime} onChange={(e) => setSleepBedtime(e.target.value)} className="w-full min-h-[42px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm font-mono-nums text-[#F4F6F8]" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label htmlFor="hl-steps" className="block text-xs text-[#8E99A8] mb-1">{isAr ? 'الخطوات' : 'Steps'}</label>
                  <input id="hl-steps" type="number" value={steps} onChange={(e) => setSteps(e.target.value)} className="w-full min-h-[42px] px-2.5 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm font-mono-nums text-[#F4F6F8]" />
                </div>
                <div>
                  <label htmlFor="hl-cal" className="block text-xs text-[#8E99A8] mb-1">{isAr ? 'سعرات نشطة' : 'Active kcal'}</label>
                  <input id="hl-cal" type="number" value={activeCalories} onChange={(e) => setActiveCalories(e.target.value)} className="w-full min-h-[42px] px-2.5 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm font-mono-nums text-[#F4F6F8]" />
                </div>
                <div>
                  <label htmlFor="hl-hr" className="block text-xs text-[#8E99A8] mb-1">{isAr ? 'نبض الراحة' : 'Resting HR'}</label>
                  <input id="hl-hr" type="number" value={restingHr} onChange={(e) => setRestingHr(e.target.value)} className="w-full min-h-[42px] px-2.5 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm font-mono-nums text-[#F4F6F8]" />
                </div>
              </div>
              <button type="submit" className="w-full min-h-[44px] rounded-xl bg-emerald-500 text-[#07110C] font-semibold text-sm hover:bg-emerald-400">
                {healthSaved ? (isAr ? 'تم حفظ السجل الصحي' : 'Health Log Saved') : (isAr ? 'حفظ السجل الصحي' : 'Save Health Log')}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {/* SUBTAB 2: ENERGY INTELLIGENCE */}
      {subTab === 'energy' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 bg-[#13171C] border border-[#232A33] rounded-2xl p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-[#8E99A8] flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-emerald-400" />
                  {isAr ? 'نموذج تقدير الطاقة الشفاف (مقارنة بخط أساسك الشخصي)' : 'Transparent Personal Energy Model'}
                </p>
                <p className="text-4xl font-bold font-mono-nums text-emerald-400 mt-2" data-testid="energy-score-value">
                  {energyEstimate.estimatedScore !== null ? `${energyEstimate.estimatedScore}%` : UI_TEXT[lang].common.unavailable}
                </p>
              </div>
              <div className="text-end text-xs">
                <p className="text-[#8E99A8]">{isAr ? 'تقدم خط الأساس (30 يوماً)' : '30-Day Baseline'}</p>
                <p className="font-mono-nums text-sm font-semibold text-[#F4F6F8] mt-0.5">
                  {energyEstimate.baselineDaysLogged} / {energyEstimate.baselineTargetDays}
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-[#232A33] space-y-3 text-xs">
              <p className="font-semibold text-[#F4F6F8]">{isAr ? 'بيانات مقاسة / مسجلة (Measured Data)' : 'Measured / Logged Inputs'}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-[#8E99A8]">{isAr ? 'النوم' : 'Sleep'}</span>
                  <p className="font-mono-nums text-sm text-[#F4F6F8] mt-0.5">
                    {energyEstimate.measuredFactors.sleepHours !== null ? `${energyEstimate.measuredFactors.sleepHours}h` : UI_TEXT[lang].common.unavailable}
                  </p>
                </div>
                <div>
                  <span className="text-[#8E99A8]">{isAr ? 'الخطوات' : 'Steps'}</span>
                  <p className="font-mono-nums text-sm text-[#F4F6F8] mt-0.5">
                    {energyEstimate.measuredFactors.steps !== null ? energyEstimate.measuredFactors.steps.toLocaleString('en-US') : UI_TEXT[lang].common.unavailable}
                  </p>
                </div>
                <div>
                  <span className="text-[#8E99A8]">{isAr ? 'شاشة الليل' : 'Night Screen'}</span>
                  <p className="font-mono-nums text-sm text-[#F4F6F8] mt-0.5">
                    {energyEstimate.measuredFactors.nighttimeScreenMinutes !== null
                      ? `${energyEstimate.measuredFactors.nighttimeScreenMinutes}m`
                      : UI_TEXT[lang].common.unavailable}
                  </p>
                </div>
                <div>
                  <span className="text-[#8E99A8]">{isAr ? 'تقييمك الذاتي' : 'Self-Report'}</span>
                  <p className="font-mono-nums text-sm text-[#F4F6F8] mt-0.5">
                    {energyEstimate.selfReportedEnergy !== null ? `${energyEstimate.selfReportedEnergy}/10` : UI_TEXT[lang].common.unavailable}
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#232A33] space-y-2 text-xs">
              <p className="font-semibold text-emerald-400">{isAr ? 'استنتاجات وتوصيات عملية (Inferred Insights)' : 'Inferred Practical Suggestions'}</p>
              {(isAr ? energyEstimate.recommendationsAr : energyEstimate.recommendationsEn).map((r, i) => (
                <p key={i} className="text-[#D2DAE5] leading-relaxed">• {r}</p>
              ))}
            </div>
          </div>

          <form onSubmit={handleSaveEnergy} className="lg:col-span-5 bg-[#13171C] border border-[#232A33] rounded-2xl p-5 space-y-4 self-start">
            <h2 className="text-sm font-semibold text-[#F4F6F8]">{isAr ? 'تسجيل حالتك اليومية (Self Check-in)' : 'Daily Energy & Mood Check-in'}</h2>
            {(
              [
                { label: isAr ? 'مستوى الطاقة' : 'Energy Level', val: energyLevel, set: setEnergyLevel, id: 'en-lvl' },
                { label: isAr ? 'المزاج العام' : 'Mood', val: moodLevel, set: setMoodLevel, id: 'mood-lvl' },
                { label: isAr ? 'التركيز' : 'Focus', val: focusLevel, set: setFocusLevel, id: 'focus-lvl' },
                { label: isAr ? 'الإجهاد / التوتر' : 'Perceived Stress', val: stressLevel, set: setStressLevel, id: 'stress-lvl' },
              ] as const
            ).map((slider) => (
              <div key={slider.id} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <label htmlFor={slider.id} className="text-[#A9B3C1]">{slider.label}</label>
                  <span className="font-mono-nums text-[#F4F6F8] font-semibold">{slider.val} / 10</span>
                </div>
                <input
                  id={slider.id}
                  type="range"
                  min={1}
                  max={10}
                  value={slider.val}
                  onChange={(e) => slider.set(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>
            ))}

            <div>
              <label htmlFor="en-notes" className="block text-xs text-[#8E99A8] mb-1">{isAr ? 'ملاحظة سريعة' : 'Quick Note'}</label>
              <input
                id="en-notes"
                type="text"
                value={energyNotes}
                onChange={(e) => setEnergyNotes(e.target.value)}
                placeholder={isAr ? 'مثال: تركيز الصبح عالي بعد قهوة خفيفة' : 'e.g., Sharp morning focus'}
                className="w-full min-h-[42px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm text-[#F4F6F8]"
              />
            </div>

            <button type="submit" className="w-full min-h-[44px] rounded-xl bg-emerald-500 text-[#07110C] font-semibold text-sm hover:bg-emerald-400">
              {energySaved ? (isAr ? 'تم تسجيل التقييم' : 'Check-in Saved') : (isAr ? 'حفظ التقييم اليومي' : 'Save Daily Check-in')}
            </button>
          </form>
        </div>
      ) : null}

      {/* SUBTAB 3: XIAOMI SMART BAND & HEALTH CONNECT */}
      {subTab === 'band' ? (
        <div className="bg-[#13171C] border border-[#232A33] rounded-2xl p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <Watch className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-base font-semibold text-[#F4F6F8]">
                  {isAr ? 'Xiaomi Smart Band عبر Android Health Connect' : 'Xiaomi Smart Band via Android Health Connect'}
                </h2>
                <p className="text-xs text-[#8E99A8] mt-1 leading-relaxed">
                  {isAr
                    ? 'الحالة الحالية على متصفح الويب: غير متصل تلقائياً (يتطلب تطبيق Android أصلي مع Android Health Connect + Mi Fitness).'
                    : 'Current Web Runtime Status: Not auto-connected (requires native Android app with Android Health Connect + Mi Fitness companion).'}
                </p>
              </div>
            </div>
            <span className="text-xs font-medium text-amber-400 whitespace-nowrap">
              {isAr ? 'يتطلب Android' : 'Android Required'}
            </span>
          </div>

          <div className="pt-4 border-t border-[#232A33] grid grid-cols-1 md:grid-cols-2 gap-5 text-xs text-[#A9B3C1]">
            <div className="space-y-2">
              <p className="font-semibold text-[#F4F6F8]">{isAr ? 'مسار الربط الصحيح والموثوق' : 'Supported Standardized Integration Path'}</p>
              <p className="leading-relaxed">
                {isAr
                  ? 'لا تعتمد أجهزة Xiaomi Smart Band على API عام مباشر لكل القياسات؛ لذلك يعتمد LIFE OS على Android Health Connect كطبقة قياسية بعد تفعيل المزامنة داخل Mi Fitness.'
                  : 'Xiaomi wearables do not expose every metric through a public cloud API; LIFE OS uses Android Health Connect as the standardized layer synced from Mi Fitness.'}
              </p>
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-[#F4F6F8]">{isAr ? 'المقاييس المدعومة عند تفعيل الإذن' : 'Permissions & Metric Transparency'}</p>
              <p className="leading-relaxed">
                {isAr
                  ? 'النوم وجلساته · الخطوات والمسافة · السعرات النشطة (منفصلة عن الإجمالي) · نبض القلب ونبض الراحة · التمارين. في نسخة المتصفح الحالية يمكنك تسجيل كل هذه المقاييس يدوياً بسهولة من تبويب "النوم والنشاط".'
                  : 'Sleep sessions · Steps & distance · Active calories (separate from total energy) · Heart rate & resting HR · Workouts. On web, log these manually in the Sleep & Activity tab.'}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
