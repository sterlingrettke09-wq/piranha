import { useEffect, useRef } from 'react'

interface Fish {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
}

const PALETTE = ['#7a2630', '#9a2f3a', '#b0454e']

function drawFish(ctx: CanvasRenderingContext2D, f: Fish) {
  const ang = Math.atan2(f.vy, f.vx)
  const s = f.size
  ctx.save()
  ctx.translate(f.x, f.y)
  ctx.rotate(ang)
  ctx.fillStyle = f.color
  ctx.beginPath()
  ctx.ellipse(0, 0, s, s * 0.5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(-s * 0.85, 0)
  ctx.lineTo(-s * 1.7, -s * 0.55)
  ctx.lineTo(-s * 1.7, s * 0.55)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(s * 0.15, -s * 0.45)
  ctx.lineTo(-s * 0.45, -s * 0.95)
  ctx.lineTo(-s * 0.6, -s * 0.4)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = 'rgba(18,11,9,0.9)'
  ctx.beginPath()
  ctx.arc(s * 0.55, -s * 0.12, s * 0.1, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/** A school of piranhas that flock and chase the cursor, on a dark gradient. */
export function FishSchool({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let w = 0
    let h = 0
    const resize = () => {
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const count = Math.max(30, Math.min(80, Math.round((w * h) / 15000)))
    const fish: Fish[] = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      size: 7 + Math.random() * 9,
      color: Math.random() < 0.12 ? '#e8e0d5' : PALETTE[Math.floor(Math.random() * PALETTE.length)],
    }))

    const paintBg = () => {
      const g = ctx.createLinearGradient(0, 0, 0, h)
      g.addColorStop(0, '#16110f')
      g.addColorStop(1, '#2a0d13')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
    }

    // Reduced motion: paint a single static frame, no animation loop.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      paintBg()
      for (const f of fish) drawFish(ctx, f)
      return () => window.removeEventListener('resize', resize)
    }

    const target = { x: w / 2, y: h / 2 }
    let usingPointer = false
    const onMove = (e: PointerEvent) => {
      usingPointer = true
      target.x = e.clientX
      target.y = e.clientY
    }
    window.addEventListener('pointermove', onMove)

    let raf = 0
    let t = 0
    const step = () => {
      t += 0.01
      if (!usingPointer) {
        target.x = w * (0.5 + 0.34 * Math.cos(t * 0.6))
        target.y = h * (0.5 + 0.3 * Math.sin(t * 0.9))
      }
      paintBg()
      for (const f of fish) {
        let ax = 0
        let ay = 0
        let cx = 0
        let cy = 0
        let alx = 0
        let aly = 0
        let k = 0
        for (const o of fish) {
          if (o === f) continue
          const dx = o.x - f.x
          const dy = o.y - f.y
          const d2 = dx * dx + dy * dy
          if (d2 < 1) continue
          if (d2 < 900) {
            ax -= (dx / d2) * 28
            ay -= (dy / d2) * 28
          }
          if (d2 < 14000) {
            cx += o.x
            cy += o.y
            alx += o.vx
            aly += o.vy
            k++
          }
        }
        if (k > 0) {
          ax += (cx / k - f.x) * 0.0008
          ay += (cy / k - f.y) * 0.0008
          ax += (alx / k - f.vx) * 0.05
          ay += (aly / k - f.vy) * 0.05
        }
        const pull = usingPointer ? 0.0016 : 0.0006
        ax += (target.x - f.x) * pull
        ay += (target.y - f.y) * pull
        f.vx += ax
        f.vy += ay
        const sp = Math.hypot(f.vx, f.vy)
        const max = 2.7
        const min = 1.2
        if (sp > max) {
          f.vx = (f.vx / sp) * max
          f.vy = (f.vy / sp) * max
        } else if (sp < min && sp > 0) {
          f.vx = (f.vx / sp) * min
          f.vy = (f.vy / sp) * min
        }
        f.x += f.vx
        f.y += f.vy
        const m = 40
        if (f.x < -m) f.x = w + m
        if (f.x > w + m) f.x = -m
        if (f.y < -m) f.y = h + m
        if (f.y > h + m) f.y = -m
        drawFish(ctx, f)
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onMove)
    }
  }, [])

  return <canvas ref={canvasRef} className={className} />
}
