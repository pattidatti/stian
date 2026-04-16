import type { KartverketElevationResponse } from '../types'

const BASE = 'https://ws.geonorge.no/hoydedata/v1'

async function fetchElevationPoint(lat: number, lon: number): Promise<number> {
  const url = `${BASE}/punkt?nord=${lat}&ost=${lon}&koordsys=4326&geojson=false`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Elevation API ${res.status}`)
  const data: KartverketElevationResponse = await res.json()
  return data.punkter[0]?.z ?? 0
}

export async function fetchElevationGrid(
  points: Array<{ lat: number; lon: number }>,
  onProgress?: (done: number, total: number) => void,
): Promise<number[]> {
  const CONCURRENCY = 8
  const results: number[] = new Array(points.length).fill(0)
  let index = 0

  async function worker() {
    while (index < points.length) {
      const i = index++
      try {
        results[i] = await fetchElevationPoint(points[i].lat, points[i].lon)
      } catch {
        results[i] = mockElevation(points[i].lat, points[i].lon)
      }
      onProgress?.(i + 1, points.length)
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  return results
}

export function mockElevation(lat: number, lon: number): number {
  return Math.max(
    0,
    200 * Math.sin(lat * 300) * Math.cos(lon * 200) +
      100 * Math.sin(lat * 700 + lon * 500) +
      50,
  )
}
