import type { EditCommand } from './EditCommand'
import type { Schematic } from '../Schematic'

interface FillEntry {
  x: number
  y: number
  z: number
  oldName: string
}

const DEFAULT_MAX_BLOCKS = 50_000

/**
 * BFS flood-fill command: replaces all connected blocks of the same type
 * starting from a given position. Uses a pointer-based queue to avoid O(n)
 * shift overhead. Capped at maxBlocks to prevent accidental mega-fills.
 */
export class FillCommand implements EditCommand {
  private schematic: Schematic
  private startX: number
  private startY: number
  private startZ: number
  private newName: string
  private maxBlocks: number
  private selection?: Set<string>

  /** Set during execute(), used by undo() */
  private filled: FillEntry[] = []
  private sourceName: string = ''

  constructor(
    schematic: Schematic,
    x: number,
    y: number,
    z: number,
    newName: string,
    maxBlocks: number = DEFAULT_MAX_BLOCKS,
    selection?: Set<string>,
  ) {
    this.schematic = schematic
    this.startX = x
    this.startY = y
    this.startZ = z
    this.newName = newName
    this.maxBlocks = maxBlocks
    this.selection = selection
  }

  execute(): void {
    const sourceBlock = this.schematic.getBlock(this.startX, this.startY, this.startZ)
    this.sourceName = sourceBlock?.Name ?? 'minecraft:air'

    // No-op: source already equals target
    if (this.sourceName === this.newName) {
      this.filled = []
      return
    }

    // Pointer-based BFS queue (array + head, avoids O(n) shift)
    const queue: Array<{ x: number; y: number; z: number }> = [
      { x: this.startX, y: this.startY, z: this.startZ },
    ]
    let head = 0
    const visited = new Set<string>()
    visited.add(`${this.startX},${this.startY},${this.startZ}`)

    const filled: FillEntry[] = []

    // Collect all region bounds for out-of-bounds fast-reject
    const regionBounds = this.schematic.regions.map(r => ({
      minX: r.position.x,
      minY: r.position.y,
      minZ: r.position.z,
      maxX: r.position.x + r.size.x - 1,
      maxY: r.position.y + r.size.y - 1,
      maxZ: r.position.z + r.size.z - 1,
    }))

    while (head < queue.length) {
      if (filled.length >= this.maxBlocks) {
        throw new Error(
          `Fill exceeded max block limit (${this.maxBlocks}). ` +
          `Use a smaller target area or increase the limit.`,
        )
      }

      const { x, y, z } = queue[head++]

      // Only collect blocks matching the source type
      const block = this.schematic.getBlock(x, y, z)
      const name = block?.Name ?? 'minecraft:air'
      if (name === this.sourceName) {
        filled.push({ x, y, z, oldName: name })

        // Enqueue 6 neighbors
        for (const [dx, dy, dz] of [
          [1, 0, 0], [-1, 0, 0],
          [0, 1, 0], [0, -1, 0],
          [0, 0, 1], [0, 0, -1],
        ]) {
          const nx = x + dx
          const ny = y + dy
          const nz = z + dz
          const key = `${nx},${ny},${nz}`

          if (visited.has(key)) continue

          // Fast out-of-bounds check against all regions
          let inBounds = false
          for (const b of regionBounds) {
            if (nx >= b.minX && nx <= b.maxX && ny >= b.minY && ny <= b.maxY && nz >= b.minZ && nz <= b.maxZ) {
              inBounds = true
              break
            }
          }
          if (!inBounds) continue

          // Selection constraint: only enqueue blocks within selection
          if (this.selection && this.selection.size > 0 && !this.selection.has(key)) continue

          visited.add(key)
          queue.push({ x: nx, y: ny, z: nz })
        }
      }
    }

    this.filled = filled

    // Apply all changes
    for (const entry of this.filled) {
      this.schematic.setBlock(entry.x, entry.y, entry.z, this.newName)
    }
  }

  undo(): void {
    for (const entry of this.filled) {
      this.schematic.setBlock(entry.x, entry.y, entry.z, entry.oldName)
    }
  }

  getLabel(): string {
    const count = this.filled.length
    return `Fill ${count} block${count !== 1 ? 's' : ''} from (${this.startX}, ${this.startY}, ${this.startZ}): ${this.sourceName || '?'} → ${this.newName}`
  }
}
