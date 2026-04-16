import type { FireParams, GridBounds, GridCell, VegetationType } from '../types'

const FLAMMABILITY: Record<VegetationType, number> = {
  forest_conifer: 0.85,
  forest_deciduous: 0.45,
  open: 0.20,
  wetland: 0.00,
  water: 0.00,
  road: 0.05,
  building: 0.60,
}

const BURNOUT_TICKS: Record<VegetationType, number> = {
  forest_conifer: 8,
  forest_deciduous: 12,
  open: 4,
  wetland: 999,
  water: 999,
  road: 999,
  building: 6,
}

const ESCALATION_TICKS = 3 // ticks at intensity before escalating to next level

const NEIGHBORS: Array<{ dr: number; dc: number; angleDeg: number }> = [
  { dr: -1, dc: 0, angleDeg: 0 },
  { dr: -1, dc: 1, angleDeg: 45 },
  { dr: 0, dc: 1, angleDeg: 90 },
  { dr: 1, dc: 1, angleDeg: 135 },
  { dr: 1, dc: 0, angleDeg: 180 },
  { dr: 1, dc: -1, angleDeg: 225 },
  { dr: 0, dc: -1, angleDeg: 270 },
  { dr: -1, dc: -1, angleDeg: 315 },
]

export class FireEngine {
  private grid: GridCell[][]
  private bounds: GridBounds
  private params: FireParams
  private tick = 0

  constructor(grid: GridCell[][], bounds: GridBounds, params: FireParams) {
    this.grid = grid
    this.bounds = bounds
    this.params = params
  }

  updateParams(params: FireParams): void {
    this.params = params
  }

  setGrid(grid: GridCell[][]): void {
    this.grid = grid
  }

  setTick(tick: number): void {
    this.tick = tick
  }

  ignite(row: number, col: number): void {
    const cell = this.grid[row][col]
    if (cell.vegetation === 'water' || cell.vegetation === 'wetland') return
    if (cell.fireIntensity > 0) return
    cell.fireIntensity = 2
    cell.burnedAt = this.tick
    cell.ticksAtIntensity = 0
  }

  step(): GridCell[][] {
    this.tick++
    const { rows, cols } = this.bounds
    const nextIntensities: Array<Array<0 | 1 | 2 | 3 | 4>> = Array.from(
      { length: rows },
      (_, r) => Array.from({ length: cols }, (_, c) => this.grid[r][c].fireIntensity),
    )

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = this.grid[r][c]
        const intensity = cell.fireIntensity

        if (intensity === 0 || intensity === 4) continue

        cell.ticksAtIntensity++

        // Escalate intensity: 1→2→3
        if (intensity < 3 && cell.ticksAtIntensity >= ESCALATION_TICKS) {
          nextIntensities[r][c] = (intensity + 1) as 1 | 2 | 3
          cell.ticksAtIntensity = 0
        }

        // Burn out: intensity 3 → 4 after BURNOUT_TICKS
        if (intensity === 3 && cell.ticksAtIntensity >= BURNOUT_TICKS[cell.vegetation]) {
          nextIntensities[r][c] = 4
          continue
        }

        // Spread to neighbors
        for (const { dr, dc, angleDeg } of NEIGHBORS) {
          const nr = r + dr
          const nc = c + dc
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue
          const neighbor = this.grid[nr][nc]
          if (neighbor.fireIntensity !== 0) continue

          const p = this.spreadProbability(cell, neighbor, angleDeg)
          if (Math.random() < p) {
            nextIntensities[nr][nc] = 1
            if (neighbor.burnedAt === null) {
              neighbor.burnedAt = this.tick
            }
          }
        }
      }
    }

    // Apply next intensities
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const prev = this.grid[r][c].fireIntensity
        const next = nextIntensities[r][c]
        if (prev !== next) {
          this.grid[r][c].fireIntensity = next
          if (prev === 0 && next > 0) {
            this.grid[r][c].ticksAtIntensity = 0
          }
        }
      }
    }

    // Return a new outer-array reference so React detects the change
    return [...this.grid]
  }

  private spreadProbability(source: GridCell, target: GridCell, spreadAngleDeg: number): number {
    const baseFlamm = FLAMMABILITY[target.vegetation]
    if (baseFlamm === 0) return 0

    const windRad = ((this.params.windDirection - spreadAngleDeg) * Math.PI) / 180
    const windFactor = 1 + (this.params.windSpeed / 10) * Math.max(0, Math.cos(windRad))

    const elevDiff = target.elevation - source.elevation
    const slopeFactor =
      elevDiff > 0
        ? 1 + Math.min(elevDiff / 50, 1.0)
        : Math.max(0.4, 1 + elevDiff / 100)

    const drynessFactor = 0.5 + (this.params.dryness / 100) * 0.8

    const energyMult = { low: 0.6, medium: 1.0, high: 1.5 }[this.params.energyLevel]

    const intensityMult = source.fireIntensity === 3 ? 1.2 : source.fireIntensity === 1 ? 0.7 : 1.0

    return Math.min(
      0.95,
      baseFlamm * windFactor * slopeFactor * drynessFactor * energyMult * intensityMult,
    )
  }

  countBurnedCells(): number {
    let count = 0
    for (const row of this.grid) {
      for (const cell of row) {
        if (cell.fireIntensity > 0) count++
      }
    }
    return count
  }
}
