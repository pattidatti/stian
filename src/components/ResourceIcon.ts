import type { Resource } from '../types'

export function drawResourceIcon(
  ctx: CanvasRenderingContext2D,
  resource: Resource,
  x: number,
  y: number,
  pulse: number,
): void {
  switch (resource.type) {
    case 'helicopter':
      drawHelicopter(ctx, x, y, resource, pulse)
      break
    case 'crew':
      drawCrew(ctx, x, y, resource, pulse)
      break
    case 'truck':
      drawTruck(ctx, x, y, resource, pulse)
      break
  }
}

function drawHelicopter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: Resource,
  pulse: number,
): void {
  const empty = (r.tankLevel ?? 100) <= 0
  const atFire = r.status === 'suppressing'
  const alpha = 0.6 + pulse * 0.4

  ctx.save()

  // Outer circle
  ctx.beginPath()
  ctx.arc(x, y, 13, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(17,24,39,0.9)'
  ctx.fill()
  ctx.strokeStyle = atFire
    ? `rgba(239,68,68,${alpha})`
    : empty
      ? `rgba(245,158,11,${alpha})`
      : '#10b981'
  ctx.lineWidth = 2
  ctx.stroke()

  // Rotor lines (3 blades)
  for (let i = 0; i < 3; i++) {
    const angle = (i * Math.PI) / 3
    ctx.beginPath()
    ctx.moveTo(x + Math.cos(angle) * 15, y + Math.sin(angle) * 15)
    ctx.lineTo(x - Math.cos(angle) * 15, y - Math.sin(angle) * 15)
    ctx.strokeStyle = 'rgba(243,244,246,0.7)'
    ctx.lineWidth = 1
    ctx.stroke()
  }

  // Center dot
  ctx.beginPath()
  ctx.arc(x, y, 3, 0, Math.PI * 2)
  ctx.fillStyle = '#10b981'
  ctx.fill()

  ctx.restore()
}

function drawCrew(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: Resource,
  pulse: number,
): void {
  const atFire = r.status === 'suppressing'
  const alpha = 0.6 + pulse * 0.4

  ctx.save()

  // Square (NATO infantry symbol)
  ctx.beginPath()
  ctx.rect(x - 11, y - 11, 22, 22)
  ctx.fillStyle = 'rgba(17,24,39,0.9)'
  ctx.fill()
  ctx.strokeStyle = atFire ? `rgba(239,68,68,${alpha})` : '#10b981'
  ctx.lineWidth = 2
  ctx.stroke()

  // Cross
  ctx.beginPath()
  ctx.moveTo(x, y - 8)
  ctx.lineTo(x, y + 8)
  ctx.moveTo(x - 8, y)
  ctx.lineTo(x + 8, y)
  ctx.strokeStyle = 'rgba(243,244,246,0.8)'
  ctx.lineWidth = 1.5
  ctx.stroke()

  ctx.restore()
}

function drawTruck(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: Resource,
  pulse: number,
): void {
  const empty = (r.truckLevel ?? r.truckCapacity ?? 5000) <= 0
  const alpha = 0.6 + pulse * 0.4

  ctx.save()

  // Rectangle
  ctx.beginPath()
  ctx.rect(x - 14, y - 9, 28, 18)
  ctx.fillStyle = 'rgba(17,24,39,0.9)'
  ctx.fill()
  ctx.strokeStyle = empty ? `rgba(245,158,11,${alpha})` : '#10b981'
  ctx.lineWidth = 2
  ctx.stroke()

  // Direction arrow (right-pointing)
  ctx.beginPath()
  ctx.moveTo(x - 5, y)
  ctx.lineTo(x + 5, y)
  ctx.moveTo(x + 2, y - 4)
  ctx.lineTo(x + 6, y)
  ctx.lineTo(x + 2, y + 4)
  ctx.strokeStyle = 'rgba(243,244,246,0.8)'
  ctx.lineWidth = 1.5
  ctx.stroke()

  ctx.restore()
}
