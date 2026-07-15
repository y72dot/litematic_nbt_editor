import { describe, it, expect } from 'vitest'
import { Litematic } from '../Litematic'
import { FillCommand } from '../commands/FillCommand'
import { makeMockLitematicNbt, makeMockRegionNbt } from './testHelpers'

/** Create a Litematic with a single region of the given size and palette. */
function makeSchematic(
  size: { x: number; y: number; z: number },
  palette: string[],
  blockValues?: number[],
  position?: { x: number; y: number; z: number },
) {
  const nbtValue = makeMockLitematicNbt({
    version: 6,
    regions: {
      Main: makeMockRegionNbt({
        size,
        position: position ?? { x: 0, y: 0, z: 0 },
        palette,
        ...(blockValues
          ? { blockStatesFormat: 'non-spanning' as const, blockStatesValues: blockValues }
          : {}),
      }),
    },
  })
  return new Litematic({ type: 'compound', value: nbtValue })
}

describe('FillCommand', () => {
  // ── Basic flood-fill ─────────────────────────────────────────

  it('fills all connected blocks of the same type', () => {
    // 3x3x3 all-air region
    const schematic = makeSchematic({ x: 3, y: 3, z: 3 }, ['minecraft:air', 'minecraft:stone'])

    const cmd = new FillCommand(schematic, 1, 1, 1, 'minecraft:stone')
    cmd.execute()

    // All 27 blocks should now be stone
    for (let x = 0; x < 3; x++) {
      for (let y = 0; y < 3; y++) {
        for (let z = 0; z < 3; z++) {
          expect(schematic.getBlock(x, y, z)!.Name).toBe('minecraft:stone')
        }
      }
    }
  })

  it('does nothing when source block equals target block', () => {
    // Pre-fill all with stone values
    const size = { x: 2, y: 2, z: 2 }
    const values = [1, 1, 1, 1, 1, 1, 1, 1] // all stone (index 1)
    const schematic = makeSchematic(size, ['minecraft:air', 'minecraft:stone'], values)

    // Set block at (0,0,0) to stone first to trigger edit mode
    schematic.setBlock(0, 0, 0, 'minecraft:stone')

    const cmd = new FillCommand(schematic, 0, 0, 0, 'minecraft:stone')
    cmd.execute()

    // Should still be all stone
    for (let x = 0; x < 2; x++) {
      for (let y = 0; y < 2; y++) {
        for (let z = 0; z < 2; z++) {
          expect(schematic.getBlock(x, y, z)!.Name).toBe('minecraft:stone')
        }
      }
    }
  })

  // ── Only fills connected blocks ──────────────────────────────

  it('only replaces blocks matching the source type', () => {
    // 3x3x3 with specific layout: center row is stone (index 1), rest is air (index 0)
    const values: number[] = []
    for (let y = 0; y < 3; y++) {
      for (let z = 0; z < 3; z++) {
        for (let x = 0; x < 3; x++) {
          // Make Y=1 layer all stone, others air
          values.push(y === 1 ? 1 : 0)
        }
      }
    }
    const schematic = makeSchematic(
      { x: 3, y: 3, z: 3 },
      ['minecraft:air', 'minecraft:stone', 'minecraft:dirt'],
      values,
    )

    // Fill from a top-layer air block with dirt
    const cmd = new FillCommand(schematic, 1, 0, 1, 'minecraft:dirt')
    cmd.execute()

    // Top layer (y=0) should be dirt (was air)
    for (let x = 0; x < 3; x++) {
      for (let z = 0; z < 3; z++) {
        expect(schematic.getBlock(x, 0, z)!.Name).toBe('minecraft:dirt')
      }
    }

    // Bottom layer (y=2) should remain air — separated by stone wall at y=1
    for (let x = 0; x < 3; x++) {
      for (let z = 0; z < 3; z++) {
        expect(schematic.getBlock(x, 2, z)!.Name).toBe('minecraft:air')
      }
    }

    // Middle layer (y=1) should still be stone (not connected via same type)
    for (let x = 0; x < 3; x++) {
      for (let z = 0; z < 3; z++) {
        expect(schematic.getBlock(x, 1, z)!.Name).toBe('minecraft:stone')
      }
    }
  })

  it('does not cross diagonal gaps', () => {
    // 3x3x3 with a diagonal wall of stone separating air pockets
    // y=0: all air
    // y=1: diagonal x=z is stone, rest air
    // y=2: all air
    const values: number[] = []
    for (let y = 0; y < 3; y++) {
      for (let z = 0; z < 3; z++) {
        for (let x = 0; x < 3; x++) {
          values.push(y === 1 && x === z ? 1 : 0)
        }
      }
    }
    const schematic = makeSchematic(
      { x: 3, y: 3, z: 3 },
      ['minecraft:air', 'minecraft:stone', 'minecraft:dirt'],
      values,
    )

    // Fill from (0,0,0) with dirt — should connect through y=0 and around the diagonal
    const cmd = new FillCommand(schematic, 0, 0, 0, 'minecraft:dirt')
    cmd.execute()

    // (0,0,0) and neighbors in top layer should be dirt
    expect(schematic.getBlock(0, 0, 0)!.Name).toBe('minecraft:dirt')
    // The diagonal stone block should remain stone
    expect(schematic.getBlock(1, 1, 1)!.Name).toBe('minecraft:stone')
    // Stone at (2,1,2) should remain
    expect(schematic.getBlock(2, 1, 2)!.Name).toBe('minecraft:stone')
  })

  // ── Region boundaries ────────────────────────────────────────

  it('does not cross region boundaries', () => {
    const nbtValue = makeMockLitematicNbt({
      version: 6,
      regions: {
        R1: makeMockRegionNbt({
          size: { x: 2, y: 2, z: 2 },
          position: { x: 0, y: 0, z: 0 },
          palette: ['minecraft:air', 'minecraft:stone'],
        }),
        R2: makeMockRegionNbt({
          size: { x: 2, y: 2, z: 2 },
          position: { x: 3, y: 0, z: 0 },
          palette: ['minecraft:air', 'minecraft:stone'],
        }),
      },
    })
    const schematic = new Litematic({ type: 'compound', value: nbtValue })

    // Fill from R1 center — should only affect R1
    const cmd = new FillCommand(schematic, 1, 1, 0, 'minecraft:stone')
    cmd.execute()

    // R1 should be all stone
    for (let x = 0; x < 2; x++) {
      for (let y = 0; y < 2; y++) {
        for (let z = 0; z < 2; z++) {
          expect(schematic.getBlock(x, y, z)!.Name).toBe('minecraft:stone')
        }
      }
    }

    // R2 should still be air (positions x=3,4 y=0,1 z=0,1)
    expect(schematic.getBlock(3, 0, 0)!.Name).toBe('minecraft:air')
    expect(schematic.getBlock(4, 1, 1)!.Name).toBe('minecraft:air')
  })

  // ── Undo ─────────────────────────────────────────────────────

  it('undo restores all blocks to original state', () => {
    const schematic = makeSchematic({ x: 3, y: 3, z: 3 }, ['minecraft:air', 'minecraft:stone'])

    // Verify initial state
    expect(schematic.getBlock(1, 1, 1)!.Name).toBe('minecraft:air')

    const cmd = new FillCommand(schematic, 1, 1, 1, 'minecraft:stone')
    cmd.execute()

    // After fill
    expect(schematic.getBlock(1, 1, 1)!.Name).toBe('minecraft:stone')
    expect(schematic.getBlock(0, 0, 0)!.Name).toBe('minecraft:stone')

    // Undo
    cmd.undo()

    // All should be air again
    for (let x = 0; x < 3; x++) {
      for (let y = 0; y < 3; y++) {
        for (let z = 0; z < 3; z++) {
          expect(schematic.getBlock(x, y, z)!.Name).toBe('minecraft:air')
        }
      }
    }
  })

  // ── Redo ─────────────────────────────────────────────────────

  it('redo re-applies fill after undo', () => {
    const schematic = makeSchematic({ x: 2, y: 2, z: 2 }, ['minecraft:air', 'minecraft:stone'])

    const cmd = new FillCommand(schematic, 1, 1, 1, 'minecraft:stone')
    cmd.execute()
    cmd.undo()

    // After undo, should be air
    expect(schematic.getBlock(0, 0, 0)!.Name).toBe('minecraft:air')

    // Redo
    cmd.execute()

    // Should be stone again
    expect(schematic.getBlock(0, 0, 0)!.Name).toBe('minecraft:stone')
    expect(schematic.getBlock(1, 1, 1)!.Name).toBe('minecraft:stone')
  })

  // ── Max blocks limit ─────────────────────────────────────────

  it('throws when connected region exceeds max blocks', () => {
    // Use a small limit for testing
    const schematic = makeSchematic({ x: 3, y: 3, z: 3 }, ['minecraft:air', 'minecraft:stone'])

    const cmd = new FillCommand(schematic, 1, 1, 1, 'minecraft:stone', 5)
    expect(() => cmd.execute()).toThrow(/exceeded/i)
  })

  it('does not throw when region is within limit', () => {
    const schematic = makeSchematic({ x: 2, y: 2, z: 2 }, ['minecraft:air', 'minecraft:stone'])

    const cmd = new FillCommand(schematic, 1, 1, 1, 'minecraft:stone', 10)
    expect(() => cmd.execute()).not.toThrow()
  })

  // ── Single block fill ────────────────────────────────────────

  it('fills a single isolated block', () => {
    // 3x3x3 where only (1,1,1) is air, rest is stone
    const values: number[] = []
    for (let y = 0; y < 3; y++) {
      for (let z = 0; z < 3; z++) {
        for (let x = 0; x < 3; x++) {
          values.push(x === 1 && y === 1 && z === 1 ? 0 : 1)
        }
      }
    }
    const schematic = makeSchematic(
      { x: 3, y: 3, z: 3 },
      ['minecraft:air', 'minecraft:stone'],
      values,
    )

    const cmd = new FillCommand(schematic, 1, 1, 1, 'minecraft:stone')
    cmd.execute()

    // Only (1,1,1) should change
    for (let x = 0; x < 3; x++) {
      for (let y = 0; y < 3; y++) {
        for (let z = 0; z < 3; z++) {
          expect(schematic.getBlock(x, y, z)!.Name).toBe('minecraft:stone')
        }
      }
    }
  })

  // ── getLabel ─────────────────────────────────────────────────

  it('returns a descriptive label', () => {
    const schematic = makeSchematic({ x: 2, y: 2, z: 2 }, ['minecraft:air', 'minecraft:stone'])

    const cmd = new FillCommand(schematic, 1, 1, 1, 'minecraft:stone')
    cmd.execute()

    const label = cmd.getLabel()
    expect(label).toContain('minecraft:air')
    expect(label).toContain('minecraft:stone')
    expect(label).toContain('(1, 1, 1)')
  })

  // ── Palette expansion on fill ────────────────────────────────

  it('auto-adds target block to palette if not present', () => {
    const schematic = makeSchematic({ x: 2, y: 2, z: 2 }, ['minecraft:air'])

    const cmd = new FillCommand(schematic, 0, 0, 0, 'minecraft:diamond_block')
    cmd.execute()

    // All blocks should be diamond_block
    for (let x = 0; x < 2; x++) {
      for (let y = 0; y < 2; y++) {
        for (let z = 0; z < 2; z++) {
          expect(schematic.getBlock(x, y, z)!.Name).toBe('minecraft:diamond_block')
        }
      }
    }

    // Palette should now contain the new block
    expect(schematic.regions[0].palette).toContain('minecraft:diamond_block')
  })
})
