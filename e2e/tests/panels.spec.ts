import { test, expect } from '@playwright/test';
import { waitForAppReady, openMenu, clickDropdownItem } from '../utils/test-helpers';

test.describe('Panels - Window Menu Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await waitForAppReady(page);
  });

  test('Tools tab is open by default', async ({ page }) => {
    const toolsTab = page.locator('.flexlayout__tab_button').filter({ hasText: 'Tools' }).first();
    await expect(toolsTab).toBeVisible({ timeout: 5000 });
  });

  test('Selection tab is open by default', async ({ page }) => {
    const selectionTab = page.locator('.flexlayout__tab_button').filter({ hasText: 'Selection' }).first();
    await expect(selectionTab).toBeVisible({ timeout: 5000 });
  });

  test('Swatches tab is open by default', async ({ page }) => {
    const swatchesTab = page.locator('.flexlayout__tab_button').filter({ hasText: 'Swatches' }).first();
    await expect(swatchesTab).toBeVisible({ timeout: 5000 });
  });

  test('History tab is open by default', async ({ page }) => {
    const historyTab = page.locator('.flexlayout__tab_button').filter({ hasText: 'History' }).first();
    await expect(historyTab).toBeVisible({ timeout: 5000 });
  });

  test('Metadata tab is open by default', async ({ page }) => {
    const metadataTab = page.locator('.flexlayout__tab_button').filter({ hasText: 'Metadata' }).first();
    await expect(metadataTab).toBeVisible({ timeout: 5000 });
  });

  test('Settings tab is open by default', async ({ page }) => {
    const settingsTab = page.locator('.flexlayout__tab_button').filter({ hasText: 'Settings' }).first();
    await expect(settingsTab).toBeVisible({ timeout: 5000 });
  });

  test('Raw NBT tab is open by default', async ({ page }) => {
    const nbtTab = page.locator('.flexlayout__tab_button').filter({ hasText: 'Raw NBT' }).first();
    await expect(nbtTab).toBeVisible({ timeout: 5000 });
  });

  test('3D Viewer tab is always present', async ({ page }) => {
    const viewerTab = page.locator('.flexlayout__tab_button').filter({ hasText: '3D Viewer' }).first();
    await expect(viewerTab).toBeVisible({ timeout: 5000 });
    // 3D Viewer should NOT have a close button (enableClose: false)
  });
});
