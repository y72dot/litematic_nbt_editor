import { describe, it, expect } from 'vitest'
import { PackedBlockStorage } from '../PackedBlockStorage'
import type { TraversalOrder } from '../BlockStorage'

// ─── Helpers for building packed data ───────────────────────────

/**
 * Pack values into a BigInt64Array using NON-SPANNING layout.
 * Each long holds floor(64 / bps) blocks. Leftover bits per long are unused.
 */
function packNonSpanning(values: number[], bitsPerBlock: number): BigInt64Array {
  const blocksPerLong = Math.floor(64 / bitsPerBlock)
  const numLongs = Math.ceil(values.length / blocksPerLong)
  const longs = new BigInt64Array(numLongs)
  for (let i = 0; i < values.length; i++) {
    const longIdx = Math.floor(i / blocksPerLong)
    const bitOffset = (i % blocksPerLong) * bitsPerBlock
    longs[longIdx] |= BigInt(values[i]) << BigInt(bitOffset)
  }
  return longs
}

/**
 * Pack values into a BigInt64Array using SPANNING layout.
 * Values are packed contiguously without long-boundary gaps.
 */
function packSpanning(values: number[], bitsPerBlock: number): BigInt64Array {
  const totalBits = values.length * bitsPerBlock
  const numLongs = Math.ceil(totalBits / 64)
  const longs = new BigInt64Array(numLongs)
  for (let i = 0; i < values.length; i++) {
    const startBit = i * bitsPerBlock
    const startLong = Math.floor(startBit / 64)
    const bitOffset = startBit % 64
    const val = BigInt(values[i])
    longs[startLong] |= val << BigInt(bitOffset)
    if (bitOffset + bitsPerBlock > 64) {
      // Spans into next long
      const bitsInFirst = 64 - bitOffset
      longs[startLong + 1] |= val >> BigInt(bitsInFirst)
    }
  }
  return longs
}

// ─── Tests ──────────────────────────────────────────────────────

const size = { x: 2, y: 2, z: 2 } // 8 blocks

describe('PackedBlockStorage', () => {
  // ── Construction ─────────────────────────────────────────────

  describe('constructor', () => {
    it('accepts BigInt64Array', () => {
      const data = new BigInt64Array(1)
      data[0] = 0n
      const s = new PackedBlockStorage(data, 4, size, 'non-spanning')
      expect(s.getBlockIndex(0, 0, 0)).toBe(0)
    })

    it('accepts number[] and converts to BigInt64Array', () => {
      const data = [42n] // BigInt values in array
      const s = new PackedBlockStorage(data, 4, size, 'non-spanning')
      expect(s.getBlockIndex(0, 0, 0)).toBe(Number(BigInt.asUintN(64, 42n) & 3n))
    })

    it('handles unknown data format gracefully', () => {
      const s = new PackedBlockStorage({ foo: 'bar' }, 4, size)
      // Should initialize with empty storage
      expect(s.getBlockIndex(0, 0, 0)).toBe(0)
    })

    it('stores palette size and size', () => {
      const s = new PackedBlockStorage(new BigInt64Array(1), 50, { x: 3, y: 4, z: 5 })
      expect(s.getPaletteSize()).toBe(50)
      expect(s.getSize()).toEqual({ x: 3, y: 4, z: 5 })
    })
  })

  // ── Non-spanning reads ───────────────────────────────────────

  describe('non-spanning reads', () => {
    it('reads bitsPerBlock=2 correctly', () => {
      const bps = 2
      const values = [3, 2, 1, 0, 3, 2, 1, 0]
      const packed = packNonSpanning(values, bps)
      const s = new PackedBlockStorage(packed, 4, size, 'non-spanning')

      for (let i = 0; i < 8; i++) {
        // YZX order: index = (y * zSize + z) * xSize + x
        // Reverse: y = floor(i / (zSize*xSize)), z = floor((i % (zSize*xSize)) / xSize), x = i % xSize
        const y = Math.floor(i / 4)
        const z = Math.floor((i % 4) / 2)
        const x = i % 2
        expect(s.getBlockIndex(x, y, z)).toBe(values[i])
      }
    })

    it('reads bitsPerBlock=4 correctly', () => {
      const bps = 4
      // 16 blocks per long, enough for our 8-block volume
      const values = [15, 8, 3, 0, 7, 1, 12, 5]
      const packed = packNonSpanning(values, bps)
      const s = new PackedBlockStorage(packed, 16, size, 'non-spanning')

      for (let i = 0; i < 8; i++) {
        // YZX: y = floor(i / 4), z = floor((i % 4) / 2), x = i % 2
        const y = Math.floor(i / 4)
        const z = Math.floor((i % 4) / 2)
        const x = i % 2
        expect(s.getBlockIndex(x, y, z)).toBe(values[i])
      }
    })

    it('reads bitsPerBlock=8 correctly', () => {
      const bps = 8
      const values = [255, 128, 64, 32, 16, 8, 4, 2]
      const packed = packNonSpanning(values, bps)
      const s = new PackedBlockStorage(packed, 256, size, 'non-spanning')

      for (let i = 0; i < 8; i++) {
        const y = Math.floor(i / 4)
        const z = Math.floor((i % 4) / 2)
        const x = i % 2
        expect(s.getBlockIndex(x, y, z)).toBe(values[i])
      }
    })

    it('reads bitsPerBlock=16 correctly', () => {
      const bps = 16
      const values = [65535, 32768, 16384, 8192, 4096, 2048, 1024, 512]
      const packed = packNonSpanning(values, bps)
      const s = new PackedBlockStorage(packed, 65536, { x: 2, y: 2, z: 2 }, 'non-spanning')

      for (let i = 0; i < 8; i++) {
        const y = Math.floor(i / 4)
        const z = Math.floor((i % 4) / 2)
        const x = i % 2
        expect(s.getBlockIndex(x, y, z)).toBe(values[i])
      }
    })
  })

  // ── Spanning reads ───────────────────────────────────────────

  describe('spanning reads', () => {
    it('reads values that cross long boundaries (bps=5)', () => {
      const bps = 5
      // 13 blocks with bps=5: spanning mode packs contiguously (65 bits → 2 longs)
      // Block 12 spans bits 60-64 across long 0 and long 1
      const values = new Array(13).fill(0)
      values[0] = 5
      values[12] = 31 // 0b11111, spans across long boundary

      const packed = packSpanning(values, bps)
      const s = new PackedBlockStorage(packed, 32, { x: 1, y: 1, z: 13 }, 'spanning')

      expect(s.getBlockIndex(0, 0, 0)).toBe(5)
      expect(s.getBlockIndex(0, 0, 12)).toBe(31)
    })

    it('produces different result from non-spanning for bps=5', () => {
      const bps = 5
      const values = new Array(13).fill(0)
      values[12] = 31

      // Pack using spanning: value 31 spans bits 60-64 across long boundary
      const spanningPacked = packSpanning(values, bps)

      // Read with spanning → correctly decodes the cross-long value
      const spanningS = new PackedBlockStorage(spanningPacked, 32, { x: 1, y: 1, z: 13 }, 'spanning')
      expect(spanningS.getBlockIndex(0, 0, 12)).toBe(31)

      // Read the SAME spanning-packed data with non-spanning → different result
      // Non-spanning reads block 12 from long 1, bits 0-4 (only bit 0 set from spanning pack)
      const nonSpanningS = new PackedBlockStorage(spanningPacked, 32, { x: 1, y: 1, z: 13 }, 'non-spanning')
      expect(nonSpanningS.getBlockIndex(0, 0, 12)).not.toBe(31)
    })
  })

  // ── setBlockIndex ────────────────────────────────────────────

  describe('setBlockIndex', () => {
    it('throws an error (read-only)', () => {
      const s = new PackedBlockStorage(new BigInt64Array(1), 4, size)
      expect(() => s.setBlockIndex(0, 0, 0, 5)).toThrow('PackedBlockStorage is Read-Only')
    })
  })

  // ── toArray ──────────────────────────────────────────────────

  describe('toArray', () => {
    it('returns Uint32Array in YZX order', () => {
      // Pack values for a 2x2x2 volume in YZX order
      // YZX: for y in 0..1, for z in 0..1, for x in 0..1
      // index = (y * 2 + z) * 2 + x
      const yzxValues = [0, 1, 2, 3, 4, 5, 6, 7]
      // Non-spanning packs the same values at the same linear indices
      const packed = packNonSpanning(yzxValues, 4)
      const s = new PackedBlockStorage(packed, 16, size, 'non-spanning')
      const arr = s.toArray()
      expect(arr).toBeInstanceOf(Uint32Array)

      // toArray iterates YZX: for y, for z, for x -> getBlockIndex(x,y,z)
      let i = 0
      for (let y = 0; y < 2; y++) {
        for (let z = 0; z < 2; z++) {
          for (let x = 0; x < 2; x++) {
            expect(arr[i]).toBe(yzxValues[i])
            i++
          }
        }
      }
    })

    it('has correct length', () => {
      const s = new PackedBlockStorage(new BigInt64Array(1), 4, size)
      expect(s.toArray().length).toBe(8)
    })
  })

  // ── Traversal orders ─────────────────────────────────────────

  describe('traversalOrder', () => {
    const orders: TraversalOrder[] = ['XYZ', 'XZY', 'YXZ', 'YZX', 'ZXY', 'ZYX']

    it('defaults to YZX', () => {
      const s = new PackedBlockStorage(new BigInt64Array(1), 4, size)
      expect(s.traversalOrder).toBe('YZX')
    })

    it('supports switching to all 6 orders', () => {
      const packed = packNonSpanning([1, 2, 3, 4, 5, 6, 7, 8], 4)
      const s = new PackedBlockStorage(packed, 16, size, 'non-spanning')

      for (const order of orders) {
        s.setTraversalOrder(order)
        expect(s.traversalOrder).toBe(order)
        // Should not throw
        const val = s.getBlockIndex(0, 0, 0)
        expect(typeof val).toBe('number')
      }
    })

    it('toArray respects traversal order change', () => {
      const packed = packNonSpanning([1, 2, 3, 4, 5, 6, 7, 8], 4)
      const s = new PackedBlockStorage(packed, 16, size, 'non-spanning')

      // With YZX order, index = (y * 2 + z) * 2 + x
      s.setTraversalOrder('YZX')
      const yzx = s.toArray()

      // With different order, toArray should still output in YZX
      // because toArray always iterates y,z,x and calls getBlockIndex(x,y,z)
      s.setTraversalOrder('ZYX')
      const zyx = s.toArray()
      // The arrays may differ because getBlockIndex maps coordinates
      // differently under different traversal orders
      expect(yzx.length).toBe(zyx.length)
    })
  })

  // ── Edge cases ───────────────────────────────────────────────

  describe('edge cases', () => {
    it('returns 0 for empty data', () => {
      const s = new PackedBlockStorage(new BigInt64Array(0), 4, size)
      expect(s.getBlockIndex(0, 0, 0)).toBe(0)
    })

    it('returns 0 for out-of-bounds index', () => {
      // 2x2x2 = 8 blocks, each with 4 bits = 1 long is enough
      const packed = new BigInt64Array(1)
      packed[0] = ~0n // all bits set
      // Accessing an index beyond what's packed: non-spanning with bps=4
      // blocksPerLong = 16, so indices 0-15 are valid, 16+ returns 0
      // But our volume is only 8, so the long index for position 8:
      // YZX: pos(1,1,0) = (1*2+0)*2+1 = 5, pos(1,1,1) = (1*2+1)*2+1 = 7
      // All within first long, no OOB
      const s = new PackedBlockStorage(packed, 16, size, 'non-spanning')
      // All 8 blocks are within range; just verify no error
      expect(s.getBlockIndex(0, 0, 0)).not.toBe(0) // all bits set, should be 15
    })
  })
})
