import { test, expect } from '@playwright/test';
import { waitForAppReady, uploadFixture, switchToTab } from '../utils/test-helpers';

test.describe('Settings Panel', () => {
  test.beforeEach(async ({ page }) => {
    await waitForAppReady(page);
    await switchToTab(page, 'Settings');
  });

  test('settings panel has renderer, unpacking, and traversal selects', async ({ page }) => {
    const selectEls = page.locator('.studio-select');
    // Should be 3 selects (Renderer, Unpacking, Traversal)
    await expect(selectEls).toHaveCount(3);
  });

  test('renderer select shows deepslate by default', async ({ page }) => {
    const rendererSelect = page.locator('.studio-select').first();
    await expect(rendererSelect).toHaveValue('deepslate');
  });

  test('renderer select can switch to three.js', async ({ page }) => {
    const rendererSelect = page.locator('.studio-select').first();
    await rendererSelect.selectOption('three');
    await expect(rendererSelect).toHaveValue('three');
  });

  test('unpacking format default is non-spanning', async ({ page }) => {
    const formatSelect = page.locator('.studio-select').nth(1);
    await expect(formatSelect).toHaveValue('non-spanning');
  });

  test('unpacking format can switch to spanning', async ({ page }) => {
    const formatSelect = page.locator('.studio-select').nth(1);
    await formatSelect.selectOption('spanning');
    await expect(formatSelect).toHaveValue('spanning');
  });

  test('traversal order default is YZX', async ({ page }) => {
    const traversalSelect = page.locator('.studio-select').nth(2);
    await expect(traversalSelect).toHaveValue('YZX');
  });

  test('traversal order can switch to XYZ', async ({ page }) => {
    const traversalSelect = page.locator('.studio-select').nth(2);
    await traversalSelect.selectOption('XYZ');
    await expect(traversalSelect).toHaveValue('XYZ');
  });

  test('all three traversal orders from menu are available', async ({ page }) => {
    const traversalSelect = page.locator('.studio-select').nth(2);
    const options = await traversalSelect.locator('option').allTextContents();
    expect(options).toContain('YZX (Standard)');
    expect(options).toContain('XYZ');
    expect(options).toContain('YXZ');
    expect(options).toContain('XZY');
    expect(options).toContain('ZXY');
    expect(options).toContain('ZYX');
  });
});
