import { useEffect, useState } from 'react';
import type { MyAssignment, MyAssignmentsResponse } from '@abra/contracts';
import { authFetch } from '../../lib/api';

export interface TaskPickerProps {
  selectedTaskId?: string;
  onSelectTask: (assignment: MyAssignment) => void;
}

export function filterOpenAssignments(assignments: MyAssignment[]): MyAssignment[] {
  // Strictly filter out any null, empty, or closed task entries
  return assignments.filter(
    (a) =>
      a &&
      a.taskId &&
      a.taskName &&
      (a as unknown as { status?: string }).status !== 'CLOSED' &&
      (a as unknown as { deletedAt?: string | null }).deletedAt === undefined,
  );
}

export function TaskPicker({ selectedTaskId, onSelectTask }: TaskPickerProps) {
  const [assignments, setAssignments] = useState<MyAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    // Strictly fetch GET /api/v1/me/assignments without includeDeleted=true
    authFetch('/me/assignments')
      .then(async (res) => {
        if (!res.ok) {
          throw new Error('Failed to fetch assignments');
        }
        const json: MyAssignmentsResponse = await res.json();
        if (isMounted) {
          const openOnly = filterOpenAssignments(json.data ?? []);
          setAssignments(openOnly);
        }
      })
      .catch(() => {
        if (isMounted) {
          setError('שגיאה בטעינת המשימות');
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return <p className="text-sm text-neutral-500">טוען משימות…</p>;
  }

  if (error) {
    return (
      <p role="alert" className="text-sm text-red-600">
        {error}
      </p>
    );
  }

  if (assignments.length === 0) {
    return <p className="text-sm text-neutral-500">לא נמצאו משימות פעילות לשיוך</p>;
  }

  return (
    <div className="flex flex-col gap-1" dir="rtl">
      <label htmlFor="task-picker-select" className="text-sm font-medium text-neutral-700">
        בחירת משימה לדיווח
      </label>
      <select
        id="task-picker-select"
        value={selectedTaskId ?? ''}
        onChange={(e) => {
          const chosen = assignments.find((a) => a.taskId === e.target.value);
          if (chosen) {
            onSelectTask(chosen);
          }
        }}
        className="rounded border border-neutral-300 bg-white p-2 text-sm text-neutral-900 focus:border-blue-500 focus:outline-none"
      >
        <option value="">-- בחר משימה --</option>
        {assignments.map((a) => (
          <option key={a.taskId} value={a.taskId}>
            {a.taskName} ({a.projectName} - {a.clientName})
          </option>
        ))}
      </select>
    </div>
  );
}
