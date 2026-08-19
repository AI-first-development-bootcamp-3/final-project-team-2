// Figma page chrome (Admin Web Portal Spec §1): bold navy title with a muted
// one-line subtitle underneath, right-aligned in the RTL content area.
export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="mb-6">
      <h2 className="text-2xl font-bold text-navy">{title}</h2>
      <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>
    </header>
  );
}
