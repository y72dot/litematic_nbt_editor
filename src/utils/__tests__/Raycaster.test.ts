import { describe, it, expect } from 'vitest'
import { vec3 } from 'gl-matrix'
import { Raycaster } from '../Raycaster'
import { solidAt } from '../../core/__tests__/testHelpers'

describe('Raycaster.traceRay', () => {
  // ─── Straight hits ────────────────────────────────────────────

  it('hits a block straight along +x', () => {
    const origin = vec3.fromValues(0.5, 0.5, 0.5)
    const direction = vec3.fromValues(1, 0, 0)
    const isSolid = solidAt([[1, 0, 0]])

    const result = Raycaster.traceRay(origin, direction, 10, isSolid)
    expect(result).not.toBeNull()
    expect(result!.position[0]).toBe(1)
    expect(result!.position[1]).toBe(0)
    expect(result!.position[2]).toBe(0)
    expect(result!.normal[0]).toBe(-1) // entered from -x face
    expect(result!.normal[1]).toBe(0)
    expect(result!.normal[2]).toBe(0)
  })

  it('hits a block straight along +y', () => {
    const origin = vec3.fromValues(0.5, 0.5, 0.5)
    const direction = vec3.fromValues(0, 1, 0)
    const isSolid = solidAt([[0, 1, 0]])

    const result = Raycaster.traceRay(origin, direction, 10, isSolid)
    expect(result).not.toBeNull()
    expect(result!.position[0]).toBe(0)
    expect(result!.position[1]).toBe(1)
    expect(result!.position[2]).toBe(0)
    expect(result!.normal[0]).toBe(0)
    expect(result!.normal[1]).toBe(-1)
    expect(result!.normal[2]).toBe(0)
  })

  it('hits a block straight along +z', () => {
    const origin = vec3.fromValues(0.5, 0.5, 0.5)
    const direction = vec3.fromValues(0, 0, 1)
    const isSolid = solidAt([[0, 0, 1]])

    const result = Raycaster.traceRay(origin, direction, 10, isSolid)
    expect(result).not.toBeNull()
    expect(result!.position[2]).toBe(1)
  })

  it('hits a block straight along -x', () => {
    const origin = vec3.fromValues(1.5, 0.5, 0.5)
    const direction = vec3.fromValues(-1, 0, 0)
    const isSolid = solidAt([[1, 0, 0]])

    const result = Raycaster.traceRay(origin, direction, 10, isSolid)
    expect(result).not.toBeNull()
    expect(result!.position[0]).toBe(1)
    expect(result!.normal[0]).toBe(1) // entered from +x face
  })

  // ─── Diagonal hit ────────────────────────────────────────────

  it('hits a block diagonally', () => {
    const origin = vec3.fromValues(0.5, 0.5, 0.5)
    const direction = vec3.create()
    vec3.normalize(direction, vec3.fromValues(1, 1, 0))
    const isSolid = solidAt([[1, 1, 0]])

    const result = Raycaster.traceRay(origin, direction, 10, isSolid)
    expect(result).not.toBeNull()
    // The ray should hit either (1,0,0) or (0,1,0) or (1,1,0)
    // With equal direction components it depends on tMax ordering
    const pos = result!.position
    expect(pos[2]).toBe(0)
    expect(pos[0] + pos[1]).toBeGreaterThanOrEqual(1) // hit something
  })

  it('hits a distant block diagonally', () => {
    const origin = vec3.fromValues(0.5, 0.5, 0.5)
    const direction = vec3.create()
    vec3.normalize(direction, vec3.fromValues(1, 1, 1))
    const isSolid = solidAt([[2, 2, 2]])

    const result = Raycaster.traceRay(origin, direction, 10, isSolid)
    expect(result).not.toBeNull()
    expect(result!.position[0]).toBe(2)
    expect(result!.position[1]).toBe(2)
    expect(result!.position[2]).toBe(2)
  })

  // ─── Miss ─────────────────────────────────────────────────────

  it('returns null when no block is hit', () => {
    const origin = vec3.fromValues(0.5, 0.5, 0.5)
    const direction = vec3.fromValues(1, 0, 0)
    const isSolid = solidAt([])

    const result = Raycaster.traceRay(origin, direction, 10, isSolid)
    expect(result).toBeNull()
  })

  // ─── Start inside solid ───────────────────────────────────────

  it('returns immediate hit when starting inside a solid block (dist=0)', () => {
    const origin = vec3.fromValues(1.0, 1.0, 1.0)
    const direction = vec3.fromValues(1, 0, 0)
    const isSolid = solidAt([[1, 1, 1]])

    const result = Raycaster.traceRay(origin, direction, 10, isSolid)
    expect(result).not.toBeNull()
    expect(result!.dist).toBe(0)
    expect(result!.position[0]).toBe(1)
    expect(result!.position[1]).toBe(1)
    expect(result!.position[2]).toBe(1)
  })

  // ─── maxDistance cutoff ───────────────────────────────────────

  it('returns null when block is beyond maxDistance', () => {
    const origin = vec3.fromValues(0.5, 0.5, 0.5)
    const direction = vec3.fromValues(1, 0, 0)
    const isSolid = solidAt([[5, 0, 0]])

    const result = Raycaster.traceRay(origin, direction, 1, isSolid)
    expect(result).toBeNull()
  })

  it('hits block within maxDistance', () => {
    const origin = vec3.fromValues(0.5, 0.5, 0.5)
    const direction = vec3.fromValues(1, 0, 0)
    const isSolid = solidAt([[1, 0, 0]])

    const result = Raycaster.traceRay(origin, direction, 5, isSolid)
    expect(result).not.toBeNull()
    expect(result!.position[0]).toBe(1)
  })

  // ─── Negative direction ───────────────────────────────────────

  it('traces correctly in negative y direction', () => {
    const origin = vec3.fromValues(0.5, 1.5, 0.5)
    const direction = vec3.fromValues(0, -1, 0)
    const isSolid = solidAt([[0, 0, 0]])

    const result = Raycaster.traceRay(origin, direction, 10, isSolid)
    expect(result).not.toBeNull()
    expect(result!.position[0]).toBe(0)
    expect(result!.position[1]).toBe(0)
    expect(result!.position[2]).toBe(0)
  })

  it('traces correctly in negative z direction', () => {
    const origin = vec3.fromValues(0.5, 0.5, 1.5)
    const direction = vec3.fromValues(0, 0, -1)
    const isSolid = solidAt([[0, 0, 0]])

    const result = Raycaster.traceRay(origin, direction, 10, isSolid)
    expect(result).not.toBeNull()
    expect(result!.position[0]).toBe(0)
    expect(result!.position[2]).toBe(0)
  })

  // ─── Multiple blocks ──────────────────────────────────────────

  it('hits the first block along the ray, not a farther one', () => {
    const origin = vec3.fromValues(0.5, 0.5, 0.5)
    const direction = vec3.fromValues(1, 0, 0)
    const isSolid = solidAt([[1, 0, 0], [2, 0, 0]])

    const result = Raycaster.traceRay(origin, direction, 10, isSolid)
    expect(result).not.toBeNull()
    expect(result!.position[0]).toBe(1) // first block
  })
})
