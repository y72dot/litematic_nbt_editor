import { test, expect } from '@playwright/test';
import { waitForAppReady, uploadFixture, expectStatusText, expectNoError } from '../utils/test-helpers';

test.describe('File Upload', () => {
  test.beforeEach(async ({ page }) => {
    await waitForAppReady(page);
  });

  test('upload valid v6 litematic file loads successfully', async ({ page }) => {
    await uploadFixture(page, 'valid-v6.litematic');

    // Empty state should disappear
    await expect(page.locator('.empty-state')).not.toBeVisible({ timeout: 10000 });

    // Status bar should show size info
    await expectStatusText(page, /3/);

    // Metadata panel should show parsed data
    await expect(page.locator('.studio-input').first()).toHaveValue('Test Build', { timeout: 5000 });
  });

  test('upload valid v5 spanning litematic file', async ({ page }) => {
    await uploadFixture(page, 'valid-v5-spanning.litematic');

    await expect(page.locator('.empty-state')).not.toBeVisible({ timeout: 10000 });
    await expectStatusText(page, /4/);
    await expect(page.locator('.studio-input').first()).toHaveValue('V5 Spanning Build', { timeout: 5000 });
  });

  test('upload multi-region litematic shows 2 regions', async ({ page }) => {
    await uploadFixture(page, 'multi-region.litematic');

    await expect(page.locator('.empty-state')).not.toBeVisible({ timeout: 10000 });
    // Status bar should show "2 Regions"
    await expectStatusText(page, /2 Region/);
  });

  test('upload valid .nbt structure file', async ({ page }) => {
    await uploadFixture(page, 'valid-structure.nbt');

    await expect(page.locator('.empty-state')).not.toBeVisible({ timeout: 10000 });
    // Structure files don't have metadata, but should load
    await expect(page.locator('.status-error')).not.toBeVisible({ timeout: 5000 });
  });

  test('upload empty-regions litematic file', async ({ page }) => {
    await uploadFixture(page, 'empty-regions.litematic');

    await expect(page.locator('.empty-state')).not.toBeVisible({ timeout: 10000 });
    await expectStatusText(page, /0 Region/);
  });

  test('filename updates in top bar after upload', async ({ page }) => {
    // Top bar should show filename after upload
    await uploadFixture(page, 'valid-v6.litematic');
    await expect(page.locator('.empty-state')).not.toBeVisible({ timeout: 10000 });
    // The top bar span shows the filename
    await expect(page.locator('.top-bar')).toContainText('valid-v6.litematic');
  });
});
