import type { SimPhase, SimSnapshot, SimState } from '../types'

interface TimelineProps {
  snapshots: SimSnapshot[]
  currentIndex: number
  branchPoints: number[]
  phase: SimPhase
  speed: SimState['speed']
  onScrub: (index: number) => void
  onPlay: () => void
  onPause: () => void
  onStepBack: () => void
  onStepForward: () => void
  onBranch: () => void
  onSetSpeed: (speed: SimState['speed']) => void
}

const SPEEDS: SimState['speed'][] = [0.5, 1, 2, 5, 10]

function formatSimTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  }
  return `${String(minutes).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`
}

export default function Timeline({
  snapshots,
  currentIndex,
  branchPoints,
  phase,
  speed,
  onScrub,
  onPlay,
  onPause,
  onStepBack,
  onStepForward,
  onBranch,
  onSetSpeed,
}: TimelineProps) {
  const isPlaying = phase === 'running'
  const total = Math.max(1, snapshots.length - 1)
  const currentSnap = snapshots[currentIndex]
  const simTime = currentSnap ? formatSimTime(currentSnap.simTimeMs) : '00:00'

  return (
    <div
      className="flex items-center gap-3 px-4 select-none"
      style={{
        height: '56px',
        background: '#111827',
        borderTop: '1px solid #374151',
        fontFamily: 'Courier New, monospace',
      }}
    >
      {/* Transport controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={onStepBack}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
          title="Steg tilbake"
        >
          ⏮
        </button>
        <button
          onClick={isPlaying ? onPause : onPlay}
          disabled={phase === 'setup'}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-700 disabled:opacity-30 transition-colors"
          style={{ color: isPlaying ? '#ef4444' : '#10b981' }}
          title={isPlaying ? 'Pause' : 'Spill av'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button
          onClick={onStepForward}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
          title="Steg fremover"
        >
          ⏭
        </button>
      </div>

      {/* Scrubber */}
      <div className="relative flex-1 flex items-center" style={{ minWidth: 0 }}>
        <input
          type="range"
          min={0}
          max={total}
          value={currentIndex}
          onChange={(e) => onScrub(Number(e.target.value))}
          className="w-full"
          disabled={snapshots.length === 0}
        />
        {/* Branch point markers */}
        {branchPoints.map((bIdx) => {
          const pct = total > 0 ? (bIdx / total) * 100 : 0
          return (
            <span
              key={bIdx}
              style={{
                position: 'absolute',
                left: `${pct}%`,
                top: '-4px',
                color: '#f59e0b',
                fontSize: '10px',
                pointerEvents: 'none',
                transform: 'translateX(-50%)',
              }}
            >
              ◆
            </span>
          )
        })}
      </div>

      {/* Time display */}
      <div
        className="text-sm tabular-nums"
        style={{ color: '#f59e0b', minWidth: '48px', textAlign: 'center' }}
      >
        {simTime}
      </div>

      {/* Speed selector */}
      <div className="flex items-center gap-1">
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => onSetSpeed(s)}
            className="px-1.5 py-0.5 text-xs rounded transition-colors"
            style={{
              background: speed === s ? '#f59e0b' : 'transparent',
              color: speed === s ? '#0a0e1a' : '#9ca3af',
              border: speed === s ? 'none' : '1px solid #374151',
              fontFamily: 'inherit',
            }}
          >
            {s === 0.5 ? '½×' : `${s}×`}
          </button>
        ))}
      </div>

      {/* Branch button */}
      <button
        onClick={onBranch}
        disabled={snapshots.length === 0}
        className="px-3 py-1 text-xs rounded disabled:opacity-30 transition-colors hover:opacity-80"
        style={{
          background: 'transparent',
          border: '1px solid #f59e0b',
          color: '#f59e0b',
          fontFamily: 'inherit',
          letterSpacing: '1px',
        }}
        title="Hopp tilbake til dette punktet og kjør på nytt med andre beslutninger"
      >
        BRANCH HER
      </button>
    </div>
  )
}
