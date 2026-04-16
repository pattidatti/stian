import { useState, useCallback } from 'react'
import type { FireParams, Resource, ResourceType, SimAction, SimState } from '../types'
import ScorePanel from './ScorePanel'

interface SidebarProps {
  state: SimState
  dispatch: (action: SimAction) => void
  onLoadTerrain: () => void
}

type Tab = 'K' | 'R' | 'T' | 'S'

const TAB_LABELS: Record<Tab, string> = {
  K: 'KONTROLL',
  R: 'RESSURSER',
  T: 'TIDSLINJE',
  S: 'STATISTIKK',
}

export default function Sidebar({ state, dispatch, onLoadTerrain }: SidebarProps) {
  const [activeTab, setActiveTab] = useState<Tab>('K')

  return (
    <div
      style={{
        width: '280px',
        background: '#111827',
        borderRight: '1px solid #374151',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'Courier New, monospace',
      }}
    >
      {/* Tab buttons */}
      <div style={{ display: 'flex', borderBottom: '1px solid #374151' }}>
        {(['K', 'R', 'T', 'S'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: '8px 4px',
              fontSize: '11px',
              letterSpacing: '1px',
              background: activeTab === tab ? '#1f2937' : 'transparent',
              color: activeTab === tab ? '#f59e0b' : '#6b7280',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid #f59e0b' : '2px solid transparent',
              cursor: 'pointer',
              fontFamily: 'Courier New, monospace',
              transition: 'color 0.15s',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab label */}
      <div
        style={{
          padding: '6px 12px',
          fontSize: '9px',
          color: '#4b5563',
          letterSpacing: '2px',
          borderBottom: '1px solid #1f2937',
        }}
      >
        {TAB_LABELS[activeTab]}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'K' && (
          <KontrollerTab state={state} dispatch={dispatch} onLoadTerrain={onLoadTerrain} />
        )}
        {activeTab === 'R' && <RessurserTab state={state} dispatch={dispatch} />}
        {activeTab === 'T' && <TidslinjeTab state={state} />}
        {activeTab === 'S' && (
          <ScorePanel
            stats={state.stats}
            debriefMode={state.debriefMode}
            onEnterDebrief={() => dispatch({ type: 'ENTER_DEBRIEF' })}
            onExitDebrief={() => dispatch({ type: 'EXIT_DEBRIEF' })}
          />
        )}
      </div>
    </div>
  )
}

// ─── K: Kontroller ────────────────────────────────────────────────────────

function KontrollerTab({
  state,
  dispatch,
  onLoadTerrain,
}: {
  state: SimState
  dispatch: (a: SimAction) => void
  onLoadTerrain: () => void
}) {
  const { fireParams, phase, ignitionMode, grid } = state

  const updateParam = useCallback(
    (patch: Partial<FireParams>) => dispatch({ type: 'UPDATE_FIRE_PARAMS', params: patch }),
    [dispatch],
  )

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Wind direction compass */}
      <div>
        <Label>VINDRETNING</Label>
        <div className="flex items-center gap-3 mt-2">
          <CompassWidget
            direction={fireParams.windDirection}
            onChange={(d) => updateParam({ windDirection: d })}
          />
          <div style={{ color: '#f3f4f6', fontSize: '13px', minWidth: '50px' }}>
            {fireParams.windDirection.toFixed(0)}°
            <div style={{ fontSize: '10px', color: '#9ca3af' }}>
              {compassLabel(fireParams.windDirection)}
            </div>
          </div>
        </div>
      </div>

      {/* Wind speed */}
      <SliderRow
        label="VINDSTYRKE"
        value={fireParams.windSpeed}
        min={0}
        max={30}
        step={0.5}
        unit=" m/s"
        onChange={(v) => updateParam({ windSpeed: v })}
      />

      {/* Dryness */}
      <SliderRow
        label="TØRRHET"
        value={fireParams.dryness}
        min={0}
        max={100}
        step={1}
        unit="%"
        onChange={(v) => updateParam({ dryness: v })}
      />

      {/* Energy level */}
      <div>
        <Label>ENERGINIVÅ</Label>
        <div className="flex gap-2 mt-2">
          {(['low', 'medium', 'high'] as const).map((level) => (
            <button
              key={level}
              onClick={() => updateParam({ energyLevel: level })}
              className="flex-1 py-1.5 text-xs rounded transition-colors"
              style={{
                background: fireParams.energyLevel === level ? energyColor(level) : 'transparent',
                color: fireParams.energyLevel === level ? '#0a0e1a' : '#9ca3af',
                border:
                  fireParams.energyLevel === level
                    ? 'none'
                    : `1px solid ${energyColor(level)}40`,
                fontFamily: 'Courier New, monospace',
                fontSize: '10px',
                letterSpacing: '1px',
              }}
            >
              {level === 'low' ? 'LAV' : level === 'medium' ? 'MIDDEL' : 'HØY'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ borderTop: '1px solid #1f2937', paddingTop: '12px' }}>
        {/* Load terrain button */}
        <button
          onClick={onLoadTerrain}
          className="w-full py-2 mb-3 text-xs tracking-widest transition-colors hover:opacity-80"
          style={{
            background: 'transparent',
            border: `1px solid ${!grid ? '#6b7280' : '#374151'}`,
            color: !grid ? '#d1d5db' : '#9ca3af',
            fontFamily: 'Courier New, monospace',
            letterSpacing: '2px',
            boxShadow: !grid ? '0 0 6px rgba(156,163,175,0.3)' : 'none',
          }}
        >
          {!grid ? '▶ LAST TERRENGDATA' : 'LAST TERRENGDATA'}
        </button>

        {/* Ignition button */}
        <button
          onClick={() => dispatch({ type: 'SET_IGNITION_MODE', active: !ignitionMode })}
          disabled={!grid}
          title={!grid ? 'Last terrengdata først' : undefined}
          className="w-full py-2 text-xs tracking-widest transition-colors hover:opacity-80 disabled:opacity-30"
          style={{
            background: ignitionMode ? '#ef4444' : 'transparent',
            border: `1px solid ${ignitionMode ? '#ef4444' : '#ef444440'}`,
            color: ignitionMode ? '#fff' : '#ef4444',
            fontFamily: 'Courier New, monospace',
            letterSpacing: '2px',
          }}
        >
          {ignitionMode ? '● KLIKK FOR Å SETTE ILD' : 'SETT ILD'}
        </button>

        {!grid && (
          <p style={{ fontSize: '10px', color: '#6b7280', textAlign: 'center', marginTop: '8px', letterSpacing: '1px' }}>
            Last terrengdata for å aktivere brannsetting
          </p>
        )}
      </div>

      {phase === 'paused' && (
        <div
          style={{
            fontSize: '10px',
            color: '#9ca3af',
            letterSpacing: '1px',
            textAlign: 'center',
          }}
        >
          SIMULERING SATT PÅ PAUSE
        </div>
      )}
    </div>
  )
}

// ─── R: Ressurser ────────────────────────────────────────────────────────

const RESOURCE_ICONS: Record<ResourceType, string> = {
  helicopter: '△',
  crew: '■',
  truck: '▶',
}

const RESOURCE_LABELS: Record<ResourceType, string> = {
  helicopter: 'HELIKOPTER',
  crew: 'MANNSKAP',
  truck: 'TANKVOGN',
}

function RessurserTab({
  state,
  dispatch,
}: {
  state: SimState
  dispatch: (a: SimAction) => void
}) {
  const { resources, selectedResourceId, pendingResourceType } = state
  const selectedResource = resources.find((r) => r.id === selectedResourceId)

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Selected resource */}
      {selectedResource && (
        <div
          style={{
            background: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '4px',
            padding: '12px',
            marginBottom: '8px',
          }}
        >
          <div className="flex justify-between items-center mb-3">
            <div style={{ color: '#f59e0b', fontSize: '12px', letterSpacing: '1px' }}>
              {RESOURCE_ICONS[selectedResource.type]} {selectedResource.name}
            </div>
            <button
              onClick={() => dispatch({ type: 'SELECT_RESOURCE', id: null })}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#6b7280',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              ✕
            </button>
          </div>

          <ResourceControls resource={selectedResource} dispatch={dispatch} />
        </div>
      )}

      {/* Add resource buttons */}
      <div>
        <Label>LEGG TIL RESSURS</Label>
        <div className="flex flex-col gap-2 mt-2">
          {(['helicopter', 'crew', 'truck'] as ResourceType[]).map((type) => (
            <button
              key={type}
              onClick={() =>
                dispatch({
                  type: 'SET_PENDING_RESOURCE',
                  resourceType: pendingResourceType === type ? null : type,
                })
              }
              className="flex items-center gap-2 px-3 py-2 text-xs rounded transition-colors"
              style={{
                background:
                  pendingResourceType === type ? '#1f2937' : 'transparent',
                border: `1px solid ${pendingResourceType === type ? '#f59e0b' : '#374151'}`,
                color: pendingResourceType === type ? '#f59e0b' : '#9ca3af',
                fontFamily: 'Courier New, monospace',
                letterSpacing: '1px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span>{RESOURCE_ICONS[type]}</span>
              <span>{RESOURCE_LABELS[type]}</span>
              {pendingResourceType === type && (
                <span style={{ marginLeft: 'auto', fontSize: '9px' }}>KLIKK PÅ KART</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Resource list */}
      {resources.length > 0 && (
        <div style={{ marginTop: '8px' }}>
          <Label>DEPLOYERTE ({resources.length})</Label>
          <div className="flex flex-col gap-1 mt-2">
            {resources.map((r) => (
              <div
                key={r.id}
                onClick={() => dispatch({ type: 'SELECT_RESOURCE', id: r.id })}
                className="flex items-center gap-2 px-3 py-2 rounded cursor-pointer transition-colors"
                style={{
                  background: selectedResourceId === r.id ? '#1f2937' : 'transparent',
                  border: `1px solid ${selectedResourceId === r.id ? '#374151' : 'transparent'}`,
                }}
              >
                <span style={{ color: statusColor(r.status) }}>{RESOURCE_ICONS[r.type]}</span>
                <span style={{ color: '#d1d5db', fontSize: '11px', flex: 1 }}>{r.name}</span>
                <span
                  style={{
                    color: statusColor(r.status),
                    fontSize: '9px',
                    letterSpacing: '1px',
                  }}
                >
                  {r.status.toUpperCase()}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    dispatch({ type: 'REMOVE_RESOURCE', id: r.id })
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#4b5563',
                    cursor: 'pointer',
                    fontSize: '12px',
                    padding: '0 2px',
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ResourceControls({
  resource,
  dispatch,
}: {
  resource: Resource
  dispatch: (a: SimAction) => void
}) {
  const patch = (p: Partial<Resource>) =>
    dispatch({ type: 'UPDATE_RESOURCE', id: resource.id, patch: p })

  if (resource.type === 'helicopter') {
    const tankPct = resource.tankCapacity
      ? ((resource.tankLevel ?? 0) / resource.tankCapacity) * 100
      : 0
    return (
      <>
        <div style={{ marginBottom: '8px' }}>
          <div className="flex justify-between mb-1">
            <span style={{ color: '#6b7280', fontSize: '10px' }}>TANK</span>
            <span style={{ color: '#f3f4f6', fontSize: '10px' }}>{tankPct.toFixed(0)}%</span>
          </div>
          <div style={{ height: '4px', background: '#374151', borderRadius: '2px' }}>
            <div
              style={{
                width: `${tankPct}%`,
                height: '100%',
                background: tankPct < 20 ? '#ef4444' : '#10b981',
                borderRadius: '2px',
                transition: 'width 0.3s',
              }}
            />
          </div>
        </div>
        <SliderRow
          label="FLYHASTIGHET"
          value={resource.flySpeed ?? 2}
          min={1}
          max={5}
          step={0.5}
          unit=" c/t"
          onChange={(v) => patch({ flySpeed: v })}
        />
        <div style={{ color: statusColor(resource.status), fontSize: '10px', letterSpacing: '1px', marginTop: '6px' }}>
          STATUS: {resource.status.toUpperCase()}
        </div>
      </>
    )
  }

  if (resource.type === 'crew') {
    return (
      <>
        <SliderRow
          label="SLOKKINGSKAPASITET"
          value={resource.suppressionCapacity ?? 1}
          min={1}
          max={5}
          step={1}
          unit=""
          onChange={(v) => patch({ suppressionCapacity: v })}
        />
        <div style={{ marginTop: '6px' }}>
          <div className="flex justify-between">
            <span style={{ color: '#6b7280', fontSize: '10px' }}>UTHOLDENHET</span>
            <span style={{ color: '#f3f4f6', fontSize: '10px' }}>{resource.endurance ?? 100}</span>
          </div>
          <div style={{ height: '4px', background: '#374151', borderRadius: '2px', marginTop: '4px' }}>
            <div
              style={{
                width: `${resource.endurance ?? 100}%`,
                height: '100%',
                background: '#10b981',
                borderRadius: '2px',
              }}
            />
          </div>
        </div>
        <div style={{ color: statusColor(resource.status), fontSize: '10px', letterSpacing: '1px', marginTop: '6px' }}>
          STATUS: {resource.status.toUpperCase()}
        </div>
      </>
    )
  }

  const lvlPct = resource.truckCapacity
    ? (((resource.truckLevel ?? resource.truckCapacity) / resource.truckCapacity) * 100)
    : 0

  return (
    <>
      <div style={{ marginBottom: '8px' }}>
        <div className="flex justify-between mb-1">
          <span style={{ color: '#6b7280', fontSize: '10px' }}>TANK</span>
          <span style={{ color: '#f3f4f6', fontSize: '10px' }}>{lvlPct.toFixed(0)}%</span>
        </div>
        <div style={{ height: '4px', background: '#374151', borderRadius: '2px' }}>
          <div
            style={{
              width: `${lvlPct}%`,
              height: '100%',
              background: lvlPct < 20 ? '#ef4444' : '#10b981',
              borderRadius: '2px',
            }}
          />
        </div>
      </div>
      <SliderRow
        label="HASTIGHET"
        value={resource.truckSpeed ?? 1}
        min={0.5}
        max={3}
        step={0.5}
        unit=" c/t"
        onChange={(v) => patch({ truckSpeed: v })}
      />
      <div style={{ color: statusColor(resource.status), fontSize: '10px', letterSpacing: '1px', marginTop: '6px' }}>
        STATUS: {resource.status.toUpperCase()}
      </div>
    </>
  )
}

// ─── T: Tidslinje ────────────────────────────────────────────────────────

function TidslinjeTab({ state }: { state: SimState }) {
  const { snapshots, branchPoints } = state

  return (
    <div className="flex flex-col gap-3 p-4">
      <Label>SNAPSHOTS ({snapshots.length})</Label>
      {branchPoints.length === 0 ? (
        <div style={{ color: '#4b5563', fontSize: '11px' }}>Ingen branch-punkter ennå.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {branchPoints.map((idx) => {
            const snap = snapshots[idx]
            if (!snap) return null
            const t = formatSimTimeFull(snap.simTimeMs)
            return (
              <div
                key={idx}
                style={{
                  background: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '4px',
                  padding: '8px 10px',
                  fontSize: '11px',
                }}
              >
                <span style={{ color: '#f59e0b' }}>◆ </span>
                <span style={{ color: '#f3f4f6' }}>{t}</span>
                <span style={{ color: '#6b7280', marginLeft: '8px' }}>tick {snap.tick}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function formatSimTimeFull(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ─── Shared UI ────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: '#6b7280', fontSize: '10px', letterSpacing: '2px', marginBottom: '2px' }}>
      {children}
    </div>
  )
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span style={{ color: '#6b7280', fontSize: '10px', letterSpacing: '1px' }}>{label}</span>
        <span style={{ color: '#f3f4f6', fontSize: '10px' }}>
          {value.toFixed(step < 1 ? 1 : 0)}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}

function CompassWidget({
  direction,
  onChange,
}: {
  direction: number
  onChange: (d: number) => void
}) {
  const r = 40
  const cx = r + 4
  const cy = r + 4
  const size = (r + 4) * 2

  const handleClick = (e: React.MouseEvent<SVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const dx = e.clientX - rect.left - cx
    const dy = e.clientY - rect.top - cy
    let angle = (Math.atan2(dx, -dy) * 180) / Math.PI
    if (angle < 0) angle += 360
    onChange(Math.round(angle))
  }

  const rad = ((direction - 90) * Math.PI) / 180
  const arrowX = cx + Math.cos(rad) * (r - 6)
  const arrowY = cy + Math.sin(rad) * (r - 6)

  return (
    <svg
      width={size}
      height={size}
      onClick={handleClick}
      style={{ cursor: 'crosshair', flexShrink: 0 }}
    >
      {/* Outer ring */}
      <circle cx={cx} cy={cy} r={r} fill="#1f2937" stroke="#374151" strokeWidth="1" />

      {/* Cardinal directions */}
      {[
        { label: 'N', x: cx, y: cy - r + 12, color: '#ef4444' },
        { label: 'S', x: cx, y: cy + r - 4, color: '#9ca3af' },
        { label: 'Ø', x: cx + r - 8, y: cy + 4, color: '#9ca3af' },
        { label: 'V', x: cx - r + 4, y: cy + 4, color: '#9ca3af' },
      ].map(({ label, x, y, color }) => (
        <text
          key={label}
          x={x}
          y={y}
          textAnchor="middle"
          fontSize="9"
          fill={color}
          fontFamily="Courier New, monospace"
        >
          {label}
        </text>
      ))}

      {/* Wind direction arrow */}
      <line
        x1={cx}
        y1={cy}
        x2={arrowX}
        y2={arrowY}
        stroke="#f59e0b"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx={arrowX} cy={arrowY} r="3" fill="#f59e0b" />

      {/* Center dot */}
      <circle cx={cx} cy={cy} r="2" fill="#6b7280" />
    </svg>
  )
}

function compassLabel(deg: number): string {
  const dirs = ['N', 'NØ', 'Ø', 'SØ', 'S', 'SV', 'V', 'NV']
  return dirs[Math.round(deg / 45) % 8]
}

function energyColor(level: string): string {
  if (level === 'low') return '#10b981'
  if (level === 'medium') return '#f59e0b'
  return '#ef4444'
}

function statusColor(status: string): string {
  switch (status) {
    case 'suppressing': return '#10b981'
    case 'moving': return '#f59e0b'
    case 'refilling': return '#60a5fa'
    case 'empty': return '#ef4444'
    default: return '#6b7280'
  }
}
