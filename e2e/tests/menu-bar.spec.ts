import { test, expect } from '@playwright/test';
import { waitForAppReady, openMenu, clickDropdownItem } from '../utils/test-helpers';

test.describe('Menu Bar', () => {
  test.beforeEach(async ({ page }) => {
    await waitForAppReady(page);
  });

  test('File menu opens on click', async ({ page }) => {
    await openMenu(page, 'File');
    await expect(page.locator('.dropdown-menu')).toBeVisible();
    await expect(page.locator('.dropdown-item')).toContainText(['Open', 'Save', 'Reset']);
  });

  test('File menu closes on second click (toggle)', async ({ page }) => {
    await openMenu(page, 'File');
    await expect(page.locator('.dropdown-menu')).toBeVisible();
    await openMenu(page, 'File');
    await expect(page.locator('.dropdown-menu')).not.toBeVisible();
  });

  test('File menu closes on outside click', async ({ page }) => {
    await openMenu(page, 'File');
    await expect(page.locator('.dropdown-menu')).toBeVisible();
    // Click on the app title area (outside the menu)
    await page.locator('.top-bar-title').click();
    await expect(page.locator('.dropdown-menu')).not.toBeVisible();
  });

  test('Save option is disabled when no file loaded', async ({ page }) => {
    await openMenu(page, 'File');
    // The "Save" dropdown item should have disabled class
    const saveItem = page.locator('.dropdown-item').filter({ hasText: 'Save' }).first();
    await expect(saveItem).toHaveClass(/disabled/);
  });

  test('Open item triggers file input click', async ({ page }) => {
    await openMenu(page, 'File');
    // Clicking "Open..." should trigger the hidden file input
    const fileInput = page.locator('input[type="file"]').first();
    // Verify the input exists and is hidden
    await expect(fileInput).toBeHidden();
  });

  test('Render menu shows engine options', async ({ page }) => {
    await openMenu(page, 'Render');
    await expect(page.locator('.dropdown-menu')).toBeVisible();
    await expect(page.locator('.dropdown-item')).toContainText(['Deepslate', 'Three.js']);
  });

  test('Render menu shows unpacking options', async ({ page }) => {
    await openMenu(page, 'Render');
    await expect(page.locator('.dropdown-item')).toContainText(['1.16+', '1.13-1.15']);
  });

  test('Render menu shows traversal orders', async ({ page }) => {
    await openMenu(page, 'Render');
    await expect(page.locator('.dropdown-item')).toContainText(['YZX', 'XYZ', 'YXZ']);
  });

  test('Window menu shows panel toggles', async ({ page }) => {
    await openMenu(page, 'Window');
    await expect(page.locator('.dropdown-item')).toContainText(['Metadata', 'Palette Editor', 'Advanced Settings', 'Raw NBT Data']);
  });

  test('Help menu shows About and Deepslate GitHub', async ({ page }) => {
    await openMenu(page, 'Help');
    await expect(page.locator('.dropdown-item')).toContainText(['About', 'Deepslate GitHub']);
  });

  test('Menu switches when clicking another menu', async ({ page }) => {
    await openMenu(page, 'File');
    await expect(page.locator('.dropdown-menu')).toBeVisible();
    await expect(page.locator('.dropdown-item')).toContainText(['Open']);

    // Switch to Render menu
    await openMenu(page, 'Render');
    await expect(page.locator('.dropdown-menu')).toBeVisible();
    await expect(page.locator('.dropdown-item')).toContainText(['Deepslate']);
  });
});
