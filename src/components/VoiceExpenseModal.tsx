import React, { useState } from 'react';
import { Check, Loader2, Mic, MicOff, X } from 'lucide-react';
import { useLifeOs } from '../context/LifeOsContext';
import {
  DEFAULT_EXPENSE_CATEGORIES,
  getCategoryLabel,
  PAYMENT_METHOD_LABELS,
} from '../i18n/translations';
import { TODAY_ISO } from '../data/seedData';
import { egpToPiasters } from '../utils/finance';
import type { ParsedExpenseProposal, PaymentMethod } from '../types/lifeos';

interface VoiceExpenseModalProps {
  open: boolean;
  onClose: () => void;
}

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
}

export const VoiceExpenseModal: React.FC<VoiceExpenseModalProps> = ({ open, onClose }) => {
  const { lang, addExpense, recordAiUsage, data } = useLifeOs();
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [proposal, setProposal] = useState<ParsedExpenseProposal | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!open) return null;

  const isAr = lang === 'ar';
  const allCategories = [...DEFAULT_EXPENSE_CATEGORIES, ...(data.profile.customCategories || [])];

  const handleVoiceCapture = () => {
    setErrorMsg(null);
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    };
    const SpeechRec = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRec) {
      setErrorMsg(
        isAr
          ? 'التعرف الصوتي المباشر غير مدعوم في هذا المتصفح — يمكنك كتابة الجملة بالعامية المصرية مباشرة أدناه.'
          : 'Browser Speech Recognition is unavailable here — type your expense sentence directly below.',
      );
      return;
    }

    const recognition = new SpeechRec();
    recognition.lang = isAr ? 'ar-EG' : 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setIsListening(true);

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript || '';
      setInputText(transcript);
      setIsListening(false);
    };
    recognition.onerror = () => {
      setIsListening(false);
      setErrorMsg(isAr ? 'تعذّر التقاط الصوت، جرّب الكتابة أو إعادة المحاولة.' : 'Could not capture audio. Please type or retry.');
    };
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const handleParse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    setErrorMsg(null);
    setProposal(null);
    setSavedSuccess(false);
    setIsParsing(true);

    try {
      const res = await fetch('/api/ai/parse-expense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputText.trim(),
          sourceType: 'voice',
          todayIso: TODAY_ISO,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Parsing failed');
      }
      if (json.tokensUsed) {
        recordAiUsage('gemini-3.1-flash-lite', json.tokensUsed);
      }
      setProposal(json.proposal as ParsedExpenseProposal);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to parse expense');
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirmSave = async () => {
    if (!proposal || proposal.amountEgp <= 0 || !proposal.description.trim()) {
      setErrorMsg(isAr ? 'يرجى التأكد من المبلغ والوصف قبل الحفظ.' : 'Please verify amount and description before saving.');
      return;
    }
    await addExpense({
      description: proposal.description,
      amountPiasters: egpToPiasters(proposal.amountEgp),
      currency: 'EGP',
      category: proposal.category || 'other',
      date: proposal.date || TODAY_ISO,
      paymentMethod: proposal.paymentMethod || 'cash',
      entrySource: 'voice',
      recurring: false,
      notes: proposal.notes,
    });
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      setProposal(null);
      setInputText('');
      onClose();
    }, 600);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-expense-title"
    >
      <div className="w-full max-w-lg bg-[#13171C] border border-[#232A33] rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 id="voice-expense-title" className="text-base font-semibold text-[#F4F6F8]">
              {isAr ? 'تسجيل مصروف بالصوت أو النص الطبيعي' : 'Voice & Natural-Language Expense Entry'}
            </h2>
            <p className="text-xs text-[#8E99A8] mt-1">
              {isAr
                ? 'تحليل ذكي عبر Gemini Flash-Lite مع شاشة تأكيد إلزامية قبل الحفظ.'
                : 'Parsed via Gemini Flash-Lite with mandatory confirmation before saving.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={isAr ? 'إغلاق' : 'Close'}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#8E99A8] hover:text-[#F4F6F8] hover:bg-[#1C222B]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleParse} className="space-y-3">
          <label htmlFor="voice-expense-input" className="block text-xs font-medium text-[#A9B3C1]">
            {isAr ? 'اتكلم أو اكتب المصروف بالعامية المصرية' : 'Speak or type your expense naturally'}
          </label>
          <div className="flex gap-2">
            <input
              id="voice-expense-input"
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isAr ? 'مثال: دفعت 150 جنيه مواصلات النهارده' : 'e.g., Paid 150 EGP for Uber today'}
              className="flex-1 min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm text-[#F4F6F8] placeholder:text-[#5E6877] focus:outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={handleVoiceCapture}
              aria-label={isAr ? 'تسجيل صوتي' : 'Start voice input'}
              className={`min-h-[44px] min-w-[44px] px-3 rounded-xl border transition-colors flex items-center justify-center ${
                isListening
                  ? 'bg-red-500/20 border-red-500 text-red-400'
                  : 'bg-[#191F27] border-[#232A33] text-[#C8D0DC] hover:border-emerald-500/60'
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              onClick={() => setInputText('دفعت 150 جنيه مواصلات النهارده')}
              className="text-[#8E99A8] hover:text-emerald-400 underline underline-offset-4 transition-colors"
            >
              "دفعت 150 جنيه مواصلات النهارده"
            </button>
            <span className="text-[#404A58]">·</span>
            <button
              type="button"
              onClick={() => setInputText('اشتريت قهوة وغدا ب 220 جنيه كاش')}
              className="text-[#8E99A8] hover:text-emerald-400 underline underline-offset-4 transition-colors"
            >
              "اشتريت قهوة وغدا ب 220 جنيه كاش"
            </button>
          </div>

          <button
            type="submit"
            disabled={isParsing || !inputText.trim()}
            className="w-full min-h-[44px] rounded-xl bg-emerald-500 text-[#07110C] font-semibold text-sm hover:bg-emerald-400 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {isParsing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {isParsing
              ? isAr ? 'جاري التحليل...' : 'Parsing...'
              : isAr ? 'تحليل المصروف قبل الحفظ' : 'Extract & Review Expense'}
          </button>
        </form>

        {errorMsg ? (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300">
            {errorMsg}
          </div>
        ) : null}

        {proposal ? (
          <div className="pt-4 border-t border-[#232A33] space-y-4">
            <div className="flex items-center justify-between text-xs text-[#8E99A8]">
              <span className="font-semibold text-emerald-400">
                {isAr ? 'مراجعة وتأكيد المعاملة (إلزامي)' : 'Confirm Extracted Transaction (Required)'}
              </span>
              <span className="font-mono-nums">
                {isAr ? 'دقة التحليل:' : 'Confidence:'} {Math.round((proposal.confidence || 0) * 100)}%
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="prop-amount" className="block text-xs text-[#8E99A8] mb-1">
                  {isAr ? 'المبلغ (ج.م)' : 'Amount (EGP)'}
                </label>
                <input
                  id="prop-amount"
                  type="number"
                  step="0.01"
                  value={proposal.amountEgp}
                  onChange={(e) => setProposal({ ...proposal, amountEgp: Number(e.target.value) })}
                  className="w-full min-h-[42px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm font-mono-nums text-[#F4F6F8]"
                />
              </div>

              <div>
                <label htmlFor="prop-cat" className="block text-xs text-[#8E99A8] mb-1">
                  {isAr ? 'التصنيف' : 'Category'}
                </label>
                <select
                  id="prop-cat"
                  value={proposal.category}
                  onChange={(e) => setProposal({ ...proposal, category: e.target.value })}
                  className="w-full min-h-[42px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm text-[#F4F6F8]"
                >
                  {allCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {getCategoryLabel(cat, lang)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="prop-desc" className="block text-xs text-[#8E99A8] mb-1">
                  {isAr ? 'الوصف' : 'Description'}
                </label>
                <input
                  id="prop-desc"
                  type="text"
                  value={proposal.description}
                  onChange={(e) => setProposal({ ...proposal, description: e.target.value })}
                  className="w-full min-h-[42px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm text-[#F4F6F8]"
                />
              </div>

              <div>
                <label htmlFor="prop-date" className="block text-xs text-[#8E99A8] mb-1">
                  {isAr ? 'التاريخ' : 'Date'}
                </label>
                <input
                  id="prop-date"
                  type="date"
                  value={proposal.date}
                  onChange={(e) => setProposal({ ...proposal, date: e.target.value })}
                  className="w-full min-h-[42px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm font-mono-nums text-[#F4F6F8]"
                />
              </div>

              <div>
                <label htmlFor="prop-method" className="block text-xs text-[#8E99A8] mb-1">
                  {isAr ? 'طريقة الدفع' : 'Payment Method'}
                </label>
                <select
                  id="prop-method"
                  value={proposal.paymentMethod}
                  onChange={(e) => setProposal({ ...proposal, paymentMethod: e.target.value as PaymentMethod })}
                  className="w-full min-h-[42px] px-3 rounded-xl bg-[#0B0D10] border border-[#232A33] text-sm text-[#F4F6F8]"
                >
                  {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
                    <option key={m} value={m}>
                      {PAYMENT_METHOD_LABELS[m][lang]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => setProposal(null)}
                className="min-h-[44px] px-4 rounded-xl border border-[#232A33] text-sm text-[#C8D0DC] hover:bg-[#1B212A]"
              >
                {isAr ? 'إلغاء' : 'Discard'}
              </button>
              <button
                type="button"
                onClick={handleConfirmSave}
                className="min-h-[44px] px-5 rounded-xl bg-emerald-500 text-[#07110C] font-semibold text-sm hover:bg-emerald-400 flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                {savedSuccess
                  ? isAr ? 'تم الحفظ' : 'Saved'
                  : isAr ? 'تأكيد وحفظ المصروف' : 'Confirm & Save Expense'}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
