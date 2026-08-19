import type { FormEvent, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type CrudModalProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  children: ReactNode;
  saving?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  onClose: () => void;
  onSubmit: () => void;
};

// Figma form modal (e.g. node 12-12563 יצירת לקוח): rounded card with an X
// close at the far corner, a blue ⊕ badge beside the bold navy title, a muted
// subtitle, stacked labeled fields, and a full-width primary submit. The
// design has no cancel button (only the X); the ביטול button stays for
// accessibility and existing tests, styled as a quiet secondary action.
export function CrudModal({
  open,
  title,
  subtitle,
  children,
  saving = false,
  submitLabel = 'שמירה',
  cancelLabel = 'ביטול',
  onClose,
  onSubmit,
}: CrudModalProps) {
  if (!open) return null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    onSubmit();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" dir="rtl">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="crud-modal-title"
        className={cn(
          'relative w-full max-w-md rounded-2xl bg-white p-8 text-neutral-900 shadow-xl',
        )}
      >
        <button
          type="button"
          aria-label="סגירה"
          onClick={onClose}
          className="absolute left-4 top-4 rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M18 6 6 18 M6 6l12 12" />
          </svg>
        </button>
        <form onSubmit={handleSubmit} noValidate>
          {/* Figma 12-12563: the title/subtitle block sits at the right with the
              blue ⊕ badge immediately beside it (not at the far edge). */}
          <div className="mb-6 flex items-start gap-4">
            <div>
              <h2 id="crud-modal-title" className="text-lg font-bold text-navy">
                {title}
              </h2>
              {subtitle ? <p className="mt-1 text-xs text-neutral-500">{subtitle}</p> : null}
            </div>
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linkBlue text-white"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v8 M8 12h8" />
              </svg>
            </span>
          </div>
          <div className="space-y-4">{children}</div>
          <div className="mt-8 space-y-2">
            <button
              type="submit"
              className="w-full rounded-lg bg-linkBlue py-2.5 text-base font-bold text-white transition-colors hover:bg-linkBlue/90 disabled:bg-neutral-400"
              disabled={saving}
            >
              {saving ? 'שומר…' : submitLabel}
            </button>
            <button
              type="button"
              className="w-full rounded-lg py-2 text-sm text-neutral-500 transition-colors hover:bg-neutral-100"
              onClick={onClose}
            >
              {cancelLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
