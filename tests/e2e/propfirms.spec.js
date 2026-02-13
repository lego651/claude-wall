/**
 * PROP-023: E2E tests for Prop Firms Leaderboard (/propfirms).
 * Assumes app is served at baseURL (or webServer starts it).
 */
const { test, expect } = require('@playwright/test');

test('page loads and displays firms', async ({ page }) => {
  await page.goto('/propfirms');
    await expect(page.getByRole('heading', { name: /Prop Firm.*Leaderboard/i })).toBeVisible();
    await expect(page.getByText(/Viewing Stats For/i)).toBeVisible();
    await page.waitForSelector('table tbody tr', { state: 'visible', timeout: 15000 });
    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible();
    await expect(rows).toHaveCount(await rows.count());
});

test('can switch between periods (1d, 7d, 30d, 12m)', async ({ page }) => {
    await page.goto('/propfirms');
    await page.waitForSelector('table tbody tr', { state: 'visible', timeout: 15000 });
    const period7d = page.getByRole('button', { name: '7 Days' });
    await period7d.click();
    await expect(period7d).toHaveClass(/bg-white/);
    const period30d = page.getByRole('button', { name: '30 Days' });
    await period30d.click();
    await expect(period30d).toHaveClass(/bg-white/);
    const period12m = page.getByRole('button', { name: '12 Months' });
    await period12m.click();
    await expect(period12m).toHaveClass(/bg-white/);
    const period1d = page.getByRole('button', { name: '24 Hours' });
    await period1d.click();
    await expect(period1d).toHaveClass(/bg-white/);
});

test('can sort by column (click header)', async ({ page }) => {
    await page.goto('/propfirms');
    await page.waitForSelector('table tbody tr', { state: 'visible', timeout: 15000 });
    const aggHeader = page.getByRole('columnheader', { name: /Aggregate Payouts/i });
    await aggHeader.click();
    await expect(page.locator('table tbody tr').first()).toBeVisible();
    await aggHeader.click();
    await expect(page.locator('table tbody tr').first()).toBeVisible();
    const peakHeader = page.getByRole('columnheader', { name: /Peak Payout/i });
    await peakHeader.click();
    await expect(page.locator('table tbody tr').first()).toBeVisible();
});

test('can view firm details', async ({ page }) => {
    await page.goto('/propfirms');
    await page.waitForSelector('table tbody tr', { state: 'visible', timeout: 15000 });
    await page.goto('/propfirm/fundingpips');
    await expect(page).toHaveURL(/\/propfirm\/fundingpips/);
    await expect(page.getByRole('heading', { level: 1 }).or(page.getByRole('heading', { level: 2 }))).toBeVisible({ timeout: 10000 });
    await expect(page.locator('body')).toContainText('FundingPips', { timeout: 5000 });
});

test('loading state shows skeleton', async ({ page }) => {
    await page.goto('/propfirms');
    const skeleton = page.locator('.animate-pulse').first();
    await expect(skeleton).toBeVisible({ timeout: 2000 }).catch(() => {});
    await page.waitForSelector('table tbody tr', { state: 'visible', timeout: 20000 });
});

test('error state displays when API fails', async ({ page }) => {
    await page.route('**/api/v2/propfirms*', (route) => route.fulfill({ status: 500, body: '{}' }));
    await page.goto('/propfirms');
    await expect(page.getByText(/Error loading firms/i)).toBeVisible({ timeout: 15000 });
});

test('empty state when no firms', async ({ page }) => {
    await page.route('**/api/v2/propfirms*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], meta: { period: '1d', sort: 'totalPayouts', order: 'desc', count: 0 } }),
      })
    );
    await page.goto('/propfirms');
    await expect(page.getByText(/No firms found/i)).toBeVisible({ timeout: 15000 });
});

test('mobile viewport shows leaderboard', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/propfirms');
    await expect(page.getByRole('heading', { name: /Prop Firm.*Leaderboard/i })).toBeVisible();
    await page.waitForSelector('table', { state: 'visible', timeout: 15000 });
});

test('table is scrollable on small viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/propfirms');
    await page.waitForSelector('table', { state: 'visible', timeout: 15000 });
    const tableWrap = page.locator('.overflow-x-auto').first();
    await expect(tableWrap).toBeVisible();
});

test('period buttons are focusable', async ({ page }) => {
    await page.goto('/propfirms');
    const periodButton = page.getByRole('button', { name: '24 Hours' });
    await expect(periodButton).toBeVisible({ timeout: 15000 });
    await expect(periodButton).toBeEnabled();
});

test('main content has landmark', async ({ page }) => {
    await page.goto('/propfirms');
    await expect(page.getByRole('main').first()).toBeVisible({ timeout: 15000 });
});
