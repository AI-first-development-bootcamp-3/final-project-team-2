import type { Location } from 'react-router-dom';

// RequireAdmin stashes the bounced-from location in navigation state; this is
// the one typed reader for that contract (no inline casts at call sites).
export function requestedPathFrom(location: Location): string | null {
  const state = location.state as { from?: { pathname?: string } } | null;
  return state?.from?.pathname ?? null;
}
