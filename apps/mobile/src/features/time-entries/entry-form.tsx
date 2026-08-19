import React, { useEffect, useMemo, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import {
  ApiErrorSchema,
  CreateTimeEntryBodySchema,
  TimeEntriesListSuccessSchema,
  VAL_MESSAGES,
  toLocalDate,
  zodIssuesToDetails,
  type TimeEntryListItem,
} from '@abra/contracts';
import { AssignmentPicker } from './assignment-picker';
import { toProjectGroups } from './assignment-tree';
import { partitionDetails, type EntryField } from './field-details';
import { addLocalDay, formTimesToUtc, utcIsoToLocalClock } from './local-clock';
import { useAssignments } from './use-assignments';
import { authFetch } from '../../lib/api';

const LOCATIONS = [
  { value: 'office', label: 'משרד' },
  { value: 'client_site', label: 'אצל לקוח' },
  { value: 'home', label: 'בית' },
] as const;

export type EntryFormValues = {
  date: string;
  startTime: string;
  endTime: string;
  location: '' | 'office' | 'client_site' | 'home';
  description: string;
  taskId: string;
  projectId: string;
};

export type EntryFormProps = {
  mode: 'new' | 'edit';
  entryId?: string;
  initialEntry?: TimeEntryListItem;
  locked?: boolean;
  defaultDate?: string;
  onSaved?: () => void;
  onCancel?: () => void;
};

function valuesFromEntry(entry: TimeEntryListItem): EntryFormValues {
  const start = utcIsoToLocalClock(entry.startAt);
  const end = entry.endAt ? utcIsoToLocalClock(entry.endAt) : { time: '' };
  return {
    date: entry.date,
    startTime: start.time,
    endTime: end.time,
    location: entry.location ?? '',
    description: entry.description ?? '',
    taskId: entry.taskId ?? '',
    projectId: entry.projectId ?? '',
  };
}

function toCreateBody(values: EntryFormValues) {
  const hasTimes = values.startTime.length > 0 && values.endTime.length > 0;
  const times = hasTimes
    ? formTimesToUtc(values.date, values.startTime, values.endTime)
    : { date: values.date, startAt: values.startTime, endAt: values.endTime };

  return {
    taskId: values.taskId,
    date: times.date,
    startAt: times.startAt,
    endAt: times.endAt,
    location: values.location === '' ? undefined : values.location,
    ...(values.description.trim() ? { description: values.description.trim() } : {}),
  };
}

const entryFormResolver: Resolver<EntryFormValues> = async (values) => {
  const parsed = CreateTimeEntryBodySchema.safeParse(toCreateBody(values));
  if (parsed.success) {
    return { values, errors: {} };
  }

  const { fieldErrors, formError } = partitionDetails(zodIssuesToDetails(parsed.error.issues));
  const errors: Record<string, { type: string; message: string }> = {};
  for (const [field, message] of Object.entries(fieldErrors) as [EntryField, string][]) {
    errors[field] = { type: 'validate', message };
  }
  if (formError) {
    errors.root = { type: 'validate', message: formError };
  }
  return { values: {}, errors };
};

export function EntryForm({
  mode,
  entryId,
  initialEntry,
  locked = false,
  defaultDate,
  onSaved,
  onCancel,
}: EntryFormProps) {
  const assignments = useAssignments();
  const [loadedEntry, setLoadedEntry] = useState(initialEntry);
  const [loadError, setLoadError] = useState(false);
  const [monthLocked, setMonthLocked] = useState(locked);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const today = defaultDate ?? toLocalDate(new Date());
  const defaults = useMemo<EntryFormValues>(
    () =>
      loadedEntry
        ? valuesFromEntry(loadedEntry)
        : {
            date: today,
            startTime: '',
            endTime: '',
            location: '',
            description: '',
            taskId: '',
            projectId: '',
          },
    [loadedEntry, today],
  );

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    reset,
    formState: { errors },
  } = useForm<EntryFormValues>({
    resolver: entryFormResolver,
    defaultValues: defaults,
  });

  useEffect(() => {
    reset(defaults);
  }, [defaults, reset]);

  useEffect(() => {
    setMonthLocked(locked);
  }, [locked]);

  useEffect(() => {
    if (mode !== 'edit' || initialEntry || !entryId) {
      return;
    }

    const from = addLocalDay(today, -400);
    const to = addLocalDay(today, 400);
    let active = true;

    authFetch(`/time-entries?from=${from}&to=${to}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('failed to load entry');
        }
        const body = TimeEntriesListSuccessSchema.parse(await response.json());
        const found = body.data.find((entry) => entry.id === entryId);
        if (!found) {
          throw new Error('entry not found');
        }
        if (active) {
          setLoadedEntry(found);
        }
      })
      .catch(() => {
        if (active) {
          setLoadError(true);
        }
      });

    return () => {
      active = false;
    };
  }, [mode, initialEntry, entryId, today]);

  const projectId = watch('projectId');
  const taskId = watch('taskId');
  const readOnly = monthLocked;
  const readyAssignments = assignments.status === 'ready' ? assignments.assignments : [];
  const totalHoursGroups = toProjectGroups(readyAssignments, { reportType: 'TOTAL_HOURS' });
  const noWork = assignments.status === 'ready' && totalHoursGroups.length === 0;

  async function onSubmit(values: EntryFormValues) {
    setFormError(null);
    setSaving(true);
    try {
      const payload = toCreateBody(values);
      const path = mode === 'new' ? '/time-entries' : `/time-entries/${entryId}`;
      const response = await authFetch(path, {
        method: mode === 'new' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body: unknown = await response.json().catch(() => ({}));
        const parsed = ApiErrorSchema.safeParse(body);
        const details = parsed.success ? (parsed.data.details ?? []) : [];
        const mapped = partitionDetails(details);
        for (const [field, message] of Object.entries(mapped.fieldErrors) as [
          EntryField,
          string,
        ][]) {
          setError(field, { type: 'server', message });
        }
        if (details.some((detail) => detail.rule === 'VAL-34')) {
          setMonthLocked(true);
          setFormError(VAL_MESSAGES['VAL-34']);
        } else {
          setFormError(mapped.formError);
        }
        return;
      }

      onSaved?.();
    } catch {
      setFormError('אופססס... אין מידע זמין כרגע, נסה שוב מאוחר יותר או פנה למנהל ישיר');
    } finally {
      setSaving(false);
    }
  }

  const hasFieldErrors = Boolean(
    errors.taskId || errors.startTime || errors.endTime || errors.location || errors.date,
  );

  return (
    <form
      dir="rtl"
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="mx-auto flex min-h-screen w-full max-w-[393px] flex-col gap-4 bg-lightBg p-4 font-sans"
    >
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-navy">דיווח ידני</h1>
        {onCancel ? (
          <button type="button" onClick={onCancel} className="text-sm text-darkGray">
            ביטול
          </button>
        ) : null}
      </header>

      {readOnly ? (
        <p role="status" className="rounded-lg bg-white px-4 py-3 text-sm font-medium text-navy">
          החודש נעול
        </p>
      ) : null}

      {hasFieldErrors ? (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-right">
          <p className="font-semibold text-navy">חסר לנו פרט או שניים</p>
          <p className="text-sm text-darkGray">
            מלא את כל הנתונים הדרושים כדי שנוכל לשמור את הדיווח בהצלחה
          </p>
        </div>
      ) : null}

      {formError || errors.root?.message ? (
        <p role="alert" className="text-sm font-medium text-red-600">
          {formError ?? errors.root?.message}
        </p>
      ) : null}

      {assignments.status === 'loading' ? (
        <p className="text-sm text-darkGray">טוען שיבוצים…</p>
      ) : null}
      {assignments.status === 'error' ? (
        <p role="alert" className="text-sm text-red-600">
          לא ניתן לטעון שיבוצים כרגע.
        </p>
      ) : null}
      {loadError ? (
        <p role="alert" className="text-sm text-red-600">
          לא ניתן לטעון את הדיווח.
        </p>
      ) : null}

      {noWork ? (
        <p role="status" className="rounded-lg bg-white px-4 py-3 text-sm text-navy">
          אין עבודה זמינה לדיווח. פנה למנהל לשיבוץ למשימה.
        </p>
      ) : assignments.status === 'ready' ? (
        <AssignmentPicker
          assignments={readyAssignments}
          projectId={projectId}
          taskId={taskId}
          disabled={readOnly}
          error={errors.taskId?.message}
          onChange={(next) => {
            setValue('projectId', next.projectId, { shouldDirty: true });
            setValue('taskId', next.taskId, { shouldDirty: true, shouldValidate: true });
          }}
        />
      ) : null}

      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="startTime" className="text-sm font-medium text-navy">
            שעת התחלה
          </label>
          <input
            id="startTime"
            type="time"
            disabled={readOnly}
            className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-base"
            {...register('startTime')}
          />
          {errors.startTime?.message ? (
            <span role="alert" className="text-xs font-medium text-red-600">
              {errors.startTime.message}
            </span>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="endTime" className="text-sm font-medium text-navy">
            שעת סיום
          </label>
          <input
            id="endTime"
            type="time"
            disabled={readOnly}
            className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-base"
            {...register('endTime')}
          />
          {errors.endTime?.message ? (
            <span role="alert" className="text-xs font-medium text-red-600">
              {errors.endTime.message}
            </span>
          ) : null}
        </div>
      </div>

      <fieldset disabled={readOnly} className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-navy">
          מיקום <span className="text-red-600">*</span>
        </legend>
        <div className="flex flex-col gap-1 rounded-xl bg-white px-2 py-1">
          {LOCATIONS.map((location) => (
            <label key={location.value} className="flex items-center justify-between px-2 py-2">
              <span>{location.label}</span>
              <input type="radio" value={location.value} {...register('location')} />
            </label>
          ))}
        </div>
        {errors.location?.message ? (
          <span role="alert" className="text-xs font-medium text-red-600">
            {errors.location.message}
          </span>
        ) : null}
      </fieldset>

      <div className="flex flex-col gap-1">
        <label htmlFor="description" className="text-sm font-medium text-navy">
          תיאור
        </label>
        <textarea
          id="description"
          disabled={readOnly}
          rows={3}
          placeholder="תיאור העבודה בכמה מילים, לא ארוך מידי…"
          className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-base"
          {...register('description')}
        />
      </div>

      {readOnly ? null : (
        <button
          type="submit"
          disabled={saving || noWork}
          className="mt-auto w-full rounded-lg bg-navy py-4 text-base font-semibold text-white disabled:opacity-60"
        >
          שמירה
        </button>
      )}
    </form>
  );
}
