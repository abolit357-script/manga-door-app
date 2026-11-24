import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { MangaBook } from '../types/manga'
import { getBookTextures, getPageEdgesTexture } from '../utils/bookTextures'
import {
  computeTargetBookPose,
  type BookTransitionState,
} from '../utils/transitionMath'

export type TargetBookHandle = {
  getLivePose: () => {
    position: THREE.Vector3
    quaternion: THREE.Quaternion
    scale: number
  }
}

type Scene3TargetBookProps = {
  book: MangaBook | null
  dimensions: [number, number, number] | null
  slotRef: React.RefObject<HTMLDivElement>
  transitionRef: React.MutableRefObject<BookTransitionState>
  isInteractiveDetail: boolean
  reducedMotion: boolean
  registerTargetHandle: (handle: TargetBookHandle | null) => void
}

const _tiltEuler = new THREE.Euler(0, 0, 0, 'YXZ')
const _tiltQuat = new THREE.Quaternion()

export default function Scene3TargetBook({
  book,
  dimensions,
  slotRef,
  transitionRef,
  isInteractiveDetail,
  reducedMotion,
  registerTargetHandle,
}: Scene3TargetBookProps) {
  const groupRef = useRef<THREE.Group>(null)
  const floatBlendRef = useRef(0)
  const mouseYawRef = useRef(0)
  const mousePitchRef = useRef(0)
  const { camera, pointer, size } = useThree()

  const textures = useMemo(() => (book ? getBookTextures(book) : null), [book])
  const pageTexture = useMemo(() => getPageEdgesTexture(), [])

  const materials = useMemo(() => {
    if (!textures) return null
    const coverProps = {
      roughness: 0.5,
      metalness: 0.04,
      emissive: new THREE.Color('#ffd38c'),
      emissiveIntensity: 0.05,
    }
    const pageProps = {
      map: pageTexture,
      roughness: 0.85,
      metalness: 0,
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

  useEffect(() => {
    return () => {
      materials?.forEach((m) => m.dispose())
    }
  }, [materials])

  useEffect(() => {
    registerTargetHandle({
      getLivePose: () => {
        const g = groupRef.current
        if (!g) {
          return {
            position: transitionRef.current.targetPos.clone(),
            quaternion: transitionRef.current.targetQuat.clone(),
            scale: transitionRef.current.targetScale,
          }
        }
        return {
          position: g.position.clone(),
          quaternion: g.quaternion.clone(),
          scale: g.scale.x,
        }
      },
    })
    return () => registerTargetHandle(null)
  }, [registerTargetHandle, transitionRef])

  useFrame((state, delta) => {
    const group = groupRef.current
    if (!group || !book || !dimensions) return
    const tState = transitionRef.current

    if (!tState.relayToTarget) {
      group.visible = false
      floatBlendRef.current = 0
      mouseYawRef.current = 0
      mousePitchRef.current = 0
      return
    }

    group.visible = true
    const dt = Math.min(delta, 0.05)

    // Keep pose locked to DOM slot if viewport resizes while in Scene 3
    let basePos = tState.targetPos
    let baseQuat = tState.targetQuat
    let baseScale = tState.targetScale

    const slotEl = slotRef.current
    if (isInteractiveDetail && slotEl) {
      const rect = slotEl.getBoundingClientRect()
      if (rect.height > 20) {
        const fov = (camera as THREE.PerspectiveCamera).fov || 50
        const computed = computeTargetBookPose(
          rect,
          size.width,
          size.height,
          0,
          tState.camEndPos,
          tState.camEndLook,
          fov,
          dimensions[1],
        )
        basePos = computed.position
        baseQuat = computed.quaternion
        baseScale = computed.scale
        tState.targetPos.copy(basePos)
        tState.targetQuat.copy(baseQuat)
        tState.targetScale = baseScale
      }
    }

    const canAnimate = isInteractiveDetail && !reducedMotion
    floatBlendRef.current = THREE.MathUtils.damp(
      floatBlendRef.current,
      canAnimate ? 1 : 0,
      6,
      dt,
    )

    const targetYaw = canAnimate ? pointer.x * 0.18 : 0
    const targetPitch = canAnimate ? -pointer.y * 0.1 : 0
    mouseYawRef.current = THREE.MathUtils.damp(mouseYawRef.current, targetYaw, 5, dt)
    mousePitchRef.current = THREE.MathUtils.damp(mousePitchRef.current, targetPitch, 5, dt)

    const floatY =
      Math.sin(state.clock.elapsedTime * 1.45) * 0.014 * floatBlendRef.current

    group.position.copy(basePos)
    group.position.x += tState.swapOffsetX
    group.position.y += floatY
    group.scale.setScalar(baseScale)

    _tiltEuler.set(mousePitchRef.current, mouseYawRef.current + tState.swapYaw, 0, 'YXZ')
    _tiltQuat.setFromEuler(_tiltEuler)
    group.quaternion.copy(baseQuat).multiply(_tiltQuat)
  })

  if (!book || !dimensions || !materials) return null

  return (
    <group ref={groupRef} visible={false}>
      <mesh castShadow receiveShadow frustumCulled={false} material={materials}>
        <boxGeometry args={dimensions} />
      </mesh>
    </group>
  )
}
