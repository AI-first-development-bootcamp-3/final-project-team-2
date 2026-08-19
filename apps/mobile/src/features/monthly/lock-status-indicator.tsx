export interface LockStatusIndicatorProps {
  year: number;
  month: number;
  /** Whether the month is closed for editing (§7.1). */
  isLocked: boolean;
  /** ISO 8601 instant the month was locked, or null when unknown. */
  lockedAt: string | null;
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
 *
 * `isLocked` alone decides the read-only presentation: the lock instant is
 * bookkeeping, so a locked month with an unknown `lockedAt` still shows the
 * badge — only the date suffix is dropped.
 */
export function LockStatusIndicator({ year, month, isLocked, lockedAt }: LockStatusIndicatorProps) {
  if (!isLocked) {
    return null;
  }

  const lockedOn =
    lockedAt === null ? null : lockDateFormat.format(new Date(lockedAt)).replaceAll('/', '.');

  return (
    <div
      role="status"
      dir="rtl"
      className="flex items-center gap-2 rounded-lg bg-neutral-200 px-3 py-2 text-xs text-neutral-700"
    >
      <span aria-hidden="true">🔒</span>
      <span>
        {lockedOn === null
          ? `חודש ${month}/${year} נעול`
          : `חודש ${month}/${year} ננעל בתאריך ${lockedOn}`}
      </span>
    </div>
  );
}
