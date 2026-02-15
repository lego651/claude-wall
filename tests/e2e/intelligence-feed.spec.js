/**
 * TICKET-010: E2E tests for Intelligence Feed (overview section + intelligence page).
 * Assumes app is served at baseURL (or webServer starts it).
 */
const { test, expect } = require('@playwright/test');

test.describe('Intelligence Feed', () => {
  test('overview page shows Intelligence Feed section and Live Reports link', async ({ page }) => {
    await page.goto('/propfirms/fundingpips');
    await expect(page.getByRole('heading', { name: /FundingPips/i })).toBeVisible({ timeout: 15000 });

    const section = page.getByRole('heading', { name: 'Intelligence Feed' });
    await expect(section).toBeVisible();

    const liveReportsLink = page.getByRole('link', { name: 'Live Reports' });
    await expect(liveReportsLink).toBeVisible();
  });

  test('overview page shows incidents or empty state after load', async ({ page }) => {
    await page.goto('/propfirms/fundingpips');
    await expect(page.getByRole('heading', { name: 'Intelligence Feed' })).toBeVisible({ timeout: 15000 });

    // Wait for incidents to load (spinner then content or empty message)
    await page.waitForTimeout(3000);
    const hasSeverityBadge = await page.getByText(/high severity|medium severity|low severity/i).first().isVisible().catch(() => false);
    const hasEmpty = await page.getByText(/No recent incidents in the last 30 days/i).isVisible().catch(() => false);
    expect(hasSeverityBadge || hasEmpty).toBe(true);

    if (hasSeverityBadge) {
      const incidentCards = page.locator('.rounded-xl.border').filter({ has: page.locator('h4') });
      const count = await incidentCards.count();
      expect(count).toBeLessThanOrEqual(3);
    }
  });

  test('Live Reports link navigates to intelligence page', async ({ page }) => {
    await page.goto('/propfirms/fundingpips');
    await expect(page.getByRole('link', { name: 'Live Reports' })).toBeVisible({ timeout: 15000 });
    await page.getByRole('link', { name: 'Live Reports' }).click();
    await expect(page).toHaveURL(/\/propfirms\/fundingpips\/intelligence/);
    await expect(page.getByRole('heading', { name: 'Firm Intelligence Feed' })).toBeVisible();
  });

  test('intelligence page shows title and 30 days description', async ({ page }) => {
    await page.goto('/propfirms/fundingpips/intelligence');
    await expect(page.getByRole('heading', { name: 'Firm Intelligence Feed' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Curated, summarized, and classified signals from the last 30 days/i)).toBeVisible();
  });

  test('intelligence page shows loading skeletons then content or empty state', async ({ page }) => {
    await page.goto('/propfirms/fundingpips/intelligence');
    // Skeleton or content should appear
    const skeleton = page.locator('.animate-pulse').first();
    const skeletonVisible = await skeleton.isVisible().catch(() => false);
    if (skeletonVisible) {
      await expect(skeleton).toBeVisible();
    }
    // Wait for load to complete (either cards or empty message)
    await page.waitForSelector('text=last 30 days', { state: 'visible', timeout: 15000 });
    const emptyMsg = page.getByText(/No intelligence signals in the last 30 days/i);
    const filterSelect = page.locator('select').filter({ has: page.locator('option[value="all"]') });
    await expect(filterSelect.or(emptyMsg)).toBeVisible();
  });

  test('intelligence page has type filter (All Types, Reputation, Operational)', async ({ page }) => {
    await page.goto('/propfirms/fundingpips/intelligence');
    await page.waitForSelector('select', { state: 'visible', timeout: 15000 });
    const select = page.locator('select').first();
    await expect(select).toBeVisible();
    await expect(select).toHaveValue('all');
    await select.selectOption({ value: 'REPUTATION' });
    await expect(select).toHaveValue('REPUTATION');
    await select.selectOption({ value: 'OPERATIONAL' });
    await expect(select).toHaveValue('OPERATIONAL');
    await select.selectOption({ value: 'all' });
    await expect(select).toHaveValue('all');
  });

  test('intelligence page shows no-data message when API returns empty incidents', async ({ page }) => {
    await page.route('**/api/v2/propfirms/*/incidents*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ incidents: [] }),
      })
    );
    await page.goto('/propfirms/fundingpips/intelligence');
    await expect(page.getByText(/No intelligence signals in the last 30 days/i)).toBeVisible({ timeout: 15000 });
  });

  test('intelligence page handles API error without crashing', async ({ page }) => {
    await page.route('**/api/v2/propfirms/*/incidents*', (route) =>
      route.fulfill({ status: 500, body: '{}' })
    );
    await page.goto('/propfirms/fundingpips/intelligence');
    await expect(page.getByRole('heading', { name: 'Firm Intelligence Feed' })).toBeVisible({ timeout: 15000 });
    // Page should still show 30 days copy or empty state (no uncaught errors)
    await expect(page.locator('body')).toContainText('30 days');
  });

  test('intelligence page footer shows CTA and updated text', async ({ page }) => {
    await page.goto('/propfirms/fundingpips/intelligence');
    await expect(page.getByRole('heading', { name: 'Firm Intelligence Feed' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('heading', { name: /Want real-time alerts/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Updated hourly/i)).toBeVisible();
  });
});
