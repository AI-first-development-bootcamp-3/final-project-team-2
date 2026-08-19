import type { ReactNode, SelectHTMLAttributes } from 'react';

// Figma toolbar controls, exact values from the design frames: search Field is
// 400×48 white with an inline magnifier and #848891 placeholder; the primary
// button (base_Button) is #0C69FF, 48px tall, 12×16 padding, radius 8, bold
// label. Labels stay in the DOM (sr-only) so getByLabel selectors keep working.

export function SearchField(props: {
  label?: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const label = props.label ?? 'חיפוש';
  return (
    <label className="relative block w-full max-w-[400px]">
      <span className="sr-only">{label}</span>
      <input
        type="search"
        value={props.value}
        placeholder={props.placeholder}
        onChange={(event) => props.onChange(event.target.value)}
        className="h-12 w-full rounded-lg bg-white pl-4 pr-10 text-sm text-ink shadow-sm ring-1 ring-divider placeholder:text-grayIcon focus:outline-none focus:ring-2 focus:ring-linkBlue/40"
      />
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grayIcon"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </svg>
    </label>
  );
}

export function FilterSelect({
  label,
  children,
  ...rest
}: { label: string; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="flex items-center gap-2 text-sm text-neutral-600">
      <span>{label}</span>
      <select
        {...rest}
        className="h-12 rounded-lg bg-white px-3 text-sm text-ink shadow-sm ring-1 ring-divider focus:outline-none focus:ring-2 focus:ring-linkBlue/40"
      >
        {children}
      </select>
    </label>
  );
}

export function PrimaryButton(props: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className="h-12 rounded-lg bg-linkBlue px-4 text-lg font-bold text-white shadow-sm transition-colors hover:bg-linkBlue/90 disabled:opacity-50"
    >
      {props.children}
    </button>
  );
}
