/**
 * TICKET-S8-011: E2E tests for Content Pipeline (firm content + industry news).
 * Covers auth protection and that admin content routes exist.
 * Full workflow (upload → approve → digest) requires admin auth and is manual or separate setup.
 */
const { test, expect } = require('@playwright/test');

test.describe('Content Pipeline', () => {
  test('content review API requires authentication', async ({ request }) => {
    const res = await request.get('/api/admin/content/review?status=pending');
    expect(res.status()).toBe(401);
  });

  test('content review API with invalid auth returns 403 or 401', async ({ request }) => {
    const res = await request.get('/api/admin/content/review?status=pending', {
      headers: { Authorization: 'Bearer invalid' },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('unauthenticated user visiting content upload is redirected to signin', async ({ page }) => {
    await page.goto('/admin/content/upload');
    await expect(page).toHaveURL(/\/signin/, { timeout: 10000 });
  });

  test('unauthenticated user visiting content review is redirected to signin', async ({ page }) => {
    await page.goto('/admin/content/review');
    await expect(page).toHaveURL(/\/signin/, { timeout: 10000 });
  });

  test('unauthenticated user visiting weekly review is redirected to signin', async ({ page }) => {
    await page.goto('/admin/content/weekly-review');
    await expect(page).toHaveURL(/\/signin/, { timeout: 10000 });
  });

  test('weekly-review API requires authentication', async ({ request }) => {
    const res = await request.get('/api/admin/content/weekly-review');
    expect(res.status()).toBe(401);
  });
});
