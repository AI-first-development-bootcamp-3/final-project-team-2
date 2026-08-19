import emptyIllustration from '@/assets/empty-state-illustration.svg';

// Figma empty state (node 1-33175): centered bold navy "אין מידע קיים עד כה"
// above the shrugging-character illustration, inside the table card area.
export function EmptyState({ message = 'אין מידע קיים עד כה' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center gap-8 rounded-xl bg-white py-16 shadow-sm ring-1 ring-neutral-200/60">
      <p className="text-lg font-bold text-navy">{message}</p>
      <img src={emptyIllustration} alt="" className="h-64 w-auto" aria-hidden="true" />
    </div>
  );
}
