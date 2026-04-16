// ─── Terrain ───────────────────────────────────────────────────────────────

export type VegetationType =
  | 'forest_conifer'    // barskog  — antennbarhet HØY
  | 'forest_deciduous'  // løvskog  — antennbarhet MIDDELS
  | 'wetland'           // myr      — antennbarhet INGEN
  | 'open'              // åpen mark — antennbarhet LAV
  | 'water'             // vann/sjø  — brann stopper her
  | 'road'              // vei       — lav, brukes av tankvogner
  | 'building'          // bebyggelse — varsler trigges

export interface GridCell {
  row: number
  col: number
  lat: number
  lon: number
  elevation: number
  vegetation: VegetationType
  fireIntensity: 0 | 1 | 2 | 3 | 4
  burnedAt: number | null       // simulasjons-tick da cellen ble antent
  suppressedAt: number | null
  ticksAtIntensity: number
}

export interface GridBounds {
  northLat: number
  southLat: number
  eastLon: number
  westLon: number
  rows: number
  cols: number
  cellSizeMeters: number
}

// ─── Brannparametere ───────────────────────────────────────────────────────

export interface FireParams {
  windDirection: number   // grader, 0=nord, med klokken
  windSpeed: number       // m/s, 0–30
  dryness: number         // 0–100
  energyLevel: 'low' | 'medium' | 'high'
}

// ─── Ressurser ─────────────────────────────────────────────────────────────

export type ResourceType = 'crew' | 'helicopter' | 'truck'
export type ResourceStatus = 'idle' | 'moving' | 'suppressing' | 'refilling' | 'empty'

export interface Resource {
  id: string
  type: ResourceType
  lat: number
  lon: number
  targetLat: number | null
  targetLon: number | null
  status: ResourceStatus
  name: string

  // Mannskap til fots
  crewCount?: number
  suppressionCapacity?: number
  endurance?: number

  // Helikopter
  tankCapacity?: number
  tankLevel?: number
  flySpeed?: number
  range?: number
  fillTime?: number

  // Tankvogn
  truckCapacity?: number
  truckLevel?: number
  truckSpeed?: number
}

// ─── Simulasjons-snapshot ─────────────────────────────────────────────────

export interface SimSnapshot {
  tick: number
  simTimeMs: number
  intensities: Uint8Array             // flat: row*cols+col, verdier 0–4
  burnedAt: (number | null)[]         // flat array, parallell med intensities
  resources: Resource[]
  fireParams: FireParams
  isBranch: boolean
}

// ─── Simulasjonstilstand ──────────────────────────────────────────────────

export type SimPhase = 'setup' | 'running' | 'paused' | 'debrief'

export interface SimStats {
  burnedCells: number
  burnedAreaM2: number
  resourcesDeployed: number
  elapsedTicks: number
}

export interface SimState {
  phase: SimPhase
  currentTick: number
  playheadIndex: number
  speed: 0.5 | 1 | 2 | 5 | 10
  grid: GridCell[][] | null
  gridBounds: GridBounds | null
  resources: Resource[]
  fireParams: FireParams
  snapshots: SimSnapshot[]
  branchPoints: number[]
  stats: SimStats
  ignitionMode: boolean
  selectedResourceId: string | null
  pendingResourceType: ResourceType | null
  isLoading: boolean
  loadingMessage: string
  usedMockData: boolean
  debriefMode: boolean
  fullscreenMode: boolean
}

// ─── Reducer actions ──────────────────────────────────────────────────────

export type SimAction =
  | { type: 'LOAD_GRID_START'; message: string }
  | { type: 'LOAD_GRID_PROGRESS'; message: string }
  | { type: 'LOAD_GRID_DONE'; grid: GridCell[][]; bounds: GridBounds; usedMockData: boolean }
  | { type: 'IGNITE'; row: number; col: number }
  | { type: 'TICK'; grid: GridCell[][]; resources: Resource[] }
  | { type: 'SAVE_SNAPSHOT'; snapshot: SimSnapshot }
  | { type: 'PAUSE' }
  | { type: 'PLAY' }
  | { type: 'SET_SPEED'; speed: SimState['speed'] }
  | { type: 'SCRUB'; snapshotIndex: number }
  | { type: 'BRANCH' }
  | { type: 'UPDATE_FIRE_PARAMS'; params: Partial<FireParams> }
  | { type: 'ADD_RESOURCE'; resource: Resource }
  | { type: 'UPDATE_RESOURCE'; id: string; patch: Partial<Resource> }
  | { type: 'REMOVE_RESOURCE'; id: string }
  | { type: 'SELECT_RESOURCE'; id: string | null }
  | { type: 'SET_IGNITION_MODE'; active: boolean }
  | { type: 'SET_PENDING_RESOURCE'; resourceType: ResourceType | null }
  | { type: 'ENTER_DEBRIEF' }
  | { type: 'EXIT_DEBRIEF' }
  | { type: 'SET_FULLSCREEN'; active: boolean }

// ─── API response shapes ──────────────────────────────────────────────────

export interface KartverketElevationResponse {
  koordsys: number
  punkter: Array<{
    datakilde: string
    terreng: string
    x: number
    y: number
    z: number
  }>
}

export interface GeonorgeAddressResult {
  adressenavn: string
  kommunenavn: string
  poststed: string
  representasjonspunkt: { epsg: string; lat: number; lon: number }
}

export interface OverpassResponse {
  elements: OverpassElement[]
}

export interface OverpassElement {
  type: 'node' | 'way' | 'relation'
  id: number
  tags?: Record<string, string>
  geometry?: Array<{ lat: number; lon: number }>
  bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number }
}
