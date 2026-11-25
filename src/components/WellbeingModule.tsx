import React, { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ShieldCheck, Smartphone } from 'lucide-react';
import { useLifeOs } from '../context/LifeOsContext';
import { TODAY_ISO } from '../data/seedData';

export const WellbeingModule: React.FC = () => {
  const { data, lang, upsertAppUsageLog } = useLifeOs();
  const isAr = lang === 'ar';

  const latest = useMemo(
    () => [...data.appUsageLogs].sort((a, b) => b.date.localeCompare(a.date))[0] || null,
    [data.appUsageLogs],
  );

  const [prod, setProd] = useState(String(latest?.productivityMinutes ?? 90));
  const [comm, setComm] = useState(String(latest?.communicationMinutes ?? 50));
  const [social, setSocial] = useState(String(latest?.socialMediaMinutes ?? 65));
  const [ent, setEnt] = useState(String(latest?.entertainmentMinutes ?? 35));
  const [edu, setEdu] = useState(String(latest?.educationMinutes ?? 30));
  const [other, setOther] = useState(String(latest?.otherMinutes ?? 15));
  const [night, setNight] = useState(String(latest?.nighttimeMinutes ?? 40));
  const [interrupts, setInterrupts] = useState(String(latest?.interruptions ?? 20));
  const [saved, setSaved] = useState(false);

  const totalMinutes = latest
    ? latest.productivityMinutes +
      latest.communicationMinutes +
      latest.socialMediaMinutes +
      latest.entertainmentMinutes +
      latest.educationMinutes +
      latest.otherMinutes
    : 0;

  const categoryBars = useMemo(() => {
    if (!latest) return [];
    return [
      { name: isAr ? 'إنتاجية' : 'Productivity', mins: latest.productivityMinutes },
      { name: isAr ? 'تواصل' : 'Communication', mins: latest.communicationMinutes },
      { name: isAr ? 'سوشيال ميديا' : 'Social Media', mins: latest.socialMediaMinutes },
      { name: isAr ? 'ترفيه' : 'Entertainment', mins: latest.entertainmentMinutes },
      { name: isAr ? 'تعليم' : 'Education', mins: latest.educationMinutes },
      { name: isAr ? 'أخرى' : 'Other', mins: latest.otherMinutes },
    ];
  }, [latest, isAr]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await upsertAppUsageLog({
      date: TODAY_ISO,
      productivityMinutes: Math.max(0, Number(prod) || 0),
      communicationMinutes: Math.max(0, Number(comm) || 0),
      socialMediaMinutes: Math.max(0, Number(social) || 0),
      entertainmentMinutes: Math.max(0, Number(ent) || 0),
      educationMinutes: Math.max(0, Number(edu) || 0),
      otherMinutes: Math.max(0, Number(other) || 0),
      nighttimeMinutes: Math.max(0, Number(night) || 0),
      interruptions: Math.max(0, Number(interrupts) || 0),
      source: 'manual',
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#F4F6F8]">{isAr ? 'الرفاهية الرقمية' : 'Digital Wellbeing'}</h1>
        <p className="text-xs text-[#8E99A8] mt-1">
          {isAr
            ? 'تحليل وقت الشاشة والاستخدام الليلي ومقاطعات التركيز عبر Android Usage Stats أو التسجيل اليدوي.'
            : 'Screen time, nighttime usage, and focus interruption tracking via Android Usage Stats or manual entry.'}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#13171C] border border-[#232A33] rounded-2xl p-4">
          <p className="text-xs text-[#8E99A8]">{isAr ? 'إجمالي وقت الشاشة' : 'Total Screen Time'}</p>
          <p className="text-xl font-bold font-mono-nums text-[#F4F6F8] mt-1">
            {(totalMinutes / 60).toFixed(1)} {isAr ? 'ساعة' : 'h'}
          </p>
        </div>
        <div className="bg-[#13171C] border border-[#232A33] rounded-2xl p-4">
          <p className="text-xs text-[#8E99A8]">{isAr ? 'تطبيقات الإنتاجية' : 'Productive Apps'}</p>
          <p className="text-xl font-bold font-mono-nums text-emerald-400 mt-1">
            {latest?.productivityMinutes ?? 0} {isAr ? 'د' : 'm'}
          </p>
        </div>
        <div className="bg-[#13171C] border border-[#232A33] rounded-2xl p-4">
          <p className="text-xs text-[#8E99A8]">{isAr ? 'السوشيال ميديا' : 'Social Media'}</p>
          <p className="text-xl font-bold font-mono-nums text-amber-400 mt-1">
            {latest?.socialMediaMinutes ?? 0} {isAr ? 'د' : 'm'}
          </p>
        </div>
        <div className="bg-[#13171C] border border-[#232A33] rounded-2xl p-4">
          <p className="text-xs text-[#8E99A8]">{isAr ? 'الاستخدام الليلي' : 'Nighttime Usage'}</p>
          <p className="text-xl font-bold font-mono-nums text-red-400 mt-1">
            {latest?.nighttimeMinutes ?? 0} {isAr ? 'د' : 'm'} · {latest?.interruptions ?? 0} {isAr ? 'مقاطعة' : 'pickups'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-[#13171C] border border-[#232A33] rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[#F4F6F8]">{isAr ? 'توزيع الاستخدام حسب الفئة (دقائق)' : 'Usage by App Category (Minutes)'}</h2>
          <div className="h-64 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryBars} margin={{ top: 8, right: 8, left: -12, bottom: 8 }}>
                <CartesianGrid stroke="#232A33" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#8E99A8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#8E99A8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#0B0D10', border: '1px solid #232A33', borderRadius: 12, color: '#F4F6F8', fontSize: 12 }} />
                <Bar dataKey="mins" fill="#34D399" radius={[6, 6, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="pt-4 border-t border-[#232A33] flex items-start gap-3 text-xs text-[#A9B3C1]">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              {isAr
                ? 'خصوصية صارمة: لا يجمع KYVORA أبداً محتوى الرسائل أو كلمات المرور أو نقرات لوحة المفاتيح. الجمع التلقائي يتطلب إذن Android Usage Stats على هاتف Android.'
                : 'Strict privacy: KYVORA never collects message contents, passwords, or keystrokes. Automatic capture requires Android Usage Stats permission on Android.'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="lg:col-span-5 bg-[#13171C] border border-[#232A33] rounded-2xl p-5 space-y-3.5 self-start">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-[#F4F6F8]">{isAr ? 'تحديث سجل وقت الشاشة اليوم' : 'Update Today’s Screen Time Log'}</h2>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            {[
              { id: 'wb-prod', label: isAr ? 'إنتاجية (د)' : 'Productivity (m)', v: prod, s: setProd },
              { id: 'wb-comm', label: isAr ? 'تواصل (د)' : 'Communication (m)', v: comm, s: setComm },
              { id: 'wb-soc', label: isAr ? 'سوشيال ميديا (د)' : 'Social Media (m)', v: social, s: setSocial },
              { id: 'wb-ent', label: isAr ? 'ترفيه (د)' : 'Entertainment (m)', v: ent, s: setEnt },
              { id: 'wb-edu', label: isAr ? 'تعليم (د)' : 'Education (m)', v: edu, s: setEdu },
              { id: 'wb-oth', label: isAr ? 'أخرى (د)' : 'Other (m)', v: other, s: setOther },
              { id: 'wb-night', label: isAr ? 'استخدام ليلي (د)' : 'Nighttime (m)', v: night, s: setNight },
              { id: 'wb-int', label: isAr ? 'مقاطعات التركيز' : 'Interruptions', v: interrupts, s: setInterrupts },
            ].map((f) => (
              <div key={f.id}>
                <label htmlFor={f.id} className="block text-[#8E99A8] mb-1">{f.label}</label>
                <input
                  id={f.id}
                  type="number"
                  value={f.v}
                  onChange={(e) => f.s(e.target.value)}
                  className="w-full min-h-[40px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm font-mono-nums text-[#F4F6F8]"
                />
              </div>
            ))}
          </div>

          <button type="submit" className="w-full min-h-[44px] rounded-xl bg-emerald-500 text-[#07110C] font-semibold text-sm hover:bg-emerald-400">
            {saved ? (isAr ? 'تم التحديث' : 'Updated') : (isAr ? 'حفظ بيانات الشاشة' : 'Save Screen Time')}
          </button>
        </form>
      </div>
    </div>
  );
};
