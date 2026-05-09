import { describe, it, expect } from 'vitest'
import { Litematic } from '../Litematic'
import { makeMockLitematicNbt, makeMockRegionNbt } from './testHelpers'

describe('Litematic', () => {
  // ── Construction / Version ───────────────────────────────────

  describe('construction', () => {
    it('defaults to version 6 (non-spanning)', () => {
      const nbtValue = makeMockLitematicNbt()
      const rootTag = { type: 'compound', value: nbtValue }
      const lit = new Litematic(rootTag)

      expect(lit.version).toBe(6)
      expect(lit.preferredFormat).toBe('non-spanning')
    })

    it('detects version 5 and uses spanning', () => {
      const nbtValue = makeMockLitematicNbt({ version: 5 })
      const rootTag = { type: 'compound', value: nbtValue }
      const lit = new Litematic(rootTag)

      expect(lit.version).toBe(5)
      expect(lit.preferredFormat).toBe('spanning')
    })

    it('parses a single region', () => {
      const nbtValue = makeMockLitematicNbt()
      const rootTag = { type: 'compound', value: nbtValue }
      const lit = new Litematic(rootTag)

      expect(lit.regions).toHaveLength(1)
      expect(lit.regions[0].name).toBe('Main')
    })

    it('parses multiple regions', () => {
      const nbtValue = makeMockLitematicNbt({
        regions: {
          Front: makeMockRegionNbt({ size: { x: 3, y: 3, z: 3 }, position: { x: 0, y: 0, z: 0 } }),
          Back: makeMockRegionNbt({ size: { x: 2, y: 2, z: 2 }, position: { x: 10, y: 0, z: 0 } }),
        },
      })
      const rootTag = { type: 'compound', value: nbtValue }
      const lit = new Litematic(rootTag)

      expect(lit.regions).toHaveLength(2)
      expect(lit.regions.map(r => r.name).sort()).toEqual(['Back', 'Front'])
    })
  })

  // ── Metadata ─────────────────────────────────────────────────

  describe('metadata', () => {
    it('parses name, author, description', () => {
      const nbtValue = makeMockLitematicNbt({
        metadata: {
          name: 'My Build',
          author: 'Player1',
          description: 'A cool house',
        },
      })
      const rootTag = { type: 'compound', value: nbtValue }
      const lit = new Litematic(rootTag)

      expect(lit.metadata.name).toBe('My Build')
      expect(lit.metadata.author).toBe('Player1')
      expect(lit.metadata.description).toBe('A cool house')
    })

    it('parses time created/modified', () => {
      const nbtValue = makeMockLitematicNbt({
        metadata: {
          timeCreated: 1700000000000n,
          timeModified: 1700000001000n,
        },
      })
      const rootTag = { type: 'compound', value: nbtValue }
      const lit = new Litematic(rootTag)

      expect(lit.metadata.timeCreated).not.toBe('Unknown')
      expect(lit.metadata.timeModified).not.toBe('Unknown')
    })

    it('parses enclosing size', () => {
      const nbtValue = makeMockLitematicNbt({
        metadata: {
          enclosingSize: { x: 10, y: 20, z: 30 },
        },
      })
      const rootTag = { type: 'compound', value: nbtValue }
      const lit = new Litematic(rootTag)

      expect(lit.metadata.enclosingSize).toEqual({ x: 10, y: 20, z: 30 })
      expect(lit.metadata.size).toEqual({ x: 10, y: 20, z: 30 })
    })

    it('handles missing metadata gracefully', () => {
      const nbtValue = makeMockLitematicNbt()
      const rootTag = { type: 'compound', value: nbtValue }
      const lit = new Litematic(rootTag)

      expect(lit.metadata.name).toBe('')
      expect(lit.metadata.author).toBe('')
      expect(lit.metadata.description).toBe('')
      expect(lit.metadata.regions).toBe(1)
    })

    it('counts correct number of regions', () => {
      const nbtValue = makeMockLitematicNbt({
        regions: {
          A: makeMockRegionNbt(),
          B: makeMockRegionNbt(),
          C: makeMockRegionNbt(),
        },
      })
      const rootTag = { type: 'compound', value: nbtValue }
      const lit = new Litematic(rootTag)

      expect(lit.metadata.regions).toBe(3)
    })
  })

  // ── getRegion ────────────────────────────────────────────────

  describe('getRegion', () => {
    it('returns region by name', () => {
      const nbtValue = makeMockLitematicNbt()
      const rootTag = { type: 'compound', value: nbtValue }
      const lit = new Litematic(rootTag)

      const region = lit.getRegion('Main')
      expect(region).toBeDefined()
      expect(region!.name).toBe('Main')
    })

    it('returns undefined for non-existent region', () => {
      const nbtValue = makeMockLitematicNbt()
      const rootTag = { type: 'compound', value: nbtValue }
      const lit = new Litematic(rootTag)

      expect(lit.getRegion('NonExistent')).toBeUndefined()
    })
  })

  // ── getBlock ─────────────────────────────────────────────────

  describe('getBlock', () => {
    it('returns block within region bounds', () => {
      const nbtValue = makeMockLitematicNbt({
        regions: {
          Main: makeMockRegionNbt({
            size: { x: 3, y: 3, z: 3 },
            position: { x: 0, y: 0, z: 0 },
            palette: ['minecraft:air', 'minecraft:stone'],
          }),
        },
      })
      const rootTag = { type: 'compound', value: nbtValue }
      const lit = new Litematic(rootTag)

      // Block at (0,0,0) - the packed data is all zeros so palette index 0 = 'minecraft:air'
      const block = lit.getBlock(0, 0, 0)
      expect(block).not.toBeNull()
      expect(block!.Name).toBe('minecraft:air')
    })

    it('returns null for coordinates outside all regions', () => {
      const nbtValue = makeMockLitematicNbt({
        regions: {
          Main: makeMockRegionNbt({
            size: { x: 2, y: 2, z: 2 },
            position: { x: 0, y: 0, z: 0 },
          }),
        },
      })
      const rootTag = { type: 'compound', value: nbtValue }
      const lit = new Litematic(rootTag)

      expect(lit.getBlock(100, 100, 100)).toBeNull()
    })

    it('handles region with non-zero position offset', () => {
      const nbtValue = makeMockLitematicNbt({
        regions: {
          Shifted: makeMockRegionNbt({
            size: { x: 2, y: 2, z: 2 },
            position: { x: 5, y: 0, z: 5 },
            palette: ['minecraft:air', 'minecraft:stone'],
          }),
        },
      })
      const rootTag = { type: 'compound', value: nbtValue }
      const lit = new Litematic(rootTag)

      // (0,0,0) global is outside the shifted region
      expect(lit.getBlock(0, 0, 0)).toBeNull()
      // (5,0,5) global = (0,0,0) local → inside
      expect(lit.getBlock(5, 0, 5)).not.toBeNull()
    })
  })

  // ── renameBlock ──────────────────────────────────────────────

  describe('renameBlock', () => {
    it('updates fullPalette and palette in all regions', () => {
      const nbtValue = makeMockLitematicNbt({
        regions: {
          R1: makeMockRegionNbt({
            size: { x: 1, y: 1, z: 1 },
            paletteWithProps: [
              { Name: 'minecraft:stone' },
              { Name: 'minecraft:dirt' },
            ],
          }),
          R2: makeMockRegionNbt({
            size: { x: 1, y: 1, z: 1 },
            paletteWithProps: [
              { Name: 'minecraft:air' },
              { Name: 'minecraft:stone' },
            ],
          }),
        },
      })
      const rootTag = { type: 'compound', value: nbtValue }
      const lit = new Litematic(rootTag)

      lit.renameBlock('minecraft:stone', 'minecraft:granite')

      for (const region of lit.regions) {
        expect(region.palette).not.toContain('minecraft:stone')
        expect(region.fullPalette.every(p => p.Name !== 'minecraft:stone')).toBe(true)
      }
    })

    it('updates raw NBT palette entries', () => {
      const nbtValue = makeMockLitematicNbt({
        regions: {
          Main: makeMockRegionNbt({
            size: { x: 1, y: 1, z: 1 },
            paletteWithProps: [
              { Name: 'minecraft:stone' },
              { Name: 'minecraft:dirt' },
            ],
          }),
        },
      })
      const rootTag = { type: 'compound', value: nbtValue }
      const lit = new Litematic(rootTag)

      lit.renameBlock('minecraft:stone', 'minecraft:granite')

      // Check raw NBT was updated
      const regionsMap = lit.rawNbt.value.Regions.value
      const mainRegion = regionsMap['Main'].value
      let palette = mainRegion.BlockStatePalette.value
      // Handle wrapping
      if (!Array.isArray(palette) && palette && palette.value && Array.isArray(palette.value)) {
        palette = palette.value
      }
      expect(palette[0].Name.value).toBe('minecraft:granite')
    })

    it('does not change unrelated palette entries', () => {
      const nbtValue = makeMockLitematicNbt({
        regions: {
          Main: makeMockRegionNbt({
            size: { x: 1, y: 1, z: 1 },
            paletteWithProps: [
              { Name: 'minecraft:stone' },
              { Name: 'minecraft:dirt' },
            ],
          }),
        },
      })
      const rootTag = { type: 'compound', value: nbtValue }
      const lit = new Litematic(rootTag)

      lit.renameBlock('minecraft:stone', 'minecraft:granite')

      expect(lit.regions[0].palette).toContain('minecraft:dirt')
    })

    it('handles palette with wrapped list (double .value)', () => {
      // Manually construct NBT with wrapped palette
      const nbtValue: Record<string, unknown> = {
        Version: { type: 'int', value: 6 },
        Metadata: {
          type: 'compound',
          value: {},
        },
        Regions: {
          type: 'compound',
          value: {
            Main: {
              type: 'compound',
              value: {
                Size: {
                  type: 'compound',
                  value: {
                    x: { type: 'int', value: 1 },
                    y: { type: 'int', value: 1 },
                    z: { type: 'int', value: 1 },
                  },
                },
                Position: {
                  type: 'compound',
                  value: {
                    x: { type: 'int', value: 0 },
                    y: { type: 'int', value: 0 },
                    z: { type: 'int', value: 0 },
                  },
                },
                BlockStatePalette: {
                  type: 'list',
                  value: {
                    type: 'compound',
                    value: [
                      { Name: { type: 'string', value: 'minecraft:oak_log' } },
                    ],
                  },
                },
                BlockStates: { type: 'longArray', value: new BigInt64Array(1) },
              },
            },
          },
        },
      }
      const rootTag = { type: 'compound', value: nbtValue }
      const lit = new Litematic(rootTag)

      lit.renameBlock('minecraft:oak_log', 'minecraft:birch_log')

      const regionsMap = lit.rawNbt.value.Regions.value
      let paletteVal = regionsMap['Main'].value.BlockStatePalette.value
      // Handle possible wrapping (same logic as in Region constructor)
      if (!Array.isArray(paletteVal) && paletteVal && paletteVal.value && Array.isArray(paletteVal.value)) {
        paletteVal = paletteVal.value
      }
      expect(paletteVal[0].Name.value).toBe('minecraft:birch_log')
    })
  })

  // ── toNbt ────────────────────────────────────────────────────

  describe('toNbt', () => {
    it('returns a value with Metadata populated', () => {
      const nbtValue = makeMockLitematicNbt({
        metadata: {
          name: 'Test',
          author: 'Author',
          description: 'Desc',
        },
      })
      const rootTag = { type: 'compound', value: nbtValue }
      const lit = new Litematic(rootTag)

      const result = lit.toNbt()
      expect(result).toBeDefined()
      expect(result.value.Metadata).toBeDefined()
    })

    it('creates Metadata compound if it did not exist', () => {
      const nbtValue: Record<string, unknown> = {
        Version: { type: 'int', value: 6 },
        Regions: { type: 'compound', value: {} },
      }
      const rootTag = { type: 'compound', value: nbtValue }
      const lit = new Litematic(rootTag)

      const result = lit.toNbt()
      expect(result.value.Metadata).toBeDefined()
      expect(result.value.Metadata.type).toBe('compound')
    })
  })
})
