export interface LockStatusIndicatorProps {
  year: number;
  month: number;
  /** ISO 8601 instant the month was locked. */
  lockedAt: string;
}

/** Calendar date of the lock in Asia/Jerusalem, as DD.MM.YYYY. */
const lockDateFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Jerusalem',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

/**
 * The lock badge for a closed month (KAN-83). Lock status is always readable,
 * even though the month itself is not editable (§7.1).
 */
export function LockStatusIndicator({ year, month, lockedAt }: LockStatusIndicatorProps) {
  const lockedOn = lockDateFormat.format(new Date(lockedAt)).replaceAll('/', '.');

  return (
    <div
      role="status"
      dir="rtl"
      className="flex items-center gap-2 rounded-lg bg-neutral-200 px-3 py-2 text-xs text-neutral-700"
    >
      <span aria-hidden="true">🔒</span>
      <span>
        חודש {month}/{year} ננעל בתאריך {lockedOn}
      </span>
    </div>
  );
}
