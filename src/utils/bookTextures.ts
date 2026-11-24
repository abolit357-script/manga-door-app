import * as THREE from 'three'
import type { MangaBook } from '../types/manga'

const DISPLAY_FONT = "'Shippori Mincho', 'Hiragino Mincho ProN', Georgia, serif"
const BODY_FONT = "'Segoe UI', system-ui, -apple-system, sans-serif"

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const num = parseInt(clean, 16)
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

function mixHex(hexA: string, hexB: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(hexA)
  const [r2, g2, b2] = hexToRgb(hexB)
  const r = Math.round(r1 + (r2 - r1) * t)
  const g = Math.round(g1 + (g2 - g1) * t)
  const b = Math.round(b1 + (b2 - b1) * t)
  return `rgb(${r}, ${g}, ${b})`
}

function getLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

function getAccentColor(spineHex: string): string {
  return getLuminance(spineHex) > 0.5 ? '#1b263b' : '#f2b35e'
}

function shortLabel(text: string): string {
  const parenIdx = text.indexOf(' (')
  if (text.length > 26 && parenIdx > 0) {
    return text.slice(0, parenIdx).trim()
  }
  return text
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 4,
): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate
    } else {
      if (current) lines.push(current)
      current = word
      if (lines.length === maxLines - 1) break
    }
  }
  if (current && lines.length < maxLines) {
    lines.push(current)
  }
  return lines
}

function formatCode(format: string): string {
  const lower = format.toLowerCase()
  if (lower.includes('light')) return 'LN'
  if (lower.includes('visuel')) return 'VN'
  return 'MG'
}

function createSpineTexture(book: MangaBook): THREE.CanvasTexture {
  const w = 160
  const h = 768
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = book.couleurDos
  ctx.fillRect(0, 0, w, h)

  // Subtle horizontal cloth/paper grain
  ctx.fillStyle = 'rgba(255,255,255,0.035)'
  for (let y = 0; y < h; y += 6) {
    if (y % 12 === 0) ctx.fillRect(0, y, w, 2)
  }

  // Spine edge rounding shadow
  const sideShadow = ctx.createLinearGradient(0, 0, w, 0)
  sideShadow.addColorStop(0, 'rgba(0,0,0,0.34)')
  sideShadow.addColorStop(0.14, 'rgba(255,255,255,0.08)')
  sideShadow.addColorStop(0.5, 'rgba(255,255,255,0)')
  sideShadow.addColorStop(0.86, 'rgba(0,0,0,0.08)')
  sideShadow.addColorStop(1, 'rgba(0,0,0,0.38)')
  ctx.fillStyle = sideShadow
  ctx.fillRect(0, 0, w, h)

  const lightSpine = getLuminance(book.couleurDos) > 0.52
  const ink = lightSpine ? '#141824' : '#f7f1e3'
  const accent = getAccentColor(book.couleurDos)

  // Top accent bar & volume/format badge
  ctx.fillStyle = accent
  ctx.fillRect(14, 24, w - 28, 7)

  ctx.beginPath()
  ctx.arc(w / 2, 76, 28, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = getLuminance(accent) > 0.5 ? '#18141c' : '#faf6ee'
  ctx.font = `700 20px ${BODY_FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(book.tomes > 1 ? String(book.tomes).padStart(2, '0') : formatCode(book.format), w / 2, 77)

  // Title rotated along spine
  const spineTitle = shortLabel(book.titre)
  ctx.save()
  ctx.translate(w / 2, h * 0.5)
  ctx.rotate(-Math.PI / 2)
  ctx.fillStyle = ink
  let fontSize = 28
  ctx.font = `700 ${fontSize}px ${DISPLAY_FONT}`
  while (ctx.measureText(spineTitle).width > 420 && fontSize > 16) {
    fontSize -= 2
    ctx.font = `700 ${fontSize}px ${DISPLAY_FONT}`
  }
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(spineTitle, 0, 2)
  ctx.restore()

  // Bottom author & publisher colophon
  ctx.fillStyle = accent
  ctx.fillRect(28, h - 122, w - 56, 3)

  ctx.fillStyle = ink
  ctx.globalAlpha = 0.88
  ctx.font = `600 16px ${BODY_FONT}`
  const cleanAuthor = shortLabel(book.auteur)
  const authorShort = cleanAuthor.split(' ').slice(-1)[0]
  ctx.fillText(authorShort, w / 2, h - 94)

  ctx.globalAlpha = 0.92
  ctx.strokeStyle = accent
  ctx.lineWidth = 2.5
  ctx.strokeRect(w / 2 - 24, h - 66, 48, 34)
  ctx.fillStyle = accent
  ctx.font = `700 15px ${BODY_FONT}`
  ctx.fillText(formatCode(book.format), w / 2, h - 49)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

function createBackCoverTexture(book: MangaBook): THREE.CanvasTexture {
  const w = 512
  const h = 768
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  const bg = mixHex(book.couleurDos, '#0d0c14', 0.58)
  const accent = '#f2b35e'
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  ctx.strokeStyle = accent
  ctx.globalAlpha = 0.42
  ctx.lineWidth = 2
  ctx.strokeRect(24, 24, w - 48, h - 48)
  ctx.globalAlpha = 1

  // Title header
  ctx.fillStyle = '#f7f1e3'
  ctx.font = `700 26px ${DISPLAY_FONT}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  const headLines = wrapLines(ctx, shortLabel(book.titre), w - 88, 2)
  headLines.forEach((l, i) => ctx.fillText(l, 44, 52 + i * 34))

  ctx.fillStyle = accent
  ctx.font = `600 15px ${BODY_FONT}`
  ctx.fillText(
    `${shortLabel(book.auteur)} · ${book.format} · ${book.annee}`,
    44,
    headLines.length > 1 ? 128 : 96,
  )

  const dividerY = headLines.length > 1 ? 162 : 132
  ctx.fillRect(44, dividerY, 64, 3)

  // Synopsis block
  ctx.fillStyle = '#e6dfd0'
  ctx.font = `400 19px ${BODY_FONT}`
  const synLines = wrapLines(ctx, book.synopsis, w - 88, 10)
  synLines.forEach((l, i) => ctx.fillText(l, 44, dividerY + 26 + i * 31))

  // Genre tags
  let gx = 44
  const gy = h - 182
  ctx.font = `600 14px ${BODY_FONT}`
  for (const genre of book.genres) {
    const tw = ctx.measureText(genre).width + 24
    if (gx + tw > w - 44) break
    ctx.strokeStyle = accent
    ctx.lineWidth = 1.5
    ctx.strokeRect(gx, gy, tw, 30)
    ctx.fillStyle = accent
    ctx.fillText(genre, gx + 12, gy + 6)
    gx += tw + 10
  }

  // Stylized ISBN barcode block
  ctx.fillStyle = '#f5efe2'
  ctx.fillRect(44, h - 118, 160, 68)
  ctx.fillStyle = '#18141c'
  for (let i = 0; i < 30; i++) {
    const bw = i % 3 === 0 ? 4 : i % 2 === 0 ? 2 : 1.5
    ctx.fillRect(54 + i * 4.8, h - 110, bw, 44)
  }
  ctx.font = `600 11px ${BODY_FONT}`
  ctx.fillText(`978-4-${book.annee}-${String(book.tomes).padStart(2, '0')}`, 54, h - 62)

  // Right hinge crease (adjacent to spine)
  const hinge = ctx.createLinearGradient(w - 18, 0, w, 0)
  hinge.addColorStop(0, 'rgba(0,0,0,0)')
  hinge.addColorStop(1, 'rgba(0,0,0,0.45)')
  ctx.fillStyle = hinge
  ctx.fillRect(w - 18, 0, 18, h)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

const textureLoader = new THREE.TextureLoader()

function loadFrontCoverTexture(book: MangaBook): THREE.Texture {
  const tex = textureLoader.load(book.couverture, (loaded) => {
    loaded.needsUpdate = true
  })
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

export function preloadBookCovers(books: MangaBook[]) {
  for (const book of books) {
    getBookTextures(book)
  }
}

export type BookTextureSet = {
  front: THREE.Texture
  back: THREE.CanvasTexture
  spine: THREE.CanvasTexture
}

const bookTextureCache = new Map<string, BookTextureSet>()
let sharedPageTexture: THREE.CanvasTexture | null = null
let sharedWoodTexture: THREE.CanvasTexture | null = null
let sharedDarkWoodTexture: THREE.CanvasTexture | null = null
let sharedDustTexture: THREE.CanvasTexture | null = null
let sharedHaloTexture: THREE.CanvasTexture | null = null

export function getBookTextures(book: MangaBook): BookTextureSet {
  const cached = bookTextureCache.get(book.id)
  if (cached) return cached
  const set: BookTextureSet = {
    front: loadFrontCoverTexture(book),
    back: createBackCoverTexture(book),
    spine: createSpineTexture(book),
  }
  bookTextureCache.set(book.id, set)
  return set
}

export function getPageEdgesTexture(): THREE.CanvasTexture {
  if (sharedPageTexture) return sharedPageTexture
  const w = 128
  const h = 512
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#e7ddc7'
  ctx.fillRect(0, 0, w, h)

  for (let x = 4; x < w - 4; x += 3) {
    ctx.fillStyle = x % 6 === 0 ? 'rgba(90, 70, 45, 0.14)' : 'rgba(255, 252, 244, 0.25)'
    ctx.fillRect(x, 0, 1.5, h)
  }

  ctx.fillStyle = 'rgba(28, 18, 12, 0.22)'
  ctx.fillRect(0, 0, 6, h)
  ctx.fillRect(w - 6, 0, 6, h)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  sharedPageTexture = tex
  return tex
}

function makeWoodTexture(base: string, grain: string, repeatX = 2, repeatY = 1): THREE.CanvasTexture {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = base
  ctx.fillRect(0, 0, size, size)

  ctx.strokeStyle = grain
  for (let i = 0; i < 95; i++) {
    const y = (i / 95) * size
    ctx.globalAlpha = 0.08 + (i % 5) * 0.035
    ctx.lineWidth = 1 + (i % 3)
    ctx.beginPath()
    ctx.moveTo(0, y)
    const amp = 4 + (i % 7)
    ctx.bezierCurveTo(size * 0.33, y + amp, size * 0.66, y - amp, size, y)
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeatX, repeatY)
  tex.anisotropy = 4
  return tex
}

export function getWoodTexture(): THREE.CanvasTexture {
  if (!sharedWoodTexture) {
    sharedWoodTexture = makeWoodTexture('#6b442b', '#3a2112', 2, 1)
  }
  return sharedWoodTexture
}

export function getDarkWoodTexture(): THREE.CanvasTexture {
  if (!sharedDarkWoodTexture) {
    sharedDarkWoodTexture = makeWoodTexture('#3b2519', '#1e110a', 3, 3)
  }
  return sharedDarkWoodTexture
}

export function getDustTexture(): THREE.CanvasTexture {
  if (sharedDustTexture) return sharedDustTexture
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, 'rgba(255, 244, 214, 1)')
  grad.addColorStop(0.35, 'rgba(255, 218, 150, 0.65)')
  grad.addColorStop(1, 'rgba(255, 218, 150, 0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)

  const tex = new THREE.CanvasTexture(canvas)
  sharedDustTexture = tex
  return tex
}

export function getHaloTexture(): THREE.CanvasTexture {
  if (sharedHaloTexture) return sharedHaloTexture
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  const grad = ctx.createRadialGradient(size / 2, size / 2, 12, size / 2, size / 2, size / 2)
  grad.addColorStop(0, 'rgba(255, 226, 168, 0.9)')
  grad.addColorStop(0.45, 'rgba(242, 179, 94, 0.38)')
  grad.addColorStop(1, 'rgba(242, 179, 94, 0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  sharedHaloTexture = tex
  return tex
}
