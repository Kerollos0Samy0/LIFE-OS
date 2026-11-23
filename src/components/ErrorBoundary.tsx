import React from 'react';

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message || 'Unexpected application error' };
  }

  componentDidCatch(error: Error) {
    console.error('LIFE OS ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0B0D10] text-[#F4F6F8] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-[#13171C] border border-[#232A33] rounded-2xl p-6 space-y-4">
            <h1 className="text-lg font-semibold text-red-400">حدث خطأ غير متوقع — LIFE OS</h1>
            <p className="text-sm text-[#8E99A8] leading-relaxed">
              توقف عرض الشاشة الحالية لحماية بياناتك. يمكنك إعادة تحميل التطبيق أو مراجعة تفاصيل الخطأ أدناه.
            </p>
            <pre className="text-xs font-mono bg-[#0B0D10] border border-[#232A33] rounded-xl p-3 overflow-x-auto text-slate-300 max-h-40">
              {this.state.errorMessage}
            </pre>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 text-[#07110C] font-semibold text-sm hover:bg-emerald-400 transition-colors"
            >
              إعادة تحميل التطبيق
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
