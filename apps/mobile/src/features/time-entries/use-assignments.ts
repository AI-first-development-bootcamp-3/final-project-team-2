import { useCallback, useEffect, useState } from 'react';
import { MyAssignmentsResponseSchema, type MyAssignment } from '@abra/contracts';
import { authFetch } from '../../lib/api';

export type AssignmentsState =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; assignments: MyAssignment[] };

/**
 * Loads the employee's task assignments once.
 *
 * One request feeds the whole cascading picker: the API already returns each
 * assignment with its task, project and client, scoped to open tasks under
 * active projects under active clients. Grouping the three levels client-side
 * avoids a request per cascade step, and assignment counts per employee are
 * small enough that fetching them all is cheaper than paging.
 */
export function useAssignments(): AssignmentsState & { reload: () => void } {
  const [state, setState] = useState<AssignmentsState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => {
    setAttempt((previous) => previous + 1);
  }, []);

  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });

    authFetch('/me/assignments')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('failed to load assignments');
        }
        // Parsed rather than trusted: a shape change should surface as the
        // error state, not as an undefined halfway through the picker.
        const body = MyAssignmentsResponseSchema.parse(await response.json());
        if (active) {
          setState({ status: 'ready', assignments: body.data });
        }
      })
      .catch(() => {
        if (active) {
          setState({ status: 'error' });
        }
      });

    return () => {
      active = false;
    };
  }, [attempt]);

  return { ...state, reload };
}
