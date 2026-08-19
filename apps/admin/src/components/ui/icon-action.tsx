// Figma actions column (node 1-33484): icon-only buttons — blue pencil, red
// trash — extended with key/restore/unlink for actions the design doesn't
// cover. The aria-label carries the exact previous button text so every
// getByRole('button', { name }) selector (unit + e2e) keeps resolving.

const ICONS = {
  edit: 'M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z',
  trash:
    'M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M10 11v6 M14 11v6',
  key: 'M21 2l-2 2 M15.5 7.5 19 4 M21 2l1 1-3.5 3.5 M11.39 11.61a5.5 5.5 0 1 0-1 1Z M11.39 11.61 15.5 7.5 M15.5 7.5l3 3L22 7l-3-3',
  restore: 'M3 12a9 9 0 1 0 3-6.7 M3 3v6h6',
  unlink:
    'M10 13a5 5 0 0 0 7.54.54l1.92-1.92 M14 11a5 5 0 0 0-7.54-.54L4.54 12.38 M8 2v3 M2 8h3 M16 22v-3 M22 16h-3',
  plus: 'M12 5v14 M5 12h14',
  list: 'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',
} as const;

const COLORS = {
  edit: 'text-blue-600 hover:bg-blue-50',
  trash: 'text-red-600 hover:bg-red-50',
  key: 'text-amber-600 hover:bg-amber-50',
  restore: 'text-green-600 hover:bg-green-50',
  unlink: 'text-red-600 hover:bg-red-50',
  plus: 'text-green-600 hover:bg-green-50',
  list: 'text-blue-600 hover:bg-blue-50',
} as const;

export function IconAction(props: {
  kind: keyof typeof ICONS;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={props.label}
      title={props.label}
      onClick={props.onClick}
      className={`rounded-md p-1.5 transition-colors ${COLORS[props.kind]}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
        aria-hidden="true"
      >
        <path d={ICONS[props.kind]} />
      </svg>
    </button>
  );
}
