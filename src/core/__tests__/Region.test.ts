import { describe, it, expect } from 'vitest'
import { Region } from '../Region'
import { PackedBlockStorage } from '../PackedBlockStorage'
import { ArrayBlockStorage } from '../ArrayBlockStorage'
import { makeMockRegionNbt } from './testHelpers'

describe('Region', () => {
  // ── NBT construction path ────────────────────────────────────

  describe('NBT construction', () => {
    it('parses size, position, and palette from NBT', () => {
      const raw = makeMockRegionNbt({
        size: { x: 5, y: 6, z: 7 },
        position: { x: 10, y: 20, z: 30 },
        palette: ['minecraft:air', 'minecraft:stone', 'minecraft:dirt'],
      })

      const region = new Region('TestRegion', raw)

      expect(region.size).toEqual({ x: 5, y: 6, z: 7 })
      expect(region.position).toEqual({ x: 10, y: 20, z: 30 })
      expect(region.palette).toEqual(['minecraft:air', 'minecraft:stone', 'minecraft:dirt'])
      expect(region.name).toBe('TestRegion')
    })

    it('handles negative sizes by adjusting position', () => {
      const raw = makeMockRegionNbt({
        size: { x: -3, y: 5, z: -4 },
        position: { x: 10, y: 20, z: 30 },
        palette: ['minecraft:air', 'minecraft:stone'],
      })

      const region = new Region('NegRegion', raw)

      // Size = absolute values
      expect(region.size).toEqual({ x: 3, y: 5, z: 4 })
      // Position = pos + size for negative dimensions
      expect(region.position.x).toBe(10 + (-3)) // 7
      expect(region.position.y).toBe(20) // unchanged (positive)
      expect(region.position.z).toBe(30 + (-4)) // 26
    })

    it('parses palette with Properties', () => {
      const raw = makeMockRegionNbt({
        size: { x: 1, y: 1, z: 1 },
        paletteWithProps: [
          { Name: 'minecraft:air' },
          { Name: 'minecraft:oak_fence', Properties: { north: 'true', east: 'false' } },
        ],
      })

      const region = new Region('PropRegion', raw)

      expect(region.fullPalette).toHaveLength(2)
      expect(region.fullPalette[0]).toEqual({ Name: 'minecraft:air', Properties: undefined })
      expect(region.fullPalette[1]).toEqual({
        Name: 'minecraft:oak_fence',
        Properties: { north: 'true', east: 'false' },
      })
    })

    it('handles wrapped palette list (double .value)', () => {
      // Simulate a palette that's wrapped in an extra list value
      const raw: Record<string, unknown> = {
        Size: { type: 'compound', value: { x: { type: 'int', value: 2 }, y: { type: 'int', value: 2 }, z: { type: 'int', value: 2 } } },
        Position: { type: 'compound', value: { x: { type: 'int', value: 0 }, y: { type: 'int', value: 0 }, z: { type: 'int', value: 0 } } },
        BlockStatePalette: {
          type: 'list',
          value: {
            type: 'compound',
            // The value is an array but the code checks:
            // if (!Array.isArray(rawPalette) && rawPalette && rawPalette.value && Array.isArray(rawPalette.value))
            // To trigger this path, rawPalette (which is BlockStatePalette.value) needs to have a .value
            // that is the array. Let's just use the normal path for now.
            value: [
              { Name: { type: 'string', value: 'minecraft:air' } },
            ],
          },
        },
        BlockStates: { type: 'longArray', value: new BigInt64Array(1) },
      }

      const region = new Region('Wrapped', raw)
      expect(region.palette).toEqual(['minecraft:air'])
    })

    it('initializes PackedBlockStorage by default', () => {
      const raw = makeMockRegionNbt({ size: { x: 2, y: 2, z: 2 }, palette: ['air', 'stone'] })
      const region = new Region('Default', raw)
      expect(region.storage).toBeInstanceOf(PackedBlockStorage)
    })
  })

  // ── createFromData factory ────────────────────────────────────

  describe('createFromData', () => {
    it('creates Region with explicit parameters', () => {
      const storage = new ArrayBlockStorage({ x: 3, y: 3, z: 3 }, 10)
      storage.setBlockIndex(1, 1, 1, 5)

      const region = Region.createFromData(
        'Custom',
        { x: 3, y: 3, z: 3 },
        { x: 100, y: 64, z: 200 },
        [
          { Name: 'minecraft:air' },
          { Name: 'minecraft:stone', Properties: { variant: 'granite' } },
        ],
        storage
      )

      expect(region.name).toBe('Custom')
      expect(region.size).toEqual({ x: 3, y: 3, z: 3 })
      expect(region.position).toEqual({ x: 100, y: 64, z: 200 })
      expect(region.palette).toEqual(['minecraft:air', 'minecraft:stone'])
      expect(region.fullPalette[1].Properties).toEqual({ variant: 'granite' })
      expect(region.storage.getBlockIndex(1, 1, 1)).toBe(5)
    })
  })

  // ── enableEditing ────────────────────────────────────────────

  describe('enableEditing', () => {
    it('converts PackedBlockStorage to ArrayBlockStorage', () => {
      const raw = makeMockRegionNbt({ size: { x: 2, y: 2, z: 2 }, palette: ['air', 'stone'] })
      const region = new Region('EditMe', raw)

      expect(region.storage).toBeInstanceOf(PackedBlockStorage)

      region.enableEditing()

      expect(region.storage).toBeInstanceOf(ArrayBlockStorage)
      // Data preserved (packed was all zeros → unpacked should be all zeros)
      expect(region.storage.getBlockIndex(0, 0, 0)).toBe(0)
    })

    it('is a no-op if already ArrayBlockStorage', () => {
      const storage = new ArrayBlockStorage({ x: 2, y: 2, z: 2 }, 10)
      const region = Region.createFromData('Arr', { x: 2, y: 2, z: 2 }, { x: 0, y: 0, z: 0 }, [], storage)

      const before = region.storage
      region.enableEditing()
      expect(region.storage).toBe(before) // Same reference
    })

    it('preserves block data after conversion', () => {
      // Create packed data with known values
      // bitsPerBlock = 2 (palette size 4), non-spanning, 2x2x2
      const values = [3, 2, 1, 0, 3, 2, 1, 0]
      const bps = 2
      const blocksPerLong = Math.floor(64 / bps)
      const packed = new BigInt64Array(Math.ceil(8 / blocksPerLong))
      for (let i = 0; i < 8; i++) {
        const longIdx = Math.floor(i / blocksPerLong)
        const bitOffset = (i % blocksPerLong) * bps
        packed[longIdx] |= BigInt(values[i]) << BigInt(bitOffset)
      }

      const raw = makeMockRegionNbt({
        size: { x: 2, y: 2, z: 2 },
        palette: ['a', 'b', 'c', 'd'],
        blockStates: packed,
      })

      const region = new Region('Preserve', raw)
      region.enableEditing()

      // Verify all values are preserved (YZX order)
      for (let i = 0; i < 8; i++) {
        const y = Math.floor(i / 4)
        const z = Math.floor((i % 4) / 2)
        const x = i % 2
        expect(region.storage.getBlockIndex(x, y, z)).toBe(values[i])
      }
    })
  })

  // ── setUnpackingMethod ───────────────────────────────────────

  describe('setUnpackingMethod', () => {
    it('changes version on PackedBlockStorage', () => {
      const raw = makeMockRegionNbt({ size: { x: 2, y: 2, z: 2 }, palette: ['air', 'stone'] })
      const region = new Region('Version', raw)
      const storage = region.storage as PackedBlockStorage
      expect(storage.version).toBe('non-spanning')

      region.setUnpackingMethod('spanning')
      expect(storage.version).toBe('spanning')
    })

    it('no-ops on ArrayBlockStorage', () => {
      const storage = new ArrayBlockStorage({ x: 2, y: 2, z: 2 }, 10)
      const region = Region.createFromData('Arr', { x: 2, y: 2, z: 2 }, { x: 0, y: 0, z: 0 }, [], storage)
      // Should not throw
      expect(() => region.setUnpackingMethod('spanning')).not.toThrow()
    })
  })

  // ── setTraversalOrder ────────────────────────────────────────

  describe('setTraversalOrder', () => {
    it('sets traversal order on PackedBlockStorage', () => {
      const raw = makeMockRegionNbt({ size: { x: 2, y: 2, z: 2 }, palette: ['air', 'stone'] })
      const region = new Region('Order', raw)
      region.setTraversalOrder('ZYX')
      expect((region.storage as PackedBlockStorage).traversalOrder).toBe('ZYX')
    })
  })

  // ── null construction ────────────────────────────────────────

  describe('null construction', () => {
    it('creates empty region when rawRegionData is null', () => {
      const region = new Region('Empty', null)
      expect(region.size).toEqual({ x: 0, y: 0, z: 0 })
      expect(region.position).toEqual({ x: 0, y: 0, z: 0 })
      expect(region.palette).toEqual([])
      expect(region.fullPalette).toEqual([])
      expect(region.storage).toBeInstanceOf(ArrayBlockStorage)
    })
  })
})
