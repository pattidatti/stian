import type L from 'leaflet'
import type { GridBounds, GridCell, VegetationType } from '../types'
import { fetchElevationGrid, mockElevation } from '../api/elevation'
import { fetchTerrainFeatures, classifyOsmTags } from '../api/overpass'

export function buildGridBounds(map: L.Map, cellSizeMeters = 50): GridBounds {
  const b = map.getBounds()
  const northLat = b.getNorth()
  const southLat = b.getSouth()
  const eastLon = b.getEast()
  const westLon = b.getWest()

  const centerLat = (northLat + southLat) / 2
  const metersPerDegreeLat = 111320
  const metersPerDegreeLon = 111320 * Math.cos((centerLat * Math.PI) / 180)

  const heightMeters = (northLat - southLat) * metersPerDegreeLat
  const widthMeters = (eastLon - westLon) * metersPerDegreeLon

  const rows = Math.max(10, Math.min(150, Math.ceil(heightMeters / cellSizeMeters)))
  const cols = Math.max(10, Math.min(150, Math.ceil(widthMeters / cellSizeMeters)))

  return { northLat, southLat, eastLon, westLon, rows, cols, cellSizeMeters }
}

export function gridCellToLatLon(row: number, col: number, bounds: GridBounds): { lat: number; lon: number } {
  const lat =
    bounds.northLat -
    ((row + 0.5) * (bounds.northLat - bounds.southLat)) / bounds.rows
  const lon =
    bounds.westLon +
    ((col + 0.5) * (bounds.eastLon - bounds.westLon)) / bounds.cols
  return { lat, lon }
}

export function latLonToGridCell(
  lat: number,
  lon: number,
  bounds: GridBounds,
): { row: number; col: number } | null {
  const row = Math.floor(
    ((bounds.northLat - lat) / (bounds.northLat - bounds.southLat)) * bounds.rows,
  )
  const col = Math.floor(
    ((lon - bounds.westLon) / (bounds.eastLon - bounds.westLon)) * bounds.cols,
  )
  if (row < 0 || row >= bounds.rows || col < 0 || col >= bounds.cols) return null
  return { row, col }
}

function initializeGrid(bounds: GridBounds): GridCell[][] {
  const { rows, cols } = bounds
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => {
      const { lat, lon } = gridCellToLatLon(r, c, bounds)
      return {
        row: r,
        col: c,
        lat,
        lon,
        elevation: 0,
        vegetation: 'forest_conifer' as VegetationType,
        fireIntensity: 0 as 0 | 1 | 2 | 3 | 4,
        burnedAt: null,
        suppressedAt: null,
        ticksAtIntensity: 0,
      }
    }),
  )
}

function applyMockVegetation(grid: GridCell[][], bounds: GridBounds): void {
  const centerRow = Math.floor(bounds.rows / 2)
  for (let r = 0; r < bounds.rows; r++) {
    for (let c = 0; c < bounds.cols; c++) {
      const cell = grid[r][c]
      if (Math.abs(r - centerRow) < 2) {
        cell.vegetation = 'water'
        continue
      }
      if (r === bounds.rows - 3 || r === bounds.rows - 2) {
        cell.vegetation = 'road'
        continue
      }
      if ((r * 7 + c * 13) % 17 === 0) {
        cell.vegetation = 'wetland'
        continue
      }
      if ((r * 3 + c * 11) % 23 === 0) {
        cell.vegetation = 'open'
        continue
      }
      cell.vegetation = (r + c) % 5 === 0 ? 'forest_deciduous' : 'forest_conifer'
    }
  }
}

const VEGETATION_PRIORITY: Record<VegetationType, number> = {
  water: 5,
  building: 4,
  road: 3,
  wetland: 2,
  forest_conifer: 1,
  forest_deciduous: 1,
  open: 0,
}

function rasterizeOverpassFeatures(
  grid: GridCell[][],
  elements: Array<{ tags?: Record<string, string>; geometry?: Array<{ lat: number; lon: number }> }>,
  bounds: GridBounds,
): void {
  for (const element of elements) {
    if (!element.geometry || !element.tags) continue
    const veg = classifyOsmTags(element.tags)
    if (!veg) continue

    const lats = element.geometry.map((p) => p.lat)
    const lons = element.geometry.map((p) => p.lon)
    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)
    const minLon = Math.min(...lons)
    const maxLon = Math.max(...lons)

    const startRow = Math.max(
      0,
      Math.floor(
        ((bounds.northLat - maxLat) / (bounds.northLat - bounds.southLat)) * bounds.rows,
      ),
    )
    const endRow = Math.min(
      bounds.rows - 1,
      Math.ceil(
        ((bounds.northLat - minLat) / (bounds.northLat - bounds.southLat)) * bounds.rows,
      ),
    )
    const startCol = Math.max(
      0,
      Math.floor(
        ((minLon - bounds.westLon) / (bounds.eastLon - bounds.westLon)) * bounds.cols,
      ),
    )
    const endCol = Math.min(
      bounds.cols - 1,
      Math.ceil(
        ((maxLon - bounds.westLon) / (bounds.eastLon - bounds.westLon)) * bounds.cols,
      ),
    )

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const current = grid[r][c].vegetation
        if ((VEGETATION_PRIORITY[veg] ?? 0) >= (VEGETATION_PRIORITY[current] ?? 0)) {
          grid[r][c].vegetation = veg
        }
      }
    }
  }
}

export async function buildGrid(
  bounds: GridBounds,
  onProgress: (stage: string, pct: number) => void,
): Promise<{ grid: GridCell[][]; usedMockData: boolean }> {
  const grid = initializeGrid(bounds)
  let usedMockData = false

  // Elevation: subsample 4×4, bilinear interpolate
  const sampleRows = Math.ceil(bounds.rows / 4)
  const sampleCols = Math.ceil(bounds.cols / 4)
  const samplePoints: Array<{ lat: number; lon: number; r: number; c: number }> = []

  for (let sr = 0; sr < sampleRows; sr++) {
    for (let sc = 0; sc < sampleCols; sc++) {
      const r = Math.min(Math.round(sr * 4 + 2), bounds.rows - 1)
      const c = Math.min(Math.round(sc * 4 + 2), bounds.cols - 1)
      const { lat, lon } = gridCellToLatLon(r, c, bounds)
      samplePoints.push({ lat, lon, r, c })
    }
  }

  onProgress('LASTER HØYDEDATA...', 0)

  try {
    const elevations = await fetchElevationGrid(
      samplePoints,
      (done, total) => onProgress('LASTER HØYDEDATA...', done / total * 0.5),
    )

    // Apply sampled elevations
    samplePoints.forEach((pt, i) => {
      grid[pt.r][pt.c].elevation = elevations[i]
    })

    // Bilinear interpolation for remaining cells
    for (let r = 0; r < bounds.rows; r++) {
      for (let c = 0; c < bounds.cols; c++) {
        if (grid[r][c].elevation !== 0) continue
        // Find nearest sample points and interpolate
        const sr0 = Math.floor(r / 4)
        const sc0 = Math.floor(c / 4)
        const r0 = Math.min(Math.round(sr0 * 4 + 2), bounds.rows - 1)
        const r1 = Math.min(Math.round((sr0 + 1) * 4 + 2), bounds.rows - 1)
        const c0 = Math.min(Math.round(sc0 * 4 + 2), bounds.cols - 1)
        const c1 = Math.min(Math.round((sc0 + 1) * 4 + 2), bounds.cols - 1)
        const t = r1 !== r0 ? (r - r0) / (r1 - r0) : 0
        const s = c1 !== c0 ? (c - c0) / (c1 - c0) : 0
        const e00 = grid[r0][c0].elevation
        const e10 = grid[r1][c0].elevation
        const e01 = grid[r0][c1].elevation
        const e11 = grid[r1][c1].elevation
        grid[r][c].elevation =
          e00 * (1 - t) * (1 - s) +
          e10 * t * (1 - s) +
          e01 * (1 - t) * s +
          e11 * t * s
      }
    }
  } catch {
    usedMockData = true
    for (let r = 0; r < bounds.rows; r++) {
      for (let c = 0; c < bounds.cols; c++) {
        const cell = grid[r][c]
        cell.elevation = mockElevation(cell.lat, cell.lon)
      }
    }
  }

  // Terrain features from Overpass
  try {
    onProgress('LASTER TERRENGDATA...', 0.5)
    const osm = await fetchTerrainFeatures(bounds)
    rasterizeOverpassFeatures(grid, osm.elements, bounds)
    onProgress('TERRENGDATA LASTET', 1.0)
  } catch {
    usedMockData = true
    applyMockVegetation(grid, bounds)
    onProgress('TESTDATA LASTET', 1.0)
  }

  return { grid, usedMockData }
}
