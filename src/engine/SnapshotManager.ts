import type { FireParams, GridBounds, GridCell, Resource, SimSnapshot } from '../types'

const MAX_SNAPSHOTS = 300

export class SnapshotManager {
  private snapshots: SimSnapshot[] = []

  take(
    tick: number,
    grid: GridCell[][],
    bounds: GridBounds,
    resources: Resource[],
    fireParams: FireParams,
    isBranch = false,
  ): SimSnapshot {
    const rows = bounds.rows
    const cols = bounds.cols
    const total = rows * cols
    const intensities = new Uint8Array(total)
    const burnedAt: (number | null)[] = new Array(total).fill(null)

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c
        intensities[i] = grid[r][c].fireIntensity
        burnedAt[i] = grid[r][c].burnedAt
      }
    }

    const snap: SimSnapshot = {
      tick,
      simTimeMs: tick * 10_000,
      intensities,
      burnedAt,
      resources: structuredClone(resources),
      fireParams: { ...fireParams },
      isBranch,
    }

    if (this.snapshots.length >= MAX_SNAPSHOTS) {
      const nonBranchIdx = this.snapshots.findIndex((s) => !s.isBranch)
      if (nonBranchIdx !== -1) {
        this.snapshots.splice(nonBranchIdx, 1)
      } else {
        this.snapshots.shift()
      }
    }

    this.snapshots.push(snap)
    return snap
  }

  branch(index: number): SimSnapshot[] {
    if (index >= 0 && index < this.snapshots.length) {
      this.snapshots[index].isBranch = true
      this.snapshots = this.snapshots.slice(0, index + 1)
    }
    return this.snapshots
  }

  restoreGrid(snapshot: SimSnapshot, grid: GridCell[][], bounds: GridBounds): void {
    const { rows, cols } = bounds
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c
        grid[r][c].fireIntensity = snapshot.intensities[i] as 0 | 1 | 2 | 3 | 4
        grid[r][c].burnedAt = snapshot.burnedAt[i]
        grid[r][c].ticksAtIntensity = 0
        grid[r][c].suppressedAt = null
      }
    }
  }

  getAt(index: number): SimSnapshot | null {
    return this.snapshots[index] ?? null
  }

  getAll(): SimSnapshot[] {
    return this.snapshots
  }

  getBranchIndices(): number[] {
    return this.snapshots.map((s, i) => (s.isBranch ? i : -1)).filter((i) => i !== -1)
  }

  clear(): void {
    this.snapshots = []
  }
}
