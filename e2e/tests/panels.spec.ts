import { test, expect } from '@playwright/test';
import { waitForAppReady, openMenu, clickDropdownItem } from '../utils/test-helpers';

test.describe('Panels - Window Menu Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await waitForAppReady(page);
  });

  test('Metadata tab is open by default', async ({ page }) => {
    // The "Metadata" tab should be visible in the layout
    const metadataTab = page.locator('.flexlayout__tab_button').filter({ hasText: 'Metadata' }).first();
    await expect(metadataTab).toBeVisible({ timeout: 5000 });
  });

  test('Palette tab is open by default', async ({ page }) => {
    const paletteTab = page.locator('.flexlayout__tab_button').filter({ hasText: 'Palette' }).first();
    await expect(paletteTab).toBeVisible({ timeout: 5000 });
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
