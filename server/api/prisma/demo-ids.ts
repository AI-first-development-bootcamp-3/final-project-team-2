/** Stable demo identity constants for wipe-safe local seeding (US2/US3). */

export const DEMO_PASSWORD = 'Password123!';

export const DEMO_EMAILS = {
  admin: 'admin@demo.abra.local',
  employeeFull: 'employee.full@demo.abra.local',
  employeePartial: 'employee.partial@demo.abra.local',
} as const;

export const DEMO_IDS = {
  users: {
    admin: '11111111-1111-4111-8111-111111111111',
    employeeFull: '22222222-2222-4222-8222-222222222222',
    employeePartial: '33333333-3333-4333-8333-333333333333',
  },
  clients: {
    alpha: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    beta: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  },
  projects: {
    alphaOne: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    alphaTwo: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    betaOne: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  },
  tasks: {
    alphaOneTask: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    alphaTwoTask: '10101010-1010-4010-8010-101010101010',
    betaOneTask: '12121212-1212-4212-8212-121212121212',
  },
} as const;
