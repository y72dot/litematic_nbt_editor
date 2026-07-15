import { describe, it, expect } from 'vitest'
import { getBitsPerBlock, isBlockVisible } from '../litematicParser'

// ─── getBitsPerBlock ───────────────────────────────────────────────

describe('getBitsPerBlock', () => {
  it('returns 2 for palette size 0', () => {
    expect(getBitsPerBlock(0)).toBe(2)
  })

  it('returns 2 for palette size 1', () => {
    expect(getBitsPerBlock(1)).toBe(2)
  })

  it('returns 2 for palette size 2', () => {
    expect(getBitsPerBlock(2)).toBe(2)
  })

  it('returns 2 for palette size 3', () => {
    expect(getBitsPerBlock(3)).toBe(2)
  })

  it('returns 2 for palette size 4', () => {
    expect(getBitsPerBlock(4)).toBe(2)
  })

  it('returns 3 for palette size 5', () => {
    expect(getBitsPerBlock(5)).toBe(3)
  })

  it('returns 3 for palette size 8', () => {
    expect(getBitsPerBlock(8)).toBe(3)
  })

  it('returns 4 for palette size 9', () => {
    expect(getBitsPerBlock(9)).toBe(4)
  })

  it('returns 8 for palette size 256', () => {
    expect(getBitsPerBlock(256)).toBe(8)
  })

  it('returns 9 for palette size 257', () => {
    expect(getBitsPerBlock(257)).toBe(9)
  })

  it('returns 16 for palette size 65536', () => {
    expect(getBitsPerBlock(65536)).toBe(16)
  })
})

// ─── isBlockVisible ────────────────────────────────────────────────

describe('isBlockVisible', () => {
  const w = 3, h = 3, l = 3

  // Helper: build a 3x3x3 block array filled with stone (ID 1),
  // optionally setting specific coordinates to air (ID 0).
  function makeBlocks(airPositions: [number, number, number][]): number[] {
    const blocks = new Array(w * h * l).fill(1) // all stone
    for (const [ax, ay, az] of airPositions) {
      const idx = (ay * l + az) * w + ax
      blocks[idx] = 0
    }
    return blocks
  }

  it('visible when +x neighbor is air', () => {
    const blocks = makeBlocks([[1, 1, 1]]) // make the center's +x neighbor air
    // center is at 0,1,1
    expect(isBlockVisible(0, 1, 1, w, h, l, blocks)).toBe(true)
  })

  it('visible when -x neighbor is air', () => {
    const blocks = makeBlocks([[-1, 1, 1]]) // doesn't exist in 3^3, so we test differently
    // Instead, put center at 1,1,1 and make 0,1,1 air
    const b = makeBlocks([[0, 1, 1]])
    expect(isBlockVisible(1, 1, 1, w, h, l, b)).toBe(true)
  })

  it('visible when +y neighbor is air', () => {
    const b = makeBlocks([[0, 2, 1]])
    expect(isBlockVisible(0, 1, 1, w, h, l, b)).toBe(true)
  })

  it('visible when -y neighbor is air', () => {
    const b = makeBlocks([[0, 0, 1]])
    expect(isBlockVisible(0, 1, 1, w, h, l, b)).toBe(true)
  })

  it('visible when +z neighbor is air', () => {
    const b = makeBlocks([[0, 1, 2]])
    expect(isBlockVisible(0, 1, 1, w, h, l, b)).toBe(true)
  })

  it('visible when -z neighbor is air', () => {
    const b = makeBlocks([[0, 1, 0]])
    expect(isBlockVisible(0, 1, 1, w, h, l, b)).toBe(true)
  })

  it('hidden when fully surrounded by non-air', () => {
    // center surrounded by stone IDs
    const blocks = new Array(w * h * l).fill(1)
    expect(isBlockVisible(1, 1, 1, w, h, l, blocks)).toBe(false)
  })

  it('visible when on the edge (out-of-bounds neighbor)', () => {
    // corner block at 0,0,0 - neighbors at -1 are OOB
    const blocks = new Array(w * h * l).fill(1)
    expect(isBlockVisible(0, 0, 0, w, h, l, blocks)).toBe(true)
  })

  it('visible when neighbor on boundary is air (not OOB)', () => {
    // block at 1,1,1 with neighbor at 2,1,1 being air
    const b = makeBlocks([[2, 1, 1]])
    expect(isBlockVisible(1, 1, 1, w, h, l, b)).toBe(true)
  })
})
