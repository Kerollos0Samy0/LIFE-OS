import React from 'react';
import { X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  tone?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = 'primary',
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-md bg-[#13171C] border border-[#232A33] rounded-2xl p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <h2 id="confirm-dialog-title" className="text-base font-semibold text-[#F4F6F8]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label={cancelLabel}
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[#8E99A8] hover:text-[#F4F6F8] hover:bg-[#1C222B] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-[#A9B3C1] leading-relaxed">{description}</p>

        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-[#232A33] text-sm font-medium text-[#C8D0DC] hover:bg-[#1B212A] transition-colors whitespace-nowrap"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`min-h-[44px] px-5 py-2 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap ${
              tone === 'danger'
                ? 'bg-red-500 text-white hover:bg-red-400'
                : 'bg-emerald-500 text-[#07110C] hover:bg-emerald-400'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
