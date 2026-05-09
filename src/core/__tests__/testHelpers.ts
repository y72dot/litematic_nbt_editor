/**
 * Test helpers for constructing mock NBT data in the prismarine-nbt parsed format.
 *
 * In prismarine-nbt's parsed format:
 *   - Compound tag: { type: 'compound', value: { key: childTag, ... } }
 *   - List tag:      { type: 'list', value: { type: elemType, value: [...] } }
 *     - .value       → the list-value object { type, value: [...] }
 *     - .value.value → the raw element array
 *   - String tag:    { type: 'string', value: '...' }
 *   - Int tag:       { type: 'int', value: N }
 *   - Long tag:      { type: 'long', value: BigInt(N) | [hi, lo] }
 *   - LongArray tag: { type: 'longArray', value: BigInt64Array }
 *
 * Nested lists: elements of an inner list are stored as list-VALUE objects
 * (NOT full list tags), so inner[0].value gives the raw array directly.
 */

function cc(value: Record<string, unknown>): Record<string, unknown> {
  // prismarine-nbt compound tags expose children directly on the tag object
  // as well as on .value, so spread value properties onto the tag
  return { type: 'compound', value, ...value }
}

function listStr(values: string[]): { type: 'list'; value: { type: 'string'; value: unknown[] } } {
  return {
    type: 'list',
    value: { type: 'string', value: values.map(v => str(v)) },
  }
}

function str(value: string): { type: 'string'; value: string } {
  return { type: 'string', value }
}

function int(value: number): { type: 'int'; value: number } {
  return { type: 'int', value }
}

function long(value: bigint): { type: 'long'; value: bigint } {
  return { type: 'long', value }
}

function longArr(value: BigInt64Array): { type: 'longArray'; value: BigInt64Array } {
  return { type: 'longArray', value }
}

function paletteEntry(name: string, properties?: Record<string, string>): Record<string, unknown> {
  const entry: Record<string, unknown> = { Name: str(name) }
  if (properties && Object.keys(properties).length > 0) {
    const props: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(properties)) {
      props[k] = str(v)
    }
    entry.Properties = cc(props)
  }
  return entry
}

/**
 * Build a mock Region NBT compound (the value inside a region compound tag).
 * This is what Region constructor receives as rawRegionData.
 */
export function makeMockRegionNbt(overrides: {
  size?: { x: number; y: number; z: number }
  position?: { x: number; y: number; z: number }
  palette?: string[]
  paletteWithProps?: { Name: string; Properties?: Record<string, string> }[]
  blockStates?: BigInt64Array | number[]
} = {}): Record<string, unknown> {
  const size = overrides.size ?? { x: 2, y: 2, z: 2 }
  const position = overrides.position ?? { x: 0, y: 0, z: 0 }
  const paletteNames = overrides.palette ?? ['minecraft:air', 'minecraft:stone']
  const paletteWithProps = overrides.paletteWithProps

  const paletteEntries = paletteWithProps
    ? paletteWithProps.map(p => paletteEntry(p.Name, p.Properties))
    : paletteNames.map(n => paletteEntry(n))

  const volume = size.x * size.y * size.z
  const blockStates = overrides.blockStates ?? new BigInt64Array(Math.ceil((volume * 2) / 64))

  return {
    Size: cc({ x: int(size.x), y: int(size.y), z: int(size.z) }),
    Position: cc({ x: int(position.x), y: int(position.y), z: int(position.z) }),
    BlockStatePalette: {
      type: 'list',
      value: { type: 'compound', value: paletteEntries },
    },
    BlockStates: longArr(blockStates),
  }
}

/**
 * Build a mock litematic root NBT compound value (nbtData.value).
 */
export function makeMockLitematicNbt(overrides: {
  version?: number
  metadata?: {
    name?: string
    author?: string
    description?: string
    timeCreated?: bigint
    timeModified?: bigint
    enclosingSize?: { x: number; y: number; z: number }
  }
  regions?: Record<string, Record<string, unknown>>
} = {}): Record<string, unknown> {
  const version = overrides.version ?? 6
  const meta = overrides.metadata ?? {}
  const regions = overrides.regions ?? {
    Main: makeMockRegionNbt({ size: { x: 2, y: 2, z: 2 } }),
  }

  const metaCompound: Record<string, unknown> = {}
  if (meta.name !== undefined) metaCompound.Name = str(meta.name)
  if (meta.author !== undefined) metaCompound.Author = str(meta.author)
  if (meta.description !== undefined) metaCompound.Description = str(meta.description)
  if (meta.timeCreated !== undefined) metaCompound.TimeCreated = long(meta.timeCreated)
  if (meta.timeModified !== undefined) metaCompound.TimeModified = long(meta.timeModified)
  if (meta.enclosingSize !== undefined) {
    metaCompound.EnclosingSize = cc({
      x: int(meta.enclosingSize.x),
      y: int(meta.enclosingSize.y),
      z: int(meta.enclosingSize.z),
    })
  }

  const regionsCompound: Record<string, unknown> = {}
  for (const [name, regionData] of Object.entries(regions)) {
    regionsCompound[name] = cc(regionData)
  }

  return {
    Version: int(version),
    Metadata: cc(metaCompound),
    Regions: cc(regionsCompound),
  }
}

/**
 * Build a mock Structure root NBT compound value (nbtData.value).
 * Uses either 'palette' or 'palettes', and 'blocks' as a list of compounds.
 */
export function makeMockStructureNbt(overrides: {
  size?: { x: number; y: number; z: number }
  palette?: { Name: string; Properties?: Record<string, string> }[]
  palettes?: { Name: string; Properties?: Record<string, string> }[][]
  blocks?: { x: number; y: number; z: number; state: number }[]
} = {}): Record<string, unknown> {
  const sizeVal = overrides.size ?? { x: 2, y: 2, z: 2 }

  const root: Record<string, unknown> = {}

  // Size: list of 3 ints
  root.size = {
    type: 'list',
    value: { type: 'int', value: [int(sizeVal.x), int(sizeVal.y), int(sizeVal.z)] },
  }

  // Palette: list of compounds
  if (overrides.palette) {
    root.palette = {
      type: 'list',
      value: { type: 'compound', value: overrides.palette.map(p => paletteEntry(p.Name, p.Properties)) },
    }
  }

  // Palettes: list of lists of compounds
  // Inner elements are list-VALUE objects (not full list tags):
  //   palettes[0].value gives the raw palette entry array
  if (overrides.palettes) {
    root.palettes = {
      type: 'list',
      value: {
        type: 'list',
        value: overrides.palettes.map(palette => ({
          type: 'compound',
          value: palette.map(p => paletteEntry(p.Name, p.Properties)),
        })),
      },
    }
  }

  // Blocks: list of compounds with pos (list of 3 ints) and state
  if (overrides.blocks) {
    root.blocks = {
      type: 'list',
      value: {
        type: 'compound',
        value: overrides.blocks.map(b =>
          cc({
            pos: {
              type: 'list',
              value: { type: 'int', value: [int(b.x), int(b.y), int(b.z)] },
            },
            state: int(b.state),
          })
        ),
      },
    }
  }

  return root
}

/**
 * Construct an isBlockSolid closure for Raycaster tests.
 * Takes a set of coordinates that are considered "solid".
 */
export function solidAt(solidCoords: Array<[number, number, number]>): (x: number, y: number, z: number) => boolean {
  const set = new Set(solidCoords.map(([x, y, z]) => `${x},${y},${z}`))
  return (x: number, y: number, z: number) => set.has(`${x},${y},${z}`)
}
