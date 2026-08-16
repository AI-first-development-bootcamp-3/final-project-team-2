import { test, expect } from '@playwright/test';
import { API_BASE_URL } from '../playwright.config';

test.describe('API health check', () => {
  test('GET /health returns 200 with status ok', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/health`);

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });
});
