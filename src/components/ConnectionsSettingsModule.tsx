import React, { useState } from 'react';
import { Check, Loader2, Mail, Shield, Upload } from 'lucide-react';
import { useLifeOs } from '../context/LifeOsContext';
import { TODAY_ISO } from '../data/seedData';
import { egpToPiasters, piastersToEgp } from '../utils/finance';
import { getCategoryLabel } from '../i18n/translations';
import { ConfirmDialog } from './ConfirmDialog';
import type { AiModelId, ParsedExpenseProposal, PeakConcentration } from '../types/lifeos';

interface ConnectionsSettingsProps {
  mode: 'connections' | 'settings';
}

export const ConnectionsSettingsModule: React.FC<ConnectionsSettingsProps> = ({ mode }) => {
  const {
    data,
    lang,
    user,
    isCloudMode,
    signInWithGoogle,
    signOut,
    updateProfile,
    addExpense,
    recordAiUsage,
    exportJsonBackup,
    importJsonBackup,
    resetAllData,
  } = useLifeOs();

  const isAr = lang === 'ar';

  // Untrusted financial email parser (Gmail read-only extraction pattern)
  const [emailSnippet, setEmailSnippet] = useState('');
  const [parsingEmail, setParsingEmail] = useState(false);
  const [emailProposal, setEmailProposal] = useState<ParsedExpenseProposal | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSaved, setEmailSaved] = useState(false);

  // Settings form state
  const [displayName, setDisplayName] = useState(data.profile.displayName);
  const [dailyWorkHours, setDailyWorkHours] = useState(String(data.profile.dailyWorkHours));
  const [workStart, setWorkStart] = useState(String(data.profile.workStartHour));
  const [workEnd, setWorkEnd] = useState(String(data.profile.workEndHour));
  const [targetSleep, setTargetSleep] = useState(String(data.profile.targetSleepHours));
  const [peak, setPeak] = useState<PeakConcentration>(data.profile.peakConcentration);
  const [financialGoal, setFinancialGoal] = useState(data.profile.financialGoal);
  const [smartwatch, setSmartwatch] = useState(data.profile.smartwatch);
  const [stepTarget, setStepTarget] = useState(String(data.profile.dailyStepTarget));
  const [liabilitiesEgp, setLiabilitiesEgp] = useState(String(piastersToEgp(data.profile.liabilitiesPiasters)));
  const [aiModel, setAiModel] = useState<AiModelId>(data.profile.aiDefaultModel || 'gemini-3.5-flash');
  const [aiLimit, setAiLimit] = useState(String(data.profile.aiDailyLimit));
  const [customApiKey, setCustomApiKey] = useState(data.profile.customGeminiApiKey || '');
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const handleParseEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailSnippet.trim()) return;
    setParsingEmail(true);
    setEmailError(null);
    setEmailProposal(null);
    setEmailSaved(false);
    try {
      const res = await fetch('/api/ai/parse-expense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: emailSnippet.trim(), sourceType: 'email', todayIso: TODAY_ISO }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not parse email receipt');
      if (json.tokensUsed) recordAiUsage('gemini-3.1-flash-lite', json.tokensUsed);
      setEmailProposal(json.proposal as ParsedExpenseProposal);
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Email parse error');
    } finally {
      setParsingEmail(false);
    }
  };

  const handleConfirmEmailExpense = async () => {
    if (!emailProposal || emailProposal.amountEgp <= 0) return;
    await addExpense({
      description: emailProposal.description,
      amountPiasters: egpToPiasters(emailProposal.amountEgp),
      currency: 'EGP',
      category: emailProposal.category || 'other',
      date: emailProposal.date || TODAY_ISO,
      paymentMethod: emailProposal.paymentMethod || 'card',
      entrySource: 'email_import',
      recurring: false,
      notes: emailProposal.notes,
    });
    setEmailSaved(true);
    setEmailProposal(null);
    setEmailSnippet('');
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile({
      displayName: displayName.trim() || data.profile.displayName,
      dailyWorkHours: Math.max(1, Math.min(18, Number(dailyWorkHours) || 8)),
      workStartHour: Math.max(0, Math.min(23, Number(workStart) || 9)),
      workEndHour: Math.max(1, Math.min(24, Number(workEnd) || 17)),
      targetSleepHours: Math.max(3, Math.min(12, Number(targetSleep) || 6)),
      peakConcentration: peak,
      financialGoal: financialGoal.trim(),
      smartwatch: smartwatch.trim(),
      dailyStepTarget: Math.max(1000, Number(stepTarget) || 8000),
      liabilitiesPiasters: egpToPiasters(Math.max(0, Number(liabilitiesEgp) || 0)),
      aiDefaultModel: aiModel,
      aiDailyLimit: Math.max(5, Math.min(500, Number(aiLimit) || 40)),
      customGeminiApiKey: customApiKey.trim() || undefined,
    });
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 1800);
  };

  const handleImportFile = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const ok = importJsonBackup(String(reader.result || ''));
      setImportStatus(
        ok
          ? isAr ? 'تم استعادة النسخة الاحتياطية بنجاح.' : 'Backup restored successfully.'
          : isAr ? 'ملف النسخة الاحتياطية غير صالح.' : 'Invalid backup file format.',
      );
    };
    reader.readAsText(file);
  };

  if (mode === 'connections') {
    const integrations = [
      {
        name: isAr ? 'حساب Google و Cloud Firestore' : 'Google Account & Cloud Firestore',
        status: isCloudMode
          ? isAr ? `متصل (${user?.email})` : `Connected (${user?.email})`
          : isAr ? 'غير متصل (وضع محلي)' : 'Not connected (Local Mode)',
        live: isCloudMode,
        privacy: isAr
          ? 'تخزين مشفّر وقواعد أمان تعزل بياناتك بالكامل باسم المستخدم الخاص بك فقط.'
          : 'Owner-isolated Firestore security rules keep all personal records strictly private to your UID.',
        action: isCloudMode
          ? { label: isAr ? 'تسجيل الخروج' : 'Sign out', fn: () => void signOut() }
          : { label: isAr ? 'تسجيل الدخول بـ Google' : 'Sign in with Google', fn: () => void signInWithGoogle() },
      },
      {
        name: 'Google Calendar',
        status: isAr ? 'يتطلب تفعيل OAuth (تقويم محلي نشط)' : 'OAuth Not Enabled (Local Calendar Active)',
        live: false,
        privacy: isAr
          ? 'يطلب أقل صلاحية ممكنة لقراءة وإنشاء الأحداث ويؤكد دائماً قبل الحذف.'
          : 'Uses least-privilege event scopes and always confirms before deleting events.',
      },
      {
        name: 'Google Drive (KYVORA Folder)',
        status: isAr ? 'يتطلب تفعيل OAuth (تصدير JSON محلي متاح)' : 'OAuth Not Enabled (Local JSON Export Ready)',
        live: false,
        privacy: isAr
          ? 'يصل فقط لمجلد KYVORA المخصص للنسخ الاحتياطي والتقارير.'
          : 'Uses narrowest drive.file permissions strictly for KYVORA exports and backups.',
      },
      {
        name: 'Gmail (Read-Only Financial Emails)',
        status: isAr ? 'يتطلب تفعيل OAuth (المستخرج اليدوي متاح أدناه)' : 'OAuth Not Enabled (Manual Parser Below)',
        live: false,
        privacy: isAr
          ? 'قراءة فقط (لا يرسل ولا يحذف ولا يعدل الرسائل أبداً) ويعامل محتوى الإيميل كبيانات غير موثوقة.'
          : 'Read-only in V1 — never sends, deletes, or modifies email; treats email text as untrusted data.',
      },
      {
        name: 'Android Health Connect & Xiaomi Smart Band',
        status: isAr ? 'يتطلب تطبيق Android أصلي (التسجيل اليدوي متاح)' : 'Requires Native Android (Manual Logging Active)',
        live: false,
        privacy: isAr
          ? 'يقرأ فقط المقاييس الصحية التي توافق عليها صراحةً عبر Health Connect.'
          : 'Reads only explicitly authorized metrics through Android Health Connect.',
      },
      {
        name: 'Android Usage Stats (Digital Wellbeing)',
        status: isAr ? 'يتطلب إذن Android (التسجيل اليدوي متاح)' : 'Requires Android Permission (Manual Logging Active)',
        live: false,
        privacy: isAr
          ? 'مدة استخدام التطبيقات فقط — لا يقرأ الرسائل أو كلمات المرور أو لوحة المفاتيح.'
          : 'App duration metadata only — never reads messages, passwords, or keystrokes.',
      },
    ];

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#F4F6F8]">{isAr ? 'الحسابات المتصلة والخصوصية' : 'Connected Accounts & Privacy'}</h1>
          <p className="text-xs text-[#8E99A8] mt-1">
            {isAr
              ? 'شفافية كاملة حول التكاملات الفعالة حالياً والتكاملات التي تتطلب أذونات Android أو OAuth.'
              : 'Honest availability status and privacy disclosures for every ecosystem integration.'}
          </p>
        </div>

        <div className="bg-[#13171C] border border-[#232A33] rounded-2xl divide-y divide-[#1D232C]">
          {integrations.map((item) => (
            <div key={item.name} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[#F4F6F8]">{item.name}</p>
                <p className={`text-xs font-medium ${item.live ? 'text-emerald-400' : 'text-[#8E99A8]'}`}>{item.status}</p>
                <p className="text-xs text-[#758091] flex items-center gap-1.5 pt-0.5">
                  <Shield className="w-3.5 h-3.5 shrink-0 text-emerald-400/70" />
                  {item.privacy}
                </p>
              </div>
              {item.action ? (
                <button
                  type="button"
                  onClick={item.action.fn}
                  className="min-h-[40px] px-4 rounded-xl bg-emerald-500 text-[#07110C] text-xs font-semibold hover:bg-emerald-400 whitespace-nowrap shrink-0 self-start sm:self-center"
                >
                  {item.action.label}
                </button>
              ) : null}
            </div>
          ))}
        </div>

        {/* Financial Email Receipt Extractor (Treats email as untrusted data + requires confirmation) */}
        <div className="bg-[#13171C] border border-[#232A33] rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-[#F4F6F8]">
              {isAr ? 'استخراج معاملة من رسالة إيصال / إشعار بنكي (قراءة فقط)' : 'Financial Email / Notification Receipt Extractor'}
            </h2>
          </div>
          <p className="text-xs text-[#8E99A8]">
            {isAr
              ? 'الصق نص إشعار دفع أو إيصال شراء لتحليله كبيانات غير موثوقة عبر Gemini Flash-Lite، ثم راجعه قبل الحفظ.'
              : 'Paste a payment confirmation or receipt email. Parsed strictly as untrusted data and requires your confirmation.'}
          </p>
          <form onSubmit={handleParseEmail} className="space-y-3">
            <textarea
              rows={3}
              value={emailSnippet}
              onChange={(e) => setEmailSnippet(e.target.value)}
              placeholder={
                isAr
                  ? 'مثال: تم خصم مبلغ 420.00 EGP من بطاقتك لدى Carrefour Egypt بتاريخ 2026-11-22 رقم مرجعي #88412'
                  : 'e.g., Payment confirmation: EGP 420.00 charged at Carrefour Egypt on 2026-11-22 Ref #88412'
              }
              className="w-full p-3.5 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm text-[#F4F6F8]"
            />
            <button
              type="submit"
              disabled={parsingEmail || !emailSnippet.trim()}
              className="min-h-[42px] px-5 rounded-xl bg-[#191F27] border border-[#2A3340] hover:border-emerald-500/60 text-xs font-semibold text-[#F4F6F8] inline-flex items-center gap-2"
            >
              {parsingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" /> : null}
              {isAr ? 'استخراج بيانات المعاملة للمراجعة' : 'Extract Transaction for Review'}
            </button>
          </form>

          {emailError ? <p className="text-xs text-red-400">{emailError}</p> : null}
          {emailSaved ? <p className="text-xs text-emerald-400">{isAr ? 'تم حفظ المعاملة في المصاريف.' : 'Transaction saved to Expenses.'}</p> : null}

          {emailProposal ? (
            <div className="pt-4 border-t border-[#232A33] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs space-y-1">
                <p className="font-semibold text-[#F4F6F8]">
                  {emailProposal.description} — <span className="font-mono-nums text-emerald-400">{emailProposal.amountEgp} EGP</span>
                </p>
                <p className="text-[#8E99A8]">
                  {getCategoryLabel(emailProposal.category, lang)} · {emailProposal.date} · {emailProposal.notes || ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleConfirmEmailExpense()}
                className="min-h-[40px] px-4 rounded-xl bg-emerald-500 text-[#07110C] text-xs font-semibold hover:bg-emerald-400 inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Check className="w-3.5 h-3.5" />
                {isAr ? 'تأكيد وإضافة للمصاريف' : 'Confirm & Add Expense'}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // SETTINGS & PROFILE MODE
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#F4F6F8]">{isAr ? 'الملف الشخصي والإعدادات' : 'Profile & Settings'}</h1>
        <p className="text-xs text-[#8E99A8] mt-1">
          {isAr
            ? 'يمكنك تعديل كل تفضيلاتك الشخصية والعملية وإعدادات الذكاء الاصطناعي والنسخ الاحتياطي في أي وقت.'
            : 'Edit all personalization settings, schedule preferences, AI quotas, and data exports anytime.'}
        </p>
      </div>

      <form onSubmit={handleSaveSettings} className="bg-[#13171C] border border-[#232A33] rounded-2xl p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="set-name" className="block text-xs text-[#8E99A8] mb-1">{isAr ? 'الاسم' : 'Display Name'}</label>
            <input id="set-name" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm text-[#F4F6F8]" />
          </div>
          <div>
            <label htmlFor="set-goal" className="block text-xs text-[#8E99A8] mb-1">{isAr ? 'الهدف المالي الرئيسي' : 'Main Financial Goal'}</label>
            <input id="set-goal" type="text" value={financialGoal} onChange={(e) => setFinancialGoal(e.target.value)} className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm text-[#F4F6F8]" />
          </div>
          <div>
            <label htmlFor="set-peak" className="block text-xs text-[#8E99A8] mb-1">{isAr ? 'فترة أعلى تركيز' : 'Highest Concentration Period'}</label>
            <select id="set-peak" value={peak} onChange={(e) => setPeak(e.target.value as PeakConcentration)} className="w-full min-h-[44px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm text-[#F4F6F8]">
              <option value="morning">{isAr ? 'الصباح (Morning)' : 'Morning'}</option>
              <option value="afternoon">{isAr ? 'بعد الظهر (Afternoon)' : 'Afternoon'}</option>
              <option value="evening">{isAr ? 'المساء (Evening)' : 'Evening'}</option>
            </select>
          </div>
          <div>
            <label htmlFor="set-watch" className="block text-xs text-[#8E99A8] mb-1">{isAr ? 'الساعة الذكية' : 'Smartwatch'}</label>
            <input id="set-watch" type="text" value={smartwatch} onChange={(e) => setSmartwatch(e.target.value)} className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm text-[#F4F6F8]" />
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label htmlFor="set-wh" className="block text-xs text-[#8E99A8] mb-1">{isAr ? 'ساعات العمل' : 'Work hrs'}</label>
              <input id="set-wh" type="number" value={dailyWorkHours} onChange={(e) => setDailyWorkHours(e.target.value)} className="w-full min-h-[42px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm font-mono-nums text-[#F4F6F8]" />
            </div>
            <div>
              <label htmlFor="set-ws" className="block text-xs text-[#8E99A8] mb-1">{isAr ? 'بداية' : 'Start hr'}</label>
              <input id="set-ws" type="number" value={workStart} onChange={(e) => setWorkStart(e.target.value)} className="w-full min-h-[42px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm font-mono-nums text-[#F4F6F8]" />
            </div>
            <div>
              <label htmlFor="set-we" className="block text-xs text-[#8E99A8] mb-1">{isAr ? 'نهاية' : 'End hr'}</label>
              <input id="set-we" type="number" value={workEnd} onChange={(e) => setWorkEnd(e.target.value)} className="w-full min-h-[42px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm font-mono-nums text-[#F4F6F8]" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label htmlFor="set-sleep" className="block text-xs text-[#8E99A8] mb-1">{isAr ? 'هدف النوم' : 'Sleep (h)'}</label>
              <input id="set-sleep" type="number" step="0.5" value={targetSleep} onChange={(e) => setTargetSleep(e.target.value)} className="w-full min-h-[42px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm font-mono-nums text-[#F4F6F8]" />
            </div>
            <div>
              <label htmlFor="set-steps" className="block text-xs text-[#8E99A8] mb-1">{isAr ? 'هدف الخطوات' : 'Steps'}</label>
              <input id="set-steps" type="number" value={stepTarget} onChange={(e) => setStepTarget(e.target.value)} className="w-full min-h-[42px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm font-mono-nums text-[#F4F6F8]" />
            </div>
            <div>
              <label htmlFor="set-liab" className="block text-xs text-[#8E99A8] mb-1">{isAr ? 'التزامات (ج.م)' : 'Liabilities'}</label>
              <input id="set-liab" type="number" value={liabilitiesEgp} onChange={(e) => setLiabilitiesEgp(e.target.value)} className="w-full min-h-[42px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm font-mono-nums text-[#F4F6F8]" />
            </div>
          </div>
          <div>
            <label htmlFor="set-ai-model" className="block text-xs text-[#8E99A8] mb-1">{isAr ? 'نموذج KYVORA AI الافتراضي' : 'Default KYVORA AI Model'}</label>
            <select id="set-ai-model" value={aiModel} onChange={(e) => setAiModel(e.target.value as AiModelId)} className="w-full min-h-[44px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm text-[#F4F6F8]">
              <option value="gemini-3.5-flash">Gemini 3.5 Flash ({isAr ? 'الأذكى والأسرع — مستحسن' : 'Smartest & Fastest'})</option>
              <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash-Lite ({isAr ? 'خفيف وسريع' : 'Lightweight'})</option>
              <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash-Lite</option>
              <option value="gemini-3.8-flash">Gemini 3.8 Flash ({isAr ? 'تجريبي متقدم' : 'Advanced Preview'})</option>
            </select>
          </div>
          <div>
            <label htmlFor="set-ai-key" className="block text-xs text-[#8E99A8] mb-1">
              {isAr ? 'مفتاح Google Gemini API الشخصي (اختياري)' : 'Personal Google Gemini API Key (Optional)'}
            </label>
            <input
              id="set-ai-key"
              type="password"
              placeholder="AIzaSy... أو الصق مفتاحك هنا"
              value={customApiKey}
              onChange={(e) => setCustomApiKey(e.target.value)}
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm font-mono text-[#F4F6F8] focus:border-emerald-500/60"
            />
            <p className="text-[11px] text-[#8E99A8] mt-1">
              {isAr
                ? 'يمكنك الحصول على مفتاح شخصي مجاني من aistudio.google.com للعمل بدون أي انقطاع أو حدود مشتركة.'
                : 'Get a free key from aistudio.google.com to run Gemini without limits.'}
            </p>
          </div>
          <div>
            <label htmlFor="set-ai-limit" className="block text-xs text-[#8E99A8] mb-1">{isAr ? 'الحد اليومي لطلبات AI' : 'Daily AI Request Limit'}</label>
            <input id="set-ai-limit" type="number" value={aiLimit} onChange={(e) => setAiLimit(e.target.value)} className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm font-mono-nums text-[#F4F6F8]" />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button type="submit" className="min-h-[44px] px-6 rounded-xl bg-emerald-500 text-[#07110C] font-semibold text-sm hover:bg-emerald-400">
            {settingsSaved ? (isAr ? 'تم حفظ الإعدادات' : 'Settings Saved') : (isAr ? 'حفظ التغييرات' : 'Save Changes')}
          </button>
        </div>
      </form>

      {/* Data Ownership: Export, Restore & Reset */}
      <div className="bg-[#13171C] border border-[#232A33] rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-[#F4F6F8]">{isAr ? 'ملكية البيانات والنسخ الاحتياطي' : 'Data Ownership, Backup & Account Reset'}</h2>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              const blob = new Blob([exportJsonBackup()], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `life-os-backup-${TODAY_ISO}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="min-h-[42px] px-4 rounded-xl bg-[#191F27] border border-[#2A3340] text-xs font-semibold text-[#F4F6F8] hover:border-emerald-500/60"
          >
            {isAr ? 'تصدير نسخة احتياطية JSON' : 'Export JSON Backup'}
          </button>

          <label className="min-h-[42px] px-4 rounded-xl bg-[#191F27] border border-[#2A3340] text-xs font-semibold text-[#F4F6F8] hover:border-emerald-500/60 inline-flex items-center gap-2 cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            {isAr ? 'استعادة نسخة JSON' : 'Restore JSON Backup'}
            <input type="file" accept="application/json" onChange={handleImportFile} className="hidden" />
          </label>

          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="min-h-[42px] px-4 rounded-xl border border-red-500/40 text-xs font-semibold text-red-400 hover:bg-red-500/10"
          >
            {isAr ? 'تصفير كل البيانات للبدء على نظيف' : 'Zero Reset (Start Clean)'}
          </button>
        </div>
        {importStatus ? <p className="text-xs text-emerald-400">{importStatus}</p> : null}
      </div>

      <ConfirmDialog
        open={confirmReset}
        title={isAr ? 'تأكيد تصفير كل البيانات' : 'Confirm Data Zero-Reset'}
        description={
          isAr
            ? 'سيتم تصفير كل الأرقام والعادات والملخصات بالكامل للبدء من جديد على نظيف. هل أنت متأكد؟'
            : 'This will reset all records, habits, and summaries to zero so you can start completely clean. Are you sure?'
        }
        confirmLabel={isAr ? 'نعم، تصفير كل البيانات' : 'Yes, Zero-Reset'}
        cancelLabel={isAr ? 'إلغاء' : 'Cancel'}
        tone="danger"
        onConfirm={async () => {
          await resetAllData();
          setConfirmReset(false);
        }}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
};
