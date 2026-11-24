import { useEffect, useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { MangaBook } from '../types/manga'
import { getBookTextures, getHaloTexture, getPageEdgesTexture } from '../utils/bookTextures'
import type { BookTransitionState } from '../utils/transitionMath'

export type AnchorGetter = (target: THREE.Vector3) => THREE.Vector3

export type BookHandle = {
  book: MangaBook
  position: [number, number, number]
  dimensions: [number, number, number]
  getLivePose: () => { position: THREE.Vector3; quaternion: THREE.Quaternion }
  resetRest: () => void
}

type BookProps = {
  book: MangaBook
  position: [number, number, number]
  dimensions: [number, number, number]
  interactive: boolean
  keyboardFocused: boolean
  activeDragId: string | null
  filterDimmed?: boolean
  transitionRef: React.MutableRefObject<BookTransitionState>
  registerHandle: (id: string, handle: BookHandle | null) => void
  onDragStart: (id: string) => void
  onDragMoved: (id: string) => void
  onDragEnd: (id: string) => void
  onHoverEnter: (book: MangaBook, getAnchor: AnchorGetter) => void
  onHoverLeave: (id: string) => void
  onSelect: (book: MangaBook) => void
}

const DRAG_THRESHOLD_PX = 6
const HOVER_PULL_Z = 0.2
const SPIN_PULL_Z = 0.31
const HOVER_PEEK_YAW = -0.6
const MAX_TILT_X = 0.55

const _fullWhite = new THREE.Color('#ffffff')
const _dimTint = new THREE.Color('#69605a')
const _tmpColor = new THREE.Color()
const _euler = new THREE.Euler(0, 0, 0, 'YXZ')
const _tmpPos = new THREE.Vector3()

export default function Book({
  book,
  position,
  dimensions,
  interactive,
  keyboardFocused,
  activeDragId,
  filterDimmed = false,
  transitionRef,
  registerHandle,
  onDragStart,
  onDragMoved,
  onDragEnd,
  onHoverEnter,
  onHoverLeave,
  onSelect,
}: BookProps) {
  const [thickness, height, depth] = dimensions
  const groupRef = useRef<THREE.Group>(null)
  const haloMatRef = useRef<THREE.SpriteMaterial>(null)

  const hoveredRef = useRef(false)
  const isDraggingRef = useRef(false)
  const hasSpunRef = useRef(false)
  const rotYRef = useRef(0)
  const rotXRef = useRef(0)
  const velYRef = useRef(0)
  const velXRef = useRef(0)
  const glowRef = useRef(0)
  const dragCleanupRef = useRef<(() => void) | null>(null)

  const textures = useMemo(() => getBookTextures(book), [book])
  const pageTexture = useMemo(() => getPageEdgesTexture(), [])
  const haloTexture = useMemo(() => getHaloTexture(), [])

  const materials = useMemo(() => {
    const coverProps = {
      roughness: 0.55,
      metalness: 0.04,
      emissive: new THREE.Color('#ffd38c'),
      emissiveIntensity: 0,
    }
    const pageProps = {
      map: pageTexture,
      roughness: 0.85,
      metalness: 0,
      emissive: new THREE.Color('#ffe0ab'),
      emissiveIntensity: 0,
    }
    return [
      new THREE.MeshStandardMaterial({ map: textures.front, ...coverProps }),
      new THREE.MeshStandardMaterial({ map: textures.back, ...coverProps }),
      new THREE.MeshStandardMaterial(pageProps),
      new THREE.MeshStandardMaterial(pageProps),
      new THREE.MeshStandardMaterial({ map: textures.spine, ...coverProps }),
      new THREE.MeshStandardMaterial(pageProps),
    ]
  }, [textures, pageTexture])

  const getAnchor: AnchorGetter = useMemo(() => {
    const localTop = new THREE.Vector3(0, height / 2 + 0.05, 0)
    return (out: THREE.Vector3) => {
      out.copy(localTop)
      if (groupRef.current) {
        groupRef.current.updateWorldMatrix(true, false)
        out.applyMatrix4(groupRef.current.matrixWorld)
      }
      return out
    }
  }, [height])

  useEffect(() => {
    const handle: BookHandle = {
      book,
      position,
      dimensions,
      getLivePose: () => {
        const g = groupRef.current
        if (!g) {
          return {
            position: new THREE.Vector3(...position),
            quaternion: new THREE.Quaternion(),
          }
        }
        return {
          position: g.position.clone(),
          quaternion: g.quaternion.clone(),
        }
      },
      resetRest: () => {
        hoveredRef.current = false
        isDraggingRef.current = false
        hasSpunRef.current = false
        rotYRef.current = 0
        rotXRef.current = 0
        velYRef.current = 0
        velXRef.current = 0
        glowRef.current = 0
        if (groupRef.current) {
          groupRef.current.visible = true
          groupRef.current.position.set(position[0], position[1], position[2])
          groupRef.current.quaternion.identity()
          groupRef.current.scale.setScalar(1)
        }
      },
    }
    registerHandle(book.id, handle)
    return () => registerHandle(book.id, null)
  }, [book, position, dimensions, registerHandle])

  useEffect(() => {
    if (keyboardFocused && interactive) {
      onHoverEnter(book, getAnchor)
    } else if (!keyboardFocused && !hoveredRef.current) {
      onHoverLeave(book.id)
    }
  }, [keyboardFocused, interactive, book, getAnchor, onHoverEnter, onHoverLeave])

  useEffect(() => {
    if (!interactive) {
      dragCleanupRef.current?.()
      isDraggingRef.current = false
      hoveredRef.current = false
      onHoverLeave(book.id)
    }
  }, [interactive, book.id, onHoverLeave])

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.()
      materials.forEach((m) => m.dispose())
    }
  }, [materials])

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (!interactive) return
    if (activeDragId !== null && activeDragId !== book.id) return
    hoveredRef.current = true
    if (!isDraggingRef.current) {
      document.body.style.cursor = 'pointer'
      onHoverEnter(book, getAnchor)
    }
  }

  const handlePointerOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    hoveredRef.current = false
    if (!isDraggingRef.current && !keyboardFocused) {
      onHoverLeave(book.id)
    }
  }

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (!interactive) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (activeDragId !== null && activeDragId !== book.id) return

    dragCleanupRef.current?.()

    const pointerId = e.pointerId
    const startX = e.clientX
    const startY = e.clientY
    let lastX = startX
    let lastY = startY
    let lastTime = performance.now()
    let totalDist = 0
    let hasDragged = false

    isDraggingRef.current = true
    hoveredRef.current = true
    velYRef.current = 0
    velXRef.current = 0
    onDragStart(book.id)

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      const now = performance.now()
      const dx = ev.clientX - lastX
      const dy = ev.clientY - lastY
      totalDist += Math.hypot(dx, dy)
      const straightDist = Math.hypot(ev.clientX - startX, ev.clientY - startY)

      if (!hasDragged && (totalDist > DRAG_THRESHOLD_PX || straightDist > DRAG_THRESHOLD_PX)) {
        hasDragged = true
        hasSpunRef.current = true
        document.body.style.cursor = 'grabbing'
        onDragMoved(book.id)
      }

      if (hasDragged) {
        rotYRef.current += dx * 0.012
        rotXRef.current = THREE.MathUtils.clamp(rotXRef.current + dy * 0.007, -MAX_TILT_X, MAX_TILT_X)

        const dt = Math.max((now - lastTime) / 1000, 0.008)
        const instVelY = THREE.MathUtils.clamp((dx * 0.012) / dt, -18, 18)
        const instVelX = THREE.MathUtils.clamp((dy * 0.007) / dt, -8, 8)
        velYRef.current = THREE.MathUtils.lerp(velYRef.current, instVelY, 0.5)
        velXRef.current = THREE.MathUtils.lerp(velXRef.current, instVelX, 0.5)
      }

      lastX = ev.clientX
      lastY = ev.clientY
      lastTime = now
    }

    const cleanup = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onEnd)
      window.removeEventListener('pointercancel', onEnd)
      dragCleanupRef.current = null
    }

    const onEnd = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      cleanup()
      isDraggingRef.current = false
      onDragEnd(book.id)

      if (ev.type === 'pointerup' && !hasDragged) {
        document.body.style.cursor = 'auto'
        hoveredRef.current = false
        onHoverLeave(book.id)
        onSelect(book)
        return
      }

      if (performance.now() - lastTime > 85) {
        velYRef.current = 0
        velXRef.current = 0
      }

      if (hoveredRef.current) {
        document.body.style.cursor = 'pointer'
        onHoverEnter(book, getAnchor)
      } else {
        document.body.style.cursor = 'auto'
        onHoverLeave(book.id)
      }
    }

    dragCleanupRef.current = cleanup
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onEnd)
    window.addEventListener('pointercancel', onEnd)
  }

  useFrame((_, delta) => {
    const group = groupRef.current
    if (!group) return
    const dt = Math.min(delta, 0.05)
    const tState = transitionRef.current

    // GSAP-driven transition pose for the selected book
    if (tState.activeBookId === book.id && tState.mode !== 'idle') {
      if (tState.relayToTarget) {
        group.visible = false
        return
      }
      group.visible = true

      if (tState.mode === 'reduced') {
        group.position.set(position[0], position[1], position[2])
        group.quaternion.identity()
        group.scale.setScalar(1)
      } else if (tState.pathProgress <= 0) {
        group.position.lerpVectors(tState.startPos, tState.selectPos, tState.selectProgress)
        group.quaternion.slerpQuaternions(tState.startQuat, tState.selectQuat, tState.selectProgress)
        group.scale.setScalar(1)
      } else {
        const u = tState.pathProgress
        const om = 1 - u
        // Quadratic Bezier curve from selectPos -> midPos -> targetPos
        _tmpPos
          .set(0, 0, 0)
          .addScaledVector(tState.selectPos, om * om)
          .addScaledVector(tState.midPos, 2 * om * u)
          .addScaledVector(tState.targetPos, u * u)

        _tmpPos.y += tState.bounceOffset * 0.025
        group.position.copy(_tmpPos)
        group.quaternion.slerpQuaternions(tState.selectQuat, tState.targetQuat, u)
        const baseScale = THREE.MathUtils.lerp(1, tState.targetScale, u)
        group.scale.setScalar(baseScale * (1 + tState.bounceOffset * 0.045))
      }

      for (let i = 0; i < materials.length; i++) {
        materials[i].color.copy(_fullWhite)
        materials[i].emissiveIntensity = i === 0 || i === 1 || i === 4 ? 0.08 : 0.03
      }
      if (haloMatRef.current) {
        haloMatRef.current.opacity = (1 - tState.pathProgress) * 0.35
      }
      return
    }

    // Normal or dimmed shelf state for all other books
    group.visible = true
    group.scale.setScalar(1)

    // Filter dimming: books that don't match the active format filter fade out
    const filterDimTarget = filterDimmed ? 0.78 : 0
    const combinedDim = Math.max(tState.dimAmount, filterDimTarget)
    _tmpColor.copy(_fullWhite).lerp(_dimTint, combinedDim)
    for (let i = 0; i < materials.length; i++) {
      materials[i].color.copy(_tmpColor)
      materials[i].opacity = filterDimmed ? 0.35 : 1
      materials[i].transparent = filterDimmed
    }

    const otherDragging = activeDragId !== null && activeDragId !== book.id
    const effectivelyHovered =
      interactive && (hoveredRef.current || keyboardFocused) && !otherDragging
    const isSpinning = Math.abs(velYRef.current) > 0.03 || Math.abs(velXRef.current) > 0.03

    if (!isDraggingRef.current) {
      if (hasSpunRef.current) {
        rotYRef.current += velYRef.current * dt
        rotXRef.current = THREE.MathUtils.clamp(rotXRef.current + velXRef.current * dt, -MAX_TILT_X, MAX_TILT_X)
        velYRef.current *= Math.exp(-3.0 * dt)
        velXRef.current *= Math.exp(-4.2 * dt)

        if (!effectivelyHovered && !isSpinning) {
          rotYRef.current = Math.atan2(Math.sin(rotYRef.current), Math.cos(rotYRef.current))
          velYRef.current = 0
          velXRef.current = 0
          hasSpunRef.current = false
        }
      } else {
        const targetYaw = effectivelyHovered ? HOVER_PEEK_YAW : 0
        rotYRef.current = THREE.MathUtils.damp(rotYRef.current, targetYaw, 8, dt)
        rotXRef.current = THREE.MathUtils.damp(rotXRef.current, 0, 8, dt)
      }
    }

    let targetPullZ = 0
    if (
      isDraggingRef.current ||
      (hasSpunRef.current && (isSpinning || effectivelyHovered))
    ) {
      targetPullZ = SPIN_PULL_Z
    } else if (effectivelyHovered) {
      targetPullZ = HOVER_PULL_Z
    }

    group.position.x = position[0]
    group.position.y = position[1]
    group.position.z = THREE.MathUtils.damp(group.position.z, position[2] + targetPullZ, 9, dt)
    _euler.set(rotXRef.current, rotYRef.current, 0, 'YXZ')
    group.quaternion.setFromEuler(_euler)

    const targetGlow = interactive && (isDraggingRef.current || effectivelyHovered) ? 1 : 0
    glowRef.current = THREE.MathUtils.damp(glowRef.current, targetGlow, 10, dt)

    const emissiveStrength = glowRef.current * 0.16
    for (let i = 0; i < materials.length; i++) {
      materials[i].emissiveIntensity =
        i === 0 || i === 1 || i === 4 ? emissiveStrength : emissiveStrength * 0.45
    }
    if (haloMatRef.current) {
      haloMatRef.current.opacity = glowRef.current * 0.44
    }
  })

  return (
    <group ref={groupRef} position={position}>
      <mesh
        castShadow
        receiveShadow
        material={materials}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onPointerDown={handlePointerDown}
      >
        <boxGeometry args={[thickness, height, depth]} />
      </mesh>

      <sprite
        position={[0, 0, -depth * 0.1]}
        scale={[depth * 1.95, height * 1.48, 1]}
        renderOrder={1}
        raycast={() => null}
      >
        <spriteMaterial
          ref={haloMatRef}
          map={haloTexture}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </sprite>
    </group>
  )
}
