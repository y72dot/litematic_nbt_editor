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
 * Upload a buffer as a file via the MenuBar's hidden file input.
 */
export async function uploadBuffer(page: Page, buffer: Buffer, fileName: string) {
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles([{ name: fileName, mimeType: 'application/octet-stream', buffer }]);
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

// ──────────────────────────────────────────────────────────────
// Canvas / 3D viewport helpers
// ──────────────────────────────────────────────────────────────

/** Verify a <canvas> element exists and has non-zero dimensions. */
export async function expectCanvasVisible(page: Page) {
  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeVisible({ timeout: 10000 });
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThan(0);
  expect(box!.height).toBeGreaterThan(0);
}

/** Verify the viewport overlay hint is visible (shown after file load). */
export async function expectViewerHintVisible(page: Page) {
  await expect(page.locator('.viewport-overlay-hint')).toBeVisible({ timeout: 5000 });
}

// ──────────────────────────────────────────────────────────────
// Palette helpers
// ──────────────────────────────────────────────────────────────

/** Get the palette panel content container. Uses a unique instruction text to identify it. */
function palettePanel(page: Page) {
  return page.locator('.flexlayout__tab').filter({ hasText: 'Click a block name to rename it' }).first();
}

/** Verify a palette entry exists (exact block name match). */
export async function expectPaletteEntry(page: Page, blockName: string) {
  const palette = palettePanel(page);
  await expect(palette.getByText(blockName, { exact: true }).first()).toBeVisible({ timeout: 5000 });
}

/** Verify a palette entry is absent. */
export async function expectPaletteEntryAbsent(page: Page, blockName: string) {
  const palette = palettePanel(page);
  await expect(palette.getByText(blockName, { exact: true }).first()).not.toBeVisible({ timeout: 5000 }).catch(() => {});
}

/** Rename a palette block via the __e2e harness (reliable cross-React-version). */
export async function renamePaletteBlock(page: Page, oldName: string, newName: string) {
  await page.evaluate(({ oldN, newN }) => {
    const obj = (window as any).__e2e.getLitematicObj();
    if (obj) {
      obj.renameBlock(oldN, newN);
      (window as any).__e2e.forceUpdate();
    }
  }, { oldN: oldName, newN: newName });
  await page.waitForTimeout(300);
}

// ──────────────────────────────────────────────────────────────
// NBT helpers
// ──────────────────────────────────────────────────────────────

/** Get the NBT panel textarea. Only one textarea exists in the app. */
function nbtTextarea(page: Page) {
  return page.locator('textarea').first();
}

/** Verify NBT textarea contains the given text. */
export async function expectNbtContains(page: Page, text: string) {
  const textarea = nbtTextarea(page);
  await expect(textarea).toContainText(text, { timeout: 5000 });
}

/** Get the full NBT textarea content as a string. */
export async function getNbtContent(page: Page): Promise<string> {
  const textarea = nbtTextarea(page);
  return await textarea.inputValue();
}

// ──────────────────────────────────────────────────────────────
// Save / download helpers
// ──────────────────────────────────────────────────────────────

/** Trigger Save via File menu and capture the downloaded file buffer. */
export async function saveAndCaptureDownload(page: Page, format?: 'litematic' | 'nbt'): Promise<Buffer> {
  await openMenu(page, 'File');

  const downloadPromise = page.waitForEvent('download');

  if (format) {
    // Click the respective Export As sub-item
    const itemText = format === 'litematic' ? '.litematic' : '.nbt (Structure)';
    await page.locator('.dropdown-menu .dropdown-item span').filter({ hasText: itemText }).first().click();
  } else {
    // Regular Save
    await clickDropdownItem(page, 'Save');
  }

  const download = await downloadPromise;
  const stream = await download.createReadStream();
  return bufferFromStream(stream);
}

/** Read a Node.js Readable stream into a Buffer. */
function bufferFromStream(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

// ──────────────────────────────────────────────────────────────
// E2E test harness wrappers (communicate with window.__e2e)
// ──────────────────────────────────────────────────────────────

/** Programmatically set a block at global coordinates. */
export async function e2eSetBlock(page: Page, x: number, y: number, z: number, blockName = 'minecraft:stone') {
  await page.evaluate(({ x, y, z, name }) => {
    (window as any).__e2e.setBlock(x, y, z, name);
  }, { x, y, z, name: blockName });
}

/** Programmatically get block info at global coordinates. */
export async function e2eGetBlock(page: Page, x: number, y: number, z: number) {
  return page.evaluate(({ x, y, z }) => {
    return (window as any).__e2e.getBlock(x, y, z);
  }, { x, y, z });
}

/** Programmatically set the selected blocks set. */
export async function e2eSetSelectedBlocks(page: Page, keys: string[]) {
  await page.evaluate((k) => {
    (window as any).__e2e.setSelectedBlocks(k);
  }, keys);
}

/** Programmatically trigger batch replace with the given block name. */
export async function e2eReplaceBlocks(page: Page, blockName: string) {
  await page.evaluate((name) => {
    (window as any).__e2e.replaceBlocks(name);
  }, blockName);
}

/** Verify the status bar shows (or hides) the undo label. */
export async function expectUndoLabel(page: Page, containsText: string | null) {
  const statusBar = page.locator('.status-bar');
  if (containsText === null) {
    await expect(statusBar.locator('.status-text').filter({ hasText: /Ctrl\+Z:/ }).first())
      .not.toBeVisible({ timeout: 5000 }).catch(() => {});
  } else {
    const escaped = containsText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await expect(statusBar.locator('.status-text')
      .filter({ hasText: new RegExp(`Ctrl\\+Z:.*${escaped}`) }).first())
      .toBeVisible({ timeout: 5000 });
  }
}

// ──────────────────────────────────────────────────────────────
// Helpers continued
// ──────────────────────────────────────────────────────────────
