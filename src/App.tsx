import { useReducer, useEffect, useRef, useCallback, useState } from 'react'
import type L from 'leaflet'
import type {
  FireParams,
  GridBounds,
  GridCell,
  Resource,
  ResourceType,
  SimAction,
  SimState,
} from './types'
import { buildGrid, buildGridBounds } from './engine/GridBuilder'
import { FireEngine } from './engine/FireEngine'
import { ResourceEngine } from './engine/ResourceEngine'
import { SnapshotManager } from './engine/SnapshotManager'
import { searchAddress } from './api/overpass'
import MapView from './components/MapView'
import Sidebar from './components/Sidebar'
import Timeline from './components/Timeline'

const DEFAULT_FIRE_PARAMS: FireParams = {
  windDirection: 45,
  windSpeed: 5,
  dryness: 60,
  energyLevel: 'medium',
}

const INITIAL_STATE: SimState = {
  phase: 'setup',
  currentTick: 0,
  playheadIndex: 0,
  speed: 1,
  grid: null,
  gridBounds: null,
  resources: [],
  fireParams: DEFAULT_FIRE_PARAMS,
  snapshots: [],
  branchPoints: [],
  stats: { burnedCells: 0, burnedAreaM2: 0, resourcesDeployed: 0, elapsedTicks: 0 },
  ignitionMode: false,
  selectedResourceId: null,
  pendingResourceType: null,
  isLoading: false,
  loadingMessage: '',
  usedMockData: false,
  debriefMode: false,
  fullscreenMode: false,
}

let resourceCounter = 0
function createResource(type: ResourceType, lat: number, lon: number): Resource {
  resourceCounter++
  const name = `${type === 'helicopter' ? 'HELIKOPTER' : type === 'crew' ? 'MANNSKAP' : 'TANKVOGN'} ${resourceCounter}`

  const base: Resource = {
    id: `${type}-${resourceCounter}`,
    type,
    name,
    lat,
    lon,
    targetLat: null,
    targetLon: null,
    status: 'idle',
  }

  if (type === 'helicopter') {
    return { ...base, tankCapacity: 1000, tankLevel: 1000, flySpeed: 2, range: 50, fillTime: 3 }
  }
  if (type === 'crew') {
    return { ...base, crewCount: 6, suppressionCapacity: 2, endurance: 100 }
  }
  return { ...base, truckCapacity: 5000, truckLevel: 5000, truckSpeed: 1.5 }
}

function computeStats(grid: GridCell[][], bounds: GridBounds, resources: Resource[], ticks: number) {
  let burned = 0
  for (const row of grid) {
    for (const cell of row) {
      if (cell.fireIntensity > 0) burned++
    }
  }
  const areaPerCell = bounds.cellSizeMeters ** 2
  return {
    burnedCells: burned,
    burnedAreaM2: burned * areaPerCell,
    resourcesDeployed: resources.length,
    elapsedTicks: ticks,
  }
}

function reducer(state: SimState, action: SimAction): SimState {
  switch (action.type) {
    case 'LOAD_GRID_START':
      return { ...state, isLoading: true, loadingMessage: action.message }

    case 'LOAD_GRID_PROGRESS':
      return { ...state, loadingMessage: action.message }

    case 'LOAD_GRID_DONE':
      return {
        ...state,
        isLoading: false,
        grid: action.grid,
        gridBounds: action.bounds,
        usedMockData: action.usedMockData,
        phase: 'paused',
        snapshots: [],
        branchPoints: [],
        currentTick: 0,
        playheadIndex: 0,
        stats: computeStats(action.grid, action.bounds, state.resources, 0),
      }

    case 'IGNITE': {
      if (!state.grid) return state
      const grid = state.grid
      grid[action.row][action.col].fireIntensity = 2
      grid[action.row][action.col].burnedAt = state.currentTick
      grid[action.row][action.col].ticksAtIntensity = 0
      return {
        ...state,
        grid: [...grid],
        ignitionMode: false,
        phase: state.phase === 'setup' ? 'paused' : state.phase,
      }
    }

    case 'TICK': {
      if (!state.gridBounds) return state
      const newTick = state.currentTick + 1
      const stats = computeStats(action.grid, state.gridBounds, action.resources, newTick)
      return {
        ...state,
        grid: action.grid,
        resources: action.resources,
        currentTick: newTick,
        playheadIndex: Math.max(0, state.snapshots.length - 1),
        stats,
      }
    }

    case 'SAVE_SNAPSHOT': {
      const snapshots = [...state.snapshots, action.snapshot]
      const branchPoints = action.snapshot.isBranch
        ? [...state.branchPoints, snapshots.length - 1]
        : state.branchPoints
      return { ...state, snapshots, branchPoints, playheadIndex: snapshots.length - 1 }
    }

    case 'PAUSE':
      return { ...state, phase: 'paused' }

    case 'PLAY':
      return state.grid ? { ...state, phase: 'running' } : state

    case 'SET_SPEED':
      return { ...state, speed: action.speed }

    case 'SCRUB': {
      const snap = state.snapshots[action.snapshotIndex]
      if (!snap || !state.grid || !state.gridBounds) return state
      return { ...state, playheadIndex: action.snapshotIndex, phase: 'paused' }
    }

    case 'BRANCH': {
      const snap = state.snapshots[state.playheadIndex]
      if (!snap) return state
      const snaps = state.snapshots.slice(0, state.playheadIndex + 1)
      snaps[snaps.length - 1] = { ...snaps[snaps.length - 1], isBranch: true }
      const bps = snaps.map((s, i) => (s.isBranch ? i : -1)).filter((i) => i !== -1)
      return {
        ...state,
        snapshots: snaps,
        branchPoints: bps,
        phase: 'paused',
      }
    }

    case 'UPDATE_FIRE_PARAMS':
      return { ...state, fireParams: { ...state.fireParams, ...action.params } }

    case 'ADD_RESOURCE':
      return {
        ...state,
        resources: [...state.resources, action.resource],
        pendingResourceType: null,
      }

    case 'UPDATE_RESOURCE':
      return {
        ...state,
        resources: state.resources.map((r) =>
          r.id === action.id ? { ...r, ...action.patch } : r,
        ),
      }

    case 'REMOVE_RESOURCE':
      return {
        ...state,
        resources: state.resources.filter((r) => r.id !== action.id),
        selectedResourceId:
          state.selectedResourceId === action.id ? null : state.selectedResourceId,
      }

    case 'SELECT_RESOURCE':
      return { ...state, selectedResourceId: action.id }

    case 'SET_IGNITION_MODE':
      return { ...state, ignitionMode: action.active, pendingResourceType: null }

    case 'SET_PENDING_RESOURCE':
      return { ...state, pendingResourceType: action.resourceType, ignitionMode: false }

    case 'ENTER_DEBRIEF':
      return { ...state, debriefMode: true, phase: 'debrief' }

    case 'EXIT_DEBRIEF':
      return { ...state, debriefMode: false, phase: 'paused' }

    case 'SET_FULLSCREEN':
      return { ...state, fullscreenMode: action.active }

    default:
      return state
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchError, setSearchError] = useState('')

  const mapRef = useRef<L.Map | null>(null)
  const fireEngineRef = useRef<FireEngine | null>(null)
  const resourceEngineRef = useRef<ResourceEngine | null>(null)
  const snapshotManagerRef = useRef(new SnapshotManager())
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Always-fresh ref to avoid stale closures in setInterval
  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state }, [state])

  // Sync fire engine when params change
  useEffect(() => {
    fireEngineRef.current?.updateParams(state.fireParams)
  }, [state.fireParams])

  // Initialize engines when grid loads
  useEffect(() => {
    if (!state.grid || !state.gridBounds) return
    fireEngineRef.current = new FireEngine(state.grid, state.gridBounds, state.fireParams)
    resourceEngineRef.current = new ResourceEngine(state.grid, state.gridBounds)
    snapshotManagerRef.current.clear()
  }, [state.gridBounds]) // eslint-disable-line react-hooks/exhaustive-deps

  // Simulation loop
  useEffect(() => {
    if (tickIntervalRef.current) {
      clearInterval(tickIntervalRef.current)
      tickIntervalRef.current = null
    }

    if (state.phase !== 'running' || !state.grid || !state.gridBounds) return

    const TICK_MS: Record<number, number> = {
      0.5: 2000,
      1: 1000,
      2: 500,
      5: 200,
      10: 100,
    }
    const intervalMs = TICK_MS[state.speed] ?? 1000

    tickIntervalRef.current = setInterval(() => {
      const fe = fireEngineRef.current
      const re = resourceEngineRef.current
      const s = stateRef.current  // always fresh
      if (!fe || !re || !s.gridBounds) return

      const newGrid = fe.step()
      re.setGrid(newGrid)

      const updatedResources = re.step(s.resources)

      dispatch({ type: 'TICK', grid: newGrid, resources: updatedResources })

      // Save snapshot every 5 ticks
      const nextTick = s.currentTick + 1
      if (nextTick % 5 === 0) {
        const snap = snapshotManagerRef.current.take(
          nextTick,
          newGrid,
          s.gridBounds,
          updatedResources,
          s.fireParams,
        )
        dispatch({ type: 'SAVE_SNAPSHOT', snapshot: snap })
      }
    }, intervalMs)

    return () => {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current)
        tickIntervalRef.current = null
      }
    }
  }, [state.phase, state.speed]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleLoadTerrain = useCallback(async () => {
    const map = mapRef.current
    if (!map) return

    const bounds = buildGridBounds(map)
    dispatch({ type: 'LOAD_GRID_START', message: 'LASTER TERRENGDATA...' })

    try {
      const { grid, usedMockData } = await buildGrid(bounds, (stage, _pct) => {
        dispatch({ type: 'LOAD_GRID_PROGRESS', message: stage })
      })
      dispatch({ type: 'LOAD_GRID_DONE', grid, bounds, usedMockData })
    } catch {
      dispatch({ type: 'LOAD_GRID_DONE', grid: [], bounds, usedMockData: true })
    }
  }, [])

  const handleSearch = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!searchQuery.trim() || !mapRef.current) return
      setSearchError('')
      const result = await searchAddress(searchQuery)
      if (result) {
        mapRef.current.setView([result.lat, result.lon], 13)
        setSearchQuery(result.label)
      } else {
        setSearchError('Sted ikke funnet')
      }
    },
    [searchQuery],
  )

  const handleMapReady = useCallback((map: L.Map) => {
    mapRef.current = map
  }, [])

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      const s = stateRef.current
      if (s.ignitionMode) {
        const fe = fireEngineRef.current
        if (fe) fe.ignite(row, col)
        dispatch({ type: 'IGNITE', row, col })
      } else if (s.pendingResourceType) {
        const cell = s.grid?.[row][col]
        if (!cell) return
        const resource = createResource(s.pendingResourceType, cell.lat, cell.lon)
        dispatch({ type: 'ADD_RESOURCE', resource })
      }
    },
    [],
  )

  const handleMapClick = useCallback(
    (lat: number, lon: number) => {
      if (state.pendingResourceType) {
        const resource = createResource(state.pendingResourceType, lat, lon)
        dispatch({ type: 'ADD_RESOURCE', resource })
      }
    },
    [state.pendingResourceType],
  )

  const handleScrub = useCallback(
    (index: number) => {
      const snap = snapshotManagerRef.current.getAt(index)
      if (!snap || !state.grid || !state.gridBounds) return
      snapshotManagerRef.current.restoreGrid(snap, state.grid, state.gridBounds)
      fireEngineRef.current?.setGrid(state.grid)
      fireEngineRef.current?.setTick(snap.tick)
      resourceEngineRef.current?.setGrid(state.grid)
      dispatch({ type: 'SCRUB', snapshotIndex: index })
    },
    [state.grid, state.gridBounds],
  )

  const handleBranch = useCallback(() => {
    const snap = snapshotManagerRef.current.getAt(state.playheadIndex)
    if (!snap || !state.grid || !state.gridBounds) return
    snapshotManagerRef.current.branch(state.playheadIndex)
    snapshotManagerRef.current.restoreGrid(snap, state.grid, state.gridBounds)
    fireEngineRef.current?.setGrid(state.grid)
    fireEngineRef.current?.setTick(snap.tick)
    resourceEngineRef.current?.setGrid(state.grid)
    dispatch({ type: 'BRANCH' })
  }, [state.playheadIndex, state.grid, state.gridBounds])

  const isFullscreen = state.fullscreenMode || state.debriefMode

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Header */}
      {!isFullscreen && (
        <header
          style={{
            height: '48px',
            background: '#111827',
            borderBottom: '1px solid #374151',
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            gap: '16px',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              color: '#f59e0b',
              fontSize: '13px',
              letterSpacing: '3px',
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
            }}
          >
            ▲ VIRTUAL SNOWFLAKE
          </div>

          <form onSubmit={handleSearch} style={{ flex: 1, display: 'flex', gap: '8px', maxWidth: '400px' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Søk sted eller adresse..."
              style={{
                flex: 1,
                background: '#1f2937',
                border: '1px solid #374151',
                color: '#f3f4f6',
                padding: '4px 10px',
                fontSize: '12px',
                fontFamily: 'Courier New, monospace',
                outline: 'none',
                borderRadius: '2px',
              }}
            />
            <button
              type="submit"
              style={{
                background: 'transparent',
                border: '1px solid #374151',
                color: '#9ca3af',
                padding: '4px 10px',
                cursor: 'pointer',
                fontFamily: 'Courier New, monospace',
                fontSize: '12px',
              }}
            >
              🔍
            </button>
          </form>

          {searchError && (
            <span style={{ color: '#ef4444', fontSize: '11px' }}>{searchError}</span>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            {state.usedMockData && (
              <span
                style={{
                  color: '#f59e0b',
                  fontSize: '10px',
                  letterSpacing: '1px',
                  border: '1px solid #f59e0b40',
                  padding: '2px 8px',
                  borderRadius: '2px',
                }}
              >
                TESTDATA
              </span>
            )}
            <button
              onClick={() => dispatch({ type: 'SET_FULLSCREEN', active: !state.fullscreenMode })}
              style={{
                background: 'transparent',
                border: '1px solid #374151',
                color: '#9ca3af',
                padding: '4px 10px',
                cursor: 'pointer',
                fontFamily: 'Courier New, monospace',
                fontSize: '11px',
                letterSpacing: '1px',
              }}
            >
              FULLSKJERM
            </button>
          </div>
        </header>
      )}

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Sidebar */}
        {!isFullscreen && (
          <Sidebar state={state} dispatch={dispatch} onLoadTerrain={handleLoadTerrain} />
        )}

        {/* Map */}
        <div style={{ flex: 1, position: 'relative' }}>
          <MapView
            grid={state.grid}
            bounds={state.gridBounds}
            resources={state.resources}
            phase={state.phase}
            ignitionMode={state.ignitionMode}
            pendingResourceType={state.pendingResourceType}
            onMapReady={handleMapReady}
            onCellClick={handleCellClick}
            onMapClick={handleMapClick}
            debriefMode={state.debriefMode}
          />

          {/* Loading overlay */}
          {state.isLoading && (
            <div className="loading-overlay">
              <span className="blink">[ {state.loadingMessage} ]</span>
            </div>
          )}

          {/* Mock data banner */}
          {state.usedMockData && !state.isLoading && (
            <div
              style={{
                position: 'absolute',
                top: '8px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(10,14,26,0.9)',
                border: '1px solid #f59e0b40',
                color: '#f59e0b',
                padding: '4px 12px',
                fontSize: '10px',
                letterSpacing: '1px',
                fontFamily: 'Courier New, monospace',
                zIndex: 1000,
                pointerEvents: 'none',
              }}
            >
              [ API UTILGJENGELIG — BRUKER TESTDATA ]
            </div>
          )}

          {/* Compass rose */}
          <CompassRose windDirection={state.fireParams.windDirection} />

          {/* Debrief overlay controls */}
          {isFullscreen && (
            <button
              onClick={() => {
                dispatch({ type: 'EXIT_DEBRIEF' })
                dispatch({ type: 'SET_FULLSCREEN', active: false })
              }}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'rgba(17,24,39,0.9)',
                border: '1px solid #374151',
                color: '#9ca3af',
                padding: '6px 12px',
                cursor: 'pointer',
                fontFamily: 'Courier New, monospace',
                fontSize: '11px',
                letterSpacing: '1px',
                zIndex: 1000,
              }}
            >
              ✕ LUKK
            </button>
          )}
        </div>
      </div>

      {/* Timeline */}
      <Timeline
        snapshots={state.snapshots}
        currentIndex={state.playheadIndex}
        branchPoints={state.branchPoints}
        phase={state.phase}
        speed={state.speed}
        onScrub={handleScrub}
        onPlay={() => dispatch({ type: 'PLAY' })}
        onPause={() => dispatch({ type: 'PAUSE' })}
        onStepBack={() => handleScrub(Math.max(0, state.playheadIndex - 1))}
        onStepForward={() =>
          handleScrub(Math.min(state.snapshots.length - 1, state.playheadIndex + 1))
        }
        onBranch={handleBranch}
        onSetSpeed={(speed) => dispatch({ type: 'SET_SPEED', speed })}
      />
    </div>
  )
}

function CompassRose({ windDirection }: { windDirection: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: '56px',
        right: '12px',
        zIndex: 500,
        pointerEvents: 'none',
        background: 'rgba(17,24,39,0.8)',
        border: '1px solid #374151',
        borderRadius: '50%',
        width: '56px',
        height: '56px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg width="48" height="48">
        <circle cx="24" cy="24" r="22" fill="none" stroke="#374151" strokeWidth="1" />
        {/* N */}
        <text x="24" y="10" textAnchor="middle" fontSize="8" fill="#ef4444" fontFamily="Courier New">N</text>
        {/* Wind arrow */}
        <g transform={`rotate(${windDirection}, 24, 24)`}>
          <line x1="24" y1="24" x2="24" y2="8" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
          <polygon points="24,5 21,11 27,11" fill="#f59e0b" />
        </g>
        {/* Center */}
        <circle cx="24" cy="24" r="2" fill="#6b7280" />
      </svg>
    </div>
  )
}
