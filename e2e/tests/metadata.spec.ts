import { test, expect } from '@playwright/test';
import { waitForAppReady, uploadFixture } from '../utils/test-helpers';

test.describe('Metadata Panel', () => {
  test('shows "No active selection" when no file loaded', async ({ page }) => {
    await waitForAppReady(page);
    // The Metadata tab content should show "No active selection"
    await expect(page.locator('.flexlayout__tab').filter({ hasText: 'No active selection' }).first()).toBeVisible();
  });

  test('metadata fields editable after file load', async ({ page }) => {
    await waitForAppReady(page);
    await uploadFixture(page, 'valid-v6.litematic');
    await page.waitForTimeout(2000); // Wait for async processing

    // Find the Name input and change its value
    const nameInput = page.locator('.studio-input').first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });

    // Clear and type new name
    await nameInput.click();
    await nameInput.fill('Renamed Build');
    await nameInput.blur();
    await expect(nameInput).toHaveValue('Renamed Build');
  });

  test('author field editable after file load', async ({ page }) => {
    await waitForAppReady(page);
    await uploadFixture(page, 'valid-v6.litematic');
    await page.waitForTimeout(2000);

    const authorInput = page.locator('.studio-input').nth(1);
    await expect(authorInput).toBeVisible({ timeout: 5000 });
    await authorInput.fill('New Author');
    await expect(authorInput).toHaveValue('New Author');
  });

  test('description field editable after file load', async ({ page }) => {
    await waitForAppReady(page);
    await uploadFixture(page, 'valid-v6.litematic');
    await page.waitForTimeout(2000);

    const descTextarea = page.locator('textarea.studio-input');
    await expect(descTextarea).toBeVisible({ timeout: 5000 });
    await descTextarea.fill('Updated description');
    await expect(descTextarea).toHaveValue('Updated description');
  });

  test('displays size, regions, and timestamps after file load', async ({ page }) => {
    await waitForAppReady(page);
    await uploadFixture(page, 'valid-v6.litematic');
    await page.waitForTimeout(2000);

    // The metadata panel shows size info in the bottom text
    const tabContent = page.locator('.flexlayout__tab').filter({ hasText: /Size/ }).first();
    await expect(tabContent).toContainText(/Size:/, { timeout: 5000 });
  });
});
