import { describe, it, expect } from 'vitest'
import { Structure } from '../Structure'
import { makeMockStructureNbt } from './testHelpers'
import { ArrayBlockStorage } from '../ArrayBlockStorage'

describe('Structure', () => {
  // ── Construction ─────────────────────────────────────────────

  describe('construction', () => {
    it('parses size from int list', () => {
      const nbtValue = makeMockStructureNbt({
        size: { x: 5, y: 6, z: 7 },
      })
      const rootTag = { type: 'compound', value: nbtValue }
      const st = new Structure(rootTag)

      expect(st.regions).toHaveLength(1)
      expect(st.regions[0].size).toEqual({ x: 5, y: 6, z: 7 })
    })

    it('creates a single "main" region at origin', () => {
      const nbtValue = makeMockStructureNbt({ size: { x: 3, y: 3, z: 3 } })
      const rootTag = { type: 'compound', value: nbtValue }
      const st = new Structure(rootTag)

      expect(st.regions[0].name).toBe('main')
      expect(st.regions[0].position).toEqual({ x: 0, y: 0, z: 0 })
    })

    it('parses single palette', () => {
      const nbtValue = makeMockStructureNbt({
        size: { x: 1, y: 1, z: 1 },
        palette: [
          { Name: 'minecraft:air' },
          { Name: 'minecraft:stone' },
          { Name: 'minecraft:oak_log', Properties: { axis: 'y' } },
        ],
      })
      const rootTag = { type: 'compound', value: nbtValue }
      const st = new Structure(rootTag)

      expect(st.regions[0].fullPalette).toHaveLength(3)
      expect(st.regions[0].fullPalette[0]).toEqual({ Name: 'minecraft:air', Properties: undefined })
      expect(st.regions[0].fullPalette[2]).toEqual({
        Name: 'minecraft:oak_log',
        Properties: { axis: 'y' },
      })
    })

    it('parses palettes (list of lists) and takes first', () => {
      const nbtValue = makeMockStructureNbt({
        size: { x: 1, y: 1, z: 1 },
        palettes: [
          [
            { Name: 'minecraft:air' },
            { Name: 'minecraft:stone' },
          ],
          [
            { Name: 'minecraft:air' },
            { Name: 'minecraft:dirt' },
          ],
        ],
      })
      const rootTag = { type: 'compound', value: nbtValue }
      const st = new Structure(rootTag)

      // Should use the first palette
      expect(st.regions[0].palette).toEqual(['minecraft:air', 'minecraft:stone'])
    })

    it('parses blocks with pos and state', () => {
      const nbtValue = makeMockStructureNbt({
        size: { x: 2, y: 2, z: 2 },
        palette: [
          { Name: 'minecraft:air' },
          { Name: 'minecraft:stone' },
        ],
        blocks: [
          { x: 0, y: 0, z: 0, state: 1 },
          { x: 1, y: 1, z: 1, state: 1 },
        ],
      })
      const rootTag = { type: 'compound', value: nbtValue }
      const st = new Structure(rootTag)

      const region = st.regions[0]
      expect(region.storage.getBlockIndex(0, 0, 0)).toBe(1)
      expect(region.storage.getBlockIndex(1, 1, 1)).toBe(1)
      // Unspecified blocks should remain 0 (air)
      expect(region.storage.getBlockIndex(0, 0, 1)).toBe(0)
    })

    it('uses ArrayBlockStorage (editable by default)', () => {
      const nbtValue = makeMockStructureNbt({ size: { x: 2, y: 2, z: 2 } })
      const rootTag = { type: 'compound', value: nbtValue }
      const st = new Structure(rootTag)

      expect(st.regions[0].storage).toBeInstanceOf(ArrayBlockStorage)
    })
  })

  // ── Metadata defaults ────────────────────────────────────────

  describe('metadata', () => {
    it('sets default metadata values', () => {
      const nbtValue = makeMockStructureNbt({ size: { x: 3, y: 4, z: 5 } })
      const rootTag = { type: 'compound', value: nbtValue }
      const st = new Structure(rootTag)

      expect(st.metadata.name).toBe('structure.nbt')
      expect(st.metadata.author).toBe('Unknown')
      expect(st.metadata.description).toBe('Imported from .nbt structure file')
      expect(st.metadata.regions).toBe(1)
      expect(st.metadata.size).toEqual({ x: 3, y: 4, z: 5 })
      expect(st.metadata.enclosingSize).toEqual({ x: 3, y: 4, z: 5 })
    })
  })

  // ── getRegion ────────────────────────────────────────────────

  describe('getRegion', () => {
    it('returns the main region', () => {
      const nbtValue = makeMockStructureNbt({ size: { x: 1, y: 1, z: 1 } })
      const rootTag = { type: 'compound', value: nbtValue }
      const st = new Structure(rootTag)

      expect(st.getRegion('main')).toBeDefined()
      expect(st.getRegion('nonexistent')).toBeUndefined()
    })
  })

  // ── getBlock ─────────────────────────────────────────────────

  describe('getBlock', () => {
    it('returns block at specified coordinates', () => {
      const nbtValue = makeMockStructureNbt({
        size: { x: 2, y: 2, z: 2 },
        palette: [
          { Name: 'minecraft:air' },
          { Name: 'minecraft:stone' },
        ],
        blocks: [
          { x: 1, y: 0, z: 1, state: 1 },
        ],
      })
      const rootTag = { type: 'compound', value: nbtValue }
      const st = new Structure(rootTag)

      expect(st.getBlock(1, 0, 1)).toEqual({ Name: 'minecraft:stone', Properties: undefined })
    })

    it('returns air for unspecified blocks', () => {
      const nbtValue = makeMockStructureNbt({
        size: { x: 2, y: 2, z: 2 },
        palette: [
          { Name: 'minecraft:air' },
          { Name: 'minecraft:stone' },
        ],
        blocks: [
          { x: 1, y: 0, z: 1, state: 1 },
        ],
      })
      const rootTag = { type: 'compound', value: nbtValue }
      const st = new Structure(rootTag)

      expect(st.getBlock(0, 0, 0)).toEqual({ Name: 'minecraft:air', Properties: undefined })
    })

    it('returns null for out-of-bounds', () => {
      const nbtValue = makeMockStructureNbt({ size: { x: 2, y: 2, z: 2 } })
      const rootTag = { type: 'compound', value: nbtValue }
      const st = new Structure(rootTag)

      expect(st.getBlock(100, 100, 100)).toBeNull()
    })
  })

  // ── renameBlock ──────────────────────────────────────────────

  describe('renameBlock', () => {
    it('renames in palette path (single palette)', () => {
      const nbtValue = makeMockStructureNbt({
        size: { x: 1, y: 1, z: 1 },
        palette: [
          { Name: 'minecraft:stone' },
          { Name: 'minecraft:dirt' },
        ],
      })
      const rootTag = { type: 'compound', value: nbtValue }
      const st = new Structure(rootTag)

      st.renameBlock('minecraft:stone', 'minecraft:granite')

      expect(st.regions[0].palette).toEqual(['minecraft:granite', 'minecraft:dirt'])

      // Check raw NBT was updated
      const paletteList = st.rawNbt.value.palette.value.value
      expect(paletteList[0].Name.value).toBe('minecraft:granite')
    })

    it('renames in palettes path (list of lists)', () => {
      const nbtValue = makeMockStructureNbt({
        size: { x: 1, y: 1, z: 1 },
        palettes: [
          [
            { Name: 'minecraft:stone' },
            { Name: 'minecraft:dirt' },
          ],
          [
            { Name: 'minecraft:stone' },
            { Name: 'minecraft:gravel' },
          ],
        ],
      })
      const rootTag = { type: 'compound', value: nbtValue }
      const st = new Structure(rootTag)

      st.renameBlock('minecraft:stone', 'minecraft:andesite')

      // Check raw NBT palettes were updated
      const palettesList = st.rawNbt.value.palettes.value.value
      for (const paletteList of palettesList) {
        for (const e of paletteList.value) {
          if (e.Name) expect(e.Name.value).not.toBe('minecraft:stone')
        }
      }
    })

    it('does not change unrelated entries', () => {
      const nbtValue = makeMockStructureNbt({
        size: { x: 1, y: 1, z: 1 },
        palette: [
          { Name: 'minecraft:stone' },
          { Name: 'minecraft:dirt' },
        ],
      })
      const rootTag = { type: 'compound', value: nbtValue }
      const st = new Structure(rootTag)

      st.renameBlock('minecraft:stone', 'minecraft:granite')

      expect(st.regions[0].palette).toContain('minecraft:dirt')
    })
  })

  // ── setBlock ─────────────────────────────────────────────────

  describe('setBlock', () => {
    it('sets a block and getBlock returns it', () => {
      const nbtValue = makeMockStructureNbt({
        size: { x: 3, y: 3, z: 3 },
        palette: [
          { Name: 'minecraft:air' },
          { Name: 'minecraft:stone' },
        ],
      })
      const rootTag = { type: 'compound', value: nbtValue }
      const st = new Structure(rootTag)

      const result = st.setBlock(1, 1, 1, 'minecraft:stone')
      expect(result).toBe(true)

      const block = st.getBlock(1, 1, 1)
      expect(block).not.toBeNull()
      expect(block!.Name).toBe('minecraft:stone')
    })

    it('auto-adds new block type to palette', () => {
      const nbtValue = makeMockStructureNbt({
        size: { x: 2, y: 2, z: 2 },
        palette: [{ Name: 'minecraft:air' }],
      })
      const rootTag = { type: 'compound', value: nbtValue }
      const st = new Structure(rootTag)

      st.setBlock(0, 0, 0, 'minecraft:diamond_block')
      expect(st.regions[0].palette).toContain('minecraft:diamond_block')
      expect(st.getBlock(0, 0, 0)!.Name).toBe('minecraft:diamond_block')
    })

    it('returns false for out-of-bounds', () => {
      const nbtValue = makeMockStructureNbt({ size: { x: 2, y: 2, z: 2 } })
      const rootTag = { type: 'compound', value: nbtValue }
      const st = new Structure(rootTag)

      expect(st.setBlock(100, 100, 100, 'minecraft:stone')).toBe(false)
    })
  })

  // ── toNbt ────────────────────────────────────────────────────

  describe('toNbt', () => {
    it('returns raw NBT data', () => {
      const nbtValue = makeMockStructureNbt({ size: { x: 1, y: 1, z: 1 } })
      const rootTag = { type: 'compound', value: nbtValue }
      const st = new Structure(rootTag)

      const result = st.toNbt()
      expect(result).toBeDefined()
      expect(result.value.size).toBeDefined()
    })

    it('rebuilds blocks list after setBlock', () => {
      const nbtValue = makeMockStructureNbt({
        size: { x: 2, y: 2, z: 2 },
        palette: [
          { Name: 'minecraft:air' },
          { Name: 'minecraft:stone' },
        ],
      })
      const rootTag = { type: 'compound', value: nbtValue }
      const st = new Structure(rootTag)

      st.setBlock(0, 0, 0, 'minecraft:stone')
      st.setBlock(1, 1, 1, 'minecraft:stone')

      const result = st.toNbt()
      const blocks = result.value.blocks.value.value

      // Should have 2 block entries (non-air only)
      expect(blocks).toHaveLength(2)

      const positions = blocks.map((b: any) => {
        const p = b.pos.value.value
        return [p[0].value, p[1].value, p[2].value]
      })
      expect(positions).toContainEqual([0, 0, 0])
      expect(positions).toContainEqual([1, 1, 1])
    })

    it('toNbt round-trip: setBlock → toNbt → parse → getBlock', () => {
      const nbtValue = makeMockStructureNbt({
        size: { x: 3, y: 3, z: 3 },
        palette: [
          { Name: 'minecraft:air' },
          { Name: 'minecraft:stone' },
          { Name: 'minecraft:dirt' },
        ],
      })
      const rootTag = { type: 'compound', value: nbtValue }
      const st = new Structure(rootTag)

      st.setBlock(1, 1, 1, 'minecraft:stone')
      st.setBlock(2, 2, 2, 'minecraft:dirt')

      const saved = st.toNbt()
      const reloaded = new Structure(saved)

      expect(reloaded.getBlock(1, 1, 1)!.Name).toBe('minecraft:stone')
      expect(reloaded.getBlock(2, 2, 2)!.Name).toBe('minecraft:dirt')
      expect(reloaded.getBlock(0, 0, 0)!.Name).toBe('minecraft:air')
    })

    it('syncs palette to rawNbt after adding new block type', () => {
      const nbtValue = makeMockStructureNbt({
        size: { x: 1, y: 1, z: 1 },
        palette: [{ Name: 'minecraft:air' }],
      })
      const rootTag = { type: 'compound', value: nbtValue }
      const st = new Structure(rootTag)

      st.setBlock(0, 0, 0, 'minecraft:emerald_block')

      const result = st.toNbt()
      const palette = result.value.palette.value.value
      const names = palette.map((p: any) => p.Name.value)
      expect(names).toContain('minecraft:emerald_block')
    })
  })
})
