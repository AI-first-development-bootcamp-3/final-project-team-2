import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ProjectListItem, ProjectsListSuccess, ReportType } from '@abra/contracts';
import { apiFetch } from '@/lib/api/client';

const PAGE_SIZE = 20;

export function ReportingSettingsPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [result, setResult] = useState<ProjectsListSuccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchProjects = useCallback(() => {
    setLoading(true);
    setError(null);
    const search = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
      sort: 'name',
      order: 'asc',
    });
    if (q.trim()) search.set('q', q.trim());

    apiFetch<ProjectsListSuccess>(`/projects?${search.toString()}`)
      .then((data) => setResult(data))
      .catch(() => setError('שגיאה בטעינת הפרויקטים'))
      .finally(() => setLoading(false));
  }, [page, q]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleReportTypeChange = async (project: ProjectListItem, nextType: ReportType) => {
    if (project.reportType === nextType || updatingId) return;
    setUpdatingId(project.id);
    setSuccessMessage(null);
    try {
      await apiFetch(`/projects/${project.id}/report-type`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportType: nextType }),
      });
      setSuccessMessage(`אופן הדיווח לפרויקט "${project.name}" עודכן בהצלחה`);
      fetchProjects();
    } catch {
      setError('שגיאה בעדכון אופן הדיווח');
    } finally {
      setUpdatingId(null);
    }
  };

  const totalPages = useMemo(
    () => (result ? Math.ceil(result.meta.total / PAGE_SIZE) : 1),
    [result],
  );

  return (
    <section dir="rtl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-neutral-900">הגדרת דיווחי שעות</h2>
      </div>

      {successMessage ? (
        <div
          role="status"
          className="mb-4 flex items-center justify-between rounded bg-green-100 p-3 text-sm text-green-800"
        >
          <span>{successMessage}</span>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-xs font-bold"
          >
            ✕
          </button>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col text-sm">
          חיפוש פרויקט / לקוח
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="חפש לפי שם..."
            className="rounded border px-2 py-1"
          />
        </label>
      </div>

      {loading ? <p>טוען…</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {!loading && !error && result && result.data.length === 0 ? <p>לא נמצאו פרויקטים</p> : null}

      {!loading && !error && result && result.data.length > 0 ? (
        <div className="overflow-x-auto rounded border bg-white shadow-sm">
          <table className="w-full text-right text-sm">
            <thead className="border-b bg-neutral-100 font-semibold text-neutral-700">
              <tr>
                <th className="px-4 py-3">לקוח</th>
                <th className="px-4 py-3">שם פרויקט</th>
                <th className="px-4 py-3">סוג דיווח</th>
              </tr>
            </thead>
            <tbody className="divide-y text-neutral-800">
              {result.data.map((proj) => (
                <tr key={proj.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">{proj.clientName}</td>
                  <td className="px-4 py-3 font-medium">{proj.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-6">
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name={`report-type-${proj.id}`}
                          value="TOTAL_HOURS"
                          checked={proj.reportType === 'TOTAL_HOURS'}
                          disabled={updatingId === proj.id}
                          onChange={() => handleReportTypeChange(proj, 'TOTAL_HOURS')}
                          className="h-4 w-4 text-neutral-900 focus:ring-neutral-900"
                        />
                        <span>סכום שעות</span>
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name={`report-type-${proj.id}`}
                          value="CLOCK_IN_OUT"
                          checked={proj.reportType === 'CLOCK_IN_OUT'}
                          disabled={updatingId === proj.id}
                          onChange={() => handleReportTypeChange(proj, 'CLOCK_IN_OUT')}
                          className="h-4 w-4 text-neutral-900 focus:ring-neutral-900"
                        />
                        <span>כניסה / יציאה</span>
                      </label>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 ? (
            <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
              <span>
                עמוד {page} מתוך {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded border px-3 py-1 disabled:opacity-50"
                >
                  הקודם
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded border px-3 py-1 disabled:opacity-50"
                >
                  הבא
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
