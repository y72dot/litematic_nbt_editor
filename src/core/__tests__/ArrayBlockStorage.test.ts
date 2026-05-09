import { describe, it, expect } from 'vitest'
import { ArrayBlockStorage } from '../ArrayBlockStorage'

describe('ArrayBlockStorage', () => {
  const size = { x: 3, y: 2, z: 4 }
  const volume = 3 * 2 * 4 // 24

  // ─── Construction ─────────────────────────────────────────────

  describe('constructor', () => {
    it('creates with Uint16Array when palette < 65536', () => {
      const storage = new ArrayBlockStorage(size, 100)
      const arr = storage.toArray()
      expect(arr).toBeInstanceOf(Uint16Array)
      expect(arr.length).toBe(volume)
      expect(arr[0]).toBe(0)
    })

    it('creates with Uint32Array when palette >= 65536', () => {
      const storage = new ArrayBlockStorage(size, 65536)
      const arr = storage.toArray()
      expect(arr).toBeInstanceOf(Uint32Array)
      expect(arr.length).toBe(volume)
    })

    it('accepts initial data as number array', () => {
      const data = new Array(volume).fill(0)
      data[0] = 5
      data[volume - 1] = 3
      const storage = new ArrayBlockStorage(size, 100, data)
      expect(storage.getBlockIndex(0, 0, 0)).toBe(5)
      expect(storage.getBlockIndex(2, 1, 3)).toBe(3)
    })

    it('accepts initial data as Uint16Array', () => {
      const data = new Uint16Array(volume)
      data[0] = 7
      const storage = new ArrayBlockStorage(size, 100, data)
      expect(storage.getBlockIndex(0, 0, 0)).toBe(7)
    })
  })

  // ─── getBlockIndex ────────────────────────────────────────────

  describe('getBlockIndex', () => {
    it('returns 0 for out-of-bounds coordinates (negative x)', () => {
      const storage = new ArrayBlockStorage(size, 100)
      expect(storage.getBlockIndex(-1, 0, 0)).toBe(0)
    })

    it('returns 0 for out-of-bounds coordinates (x too large)', () => {
      const storage = new ArrayBlockStorage(size, 100)
      expect(storage.getBlockIndex(3, 0, 0)).toBe(0)
    })

    it('returns 0 for out-of-bounds coordinates (negative y)', () => {
      const storage = new ArrayBlockStorage(size, 100)
      expect(storage.getBlockIndex(0, -1, 0)).toBe(0)
    })

    it('uses YZX index order', () => {
      const data = new Array(volume).fill(0)
      // index = (y * zSize + z) * xSize + x
      // For (1, 0, 0): (0 * 4 + 0) * 3 + 1 = 1
      // For (0, 0, 1): (0 * 4 + 1) * 3 + 0 = 3
      data[1] = 10 // (x=1, y=0, z=0)
      data[3] = 20 // (x=0, y=0, z=1)
      data[13] = 30 // (x=1, y=1, z=0): (1*4 + 0)*3 + 1 = 13
      const storage = new ArrayBlockStorage(size, 100, data)

      expect(storage.getBlockIndex(1, 0, 0)).toBe(10)
      expect(storage.getBlockIndex(0, 0, 1)).toBe(20)
      expect(storage.getBlockIndex(1, 1, 0)).toBe(30)
    })

    it('returns correct value after writing', () => {
      const storage = new ArrayBlockStorage(size, 100)
      expect(storage.getBlockIndex(0, 0, 0)).toBe(0)
      expect(storage.getBlockIndex(2, 1, 3)).toBe(0)
      expect(storage.getBlockIndex(1, 0, 2)).toBe(0)
    })
  })

  // ─── setBlockIndex ────────────────────────────────────────────

  describe('setBlockIndex', () => {
    it('writes and reads back correctly', () => {
      const storage = new ArrayBlockStorage(size, 100)
      storage.setBlockIndex(0, 0, 0, 42)
      storage.setBlockIndex(2, 1, 3, 99)
      expect(storage.getBlockIndex(0, 0, 0)).toBe(42)
      expect(storage.getBlockIndex(2, 1, 3)).toBe(99)
    })

    it('silently ignores out-of-bounds writes', () => {
      const storage = new ArrayBlockStorage(size, 100)
      storage.setBlockIndex(-1, 0, 0, 42)
      storage.setBlockIndex(3, 0, 0, 42)
      // No error thrown; all values remain 0
      for (let y = 0; y < size.y; y++)
        for (let z = 0; z < size.z; z++)
          for (let x = 0; x < size.x; x++)
            expect(storage.getBlockIndex(x, y, z)).toBe(0)
    })

    it('round-trip: set all positions then read all back', () => {
      const storage = new ArrayBlockStorage(size, 100)
      let val = 1
      for (let y = 0; y < size.y; y++)
        for (let z = 0; z < size.z; z++)
          for (let x = 0; x < size.x; x++)
            storage.setBlockIndex(x, y, z, val++)

      val = 1
      for (let y = 0; y < size.y; y++)
        for (let z = 0; z < size.z; z++)
          for (let x = 0; x < size.x; x++) {
            expect(storage.getBlockIndex(x, y, z)).toBe(val)
            val++
          }
    })
  })

  // ─── toArray ──────────────────────────────────────────────────

  describe('toArray', () => {
    it('returns the internal typed array reference', () => {
      const storage = new ArrayBlockStorage(size, 100)
      const arr = storage.toArray()
      expect(arr).toBeInstanceOf(Uint16Array)
      expect(arr.length).toBe(volume)

      // Mutating the returned array should be visible through getBlockIndex
      arr[0] = 77
      expect(storage.getBlockIndex(0, 0, 0)).toBe(77)
    })

    it('returns Uint32Array for large palette sizes', () => {
      const storage = new ArrayBlockStorage({ x: 1, y: 1, z: 1 }, 65536)
      expect(storage.toArray()).toBeInstanceOf(Uint32Array)
    })

    it('preserves data through toArray after bulk writes', () => {
      const storage = new ArrayBlockStorage(size, 256)
      storage.setBlockIndex(0, 0, 0, 255)
      storage.setBlockIndex(1, 0, 0, 128)
      const arr = storage.toArray()
      expect(arr[0]).toBe(255)
      expect(arr[1]).toBe(128)
    })
  })

  // ─── metadata ─────────────────────────────────────────────────

  it('getSize returns correct dimensions', () => {
    const storage = new ArrayBlockStorage({ x: 5, y: 6, z: 7 }, 100)
    expect(storage.getSize()).toEqual({ x: 5, y: 6, z: 7 })
  })

  it('getPaletteSize returns stored value', () => {
    const storage = new ArrayBlockStorage(size, 123)
    expect(storage.getPaletteSize()).toBe(123)
  })
})
