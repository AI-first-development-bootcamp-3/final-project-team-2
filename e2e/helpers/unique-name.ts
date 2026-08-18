export function uniqueName(kind: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `e2e.${kind}.${Date.now()}.${random}`;
}
