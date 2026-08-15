import { test, expect } from '@playwright/test';

test.describe('API health check', () => {
  test('GET /health returns 200 with status ok', async ({ request }) => {
    const response = await request.get('http://localhost:3000/health');

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });
});
