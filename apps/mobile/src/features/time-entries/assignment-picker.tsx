import React, { useState } from 'react';
import type { MyAssignment } from '@abra/contracts';
import { findAssignment, toProjectGroups, toTasks } from './assignment-tree';
import { PickerGroup, PickerOption, PickerSheet } from './picker-sheet';

export interface AssignmentPickerProps {
  assignments: readonly MyAssignment[];
  projectId: string;
  taskId: string;
  disabled?: boolean;
  error?: string;
  onChange: (next: { projectId: string; taskId: string }) => void;
}

type Sheet = 'project' | 'task' | null;

/**
 * Two-step picker matching the design: project (grouped under client names),
 * then task. Changing the project clears the task so the cascade cannot
 * submit a task from the previous project.
 */
export function AssignmentPicker({
  assignments,
  projectId,
  taskId,
  disabled = false,
  error,
  onChange,
}: AssignmentPickerProps) {
  const [sheet, setSheet] = useState<Sheet>(null);
  const [pendingProjectId, setPendingProjectId] = useState<string | undefined>(undefined);
  const [pendingTaskId, setPendingTaskId] = useState<string | undefined>(undefined);

  const groups = toProjectGroups(assignments, { reportType: 'TOTAL_HOURS' });
  const selected = findAssignment(assignments, taskId || undefined);
  const selectedProject =
    selected ?? assignments.find((assignment) => assignment.projectId === projectId);
  const tasks = toTasks(assignments, projectId || undefined);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setPendingProjectId(projectId || undefined);
          setSheet('project');
        }}
        aria-label="פרויקט"
        className="flex w-full items-center justify-between rounded-xl bg-white px-4 py-3 text-right disabled:opacity-60"
      >
        <span className="text-sm text-darkGray">פרויקט</span>
        <span className="text-base font-medium text-navy">
          {selectedProject
            ? `${selectedProject.clientName} · ${selectedProject.projectName}`
            : 'בחירה'}
        </span>
      </button>

      <button
        type="button"
        disabled={disabled || !projectId}
        onClick={() => {
          setPendingTaskId(taskId || undefined);
          setSheet('task');
        }}
        aria-label="משימה"
        className="flex w-full items-center justify-between rounded-xl bg-white px-4 py-3 text-right disabled:opacity-60"
      >
        <span className="text-sm text-darkGray">משימה</span>
        <span className="text-base font-medium text-navy">{selected?.taskName ?? 'בחירה'}</span>
      </button>
      {error ? (
        <p role="alert" className="text-xs font-medium text-red-600">
          {error}
        </p>
      ) : null}

      {sheet === 'project' ? (
        <div className="fixed inset-0 z-20">
          <PickerSheet
            title="בחר פרויקט"
            actionLabel="אישור"
            actionDisabled={!pendingProjectId}
            onClose={() => setSheet(null)}
            onAction={() => {
              const nextProjectId = pendingProjectId ?? '';
              onChange({
                projectId: nextProjectId,
                taskId: nextProjectId === projectId ? taskId : '',
              });
              setSheet(null);
            }}
          >
            {groups.map((group) => (
              <PickerGroup key={group.clientId} label={group.clientName}>
                {group.projects.map((project) => (
                  <PickerOption
                    key={project.projectId}
                    label={project.projectName}
                    selected={pendingProjectId === project.projectId}
                    onSelect={() => setPendingProjectId(project.projectId)}
                  />
                ))}
              </PickerGroup>
            ))}
          </PickerSheet>
        </div>
      ) : null}

      {sheet === 'task' ? (
        <div className="fixed inset-0 z-20">
          <PickerSheet
            title="בחר משימה"
            actionLabel="אישור"
            actionDisabled={!pendingTaskId}
            onClose={() => setSheet(null)}
            onAction={() => {
              onChange({ projectId, taskId: pendingTaskId ?? '' });
              setSheet(null);
            }}
          >
            <PickerGroup label={selectedProject?.projectName ?? ''}>
              {tasks.map((task) => (
                <PickerOption
                  key={task.taskId}
                  label={task.taskName}
                  selected={pendingTaskId === task.taskId}
                  onSelect={() => setPendingTaskId(task.taskId)}
                />
              ))}
            </PickerGroup>
          </PickerSheet>
        </div>
      ) : null}
    </div>
  );
}
