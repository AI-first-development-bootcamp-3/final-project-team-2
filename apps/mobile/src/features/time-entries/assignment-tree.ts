import type { MyAssignment, ReportType } from '@abra/contracts';

export interface PickerProject {
  projectId: string;
  projectName: string;
  clientId: string;
  clientName: string;
  reportType: ReportType;
}

export interface PickerClientGroup {
  clientId: string;
  clientName: string;
  projects: PickerProject[];
}

export interface PickerTask {
  taskId: string;
  taskName: string;
}

/**
 * Turns the flat assignment list into what the two picker sheets render.
 *
 * The design groups projects under client headings rather than making the
 * client a separate selection step, so the client is a label here, not a
 * choice. One `/me/assignments` response feeds both levels — the API already
 * scopes it to open tasks under active projects under active clients, so
 * nothing further needs filtering out.
 */
export function toProjectGroups(
  assignments: readonly MyAssignment[],
  options: { reportType?: ReportType } = {},
): PickerClientGroup[] {
  const groups = new Map<string, PickerClientGroup>();

  for (const assignment of assignments) {
    if (options.reportType !== undefined && assignment.reportType !== options.reportType) {
      continue;
    }

    let group = groups.get(assignment.clientId);
    if (group === undefined) {
      group = {
        clientId: assignment.clientId,
        clientName: assignment.clientName,
        projects: [],
      };
      groups.set(assignment.clientId, group);
    }

    // Several assigned tasks can share a project; the sheet lists it once.
    if (!group.projects.some((project) => project.projectId === assignment.projectId)) {
      group.projects.push({
        projectId: assignment.projectId,
        projectName: assignment.projectName,
        clientId: assignment.clientId,
        clientName: assignment.clientName,
        reportType: assignment.reportType,
      });
    }
  }

  return [...groups.values()];
}

/** The tasks the employee is assigned to within one project. */
export function toTasks(
  assignments: readonly MyAssignment[],
  projectId: string | undefined,
): PickerTask[] {
  if (projectId === undefined) {
    return [];
  }

  const tasks: PickerTask[] = [];
  for (const assignment of assignments) {
    if (assignment.projectId !== projectId) {
      continue;
    }
    if (!tasks.some((task) => task.taskId === assignment.taskId)) {
      tasks.push({ taskId: assignment.taskId, taskName: assignment.taskName });
    }
  }

  return tasks;
}

/** The assignment row behind a chosen task, for the labels the form shows. */
export function findAssignment(
  assignments: readonly MyAssignment[],
  taskId: string | undefined,
): MyAssignment | undefined {
  return taskId === undefined
    ? undefined
    : assignments.find((assignment) => assignment.taskId === taskId);
}
