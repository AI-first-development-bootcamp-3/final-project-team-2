import type { ReactNode, SelectHTMLAttributes } from 'react';

// Figma toolbar controls (node 1-32935): a large white rounded search field
// with an inline magnifier and placeholder, and a blue pill primary button.
// Labels stay in the DOM (sr-only) so getByLabel selectors keep working.

export function SearchField(props: {
  label?: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const label = props.label ?? 'חיפוש';
  return (
    <label className="relative block w-full max-w-md">
      <span className="sr-only">{label}</span>
      <input
        type="search"
        value={props.value}
        placeholder={props.placeholder}
        onChange={(event) => props.onChange(event.target.value)}
        className="h-10 w-full rounded-lg bg-white pl-4 pr-10 text-sm text-neutral-800 shadow-sm ring-1 ring-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-navy/40"
      />
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
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
        className="h-10 rounded-lg bg-white px-3 text-sm text-neutral-800 shadow-sm ring-1 ring-neutral-200 focus:outline-none focus:ring-2 focus:ring-navy/40"
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
      className="h-10 rounded-full bg-blue-600 px-6 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
    >
      {props.children}
    </button>
  );
}
