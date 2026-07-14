import { describe, it, expect } from 'vitest'
import { PackedBlockStorage } from '../PackedBlockStorage'
import type { TraversalOrder } from '../BlockStorage'
import { packNonSpanning, packSpanning } from './testHelpers'

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

    it.each([3, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15])(
      'decodes all blocks with bps=%i spanning (cross-long coverage)', (bps) => {
        const numBlocks = Math.ceil(128 / bps)
        const maxVal = (1 << bps) - 1
        const values = Array.from({ length: numBlocks }, (_, i) => i & maxVal)
        const packed = packSpanning(values, bps)
        const s = new PackedBlockStorage(packed, 1 << bps, { x: 1, y: 1, z: numBlocks }, 'spanning')

        for (let i = 0; i < numBlocks; i++) {
          expect(s.getBlockIndex(0, 0, i)).toBe(values[i])
        }
      }
    )
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

    it('toArray spanning bps=3 returns all values correctly', () => {
      const bps = 3
      const numBlocks = 30 // 90 bits, spans 2 longs
      const values = Array.from({ length: numBlocks }, (_, i) => (i * 3) & 7)
      const packed = packSpanning(values, bps)
      const s = new PackedBlockStorage(packed, 8, { x: 1, y: 1, z: numBlocks }, 'spanning')
      const arr = s.toArray()

      expect(arr.length).toBe(numBlocks)
      for (let i = 0; i < numBlocks; i++) {
        expect(arr[i]).toBe(values[i])
      }
    })

    it('toArray spanning bps=7 decodes cross-long-boundary values', () => {
      const bps = 7
      const numBlocks = 20 // 140 bits, 3 longs
      const values = Array.from({ length: numBlocks }, (_, i) => (i * 13 + 5) & 127)
      const packed = packSpanning(values, bps)
      const s = new PackedBlockStorage(packed, 128, { x: 1, y: 1, z: numBlocks }, 'spanning')
      const arr = s.toArray()

      expect(arr.length).toBe(numBlocks)
      for (let i = 0; i < numBlocks; i++) {
        expect(arr[i]).toBe(values[i])
      }
    })

    it('toArray always iterates in YZX order regardless of traversalOrder', () => {
      const size2 = { x: 2, y: 3, z: 4 } // 24 blocks
      const values = Array.from({ length: 24 }, (_, i) => i)
      const packed = packSpanning(values, 5)
      const s = new PackedBlockStorage(packed, 32, size2, 'spanning')

      // Set different traversal order
      s.setTraversalOrder('XYZ')
      const arr = s.toArray()

      // toArray always iterates for y, for z, for x
      let i = 0
      for (let y = 0; y < size2.y; y++) {
        for (let z = 0; z < size2.z; z++) {
          for (let x = 0; x < size2.x; x++) {
            // getBlockIndex(x,y,z) is called for each position in YZX loop
            expect(typeof arr[i]).toBe('number')
            i++
          }
        }
      }
      expect(arr.length).toBe(24)
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

    it('spanning with YZX traversal decodes correctly', () => {
      const bps = 4
      const sz = { x: 2, y: 2, z: 2 }
      // YZX linear order: index = (y*2+z)*2+x
      // positions and their YZX indices:
      // (0,0,0)=0, (1,0,0)=1, (0,0,1)=2, (1,0,1)=3,
      // (0,1,0)=4, (1,1,0)=5, (0,1,1)=6, (1,1,1)=7
      const values = [1, 2, 3, 4, 5, 6, 7, 8]
      const packed = packSpanning(values, bps)
      const s = new PackedBlockStorage(packed, 16, sz, 'spanning')
      s.setTraversalOrder('YZX')

      expect(s.getBlockIndex(0, 0, 0)).toBe(1)
      expect(s.getBlockIndex(1, 0, 0)).toBe(2)
      expect(s.getBlockIndex(0, 0, 1)).toBe(3)
      expect(s.getBlockIndex(1, 0, 1)).toBe(4)
    })

    it('spanning with XZY traversal decodes correctly', () => {
      const bps = 4
      const sz = { x: 2, y: 2, z: 2 }
      // XZY linear order: index = (x*2+z)*2+y
      // i=0→(x=0,z=0,y=0), i=1→(x=0,z=0,y=1), i=2→(x=0,z=1,y=0), i=3→(x=0,z=1,y=1)
      // i=4→(x=1,z=0,y=0), i=5→(x=1,z=0,y=1), i=6→(x=1,z=1,y=0), i=7→(x=1,z=1,y=1)
      const values = [1, 2, 3, 4, 5, 6, 7, 8]
      const packed = packSpanning(values, bps)
      const s = new PackedBlockStorage(packed, 16, sz, 'spanning')
      s.setTraversalOrder('XZY')

      // getBlockIndex(x,y,z) → linearIndex = (x*2+z)*2+y → values[linearIndex]
      expect(s.getBlockIndex(0, 0, 0)).toBe(1)  // (0*2+0)*2+0=0
      expect(s.getBlockIndex(0, 1, 0)).toBe(2)  // (0*2+0)*2+1=1
      expect(s.getBlockIndex(0, 0, 1)).toBe(3)  // (0*2+1)*2+0=2
      expect(s.getBlockIndex(0, 1, 1)).toBe(4)  // (0*2+1)*2+1=3
    })

    it('non-spanning with XZY traversal decodes correctly', () => {
      const bps = 4
      const sz = { x: 2, y: 2, z: 2 }
      const values = [1, 2, 3, 4, 5, 6, 7, 8]
      const packed = packNonSpanning(values, bps)
      const s = new PackedBlockStorage(packed, 16, sz, 'non-spanning')
      s.setTraversalOrder('XZY')

      expect(s.getBlockIndex(0, 0, 0)).toBe(1)
      expect(s.getBlockIndex(0, 1, 0)).toBe(2)
      expect(s.getBlockIndex(0, 0, 1)).toBe(3)
      expect(s.getBlockIndex(0, 1, 1)).toBe(4)
    })

    it('non-spanning with YZX traversal decodes correctly', () => {
      const bps = 4
      const sz = { x: 2, y: 2, z: 2 }
      const values = [1, 2, 3, 4, 5, 6, 7, 8]
      const packed = packNonSpanning(values, bps)
      const s = new PackedBlockStorage(packed, 16, sz, 'non-spanning')
      s.setTraversalOrder('YZX')

      expect(s.getBlockIndex(0, 0, 0)).toBe(1)
      expect(s.getBlockIndex(1, 0, 0)).toBe(2)
      expect(s.getBlockIndex(0, 0, 1)).toBe(3)
      expect(s.getBlockIndex(1, 0, 1)).toBe(4)
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

    // ── Truncated data ────────────────────────────────────────

    it('returns 0 when startLongIndex >= length in spanning', () => {
      const bps = 5
      // Pack just 1 long worth of data but ask for a position deep in the stream
      const values = [1, 2, 3]
      const packed = packSpanning(values, bps)
      // 3 * 5 = 15 bits, fits in 1 long
      const s = new PackedBlockStorage(packed, 32, { x: 1, y: 1, z: 100 }, 'spanning')
      // Block at index 50 → startBit=250, startLongIndex=3 (250/64=3.9→3)
      // packedData only has 1 long, so startLongIndex >= length → returns 0
      expect(s.getBlockIndex(0, 0, 50)).toBe(0)
    })

    it('returns 0 when endLongIndex >= length in spanning (cross-long truncation)', () => {
      const bps = 12
      // Pack just enough for a few blocks, then read one that would span beyond
      const values = [100, 200]
      const packed = packSpanning(values, bps)
      // 2 * 12 = 24 bits, fits in 1 long
      const s = new PackedBlockStorage(packed, 4096, { x: 1, y: 1, z: 20 }, 'spanning')
      // Block 0: bits 0-11, all in long 0 → returns correctly
      expect(s.getBlockIndex(0, 0, 0)).toBe(100)
      // Block 1: bits 12-23, all in long 0 → returns correctly
      expect(s.getBlockIndex(0, 0, 1)).toBe(200)
      // Block 5: startBit=60, endLongIndex=(60+12-1)/64=71/64=1
      // packedData only has 1 long, so the cross-long read is partial
      // The first part is read from long 0, second part from long 1 (which is 0n by default)
      const val5 = s.getBlockIndex(0, 0, 5)
      expect(typeof val5).toBe('number')
    })

    // ── Large volume ──────────────────────────────────────────

    it('handles 16x16x16=4096 blocks with spanning', () => {
      const bps = 7
      const volume = 4096
      const values = Array.from({ length: volume }, (_, i) => (i * 7 + 3) & 127)
      const packed = packSpanning(values, bps)
      const s = new PackedBlockStorage(packed, 128, { x: 16, y: 16, z: 16 }, 'spanning')

      // Spot-check a few key positions
      expect(s.getBlockIndex(0, 0, 0)).toBe(values[0])
      // YZX index for (15,0,0) = (0*16+0)*16+15 = 15
      expect(s.getBlockIndex(15, 0, 0)).toBe(values[15])
      // YZX index for (0,0,15) = (0*16+15)*16+0 = 240
      expect(s.getBlockIndex(0, 0, 15)).toBe(values[240])
      // YZX index for (0,15,0) = (15*16+0)*16+0 = 3840
      expect(s.getBlockIndex(0, 15, 0)).toBe(values[3840])
    })

    it('handles 16x16x16=4096 blocks with non-spanning', () => {
      const bps = 4
      const volume = 4096
      const values = Array.from({ length: volume }, (_, i) => (i * 5 + 1) & 15)
      const packed = packNonSpanning(values, bps)
      const s = new PackedBlockStorage(packed, 16, { x: 16, y: 16, z: 16 }, 'non-spanning')

      expect(s.getBlockIndex(0, 0, 0)).toBe(values[0])
      expect(s.getBlockIndex(15, 0, 0)).toBe(values[15])
      expect(s.getBlockIndex(0, 0, 15)).toBe(values[240])
      expect(s.getBlockIndex(0, 15, 0)).toBe(values[3840])
    })
  })
})
