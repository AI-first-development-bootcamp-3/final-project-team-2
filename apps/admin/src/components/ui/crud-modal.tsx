import type { FormEvent, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type CrudModalProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  saving?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  onClose: () => void;
  onSubmit: () => void;
};

export function CrudModal({
  open,
  title,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" dir="rtl">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="crud-modal-title"
        className={cn(
          'w-full max-w-md rounded-md border bg-white p-6 text-neutral-900 shadow-lg',
        )}
      >
        <form onSubmit={handleSubmit} noValidate>
          <h2 id="crud-modal-title" className="mb-4 text-lg font-semibold">
            {title}
          </h2>
          <div className="space-y-3">{children}</div>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className="rounded border px-3 py-1" onClick={onClose}>
              {cancelLabel}
            </button>
            <button
              type="submit"
              className="rounded border bg-neutral-900 px-3 py-1 text-white disabled:opacity-50"
              disabled={saving}
            >
              {saving ? 'שומר…' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
