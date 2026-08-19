import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CreateAssignmentBodySchema,
  VAL_MESSAGES,
  type TaskListItem,
  type TasksListSuccess,
  type UserListItem,
  type UsersListSuccess,
} from '@abra/contracts';
import { ApiClientError, apiFetch } from '@/lib/api/client';

// KAN-121 (Admin Web Portal Spec §5.4, Figma 1-32981): the create-assignment
// modal keeps the task select first; once a task is chosen a breadcrumb of
// chips shows task ← project ← client. The employee dropdown is replaced by a
// rich picker: a search field plus a compact table (columns right→left: בחירה
// · מס' עובד · שם מלא · תפקיד · סוג · אחוז משרה · שיוך ארגוני) with
// multi-select checkboxes that accumulate across searches. The submit button
// is labeled שייך עובד למשימה and creates one assignment per selected
// employee; per-pair failures never abort the rest.

export type AssignmentCreateFormProps = {
  open: boolean;
  onClose: () => void;
  /** All selected employees were assigned — parent closes the modal and refreshes. */
  onCreated: () => void;
  /** Some (but not all) pairs succeeded — parent refreshes without closing. */
  onSomeCreated?: () => void;
};

type PairFailure = { user: UserListItem; message: string };

const PICKER_PAGE_SIZE = 8;

function displayValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function employmentTypeLabel(value: UserListItem['employmentType']): string {
  if (value === 'worker') return 'עובד';
  if (value === 'manager') return 'מנהל';
  return '—';
}

function employmentPercentLabel(value: UserListItem['employmentPercent']): string {
  if (value === null || value === undefined) return '—';
  return `${value}%`;
}

function messageForCreateError(err: unknown): string {
  if (err instanceof ApiClientError) {
    if (err.status === 409) return 'השיוך כבר קיים במערכת';
    if (err.status === 400 || err.status === 422) return VAL_MESSAGES['VAL-26'];
  }
  return 'לא ניתן ליצור את השיוך כרגע. נסו שוב.';
}

function ContextChip(props: { children: string }) {
  return (
    <span className="inline-flex h-7 items-center rounded bg-divider px-2 text-sm text-ink">
      {props.children}
    </span>
  );
}

export function AssignmentCreateForm({
  open,
  onClose,
  onCreated,
  onSomeCreated,
}: AssignmentCreateFormProps) {
  const [taskId, setTaskId] = useState('');
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [search, setSearch] = useState('');
  const [pickerPage, setPickerPage] = useState(1);
  // Selection accumulates across searches, keyed by user id, keeping the full
  // item so result messages can name employees even after the rows change.
  const [selected, setSelected] = useState<Map<string, UserListItem>>(new Map());
  const [saving, setSaving] = useState(false);
  const [createdNames, setCreatedNames] = useState<string[]>([]);
  const [failures, setFailures] = useState<PairFailure[]>([]);
  const savingRef = useRef(false);
  const usersReqSeq = useRef(0);

  useEffect(() => {
    if (!open) return;
    apiFetch<TasksListSuccess>('/tasks?limit=100&status=open')
      .then((res) => setTasks(res.data))
      .catch(() => {});
  }, [open]);

  // The users list endpoint supports q; searching goes back to the server so
  // the picker is not limited to the first page of employees. A sequence
  // guard drops stale responses when responses arrive out of order.
  useEffect(() => {
    if (!open) return;
    const seq = ++usersReqSeq.current;
    const params = new URLSearchParams({ limit: '100' });
    const trimmed = search.trim();
    if (trimmed) params.set('q', trimmed);
    apiFetch<UsersListSuccess>(`/users?${params.toString()}`)
      .then((res) => {
        if (seq !== usersReqSeq.current) return;
        setUsers(res.data.filter((u) => u.isActive));
        setPickerPage(1);
      })
      .catch(() => {});
  }, [open, search]);

  const selectedTask = useMemo(() => tasks.find((t) => t.id === taskId), [tasks, taskId]);

  const totalPickerPages = Math.max(1, Math.ceil(users.length / PICKER_PAGE_SIZE));
  const currentPickerPage = Math.min(pickerPage, totalPickerPages);
  const pageRows = users.slice(
    (currentPickerPage - 1) * PICKER_PAGE_SIZE,
    currentPickerPage * PICKER_PAGE_SIZE,
  );

  const canSubmit = taskId !== '' && selected.size > 0 && !saving;

  function resetForm() {
    setTaskId('');
    setSearch('');
    setPickerPage(1);
    setSelected(new Map());
    setCreatedNames([]);
    setFailures([]);
    setSaving(false);
  }

  function handleClose() {
    if (saving) return;
    resetForm();
    onClose();
  }

  function toggleSelected(user: UserListItem) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(user.id)) {
        next.delete(user.id);
      } else {
        next.set(user.id, user);
      }
      return next;
    });
  }

  async function handleSubmit() {
    if (savingRef.current || !canSubmit) return;
    setCreatedNames([]);
    setFailures([]);

    savingRef.current = true;
    setSaving(true);

    const succeeded: UserListItem[] = [];
    const failed: PairFailure[] = [];
    try {
      // One POST per selected employee, sequentially; a per-pair failure
      // (e.g. VAL-27 duplicate) must not abort the remaining pairs.
      for (const user of selected.values()) {
        const parsed = CreateAssignmentBodySchema.safeParse({ userId: user.id, taskId });
        if (!parsed.success) {
          failed.push({ user, message: VAL_MESSAGES['VAL-26'] });
          continue;
        }
        try {
          await apiFetch('/assignments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(parsed.data),
          });
          succeeded.push(user);
        } catch (err: unknown) {
          if (err instanceof ApiClientError && err.status === 401) return;
          failed.push({ user, message: messageForCreateError(err) });
        }
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }

    if (failed.length === 0) {
      resetForm();
      onCreated();
      return;
    }

    // Keep the modal open: drop the employees that were assigned from the
    // selection, and report which succeeded and which failed.
    setSelected((prev) => {
      const next = new Map(prev);
      for (const user of succeeded) next.delete(user.id);
      return next;
    });
    setCreatedNames(succeeded.map((user) => user.fullName));
    setFailures(failed);
    if (succeeded.length > 0) onSomeCreated?.();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" dir="rtl">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="assignment-create-title"
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-8 text-neutral-900 shadow-xl"
      >
        <button
          type="button"
          aria-label="סגירה"
          onClick={handleClose}
          className="absolute left-4 top-4 rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M18 6 6 18 M6 6l12 12" />
          </svg>
        </button>
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <div className="mb-6 flex items-start gap-4">
            <div>
              <h2 id="assignment-create-title" className="text-lg font-bold text-navy">
                שיוך חדש
              </h2>
              <p className="mt-1 text-xs text-neutral-500">
                בחרו משימה ולאחר מכן סמנו עובד אחד או יותר לשיוך.
              </p>
            </div>
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linkBlue text-white"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v8 M8 12h8" />
              </svg>
            </span>
          </div>

          <div className="space-y-4">
            <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
              משימה
              <select
                required
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              >
                <option value="">בחר משימה</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.projectName} - {t.clientName})
                  </option>
                ))}
              </select>
            </label>

            {selectedTask ? (
              <div
                aria-label="הקשר המשימה"
                className="flex flex-wrap items-center gap-2 text-sm text-grayIcon"
              >
                <ContextChip>{selectedTask.name}</ContextChip>
                <span aria-hidden="true">←</span>
                <ContextChip>{selectedTask.projectName}</ContextChip>
                <span aria-hidden="true">←</span>
                <ContextChip>{selectedTask.clientName}</ContextChip>
              </div>
            ) : null}

            <label className="relative block w-full">
              <span className="sr-only">חיפוש לפי שם עובד</span>
              <input
                type="search"
                value={search}
                placeholder="חיפוש לפי שם עובד"
                onChange={(event) => setSearch(event.target.value)}
                className="h-12 w-full rounded-lg bg-white pl-4 pr-10 text-sm text-ink shadow-sm ring-1 ring-divider placeholder:text-grayIcon focus:outline-none focus:ring-2 focus:ring-linkBlue/40"
              />
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grayIcon"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </label>

            <div className="overflow-x-auto rounded-lg ring-1 ring-divider">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-divider bg-neutral-50 text-right text-xs font-semibold text-grayIcon">
                    <th scope="col" className="px-3 py-2">
                      בחירה
                    </th>
                    <th scope="col" className="px-3 py-2">
                      מס' עובד
                    </th>
                    <th scope="col" className="px-3 py-2">
                      שם מלא
                    </th>
                    <th scope="col" className="px-3 py-2">
                      תפקיד
                    </th>
                    <th scope="col" className="px-3 py-2">
                      סוג
                    </th>
                    <th scope="col" className="px-3 py-2">
                      אחוז משרה
                    </th>
                    <th scope="col" className="px-3 py-2">
                      שיוך ארגוני
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-4 text-center text-grayIcon">
                        לא נמצאו עובדים
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((user) => (
                      <tr key={user.id} className="border-b border-divider last:border-b-0">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            aria-label={`בחירת ${user.fullName}`}
                            checked={selected.has(user.id)}
                            onChange={() => toggleSelected(user)}
                            className="h-4 w-4 accent-linkBlue"
                          />
                        </td>
                        <td className="px-3 py-2 text-ink">{displayValue(user.employeeNumber)}</td>
                        <td className="px-3 py-2 font-medium text-ink">{user.fullName}</td>
                        <td className="px-3 py-2 text-ink">{displayValue(user.roleTitle)}</td>
                        <td className="px-3 py-2 text-ink">
                          {employmentTypeLabel(user.employmentType)}
                        </td>
                        <td className="px-3 py-2 text-ink">
                          {employmentPercentLabel(user.employmentPercent)}
                        </td>
                        <td className="px-3 py-2 text-ink">{displayValue(user.orgUnit)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-grayIcon">
              <span aria-live="polite">
                {selected.size > 0 ? `נבחרו ${selected.size} עובדים` : 'לא נבחרו עובדים'}
              </span>
              {totalPickerPages > 1 ? (
                <span className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPickerPage((p) => Math.max(1, p - 1))}
                    disabled={currentPickerPage <= 1}
                    className="rounded px-2 py-1 text-linkBlue disabled:text-grayIcon"
                  >
                    הקודם
                  </button>
                  <span>
                    עמוד {currentPickerPage} מתוך {totalPickerPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPickerPage((p) => Math.min(totalPickerPages, p + 1))}
                    disabled={currentPickerPage >= totalPickerPages}
                    className="rounded px-2 py-1 text-linkBlue disabled:text-grayIcon"
                  >
                    הבא
                  </button>
                </span>
              ) : null}
            </div>

            {createdNames.length > 0 ? (
              <p role="status" className="text-sm text-green-700">
                שויכו בהצלחה: {createdNames.join(', ')}
              </p>
            ) : null}
            {failures.length > 0 ? (
              <div role="alert" className="text-sm text-red-600">
                <p>שגיאה בשיוך העובדים הבאים:</p>
                <ul className="mt-1 list-inside list-disc">
                  {failures.map((failure) => (
                    <li key={failure.user.id}>
                      {failure.user.fullName} — {failure.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="mt-8 space-y-2">
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full rounded-lg bg-linkBlue py-2.5 text-base font-bold text-white transition-colors hover:bg-linkBlue/90 disabled:bg-neutral-400"
            >
              {saving ? 'שומר…' : 'שייך עובד למשימה'}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="w-full rounded-lg py-2 text-sm text-neutral-500 transition-colors hover:bg-neutral-100"
            >
              ביטול
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
