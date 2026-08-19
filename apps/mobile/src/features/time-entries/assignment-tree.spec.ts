import { describe, it, expect } from 'vitest';
import type { MyAssignment } from '@abra/contracts';
import { toProjectGroups, toTasks, findAssignment } from './assignment-tree';

function assignment(overrides: Partial<MyAssignment> = {}): MyAssignment {
  return {
    taskId: 'task-1',
    taskName: 'UI UX Design',
    projectId: 'project-1',
    projectName: 'Globaly',
    clientId: 'client-1',
    clientName: 'אל-על',
    reportType: 'TOTAL_HOURS',
    ...overrides,
  };
}

describe('toProjectGroups', () => {
  it('groups projects under their client', () => {
    const groups = toProjectGroups([
      assignment(),
      assignment({ taskId: 't2', projectId: 'project-2', projectName: 'Cargo' }),
      assignment({
        taskId: 't3',
        projectId: 'project-3',
        projectName: 'FLT',
        clientId: 'client-2',
        clientName: 'חשמלית אווירית',
      }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]?.clientName).toBe('אל-על');
    expect(groups[0]?.projects.map((project) => project.projectName)).toEqual(['Globaly', 'Cargo']);
    expect(groups[1]?.projects.map((project) => project.projectName)).toEqual(['FLT']);
  });

  it('lists a project once even when several of its tasks are assigned', () => {
    const groups = toProjectGroups([
      assignment({ taskId: 't1' }),
      assignment({ taskId: 't2', taskName: 'QA' }),
    ]);

    expect(groups[0]?.projects).toHaveLength(1);
  });

  it('returns nothing when the employee has no assignments', () => {
    expect(toProjectGroups([])).toEqual([]);
  });

  it('keeps only total-hours projects when asked', () => {
    // Manual entry is offered for סכום שעות projects; clock-in/out belongs to
    // the punch clock epic.
    const groups = toProjectGroups(
      [
        assignment(),
        assignment({ taskId: 't2', projectId: 'p2', projectName: 'Punch', reportType: 'CLOCK_IN_OUT' }),
      ],
      { reportType: 'TOTAL_HOURS' },
    );

    expect(groups[0]?.projects.map((project) => project.projectName)).toEqual(['Globaly']);
  });

  it('drops a client entirely when none of its projects qualify', () => {
    const groups = toProjectGroups([assignment({ reportType: 'CLOCK_IN_OUT' })], {
      reportType: 'TOTAL_HOURS',
    });

    expect(groups).toEqual([]);
  });
});

describe('toTasks', () => {
  const assignments = [
    assignment({ taskId: 't1', taskName: 'UI UX Design' }),
    assignment({ taskId: 't2', taskName: 'QA' }),
    assignment({ taskId: 't3', taskName: 'Other', projectId: 'project-2' }),
  ];

  it('returns the tasks of the chosen project only', () => {
    expect(toTasks(assignments, 'project-1').map((task) => task.taskName)).toEqual([
      'UI UX Design',
      'QA',
    ]);
  });

  it('returns nothing before a project is chosen', () => {
    expect(toTasks(assignments, undefined)).toEqual([]);
  });

  it('returns nothing for a project the employee is not assigned to', () => {
    expect(toTasks(assignments, 'project-999')).toEqual([]);
  });
});

describe('findAssignment', () => {
  const assignments = [assignment({ taskId: 't1' }), assignment({ taskId: 't2', taskName: 'QA' })];

  it('finds the row behind a chosen task', () => {
    expect(findAssignment(assignments, 't2')?.taskName).toBe('QA');
  });

  it('returns undefined when nothing is chosen', () => {
    expect(findAssignment(assignments, undefined)).toBeUndefined();
  });

  it('returns undefined for an unassigned task, so it can never be submitted', () => {
    expect(findAssignment(assignments, 'not-mine')).toBeUndefined();
  });
});
