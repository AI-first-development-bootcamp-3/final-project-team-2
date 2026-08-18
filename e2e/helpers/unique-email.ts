export function uniqueEmail(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `e2e.${Date.now()}.${random}@abra.co`;
}
