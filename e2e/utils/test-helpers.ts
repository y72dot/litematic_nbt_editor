import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import path from 'path';

const FIXTURES_DIR = path.resolve(process.cwd(), 'e2e', 'fixtures');

/**
 * Upload a fixture file via the MenuBar's hidden file input (first input[type=file]).
 */
export async function uploadFixture(page: Page, fixtureName: string) {
  const filePath = path.join(FIXTURES_DIR, fixtureName);
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(filePath);
}

/**
 * Wait for the app shell to be fully rendered.
 */
export async function waitForAppReady(page: Page) {
  await page.goto('/');
  await page.waitForSelector('.top-bar', { timeout: 15000 });
  await page.waitForSelector('.workspace', { timeout: 15000 });
  // Empty state should be visible when no file is loaded
  await expect(page.locator('.empty-state')).toBeVisible({ timeout: 10000 });
}

/**
 * Click a menu item in the top menu bar to open its dropdown.
 */
export async function openMenu(page: Page, menuName: string) {
  const menuSpan = page.locator('.menu-item span').filter({ hasText: menuName }).first();
  await menuSpan.click();
}

/**
 * Click a dropdown item by visible text within the currently open dropdown.
 */
export async function clickDropdownItem(page: Page, itemText: string) {
  const item = page.locator('.dropdown-menu .dropdown-item span').filter({ hasText: itemText }).first();
  await item.click();
}

/**
 * Switch to a tab within a flexlayout tabset by clicking its label.
 */
export async function switchToTab(page: Page, tabName: string) {
  const tab = page.locator('.flexlayout__tab_button').filter({ hasText: tabName }).first();
  await tab.click();
}

/**
 * Verify the status bar shows a specific text.
 */
export async function expectStatusText(page: Page, text: string) {
  await expect(page.locator('.status-text').filter({ hasText: text }).first()).toBeVisible({ timeout: 5000 });
}

/**
 * Verify no error is shown in the app.
 */
export async function expectNoError(page: Page) {
  await expect(page.locator('.status-error')).not.toBeVisible({ timeout: 3000 }).catch(() => {});
}
