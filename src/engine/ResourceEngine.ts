import type { GridBounds, GridCell, Resource } from '../types'
import { latLonToGridCell } from './GridBuilder'

export class ResourceEngine {
  private grid: GridCell[][]
  private bounds: GridBounds

  constructor(grid: GridCell[][], bounds: GridBounds) {
    this.grid = grid
    this.bounds = bounds
  }

  setGrid(grid: GridCell[][]): void {
    this.grid = grid
  }

  step(resources: Resource[]): Resource[] {
    return resources.map((r) => {
      switch (r.type) {
        case 'crew':
          return this.stepCrew({ ...r })
        case 'helicopter':
          return this.stepHelicopter({ ...r })
        case 'truck':
          return this.stepTruck({ ...r })
      }
    })
  }

  private stepCrew(r: Resource): Resource {
    if (r.targetLat === null || r.targetLon === null) return r

    const { newLat, newLon, arrived } = this.moveToward(r, 0.5)
    r.lat = newLat
    r.lon = newLon
    r.status = 'moving'

    if (arrived) {
      const cell = this.getCell(r.lat, r.lon)
      if (cell && cell.fireIntensity > 0 && cell.fireIntensity < 4) {
        this.suppress(cell, r.suppressionCapacity ?? 1)
        r.status = 'suppressing'
        r.endurance = Math.max(0, (r.endurance ?? 100) - 1)
        if ((r.endurance ?? 0) <= 0) {
          r.status = 'idle'
          r.targetLat = null
          r.targetLon = null
        }
      } else {
        r.status = 'idle'
      }
    }

    return r
  }

  private stepHelicopter(r: Resource): Resource {
    const tankLevel = r.tankLevel ?? 0
    const tankCapacity = r.tankCapacity ?? 1000

    if (tankLevel <= 0 && r.status !== 'refilling') {
      const waterCell = this.findNearestWater(r.lat, r.lon)
      if (waterCell) {
        r.targetLat = waterCell.lat
        r.targetLon = waterCell.lon
        r.status = 'refilling'
      }
      return r
    }

    if (r.status === 'refilling') {
      const { newLat, newLon, arrived } = this.moveToward(r, r.flySpeed ?? 2)
      r.lat = newLat
      r.lon = newLon
      if (arrived) {
        r.tankLevel = tankCapacity
        r.status = 'idle'
        r.targetLat = null
        r.targetLon = null
      }
      return r
    }

    if (r.targetLat === null || r.targetLon === null) return r

    const { newLat, newLon, arrived } = this.moveToward(r, r.flySpeed ?? 2)
    r.lat = newLat
    r.lon = newLon
    r.status = 'moving'

    if (arrived) {
      const cell = this.getCell(r.lat, r.lon)
      if (cell && cell.fireIntensity > 0 && cell.fireIntensity < 4 && tankLevel > 0) {
        const drop = Math.min(tankLevel, 200)
        r.tankLevel = tankLevel - drop
        this.suppress(cell, Math.max(1, Math.ceil(drop / 100)))
        r.status = r.tankLevel > 0 ? 'suppressing' : 'empty'
      } else {
        r.status = 'idle'
      }
    }

    return r
  }

  private stepTruck(r: Resource): Resource {
    if (r.targetLat === null || r.targetLon === null) return r

    const { newLat, newLon, arrived } = this.moveToward(r, r.truckSpeed ?? 1)
    r.lat = newLat
    r.lon = newLon
    r.status = 'moving'

    if (arrived) {
      const cell = this.getCell(r.lat, r.lon)
      const truckLevel = r.truckLevel ?? r.truckCapacity ?? 5000
      if (cell && cell.fireIntensity > 0 && cell.fireIntensity < 4 && truckLevel > 0) {
        const drop = Math.min(truckLevel, 500)
        r.truckLevel = truckLevel - drop
        this.suppress(cell, Math.max(1, Math.ceil(drop / 200)))
        r.status = (r.truckLevel ?? 0) > 0 ? 'suppressing' : 'empty'
      } else {
        r.status = 'idle'
      }
    }

    return r
  }

  private moveToward(
    r: Resource,
    speedCells: number,
  ): { newLat: number; newLon: number; arrived: boolean } {
    if (r.targetLat === null || r.targetLon === null) {
      return { newLat: r.lat, newLon: r.lon, arrived: true }
    }

    const dLat = r.targetLat - r.lat
    const dLon = r.targetLon - r.lon
    const dist = Math.sqrt(dLat * dLat + dLon * dLon)
    const cellSizeDeg = this.bounds.cellSizeMeters / 111320
    const stepDeg = speedCells * cellSizeDeg

    if (dist <= stepDeg) {
      return { newLat: r.targetLat, newLon: r.targetLon, arrived: true }
    }

    const ratio = stepDeg / dist
    return {
      newLat: r.lat + dLat * ratio,
      newLon: r.lon + dLon * ratio,
      arrived: false,
    }
  }

  private suppress(cell: GridCell, power: number): void {
    for (let i = 0; i < power; i++) {
      if (cell.fireIntensity > 0 && cell.fireIntensity < 4) {
        cell.fireIntensity = Math.max(0, cell.fireIntensity - 1) as 0 | 1 | 2 | 3 | 4
        if (cell.fireIntensity === 0) {
          cell.suppressedAt = Date.now()
        }
      }
    }
  }

  private getCell(lat: number, lon: number): GridCell | null {
    const pos = latLonToGridCell(lat, lon, this.bounds)
    if (!pos) return null
    return this.grid[pos.row][pos.col]
  }

  private findNearestWater(lat: number, lon: number): GridCell | null {
    let best: GridCell | null = null
    let bestDist = Infinity
    for (const row of this.grid) {
      for (const cell of row) {
        if (cell.vegetation !== 'water') continue
        const d = (cell.lat - lat) ** 2 + (cell.lon - lon) ** 2
        if (d < bestDist) {
          bestDist = d
          best = cell
        }
      }
    }
    return best
  }
}
