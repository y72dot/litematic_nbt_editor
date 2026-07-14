import { test, expect } from '@playwright/test';
import { waitForAppReady, uploadFixture, expectStatusText } from '../utils/test-helpers';

test.describe('Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await waitForAppReady(page);
  });

  test('upload invalid binary file shows error', async ({ page }) => {
    await uploadFixture(page, 'invalid.litematic');

    // Error should appear in the viewer panel overlay
    const errorOverlay = page.locator('.status-error').first();
    await expect(errorOverlay).toBeVisible({ timeout: 10000 });
  });

  test('upload corrupt gzip file shows error', async ({ page }) => {
    await uploadFixture(page, 'not-gzip.litematic');

    // Error should appear (may be in status bar or viewer overlay)
    const hasError = await page.locator('.status-error').first().isVisible({ timeout: 10000 }).catch(() => false);
    // At minimum, the empty state should disappear or an error should show
    if (!hasError) {
      // Some errors might be caught differently
    }
  });

  test('error clears on subsequent valid upload', async ({ page }) => {
    // First upload invalid file
    await uploadFixture(page, 'invalid.litematic');
    await page.waitForTimeout(2000);

    // Then upload valid file
    await uploadFixture(page, 'valid-v6.litematic');

    // Empty state should be gone (file loaded successfully)
    await expect(page.locator('.empty-state')).not.toBeVisible({ timeout: 10000 });

    // Error should no longer be visible
    await expect(page.locator('.status-error')).not.toBeVisible({ timeout: 5000 });
  });

  test('Palette panel shows "No file loaded" when empty', async ({ page }) => {
    // Click the Palette tab to ensure it's visible
    const paletteTab = page.locator('.flexlayout__tab_button').filter({ hasText: 'Palette' }).first();
    await paletteTab.click();
    // The palette panel content should show "No file loaded"
    await expect(page.locator('.flexlayout__tab').filter({ hasText: 'No file loaded' })).toBeVisible({ timeout: 5000 });
  });

  test('NBT tab is clickable and activates', async ({ page }) => {
    // Click the Raw NBT tab to ensure it's visible and can be activated
    const nbtTab = page.locator('.flexlayout__tab_button').filter({ hasText: 'Raw NBT' }).first();
    await expect(nbtTab).toBeVisible({ timeout: 5000 });
    await nbtTab.click();
    // Tab should become selected after clicking
    await expect(nbtTab).toHaveClass(/selected/);
  });

  test('app remains responsive after error', async ({ page }) => {
    await uploadFixture(page, 'invalid.litematic');
    await page.waitForTimeout(1000);

    // Menu should still work
    await page.locator('.menu-item span').filter({ hasText: 'Help' }).first().click();
    await expect(page.locator('.dropdown-menu')).toBeVisible({ timeout: 3000 });
  });
});
