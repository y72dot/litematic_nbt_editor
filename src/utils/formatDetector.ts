export interface FormatResult {
  format: 'litematic' | 'structure'
  version?: number
  preferredFormat?: 'spanning' | 'non-spanning'
}

/**
 * Detects whether the given parsed NBT data represents a Litematic or Structure file.
 *
 * Litematic positive (at least one):
 *   1. Root has `Regions` compound, and at least one region contains
 *      `BlockStatePalette` + `BlockStates`.
 *   2. Root has `Version` (int) AND `Metadata` compound containing `EnclosingSize`.
 *
 * Litematic negative: root has `blocks` list → excludes Litematic.
 *
 * Structure positive (all required):
 *   - `blocks` list
 *   - `palette` or `palettes` list
 *   - `size` list
 *
 * When neither format can be positively identified, the file extension is used
 * as a tiebreaker. If that also fails, an Error is thrown with the actual
 * top-level fields found in the NBT.
 */
export function detectSchematicFormat(
  nbtData: any,
  fileName?: string
): FormatResult {
  const root = nbtData?.value ?? {}

  // Top-level field presence
  const hasVersion = root.Version?.type === 'int'
  const hasMetadata = root.Metadata?.type === 'compound'
  const hasRegions = root.Regions?.type === 'compound'
  const hasBlocks = root.blocks?.type === 'list'
  const hasPalette = root.palette?.type === 'list'
  const hasPalettes = root.palettes?.type === 'list'
  const hasSize = root.size?.type === 'list'

  // Litematic: at least one region with BlockStatePalette + BlockStates
  let hasValidRegion = false
  if (hasRegions) {
    const regionsValue = root.Regions.value ?? {}
    for (const key of Object.keys(regionsValue)) {
      const region = regionsValue[key]
      if (region?.type === 'compound' && region.BlockStatePalette && region.BlockStates) {
        hasValidRegion = true
        break
      }
    }
  }

  // Litematic: Metadata contains EnclosingSize compound
  const hasEnclosingSize =
    hasMetadata && root.Metadata.EnclosingSize?.type === 'compound'

  const isLitematic = hasValidRegion || (hasVersion && hasMetadata && hasEnclosingSize)
  const isStructure = hasBlocks && (hasPalette || hasPalettes) && hasSize

  let format: 'litematic' | 'structure'

  if (isLitematic && !hasBlocks) {
    format = 'litematic'
  } else if (isStructure) {
    format = 'structure'
  } else {
    const extGuess = resolveByExtension(fileName)
    if (extGuess) {
      format = extGuess
    } else {
      const topFields = Object.keys(root)
      throw new Error(
        `无法识别文件格式。根 NBT 包含字段: [${topFields.join(', ')}]。` +
          `期望 Litematic (Regions/Metadata/Version) 或 Structure (blocks/palette/size) 格式。`
      )
    }
  }

  // Version determination (Litematic only)
  let version: number | undefined
  let preferredFormat: 'spanning' | 'non-spanning' | undefined

  if (format === 'litematic' && hasVersion) {
    version = root.Version.value as number
    preferredFormat = version < 6 ? 'spanning' : 'non-spanning'
  }

  return { format, version, preferredFormat }
}

function resolveByExtension(fileName?: string): 'litematic' | 'structure' | null {
  if (!fileName) return null
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.litematic')) return 'litematic'
  if (lower.endsWith('.nbt')) return 'structure'
  return null
}
