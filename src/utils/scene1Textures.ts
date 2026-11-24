import * as THREE from 'three'

let cachedPaintColor: THREE.CanvasTexture | null = null
let cachedPaintBump: THREE.CanvasTexture | null = null
let cachedRust: THREE.CanvasTexture | null = null
let cachedConcrete: THREE.CanvasTexture | null = null
let cachedWaterNormal: THREE.CanvasTexture | null = null
let cachedIvy: THREE.CanvasTexture | null = null
let cachedPollen: THREE.CanvasTexture | null = null
let cachedCloudDataUrl: string | null = null

function seededNoise(seed: number) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

export function getWeatheredPaintTextures(): {
  map: THREE.CanvasTexture
  bumpMap: THREE.CanvasTexture
} {
  if (cachedPaintColor && cachedPaintBump) {
    return { map: cachedPaintColor, bumpMap: cachedPaintBump }
  }

  const size = 512
  const colCanvas = document.createElement('canvas')
  colCanvas.width = size
  colCanvas.height = size
  const cctx = colCanvas.getContext('2d')!

  const bumpCanvas = document.createElement('canvas')
  bumpCanvas.width = size
  bumpCanvas.height = size
  const bctx = bumpCanvas.getContext('2d')!

  // Base warm weathered white paint
  const baseGrad = cctx.createLinearGradient(0, 0, 0, size)
  baseGrad.addColorStop(0, '#f2f0ea')
  baseGrad.addColorStop(0.75, '#e8e5dc')
  baseGrad.addColorStop(1, '#cfc8b8')
  cctx.fillStyle = baseGrad
  cctx.fillRect(0, 0, size, size)

  bctx.fillStyle = '#c8c8c8'
  bctx.fillRect(0, 0, size, size)

  const rand = seededNoise(4217)

  // Subtle vertical weathered brush strokes
  for (let i = 0; i < 160; i++) {
    const x = rand() * size
    const y = rand() * size
    const h = 30 + rand() * 140
    cctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.14)' : 'rgba(130,122,108,0.08)'
    cctx.fillRect(x, y, 1 + rand() * 3, h)
  }

  // Peeled paint patches exposing weathered wood and rust (more concentrated near bottom & edges)
  for (let i = 0; i < 65; i++) {
    const isBottom = i < 40
    const px = rand() * size
    const py = isBottom ? size * (0.62 + rand() * 0.36) : rand() * size
    const rx = 5 + rand() * 18
    const ry = 8 + rand() * 28

    // Dark peeling lip in bump map
    bctx.fillStyle = '#525252'
    bctx.beginPath()
    bctx.ellipse(px, py, rx, ry, rand() * Math.PI, 0, Math.PI * 2)
    bctx.fill()

    // Exposed rust/wood tone
    cctx.fillStyle = rand() > 0.45 ? '#8b5739' : '#5b3f2d'
    cctx.beginPath()
    cctx.ellipse(px, py, rx, ry, rand() * Math.PI, 0, Math.PI * 2)
    cctx.fill()

    // Subtle flaking rim around patch
    cctx.strokeStyle = 'rgba(218, 212, 198, 0.7)'
    cctx.lineWidth = 1.5
    cctx.stroke()
  }

  // Water-line mossy dampness right along the bottom edge
  const mossGrad = cctx.createLinearGradient(0, size * 0.88, 0, size)
  mossGrad.addColorStop(0, 'rgba(65, 86, 62, 0)')
  mossGrad.addColorStop(1, 'rgba(54, 72, 52, 0.55)')
  cctx.fillStyle = mossGrad
  cctx.fillRect(0, size * 0.88, size, size * 0.12)

  cachedPaintColor = new THREE.CanvasTexture(colCanvas)
  cachedPaintColor.colorSpace = THREE.SRGBColorSpace
  cachedPaintColor.anisotropy = 4

  cachedPaintBump = new THREE.CanvasTexture(bumpCanvas)
  cachedPaintBump.anisotropy = 4

  return { map: cachedPaintColor, bumpMap: cachedPaintBump }
}

export function getRustTexture(): THREE.CanvasTexture {
  if (cachedRust) return cachedRust
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#73452f'
  ctx.fillRect(0, 0, size, size)

  const rand = seededNoise(991)
  for (let i = 0; i < 240; i++) {
    const x = rand() * size
    const y = rand() * size
    const r = 3 + rand() * 14
    ctx.fillStyle =
      rand() > 0.6
        ? 'rgba(155, 92, 56, 0.25)'
        : rand() > 0.3
          ? 'rgba(72, 40, 26, 0.3)'
          : 'rgba(110, 108, 102, 0.2)'
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  cachedRust = new THREE.CanvasTexture(canvas)
  cachedRust.colorSpace = THREE.SRGBColorSpace
  cachedRust.wrapS = THREE.RepeatWrapping
  cachedRust.wrapT = THREE.RepeatWrapping
  cachedRust.repeat.set(1, 3)
  return cachedRust
}

export function getConcreteRuinTexture(): THREE.CanvasTexture {
  if (cachedConcrete) return cachedConcrete
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  const grad = ctx.createLinearGradient(0, 0, 0, size)
  grad.addColorStop(0, '#858e92')
  grad.addColorStop(0.7, '#687377')
  grad.addColorStop(1, '#43544e')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)

  const rand = seededNoise(773)
  for (let i = 0; i < 180; i++) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(20,28,30,0.08)'
    ctx.fillRect(rand() * size, rand() * size, 8 + rand() * 44, 4 + rand() * 18)
  }

  // Subtle horizontal concrete slab lines
  ctx.strokeStyle = 'rgba(30, 38, 42, 0.18)'
  ctx.lineWidth = 2
  for (let y = 64; y < size; y += 64) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(size, y)
    ctx.stroke()
  }

  cachedConcrete = new THREE.CanvasTexture(canvas)
  cachedConcrete.colorSpace = THREE.SRGBColorSpace
  cachedConcrete.wrapS = THREE.RepeatWrapping
  cachedConcrete.wrapT = THREE.RepeatWrapping
  cachedConcrete.repeat.set(2, 1)
  return cachedConcrete
}

export function getWaterNormalMap(): THREE.CanvasTexture {
  if (cachedWaterNormal) return cachedWaterNormal
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(size, size)
  const d = img.data

  const TAU = Math.PI * 2
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * TAU
      const v = (y / size) * TAU
      // Gentle horizontal-dominant ripples matching shallow wind-brushed water
      const dx =
        Math.cos(u * 3 + v * 2) * 0.08 +
        Math.cos(u * 5 - v * 4) * 0.05
      const dy =
        Math.sin(v * 6 + u * 1) * 0.18 +
        Math.cos(v * 11 - u * 2) * 0.11 +
        Math.sin(v * 17 + u * 3) * 0.06
      const nx = -dx
      const ny = -dy
      const nz = 1
      const inv = 1 / Math.hypot(nx, ny, nz)
      const idx = (y * size + x) * 4
      d[idx] = Math.round((nx * inv * 0.5 + 0.5) * 255)
      d[idx + 1] = Math.round((ny * inv * 0.5 + 0.5) * 255)
      d[idx + 2] = Math.round((nz * inv * 0.5 + 0.5) * 255)
      d[idx + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)

  cachedWaterNormal = new THREE.CanvasTexture(canvas)
  cachedWaterNormal.wrapS = THREE.RepeatWrapping
  cachedWaterNormal.wrapT = THREE.RepeatWrapping
  cachedWaterNormal.repeat.set(10, 10)
  return cachedWaterNormal
}

export function getIvyTexture(): THREE.CanvasTexture {
  if (cachedIvy) return cachedIvy
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, size, size)

  const rand = seededNoise(313)
  // Stems
  ctx.strokeStyle = '#335927'
  ctx.lineWidth = 4
  for (let s = 0; s < 4; s++) {
    ctx.beginPath()
    const sx = 40 + s * 55
    ctx.moveTo(sx, size)
    ctx.bezierCurveTo(sx - 25, size * 0.65, sx + 30, size * 0.35, sx + (rand() - 0.5) * 40, 18)
    ctx.stroke()
  }

  // Ivy leaves cluster
  const greens = ['#2b5a27', '#3f7832', '#57963d', '#76b348']
  for (let i = 0; i < 82; i++) {
    const lx = 26 + rand() * (size - 52)
    const ly = 18 + rand() * (size - 34)
    const leafSize = 11 + rand() * 14
    const rot = rand() * Math.PI * 2
    ctx.save()
    ctx.translate(lx, ly)
    ctx.rotate(rot)
    ctx.fillStyle = greens[Math.floor(rand() * greens.length)]
    ctx.beginPath()
    ctx.moveTo(0, -leafSize)
    ctx.quadraticCurveTo(leafSize * 0.9, -leafSize * 0.2, 0, leafSize * 0.75)
    ctx.quadraticCurveTo(-leafSize * 0.9, -leafSize * 0.2, 0, -leafSize)
    ctx.fill()
    ctx.restore()
  }

  cachedIvy = new THREE.CanvasTexture(canvas)
  cachedIvy.colorSpace = THREE.SRGBColorSpace
  return cachedIvy
}

export function getPollenTexture(): THREE.CanvasTexture {
  if (cachedPollen) return cachedPollen
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, 'rgba(255, 250, 224, 1)')
  grad.addColorStop(0.45, 'rgba(255, 232, 175, 0.65)')
  grad.addColorStop(1, 'rgba(255, 232, 175, 0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)

  cachedPollen = new THREE.CanvasTexture(canvas)
  cachedPollen.colorSpace = THREE.SRGBColorSpace
  return cachedPollen
}

export function getCloudDataUrl(): string {
  if (cachedCloudDataUrl) return cachedCloudDataUrl
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, size, size)

  // Soft anime cumulus puff lobes (pure white -> transparent)
  const puffs: [number, number, number, number][] = [
    [128, 128, 86, 0.9],
    [92, 134, 64, 0.78],
    [164, 136, 62, 0.78],
    [128, 96, 66, 0.85],
    [104, 108, 50, 0.72],
    [152, 110, 48, 0.72],
  ]

  for (const [cx, cy, r, alpha] of puffs) {
    const grad = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r)
    grad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`)
    grad.addColorStop(0.55, `rgba(246, 251, 255, ${alpha * 0.65})`)
    grad.addColorStop(1, 'rgba(235, 246, 255, 0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
  }

  cachedCloudDataUrl = canvas.toDataURL('image/png')
  return cachedCloudDataUrl
}
