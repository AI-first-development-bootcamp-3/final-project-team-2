import React from 'react';

export interface PickerSheetProps {
  title: string;
  /** Label of the bottom action. Disabled until the caller says otherwise. */
  actionLabel: string;
  actionDisabled: boolean;
  onAction: () => void;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * The full-height selection sheet the design uses for both picker steps
 * (`בחר פרויקט`, `בחר משימה`): centred title with a close chevron, a scrolling
 * grouped list, and a single bottom action that stays disabled until something
 * is chosen.
 */
export function PickerSheet({
  title,
  actionLabel,
  actionDisabled,
  onAction,
  onClose,
  children,
}: PickerSheetProps) {
  return (
    <div dir="rtl" className="flex h-full w-full flex-col bg-lightBg" role="dialog" aria-label={title}>
      <header className="relative flex items-center justify-center px-4 py-4">
        <h2 className="text-base font-semibold text-navy">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="סגירה"
          className="absolute left-4 flex h-7 w-7 items-center justify-center rounded-full bg-white text-darkGray shadow-sm"
        >
          <span aria-hidden="true">›</span>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-4">{children}</div>

      <div className="px-4 pb-6 pt-2">
        <button
          type="button"
          onClick={onAction}
          disabled={actionDisabled}
          className={`w-full rounded-lg py-4 text-center text-base font-semibold text-white ${
            actionDisabled ? 'bg-darkGray/50' : 'bg-navy'
          }`}
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

export interface PickerGroupProps {
  /** Client name, shown as the small heading above its projects. */
  label: string;
  children: React.ReactNode;
}

export function PickerGroup({ label, children }: PickerGroupProps) {
  return (
    <section className="mb-4">
      <h3 className="mb-1 px-2 text-xs text-darkGray">{label}</h3>
      <div className="divide-y divide-black/5 overflow-hidden rounded-xl bg-white">{children}</div>
    </section>
  );
}

export interface PickerOptionProps {
  label: string;
  selected: boolean;
  onSelect: () => void;
}

export function PickerOption({ label, selected, onSelect }: PickerOptionProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className="flex w-full items-center justify-between px-4 py-3 text-right"
    >
      <span className={selected ? 'font-semibold text-blue-600' : 'text-navy'}>{label}</span>
      {selected ? (
        <span
          aria-hidden="true"
          className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[11px] text-white"
        >
          ✓
        </span>
      ) : null}
    </button>
  );
}
