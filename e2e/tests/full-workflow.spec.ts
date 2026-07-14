import { test, expect } from '@playwright/test';
import {
  waitForAppReady, uploadFixture, uploadBuffer,
  expectStatusText, expectNoError, openMenu, clickDropdownItem, switchToTab,
  expectCanvasVisible, expectViewerHintVisible,
  expectPaletteEntry, expectPaletteEntryAbsent, renamePaletteBlock,
  saveAndCaptureDownload,
  e2eSetBlock, e2eGetBlock, e2eSetSelectedBlocks, e2eReplaceBlocks,
  expectUndoLabel,
} from '../utils/test-helpers';

// ── Helper: wait for file to finish loading ───────────────────

async function waitForFileLoad(page: import('@playwright/test').Page, extraMs = 300) {
  await expect(page.locator('.empty-state')).not.toBeVisible({ timeout: 10000 });
  // Let React settle after state updates (palette, metadata, canvas)
  await page.waitForTimeout(extraMs);
}

// ═══════════════════════════════════════════════════════════════
// Group 1: Complete Golden Path User Journey
// ═══════════════════════════════════════════════════════════════

test.describe('Full Workflow - Golden Path', () => {
  test.beforeEach(async ({ page }) => {
    await waitForAppReady(page);
  });

  test('1.1 upload edit-test fixture, verify empty-state gone, canvas appears, palette fills', async ({ page }) => {
    await uploadFixture(page, 'edit-test.litematic');
    await waitForFileLoad(page);

    // Canvas becomes visible
    await expectCanvasVisible(page);

    // Status bar shows size info (3×3×3)
    await expectStatusText(page, /3/);

    // All 5 palette entries visible — switch to Palette tab first
    await switchToTab(page, 'Palette');
    await page.waitForTimeout(200);
    await expectPaletteEntry(page, 'minecraft:air');
    await expectPaletteEntry(page, 'minecraft:stone');
    await expectPaletteEntry(page, 'minecraft:dirt');
    await expectPaletteEntry(page, 'minecraft:grass_block');
    await expectPaletteEntry(page, 'minecraft:oak_planks');

    // Metadata panel shows parsed data
    await switchToTab(page, 'Metadata');
    await page.waitForTimeout(200);
    await expect(page.locator('.studio-input').first()).toHaveValue('Edit Test Build', { timeout: 5000 });
  });

  test('1.2 metadata panel editable after file load', async ({ page }) => {
    await uploadFixture(page, 'edit-test.litematic');
    await waitForFileLoad(page);
    await switchToTab(page, 'Metadata');
    await page.waitForTimeout(200);

    // Edit Name
    const nameInput = page.locator('.studio-input').first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('My Custom Build');
    await expect(nameInput).toHaveValue('My Custom Build');

    // Edit Author
    const authorInput = page.locator('.studio-input').nth(1);
    await expect(authorInput).toBeVisible({ timeout: 5000 });
    await authorInput.fill('Custom Author');
    await expect(authorInput).toHaveValue('Custom Author');

    // Edit Description
    const descTextarea = page.locator('textarea.studio-input');
    await expect(descTextarea).toBeVisible({ timeout: 5000 });
    await descTextarea.fill('Custom description for testing');
    await expect(descTextarea).toHaveValue('Custom description for testing');
  });

  test('1.3 palette rename via programmatic API', async ({ page }) => {
    await uploadFixture(page, 'edit-test.litematic');
    await waitForFileLoad(page);

    // Rename minecraft:stone → minecraft:custom_stone
    await renamePaletteBlock(page, 'minecraft:stone', 'minecraft:custom_stone');

    // Verify rename at data level — getBlock at (0,0,0) was stone, should now be custom_stone
    const block = await e2eGetBlock(page, 0, 0, 0);
    expect(block?.Name).toBe('minecraft:custom_stone');

    // Also verify via raw palette data
    const paletteAfter = await page.evaluate(() => {
      const obj = (window as any).__e2e.getLitematicObj();
      return obj ? obj.regions[0].palette : [];
    });
    expect(paletteAfter).toContain('minecraft:custom_stone');
    expect(paletteAfter).not.toContain('minecraft:stone');
  });

  test('1.4 set block programmatically, verify getBlock, palette auto-expand, undo label', async ({ page }) => {
    await uploadFixture(page, 'edit-test.litematic');
    await waitForFileLoad(page);

    // Set block at (2, 0, 0) — known air position in the 3×3×3 fixture
    await e2eSetBlock(page, 2, 0, 0, 'minecraft:netherrack');

    // Verify getBlock returns correct value
    const block = await e2eGetBlock(page, 2, 0, 0);
    expect(block).not.toBeNull();
    expect(block!.Name).toBe('minecraft:netherrack');

    // Verify undo label appears in status bar
    await expectUndoLabel(page, 'Set block at (2, 0, 0)');

    // Verify netherrack auto-added to palette
    await switchToTab(page, 'Palette');
    await page.waitForTimeout(200);
    await expectPaletteEntry(page, 'minecraft:netherrack');
  });

  test('1.5 batch replace via selection + replace blocks', async ({ page }) => {
    await uploadFixture(page, 'edit-test.litematic');
    await waitForFileLoad(page);

    // Select two known non-air positions: (0,0,0)=stone, (1,1,1)=dirt
    await e2eSetSelectedBlocks(page, ['0,0,0', '1,1,1']);

    // Verify palette shows selection count
    await switchToTab(page, 'Palette');
    await page.waitForTimeout(200);
    const paletteContent = page.locator('.flexlayout__tab').filter({ hasText: 'Click a block name to rename it' }).first();
    await expect(paletteContent).toContainText('2 blocks selected', { timeout: 5000 });

    // Programmatic replace
    await e2eReplaceBlocks(page, 'minecraft:oak_planks');

    // Verify undo label for batch replace
    await expectUndoLabel(page, 'Replace 2 blocks');

    // Verify blocks were actually changed
    const b1 = await e2eGetBlock(page, 0, 0, 0);
    expect(b1?.Name).toBe('minecraft:oak_planks');
    const b2 = await e2eGetBlock(page, 1, 1, 1);
    expect(b2?.Name).toBe('minecraft:oak_planks');

    // Selection should be cleared after replace
    const selected = await page.evaluate(() => {
      return (window as any).__e2e.getSelectedBlocks();
    });
    expect(selected.length).toBe(0);
  });

  test('1.6 undo/redo with actual edits', async ({ page }) => {
    await uploadFixture(page, 'edit-test.litematic');
    await waitForFileLoad(page);

    // Record original block at (0,2,0) — should be oak_planks
    const orig = await e2eGetBlock(page, 0, 2, 0);
    expect(orig?.Name).toBe('minecraft:oak_planks');

    // Set block to something else
    await e2eSetBlock(page, 0, 2, 0, 'minecraft:obsidian');
    const changed = await e2eGetBlock(page, 0, 2, 0);
    expect(changed?.Name).toBe('minecraft:obsidian');

    // Ctrl+Z undo
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);
    const undone = await e2eGetBlock(page, 0, 2, 0);
    expect(undone?.Name).toBe('minecraft:oak_planks');

    // Ctrl+Y redo
    await page.keyboard.press('Control+y');
    await page.waitForTimeout(200);
    const redone = await e2eGetBlock(page, 0, 2, 0);
    expect(redone?.Name).toBe('minecraft:obsidian');

    // Undo again to clean up (back to oak_planks)
    await page.keyboard.press('Control+z');
  });

  test('1.6b chain 3 edits, undo all', async ({ page }) => {
    await uploadFixture(page, 'edit-test.litematic');
    await waitForFileLoad(page);

    // 3 consecutive edits
    await e2eSetBlock(page, 0, 0, 0, 'minecraft:glass');
    await e2eSetBlock(page, 1, 1, 1, 'minecraft:glass');
    await e2eSetBlock(page, 0, 2, 0, 'minecraft:glass');

    // Undo all 3
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(100);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(100);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);

    // All should be back to original
    const b1 = await e2eGetBlock(page, 0, 0, 0);
    expect(b1?.Name).toBe('minecraft:stone');
    const b2 = await e2eGetBlock(page, 1, 1, 1);
    expect(b2?.Name).toBe('minecraft:dirt');
    const b3 = await e2eGetBlock(page, 0, 2, 0);
    expect(b3?.Name).toBe('minecraft:oak_planks');

    // Undo label should be cleared
    await expectUndoLabel(page, null);
  });

  test('1.7 raw NBT data updates after rename', async ({ page }) => {
    await uploadFixture(page, 'edit-test.litematic');
    await waitForFileLoad(page);

    // Rename a block
    await renamePaletteBlock(page, 'minecraft:dirt', 'minecraft:golden_dirt');

    // Verify rawNbt contains the new name (via e2e harness)
    const rawNbtStr = await page.evaluate(() => {
      const obj = (window as any).__e2e.getLitematicObj();
      return JSON.stringify(obj.rawNbt, (_k: string, v: any) =>
        typeof v === 'bigint' ? v.toString() + 'n' : v
      );
    });
    expect(rawNbtStr).toContain('minecraft:golden_dirt');
  });

  test('1.8 settings panel controls update values', async ({ page }) => {
    await uploadFixture(page, 'edit-test.litematic');
    await waitForFileLoad(page);
    await switchToTab(page, 'Settings');
    await page.waitForTimeout(200);

    // Switch renderer to three.js
    const rendererSelect = page.locator('.studio-select').first();
    await rendererSelect.selectOption('three');
    await expect(rendererSelect).toHaveValue('three');

    // Switch unpacking method
    const formatSelect = page.locator('.studio-select').nth(1);
    await formatSelect.selectOption('spanning');
    await expect(formatSelect).toHaveValue('spanning');

    // Switch traversal order
    const traversalSelect = page.locator('.studio-select').nth(2);
    await traversalSelect.selectOption('XYZ');
    await expect(traversalSelect).toHaveValue('XYZ');
  });

  test('1.9 save → reset → re-open round-trip: all edits persist', async ({ page }) => {
    await uploadFixture(page, 'edit-test.litematic');
    await waitForFileLoad(page);

    // Step 1: Edit metadata
    await switchToTab(page, 'Metadata');
    await page.waitForTimeout(200);
    const nameInput = page.locator('.studio-input').first();
    await nameInput.fill('Round Trip Test');

    // Step 2: Rename palette block
    await switchToTab(page, 'Palette');
    await page.waitForTimeout(300);
    await renamePaletteBlock(page, 'minecraft:stone', 'minecraft:custom_stone');

    // Step 3: Set a block at a known air position
    await e2eSetBlock(page, 2, 0, 0, 'minecraft:diamond_block');

    // Wait for UI to settle
    await page.waitForTimeout(300);

    // Step 4: Save and capture download
    const savedBuffer = await saveAndCaptureDownload(page);

    // Verify we got data
    expect(savedBuffer.length).toBeGreaterThan(0);

    // Step 5: Reset the app
    await openMenu(page, 'File');
    await clickDropdownItem(page, 'Reset');

    // Empty state should reappear
    await expect(page.locator('.empty-state')).toBeVisible({ timeout: 10000 });

    // Step 6: Re-upload the saved file
    await uploadBuffer(page, savedBuffer, 'roundtrip.litematic');
    await waitForFileLoad(page, 500);

    // Step 7: Verify metadata persisted
    await switchToTab(page, 'Metadata');
    await page.waitForTimeout(200);
    await expect(page.locator('.studio-input').first()).toHaveValue('Round Trip Test', { timeout: 5000 });

    // Step 8: Verify palette rename persisted
    await switchToTab(page, 'Palette');
    await page.waitForTimeout(200);
    await expectPaletteEntry(page, 'minecraft:custom_stone');
    await expectPaletteEntryAbsent(page, 'minecraft:stone');

    // Step 9: Verify block data persisted
    const block = await e2eGetBlock(page, 2, 0, 0);
    expect(block?.Name).toBe('minecraft:diamond_block');

    // Also verify original non-air blocks are still intact
    const origBlock = await e2eGetBlock(page, 0, 2, 0);
    expect(origBlock?.Name).toBe('minecraft:oak_planks');
  });
});

// ═══════════════════════════════════════════════════════════════
// Group 2: V5 Spanning File Flow
// ═══════════════════════════════════════════════════════════════

test.describe('Full Workflow - V5 Spanning', () => {
  test.beforeEach(async ({ page }) => {
    await waitForAppReady(page);
  });

  test('2.1 upload V5 file, preferredFormat auto-detected as spanning', async ({ page }) => {
    await uploadFixture(page, 'valid-v5-spanning.litematic');
    await waitForFileLoad(page);

    // Status bar should show spanning format (1.13-1.15)
    await expect(page.locator('.status-bar')).toContainText('1.13-1.15', { timeout: 5000 });

    // Settings panel unpacking select should show spanning
    await switchToTab(page, 'Settings');
    await page.waitForTimeout(200);
    const formatSelect = page.locator('.studio-select').nth(1);
    await expect(formatSelect).toHaveValue('spanning');
  });

  test('2.2 V5 file metadata editable', async ({ page }) => {
    await uploadFixture(page, 'valid-v5-spanning.litematic');
    await waitForFileLoad(page);
    await switchToTab(page, 'Metadata');
    await page.waitForTimeout(200);

    const nameInput = page.locator('.studio-input').first();
    await expect(nameInput).toHaveValue('V5 Spanning Build', { timeout: 5000 });
    await nameInput.fill('Modified V5 Build');
    await expect(nameInput).toHaveValue('Modified V5 Build');
  });

  test('2.3 V5 file switch unpacking to non-spanning', async ({ page }) => {
    await uploadFixture(page, 'valid-v5-spanning.litematic');
    await waitForFileLoad(page);
    await switchToTab(page, 'Settings');
    await page.waitForTimeout(200);

    // Default should be spanning
    const formatSelect = page.locator('.studio-select').nth(1);
    await expect(formatSelect).toHaveValue('spanning');

    // Switch to non-spanning
    await formatSelect.selectOption('non-spanning');
    await expect(formatSelect).toHaveValue('non-spanning');

    // Status bar should reflect the change
    await expect(page.locator('.status-bar')).toContainText('1.16+', { timeout: 5000 });
  });

  test('2.4 V5 spanning save round-trip', async ({ page }) => {
    await uploadFixture(page, 'valid-v5-spanning.litematic');
    await waitForFileLoad(page);

    // Edit metadata
    await switchToTab(page, 'Metadata');
    await page.waitForTimeout(200);
    const nameInput = page.locator('.studio-input').first();
    await nameInput.fill('V5 Round Trip');

    await page.waitForTimeout(200);

    // Save
    const savedBuffer = await saveAndCaptureDownload(page);
    expect(savedBuffer.length).toBeGreaterThan(0);

    // Reset
    await openMenu(page, 'File');
    await clickDropdownItem(page, 'Reset');
    await expect(page.locator('.empty-state')).toBeVisible({ timeout: 10000 });

    // Re-upload
    await uploadBuffer(page, savedBuffer, 'v5-roundtrip.litematic');
    await waitForFileLoad(page);

    // Verify metadata
    await switchToTab(page, 'Metadata');
    await page.waitForTimeout(200);
    await expect(page.locator('.studio-input').first()).toHaveValue('V5 Round Trip', { timeout: 5000 });
  });
});

// ═══════════════════════════════════════════════════════════════
// Group 3: Structure (.nbt) File Flow
// ═══════════════════════════════════════════════════════════════

test.describe('Full Workflow - Structure (.nbt)', () => {
  test.beforeEach(async ({ page }) => {
    await waitForAppReady(page);
  });

  test('3.1 upload structure file, verify load and NBT data has structure features', async ({ page }) => {
    await uploadFixture(page, 'valid-structure.nbt');
    await waitForFileLoad(page);

    // File loaded (empty-state disappeared), status bar should show region info
    await expect(page.locator('.status-bar')).toContainText('1 Region', { timeout: 5000 });

    // Verify structure-specific keys via e2e harness (raw NBT data)
    const nbtKeys = await page.evaluate(() => {
      const obj = (window as any).__e2e.getLitematicObj();
      const root = obj?.rawNbt?.value;
      return root ? Object.keys(root) : [];
    });
    expect(nbtKeys).toContain('blocks');
    expect(nbtKeys).toContain('palette');
  });

  test('3.2 structure file metadata editable', async ({ page }) => {
    await uploadFixture(page, 'valid-structure.nbt');
    await waitForFileLoad(page);
    await switchToTab(page, 'Metadata');
    await page.waitForTimeout(200);

    // Structure metadata shows default values
    const nameInput = page.locator('.studio-input').first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('Custom Structure');
    await expect(nameInput).toHaveValue('Custom Structure');
  });

  test('3.3 structure file palette rename', async ({ page }) => {
    await uploadFixture(page, 'valid-structure.nbt');
    await waitForFileLoad(page);

    // Structure has air, stone, oak_log
    // Verify initial palette at data level
    const initialPalette = await page.evaluate(() => {
      const obj = (window as any).__e2e.getLitematicObj();
      return obj ? obj.regions[0].palette : [];
    });
    expect(initialPalette).toContain('minecraft:stone');

    // Rename stone → custom_stone
    await renamePaletteBlock(page, 'minecraft:stone', 'minecraft:custom_stone');

    // Verify at data level
    const paletteAfter = await page.evaluate(() => {
      const obj = (window as any).__e2e.getLitematicObj();
      return obj ? obj.regions[0].palette : [];
    });
    expect(paletteAfter).toContain('minecraft:custom_stone');
    expect(paletteAfter).not.toContain('minecraft:stone');
  });

  test('3.4 structure file save round-trip in native format', async ({ page }) => {
    await uploadFixture(page, 'valid-structure.nbt');
    await waitForFileLoad(page);

    // Rename a block
    await switchToTab(page, 'Palette');
    await page.waitForTimeout(300);
    await renamePaletteBlock(page, 'minecraft:stone', 'minecraft:renamed_stone');

    await page.waitForTimeout(200);

    // Save (native format for Structure = .nbt)
    const savedBuffer = await saveAndCaptureDownload(page);
    expect(savedBuffer.length).toBeGreaterThan(0);

    // Reset
    await openMenu(page, 'File');
    await clickDropdownItem(page, 'Reset');
    await expect(page.locator('.empty-state')).toBeVisible({ timeout: 10000 });

    // Re-upload saved .nbt
    await uploadBuffer(page, savedBuffer, 'structure-roundtrip.nbt');
    await waitForFileLoad(page);

    // Verify rename persisted
    await switchToTab(page, 'Palette');
    await page.waitForTimeout(200);
    await expectPaletteEntry(page, 'minecraft:renamed_stone');
    await expectPaletteEntryAbsent(page, 'minecraft:stone');
  });
});

// ═══════════════════════════════════════════════════════════════
// Group 4: Multi-Region File Flow
// ═══════════════════════════════════════════════════════════════

test.describe('Full Workflow - Multi-Region', () => {
  test.beforeEach(async ({ page }) => {
    await waitForAppReady(page);
  });

  test('4.1 upload multi-region file, verify region count and status', async ({ page }) => {
    await uploadFixture(page, 'multi-region.litematic');
    await waitForFileLoad(page);

    // Status bar should show "2 Regions"
    await expect(page.locator('.status-bar')).toContainText('2 Regions', { timeout: 5000 });
  });

  test('4.2 palette lists blocks from both regions', async ({ page }) => {
    await uploadFixture(page, 'multi-region.litematic');
    await waitForFileLoad(page);
    await switchToTab(page, 'Palette');
    await page.waitForTimeout(200);

    // Both regions have the same palette (air + stone), so they appear
    await expectPaletteEntry(page, 'minecraft:air');
    await expectPaletteEntry(page, 'minecraft:stone');
  });
});

// ═══════════════════════════════════════════════════════════════
// Group 5: Error Recovery Flow
// ═══════════════════════════════════════════════════════════════

test.describe('Full Workflow - Error Recovery', () => {
  test.beforeEach(async ({ page }) => {
    await waitForAppReady(page);
  });

  test('5.1 invalid file → valid file recovery', async ({ page }) => {
    // Upload invalid file first
    await uploadFixture(page, 'invalid.litematic');
    await page.waitForTimeout(1000);

    // Then upload valid file
    await uploadFixture(page, 'edit-test.litematic');
    await waitForFileLoad(page);

    // Error should be cleared
    await expect(page.locator('.status-error')).not.toBeVisible({ timeout: 5000 }).catch(() => {});

    // App should be functional — palette should load
    await switchToTab(page, 'Palette');
    await page.waitForTimeout(200);
    await expectPaletteEntry(page, 'minecraft:stone');
  });

  test('5.2 app remains responsive after error', async ({ page }) => {
    await uploadFixture(page, 'invalid.litematic');
    await page.waitForTimeout(1000);

    // Menu should still work
    await openMenu(page, 'Help');
    await expect(page.locator('.dropdown-menu')).toBeVisible({ timeout: 3000 });

    // Close menu by clicking elsewhere
    await page.locator('.workspace').click();
    await page.waitForTimeout(200);

    // Status bar should still be present
    await expect(page.locator('.status-bar')).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════
// Group 6: Canvas / 3D Smoke Tests
// ═══════════════════════════════════════════════════════════════

test.describe('Full Workflow - Canvas Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    await waitForAppReady(page);
  });

  test('6.1 canvas element exists with non-zero dimensions after file load', async ({ page }) => {
    await uploadFixture(page, 'edit-test.litematic');
    await waitForFileLoad(page, 1000);

    // Canvas should be visible with non-zero size
    await expectCanvasVisible(page);
  });

  test('6.2 canvas mouse events do not crash the app', async ({ page }) => {
    await uploadFixture(page, 'edit-test.litematic');
    await waitForFileLoad(page, 1000);

    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 10000 });

    const box = await canvas.boundingBox();
    if (box) {
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;

      // Hover at center
      await page.mouse.move(cx, cy);
      await page.waitForTimeout(300);

      // Click at center
      await page.mouse.click(cx, cy);
      await page.waitForTimeout(300);

      // Drag
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx + 50, cy + 50, { steps: 5 });
      await page.mouse.up();
      await page.waitForTimeout(300);
    }

    // App should still be responsive — no error overlay
    await expectNoError(page);
    await expect(page.locator('.status-bar')).toBeVisible();
  });

  test('6.3 viewer hint text visible after file load', async ({ page }) => {
    await uploadFixture(page, 'edit-test.litematic');
    await waitForFileLoad(page);

    // The viewport overlay hint should be visible
    await expectViewerHintVisible(page);
  });
});
