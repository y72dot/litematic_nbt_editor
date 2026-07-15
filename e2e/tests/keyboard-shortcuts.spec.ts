import { test, expect } from '@playwright/test';
import { waitForAppReady, uploadFixture } from '../utils/test-helpers';

test.describe('Keyboard Shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await waitForAppReady(page);
  });

  test('Ctrl+Z does not error on empty history', async ({ page }) => {
    // Press Ctrl+Z with no edits - should not crash
    await page.keyboard.press('Control+z');
    // App should still be functional
    await expect(page.locator('.status-bar')).toBeVisible();
  });

  test('Ctrl+Y does not error on empty history', async ({ page }) => {
    await page.keyboard.press('Control+y');
    await expect(page.locator('.status-bar')).toBeVisible();
  });

  test('Ctrl+Z after file load shows no undo label (no edits yet)', async ({ page }) => {
    // Upload a file first (no edits made, so no undo history)
    // But wait - file upload clears the EditHistory, so there should be no undo/redo
    await uploadFixture(page, 'valid-v6.litematic');
    await page.waitForTimeout(2000);

    await page.keyboard.press('Control+z');
    // No undo should be available since only file load happened, no edits
    await expect(page.locator('.status-error')).not.toBeVisible({ timeout: 3000 });
  });

  test('Ctrl+Shift+Z does not error on empty history', async ({ page }) => {
    await page.keyboard.press('Control+Shift+z');
    await expect(page.locator('.status-bar')).toBeVisible();
  });

  test('keyboard shortcuts work after file upload', async ({ page }) => {
    // Upload and then test shortcuts don't crash
    await uploadFixture(page, 'valid-v6.litematic');
    await page.waitForTimeout(2000);

    // Test rapid undo/redo
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+y');
    await page.keyboard.press('Control+Shift+z');

    // App should still be running
    await expect(page.locator('.status-bar')).toBeVisible();
  });
});
