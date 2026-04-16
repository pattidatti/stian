import { useEffect, useRef, useCallback } from 'react'
import L from 'leaflet'
import type { GridBounds, GridCell, Resource, SimPhase } from '../types'
import { latLonToGridCell } from '../engine/GridBuilder'
import { drawResourceIcon } from './ResourceIcon'

interface MapViewProps {
  grid: GridCell[][] | null
  bounds: GridBounds | null
  resources: Resource[]
  phase: SimPhase
  ignitionMode: boolean
  pendingResourceType: string | null
  onMapReady: (map: L.Map) => void
  onCellClick: (row: number, col: number) => void
  onMapClick: (lat: number, lon: number) => void
  debriefMode: boolean
}

const FIRE_COLORS: Record<number, string> = {
  1: 'rgba(250,204,21,0.6)',
  2: 'rgba(249,115,22,0.7)',
  3: 'rgba(239,68,68,0.8)',
  4: 'rgba(15,10,5,0.75)',   // dark ash — distinct from map tiles
}

const VEGETATION_COLORS: Record<string, string> = {
  forest_conifer: 'rgba(16,92,48,0.25)',
  forest_deciduous: 'rgba(34,137,68,0.2)',
  wetland: 'rgba(55,98,120,0.25)',
  open: 'rgba(180,160,90,0.15)',
  water: 'rgba(37,99,235,0.35)',
  road: 'rgba(107,114,128,0.3)',
  building: 'rgba(75,85,99,0.4)',
}

export default function MapView({
  grid,
  bounds,
  resources,
  phase,
  ignitionMode,
  pendingResourceType,
  onMapReady,
  onCellClick,
  onMapClick,
  debriefMode,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const pixelCacheRef = useRef<Array<{ x: number; y: number; px: number }> | null>(null)
  const animFrameRef = useRef<number>(0)
  const renderFnRef = useRef<(() => void) | null>(null)
  const mapInitialized = useRef(false)

  // Initialize Leaflet map
  useEffect(() => {
    if (mapInitialized.current || !containerRef.current) return
    mapInitialized.current = true

    const map = L.map(containerRef.current, {
      center: [59.9, 10.75],
      zoom: 13,
      zoomControl: true,
    })

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map)

    // Create canvas overlay
    const canvas = document.createElement('canvas')
    canvas.style.position = 'absolute'
    canvas.style.top = '0'
    canvas.style.left = '0'
    canvas.style.pointerEvents = 'none'
    canvas.style.zIndex = '400'
    map.getPanes().overlayPane.appendChild(canvas)
    canvasRef.current = canvas

    const resizeCanvas = () => {
      const size = map.getSize()
      canvas.width = size.x
      canvas.height = size.y
    }

    const repositionCanvas = () => {
      const topLeft = map.containerPointToLayerPoint([0, 0])
      L.DomUtil.setPosition(canvas, topLeft)
    }

    const onZoom = () => {
      pixelCacheRef.current = null
      resizeCanvas()
      repositionCanvas()
      cancelAnimationFrame(animFrameRef.current)
      if (renderFnRef.current) {
        animFrameRef.current = requestAnimationFrame(renderFnRef.current)
      }
    }

    const onMove = () => {
      repositionCanvas()
    }

    map.on('zoom zoomend', onZoom)
    map.on('move moveend', onMove)
    map.on('resize', () => { resizeCanvas(); repositionCanvas() })

    resizeCanvas()

    mapRef.current = map
    onMapReady(map)

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      map.remove()
      mapInitialized.current = false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Map click handler
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const handleClick = (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng
      if (grid && bounds) {
        const cell = latLonToGridCell(lat, lng, bounds)
        if (cell) {
          onCellClick(cell.row, cell.col)
          return
        }
      }
      onMapClick(lat, lng)
    }

    map.on('click', handleClick)
    return () => { map.off('click', handleClick) }
  }, [grid, bounds, onCellClick, onMapClick])

  // Update cursor based on mode
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    if (ignitionMode) {
      container.style.cursor = 'crosshair'
    } else if (pendingResourceType) {
      container.style.cursor = 'cell'
    } else {
      container.style.cursor = ''
    }
  }, [ignitionMode, pendingResourceType])

  const buildPixelCache = useCallback(() => {
    const map = mapRef.current
    if (!map || !grid || !bounds) return

    const cache: Array<{ x: number; y: number; px: number }> = []
    const { rows, cols } = bounds

    // Calculate cell pixel size from first two adjacent cells
    const pt0 = map.latLngToContainerPoint([grid[0][0].lat, grid[0][0].lon])
    const pt1 = map.latLngToContainerPoint([grid[0][1].lat, grid[0][1].lon])
    const cellPx = Math.max(1, Math.abs(pt1.x - pt0.x)) + 1

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = grid[r][c]
        const pt = map.latLngToContainerPoint([cell.lat, cell.lon])
        cache.push({
          x: Math.round(pt.x),
          y: Math.round(pt.y),
          px: Math.round(cellPx),
        })
      }
    }

    pixelCacheRef.current = cache
  }, [grid, bounds])

  // Render canvas when grid/resources change
  useEffect(() => {
    const map = mapRef.current
    const canvas = canvasRef.current
    if (!map || !canvas || !grid || !bounds) return

    cancelAnimationFrame(animFrameRef.current)

    const render = () => {
      if (!pixelCacheRef.current) {
        buildPixelCache()
      }

      const cache = pixelCacheRef.current
      if (!cache) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const { rows, cols } = bounds
      const pulse = (Math.sin(Date.now() / 400) + 1) / 2

      // In debrief mode: show fire development heatmap (blue=early, red=late)
      if (debriefMode) {
        let maxTick = 0
        for (const row of grid) {
          for (const cell of row) {
            if (cell.burnedAt !== null && cell.burnedAt > maxTick) maxTick = cell.burnedAt
          }
        }

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const cell = grid[r][c]
            if (cell.burnedAt === null) continue
            const idx = r * cols + c
            const { x, y, px } = cache[idx]
            const ratio = maxTick > 0 ? cell.burnedAt / maxTick : 0
            const red = Math.round(ratio * 239 + (1 - ratio) * 59)
            const green = Math.round(ratio * 68 + (1 - ratio) * 130)
            const blue = Math.round(ratio * 68 + (1 - ratio) * 246)
            ctx.fillStyle = `rgba(${red},${green},${blue},0.75)`
            ctx.fillRect(x - px / 2, y - px / 2, px, px)
          }
        }
        return
      }

      // Normal render: vegetation + fire
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = grid[r][c]
          const idx = r * cols + c
          const { x, y, px } = cache[idx]

          // Vegetation tint (subtle)
          const vegColor = VEGETATION_COLORS[cell.vegetation]
          if (vegColor && phase !== 'setup') {
            ctx.fillStyle = vegColor
            ctx.fillRect(x - px / 2, y - px / 2, px, px)
          }

          // Fire
          if (cell.fireIntensity > 0) {
            ctx.fillStyle = FIRE_COLORS[cell.fireIntensity]
            ctx.fillRect(x - px / 2, y - px / 2, px, px)

            // Buildings in danger pulse red
            if (cell.vegetation === 'building' && cell.fireIntensity < 4) {
              ctx.fillStyle = `rgba(239,68,68,${0.3 + pulse * 0.4})`
              ctx.fillRect(x - px / 2, y - px / 2, px, px)
            }
          }
        }
      }

      // Draw resource icons
      for (const resource of resources) {
        const map = mapRef.current
        if (!map) continue
        const pt = map.latLngToContainerPoint([resource.lat, resource.lon])
        drawResourceIcon(ctx, resource, Math.round(pt.x), Math.round(pt.y), pulse)
      }

      // Keep looping if anything is animated (pulsing icons or active fire)
      const hasAnimation =
        resources.some((r) => r.status !== 'idle') ||
        grid.some((row) => row.some((c) => c.fireIntensity > 0 && c.fireIntensity < 4))
      if (hasAnimation) {
        animFrameRef.current = requestAnimationFrame(render)
      }
    }

    renderFnRef.current = render
    animFrameRef.current = requestAnimationFrame(render)

    return () => cancelAnimationFrame(animFrameRef.current)
  }, [grid, bounds, resources, phase, debriefMode, buildPixelCache])

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full"
      style={{ background: '#0a0e1a' }}
    />
  )
}
