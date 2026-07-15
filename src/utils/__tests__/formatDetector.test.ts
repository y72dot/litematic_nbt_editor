import { describe, it, expect } from 'vitest'
import { detectSchematicFormat } from '../formatDetector'
import {
  makeMockLitematicNbt,
  makeMockStructureNbt,
} from '../../core/__tests__/testHelpers'

function wrap(value: Record<string, unknown>): Record<string, unknown> {
  return { type: 'compound', value: { ...value }, ...value }
}

// ─── Litematic ─────────────────────────────────────────────────────

describe('detectSchematicFormat - Litematic', () => {
  it('detects standard V6 Litematic with valid region', () => {
    const nbt = wrap(makeMockLitematicNbt({
      version: 6,
      metadata: { enclosingSize: { x: 10, y: 10, z: 10 } },
    }))
    const result = detectSchematicFormat(nbt)
    expect(result.format).toBe('litematic')
    expect(result.version).toBe(6)
    expect(result.preferredFormat).toBe('non-spanning')
  })

  it('detects V5 Litematic with spanning preference', () => {
    const nbt = wrap(makeMockLitematicNbt({
      version: 5,
      metadata: { enclosingSize: { x: 10, y: 10, z: 10 } },
    }))
    const result = detectSchematicFormat(nbt)
    expect(result.format).toBe('litematic')
    expect(result.version).toBe(5)
    expect(result.preferredFormat).toBe('spanning')
  })

  it('detects multi-region Litematic', () => {
    const nbt = wrap(makeMockLitematicNbt({
      version: 6,
      regions: {
        Main: {
          Size: { x: 2, y: 2, z: 2 },
          Position: { x: 0, y: 0, z: 0 },
          BlockStatePalette: {
            type: 'list',
            value: { type: 'compound', value: [{ Name: { type: 'string', value: 'minecraft:stone' } }] },
          },
          BlockStates: { type: 'longArray', value: new BigInt64Array(1) },
        },
        Extra: {
          Size: { x: 2, y: 2, z: 2 },
          Position: { x: 10, y: 0, z: 10 },
          BlockStatePalette: {
            type: 'list',
            value: { type: 'compound', value: [{ Name: { type: 'string', value: 'minecraft:air' } }] },
          },
          BlockStates: { type: 'longArray', value: new BigInt64Array(1) },
        },
      },
    }))
    const result = detectSchematicFormat(nbt)
    expect(result.format).toBe('litematic')
  })

  it('detects Litematic with empty Regions but valid Metadata', () => {
    const nbt = wrap(makeMockLitematicNbt({
      version: 6,
      metadata: { enclosingSize: { x: 5, y: 5, z: 5 } },
      regions: {},
    }))
    const result = detectSchematicFormat(nbt)
    expect(result.format).toBe('litematic')
  })
})

// ─── Structure ──────────────────────────────────────────────────────

describe('detectSchematicFormat - Structure', () => {
  it('detects Structure with palette field', () => {
    const nbt = wrap(makeMockStructureNbt({
      size: { x: 3, y: 3, z: 3 },
      palette: [{ Name: 'minecraft:stone' }],
      blocks: [{ x: 0, y: 0, z: 0, state: 0 }],
    }))
    const result = detectSchematicFormat(nbt)
    expect(result.format).toBe('structure')
    expect(result.version).toBeUndefined()
    expect(result.preferredFormat).toBeUndefined()
  })

  it('detects Structure with palettes field', () => {
    const nbt = wrap(makeMockStructureNbt({
      size: { x: 3, y: 3, z: 3 },
      palettes: [[{ Name: 'minecraft:stone' }]],
      blocks: [{ x: 0, y: 0, z: 0, state: 0 }],
    }))
    const result = detectSchematicFormat(nbt)
    expect(result.format).toBe('structure')
  })
})

// ─── Extension tiebreaker ───────────────────────────────────────────

describe('detectSchematicFormat - extension tiebreaker', () => {
  it('uses .litematic extension for ambiguous data', () => {
    // Only Version field — not enough for positive Litematic
    const nbt = wrap({
      Version: { type: 'int', value: 6 },
    })
    const result = detectSchematicFormat(nbt, 'my_build.litematic')
    expect(result.format).toBe('litematic')
  })

  it('uses .nbt extension for ambiguous data', () => {
    // Only blocks field — not enough for positive Structure
    const nbt = wrap(makeMockStructureNbt({
      blocks: [{ x: 0, y: 0, z: 0, state: 0 }],
      // deliberately omit palette and size
    }))
    const result = detectSchematicFormat(nbt, 'my_build.nbt')
    expect(result.format).toBe('structure')
  })
})

// ─── Error cases ────────────────────────────────────────────────────

describe('detectSchematicFormat - error cases', () => {
  it('throws Error for unknown format with no extension', () => {
    const nbt = wrap({
      UnknownField: { type: 'string', value: 'hello' },
    })
    expect(() => detectSchematicFormat(nbt)).toThrow('无法识别文件格式')
  })

  it('throws Error for empty NBT root', () => {
    const nbt = { type: 'compound', value: {} }
    expect(() => detectSchematicFormat(nbt)).toThrow('无法识别文件格式')
  })

  it('error message includes actual top-level fields', () => {
    const nbt = wrap({
      Foo: { type: 'int', value: 1 },
      Bar: { type: 'string', value: 'x' },
    })
    expect(() => detectSchematicFormat(nbt)).toThrow('Foo, Bar')
  })
})
