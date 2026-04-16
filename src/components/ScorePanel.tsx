import type { SimStats } from '../types'

interface ScorePanelProps {
  stats: SimStats
  onEnterDebrief: () => void
  onExitDebrief: () => void
  debriefMode: boolean
}

function formatTime(ticks: number): string {
  const seconds = ticks * 10
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}t ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function formatArea(m2: number): string {
  if (m2 >= 10000) return `${(m2 / 10000).toFixed(2)} daa`
  return `${m2.toFixed(0)} m²`
}

export default function ScorePanel({ stats, onEnterDebrief, onExitDebrief, debriefMode }: ScorePanelProps) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div style={{ color: '#f59e0b', fontSize: '11px', letterSpacing: '2px' }}>
        STATISTIKK
      </div>

      <div className="grid grid-cols-1 gap-3">
        <StatRow label="BRENT AREAL" value={formatArea(stats.burnedAreaM2)} />
        <StatRow label="BRENTE CELLER" value={String(stats.burnedCells)} />
        <StatRow label="RESSURSER" value={String(stats.resourcesDeployed)} />
        <StatRow label="SIMULERT TID" value={formatTime(stats.elapsedTicks)} />
      </div>

      <div className="flex flex-col gap-2 mt-4">
        {!debriefMode ? (
          <button
            onClick={onEnterDebrief}
            className="w-full py-2 text-xs tracking-widest transition-colors hover:opacity-80"
            style={{
              background: 'transparent',
              border: '1px solid #f59e0b',
              color: '#f59e0b',
              fontFamily: 'Courier New, monospace',
              letterSpacing: '2px',
            }}
          >
            DEBRIEF-MODUS
          </button>
        ) : (
          <button
            onClick={onExitDebrief}
            className="w-full py-2 text-xs tracking-widest transition-colors hover:opacity-80"
            style={{
              background: '#f59e0b',
              border: 'none',
              color: '#0a0e1a',
              fontFamily: 'Courier New, monospace',
              letterSpacing: '2px',
            }}
          >
            AVSLUTT DEBRIEF
          </button>
        )}
      </div>

      {debriefMode && (
        <div
          className="text-xs mt-2 leading-relaxed"
          style={{ color: '#9ca3af', letterSpacing: '1px' }}
        >
          DEBRIEF-MODUS AKTIV
          <br />
          Kartet viser brannutvikling fargekodet etter tidspunkt.
          <br />
          BLÅ = tidlig antent · RØD = sent antent
        </div>
      )}
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex justify-between items-center py-2"
      style={{ borderBottom: '1px solid #1f2937' }}
    >
      <span style={{ color: '#6b7280', fontSize: '10px', letterSpacing: '1px' }}>{label}</span>
      <span style={{ color: '#f3f4f6', fontSize: '13px', fontWeight: 'bold' }}>{value}</span>
    </div>
  )
}
