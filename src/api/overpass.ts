import type { GridBounds, OverpassResponse, VegetationType } from '../types'

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter'

export async function fetchTerrainFeatures(bounds: GridBounds): Promise<OverpassResponse> {
  const { southLat, westLon, northLat, eastLon } = bounds
  const bbox = `${southLat},${westLon},${northLat},${eastLon}`

  const query = `
    [out:json][timeout:30][bbox:${bbox}];
    (
      way["natural"="wood"];
      way["landuse"="forest"];
      way["natural"="wetland"];
      way["natural"="grassland"];
      way["landuse"="meadow"];
      way["natural"="water"];
      way["waterway"~"river|stream|canal"];
      way["highway"~"motorway|trunk|primary|secondary|tertiary|unclassified|residential|track"];
      way["building"];
      relation["natural"="water"];
    );
    out geom;
  `

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

  try {
    const res = await fetch(OVERPASS_ENDPOINT, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`Overpass ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timeout)
  }
}

export function classifyOsmTags(tags: Record<string, string>): VegetationType | null {
  if (tags['natural'] === 'water' || tags['waterway']) return 'water'
  if (tags['building']) return 'building'
  if (tags['highway']) return 'road'
  if (tags['natural'] === 'wetland') return 'wetland'
  if (tags['natural'] === 'wood' || tags['landuse'] === 'forest') {
    return tags['leaf_type'] === 'broadleaved' ? 'forest_deciduous' : 'forest_conifer'
  }
  if (tags['natural'] === 'grassland' || tags['landuse'] === 'meadow') return 'open'
  return null
}

export async function searchAddress(query: string): Promise<{ lat: number; lon: number; label: string } | null> {
  const url = `https://ws.geonorge.no/adresser/v1/sok?sok=${encodeURIComponent(query)}&fuzzy=true&treffPerSide=5`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    const first = data.adresser?.[0]
    if (!first) {
      // Fallback: try stedsnavn (place names)
      const nameRes = await fetch(
        `https://ws.geonorge.no/stedsnavn/v1/navn?sok=${encodeURIComponent(query)}&fuzzy=true&treffPerSide=3`,
      )
      if (!nameRes.ok) return null
      const nameData = await nameRes.json()
      const place = nameData.navn?.[0]
      if (!place) return null
      const repr = place.representasjonspunkt
      return { lat: repr.nord, lon: repr.øst, label: place.stedsnavn?.[0]?.skrivemåte ?? query }
    }
    const repr = first.representasjonspunkt
    return {
      lat: repr.lat,
      lon: repr.lon,
      label: `${first.adressenavn}, ${first.poststed}`,
    }
  } catch {
    return null
  }
}
