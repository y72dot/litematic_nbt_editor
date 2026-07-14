import { test, expect } from '@playwright/test';
import { waitForAppReady } from '../utils/test-helpers';

test.describe('App Shell', () => {
  test.beforeEach(async ({ page }) => {
    await waitForAppReady(page);
  });

  test('renders top bar with app title', async ({ page }) => {
    const title = page.locator('.top-bar-title');
    await expect(title).toBeVisible();
    await expect(title).toContainText('Litematic Studio');
  });

  test('menu bar renders four menus', async ({ page }) => {
    const menuItems = page.locator('.menu-item');
    await expect(menuItems).toHaveCount(4);
    await expect(menuItems.nth(0)).toHaveText(/File/);
    await expect(menuItems.nth(1)).toHaveText(/Render/);
    await expect(menuItems.nth(2)).toHaveText(/Window/);
    await expect(menuItems.nth(3)).toHaveText(/Help/);
  });

  test('status bar is visible', async ({ page }) => {
    await expect(page.locator('.status-bar')).toBeVisible();
    // Should show a status message or "Ready"
    await expect(page.locator('.status-text').first()).toBeVisible();
  });

  test('empty state shows when no file loaded', async ({ page }) => {
    await expect(page.locator('.empty-state')).toBeVisible();
    await expect(page.locator('.empty-state')).toContainText('No Model Loaded');
  });

  test('workspace area renders', async ({ page }) => {
    await expect(page.locator('.workspace')).toBeVisible();
  });

  test('page title is set', async ({ page }) => {
    await expect(page).toHaveTitle(/litematic/);
  });
});
