import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import gsap from 'gsap'
import type { BloomEffect } from 'postprocessing'
import Scene1Particles from '../components/Scene1Particles'
import Scene1PostProcessing from '../components/Scene1PostProcessing'
import Scene1Ruins from '../components/Scene1Ruins'
import Scene1SkyWater from '../components/Scene1SkyWater'
import { playDoorCreak } from '../utils/creakAudio'
import {
  getIvyTexture,
  getRustTexture,
  getWeatheredPaintTextures,
} from '../utils/scene1Textures'
import { useScene } from '../store'

const DOOR_W = 1.68
const DOOR_H = 3.25
const DOOR_D = 0.12
const OPEN_ANGLE = THREE.MathUtils.degToRad(100)
const CAM_START_Y = 1.25
const CAM_START_Z = 9.2
const CAM_LOOK_Y = 2.15
const CAM_END_Y = 1.7
const CAM_END_Z = 1.0

// 6 raised panels (2 columns x 3 rows) matching the weathered white reference door
const PANELS_6: [number, number][] = [
  [-0.36, 0.92],
  [0.36, 0.92],
  [-0.36, 0.0],
  [0.36, 0.0],
  [-0.36, -0.92],
  [0.36, -0.92],
]

const BASE_RUBBLE: { pos: [number, number, number]; size: [number, number, number]; rot: [number, number, number] }[] = [
  { pos: [-1.05, 0.09, 0.08], size: [0.34, 0.22, 0.28], rot: [0.1, 0.4, 0.12] },
  { pos: [-1.28, 0.06, 0.24], size: [0.24, 0.14, 0.22], rot: [-0.08, 0.9, 0.05] },
  { pos: [-0.94, 0.05, 0.26], size: [0.2, 0.12, 0.18], rot: [0.05, -0.3, 0.08] },
  { pos: [1.02, 0.07, 0.05], size: [0.28, 0.16, 0.24], rot: [-0.06, -0.5, 0.1] },
]

type Scene1DoorProps = {
  isMobile: boolean
  soundEnabled: boolean
  onReady?: () => void
}

export default function Scene1Door({
  isMobile,
  soundEnabled,
  onReady,
}: Scene1DoorProps) {
  const hingeRef = useRef<THREE.Group>(null)
  const portalMatRef = useRef<THREE.MeshBasicMaterial>(null)
  const bloomRef = useRef<BloomEffect>(null)
  const openingTlRef = useRef<gsap.core.Timeline | null>(null)
  const lookAtRef = useRef(new THREE.Vector3(0, CAM_LOOK_Y, 0))
  const soundEnabledRef = useRef(soundEnabled)
  soundEnabledRef.current = soundEnabled

  const reducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  const animRef = useRef({
    doorAngle: 0,
    portalOpacity: 0,
    portalBrightness: 1,
    bloomIntensity: 0.35,
    dollyZ: CAM_START_Z,
    camY: CAM_START_Y,
    lookY: CAM_LOOK_Y,
    lookZ: 0,
  })

  const phase = useScene((s) => s.phase)
  const enterShelf = useScene((s) => s.enterShelf)
  const { camera, pointer } = useThree()

  const paintTextures = useMemo(() => getWeatheredPaintTextures(), [])
  const rustTex = useMemo(() => getRustTexture(), [])
  const ivyTex = useMemo(() => getIvyTexture(), [])

  const doorPaintMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: paintTextures.map,
        bumpMap: paintTextures.bumpMap,
        bumpScale: 0.025,
        color: '#f7f5ef',
        roughness: 0.72,
        metalness: 0.04,
      }),
    [paintTextures],
  )

  const frameMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: paintTextures.map,
        bumpMap: paintTextures.bumpMap,
        bumpScale: 0.02,
        color: '#e5e2d9',
        roughness: 0.78,
        metalness: 0.04,
      }),
    [paintTextures],
  )

  const rustMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: rustTex,
        color: '#804c34',
        roughness: 0.65,
        metalness: 0.65,
      }),
    [rustTex],
  )

  const rubbleMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#6b6458',
        roughness: 0.92,
      }),
    [],
  )

  const ivyMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: ivyTex,
        alphaTest: 0.45,
        side: THREE.DoubleSide,
        roughness: 0.84,
      }),
    [ivyTex],
  )

  useEffect(() => {
    onReady?.()
  }, [onReady])

  useLayoutEffect(() => {
    if (phase === 'door') {
      openingTlRef.current?.kill()
      openingTlRef.current = null
      const a = animRef.current
      a.doorAngle = 0
      a.portalOpacity = 0
      a.portalBrightness = 1
      a.bloomIntensity = 0.35
      a.dollyZ = CAM_START_Z
      a.camY = CAM_START_Y
      a.lookY = CAM_LOOK_Y
      a.lookZ = 0

      camera.position.set(0, CAM_START_Y, CAM_START_Z)
      lookAtRef.current.set(0, CAM_LOOK_Y, 0)
      camera.lookAt(lookAtRef.current)

      if (hingeRef.current) hingeRef.current.rotation.y = 0
      if (portalMatRef.current) {
        portalMatRef.current.opacity = 0
        portalMatRef.current.color.setRGB(1, 1, 1)
      }
      if (bloomRef.current) {
        bloomRef.current.intensity = 0.35
      }
    }
  }, [phase, camera])

  // Single ~3s GSAP opening timeline -> Scene 2
  useEffect(() => {
    if (phase !== 'opening') return

    openingTlRef.current?.kill()
    const a = animRef.current
    a.dollyZ = camera.position.z
    a.camY = camera.position.y

    if (soundEnabledRef.current) {
      playDoorCreak()
    }

    let disposed = false
    const tl = gsap.timeline({
      onComplete: () => {
        if (!disposed) enterShelf()
      },
    })

    if (reducedMotion) {
      tl.to(a, {
        portalOpacity: 1,
        portalBrightness: 4,
        dollyZ: CAM_END_Z,
        camY: CAM_END_Y,
        lookY: CAM_END_Y,
        lookZ: -2,
        duration: 0.35,
        ease: 'power1.out',
      })
    } else {
      // 1. Pivot door 100° on its left hinge (0 -> 1.65s)
      tl.to(
        a,
        {
          doorAngle: OPEN_ANGLE,
          duration: 1.65,
          ease: 'power2.inOut',
        },
        0,
      )

      // 2. Reveal and ignite white portal plane inside frame
      tl.to(
        a,
        {
          portalOpacity: 1,
          duration: 0.45,
          ease: 'power2.out',
        },
        0.15,
      )
      tl.to(
        a,
        {
          portalBrightness: 8,
          duration: 1.9,
          ease: 'power2.in',
        },
        0.9,
      )

      // 3. Bloom rises smoothly into pure whiteout
      tl.to(
        a,
        {
          bloomIntensity: 6.5,
          duration: 1.65,
          ease: 'power2.in',
        },
        1.35,
      )

      // 4. Camera dollies smoothly through doorway to Scene 2 start pose (0, 1.7, 1)
      tl.to(
        a,
        {
          dollyZ: CAM_END_Z,
          camY: CAM_END_Y,
          lookY: CAM_END_Y,
          lookZ: -2,
          duration: 2.0,
          ease: 'power2.in',
        },
        1.0,
      )
    }

    openingTlRef.current = tl
    return () => {
      disposed = true
      tl.kill()
    }
  }, [phase, camera, reducedMotion, enterShelf])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const t = state.clock.elapsedTime

    if (phase === 'door') {
      const swayX = reducedMotion ? 0 : pointer.x * 0.25 + Math.sin(t * 0.45) * 0.05
      const swayY = reducedMotion ? 0 : pointer.y * 0.09 + Math.cos(t * 0.6) * 0.025
      camera.position.x = THREE.MathUtils.damp(camera.position.x, swayX, 3.2, dt)
      camera.position.y = THREE.MathUtils.damp(camera.position.y, CAM_START_Y + swayY, 3.2, dt)
      camera.position.z = THREE.MathUtils.damp(camera.position.z, CAM_START_Z, 4, dt)
      lookAtRef.current.set(0, CAM_LOOK_Y, 0)
      camera.lookAt(lookAtRef.current)
      return
    }

    if (phase === 'opening') {
      const a = animRef.current
      if (hingeRef.current) {
        hingeRef.current.rotation.y = a.doorAngle
      }
      if (portalMatRef.current) {
        portalMatRef.current.opacity = a.portalOpacity
        portalMatRef.current.color.setRGB(a.portalBrightness, a.portalBrightness, a.portalBrightness)
      }
      if (bloomRef.current) {
        bloomRef.current.intensity = a.bloomIntensity
      }
      camera.position.x = THREE.MathUtils.damp(camera.position.x, 0, 5, dt)
      camera.position.y = a.camY
      camera.position.z = a.dollyZ
      lookAtRef.current.set(0, a.lookY, a.lookZ)
      camera.lookAt(lookAtRef.current)
    }
  })

  return (
    <>
      <Scene1SkyWater isMobile={isMobile} reducedMotion={reducedMotion} />

      {/* Warm sunlit lighting */}
      <hemisphereLight args={['#a9e0ff', '#2b5e66', 1.15]} />
      <directionalLight
        position={[-6.5, 9.5, 6.5]}
        intensity={2.65}
        color="#fff2d6"
        castShadow
        shadow-mapSize={isMobile ? [512, 512] : [1024, 1024]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
        shadow-camera-near={1}
        shadow-camera-far={28}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-2}
      />

      {/* Mid-distance symmetrical ruins & ivy */}
      <Scene1Ruins />

      {/* Freestanding weathered white 6-panel door standing in shallow water */}
      <group position={[0, 0, 0]}>
        {/* Thin outer doorframe (no wall) */}
        <mesh position={[-(DOOR_W / 2 + 0.055), DOOR_H / 2, 0]} material={frameMat} castShadow receiveShadow>
          <boxGeometry args={[0.11, DOOR_H, 0.2]} />
        </mesh>
        <mesh position={[DOOR_W / 2 + 0.055, DOOR_H / 2, 0]} material={frameMat} castShadow receiveShadow>
          <boxGeometry args={[0.11, DOOR_H, 0.2]} />
        </mesh>
        <mesh position={[0, DOOR_H + 0.055, 0]} material={frameMat} castShadow receiveShadow>
          <boxGeometry args={[DOOR_W + 0.22, 0.11, 0.22]} />
        </mesh>
        {/* Subtle weathered threshold sill at waterline */}
        <mesh position={[0, 0.03, 0.02]} material={frameMat} receiveShadow>
          <boxGeometry args={[DOOR_W + 0.28, 0.06, 0.28]} />
        </mesh>

        {/* Small rubble stones & ivy around door base */}
        {BASE_RUBBLE.map((r, idx) => (
          <mesh key={idx} position={r.pos} rotation={r.rot} material={rubbleMat} castShadow receiveShadow>
            <boxGeometry args={r.size} />
          </mesh>
        ))}
        <mesh position={[-0.92, 0.65, 0.16]} rotation={[0, 0.2, 0]} scale={[0.75, 1.35, 1]} material={ivyMat}>
          <planeGeometry args={[1, 1]} />
        </mesh>
        <mesh position={[0.78, 3.05, 0.15]} rotation={[0, -0.15, 0.25]} scale={[0.9, 0.85, 1]} material={ivyMat}>
          <planeGeometry args={[1, 1]} />
        </mesh>

        {/* Emissive white portal inside the frame, hidden while door is closed */}
        <mesh position={[0, DOOR_H / 2, -0.045]}>
          <planeGeometry args={[DOOR_W - 0.02, DOOR_H - 0.02]} />
          <meshBasicMaterial
            ref={portalMatRef}
            color="#ffffff"
            transparent
            opacity={0}
            toneMapped={false}
          />
        </mesh>

        {/* Hinge pivot on left edge */}
        <group ref={hingeRef} position={[-DOOR_W / 2, 0, 0]}>
          <group position={[DOOR_W / 2, DOOR_H / 2, 0]}>
            {/* Main door leaf */}
            <mesh material={doorPaintMat} castShadow receiveShadow>
              <boxGeometry args={[DOOR_W, DOOR_H, DOOR_D]} />
            </mesh>

            {/* 6 raised panels on front and back */}
            {PANELS_6.map(([px, py]) => (
              <group key={`${px}-${py}`}>
                <mesh position={[px, py, DOOR_D / 2 + 0.014]} material={doorPaintMat} castShadow receiveShadow>
                  <boxGeometry args={[0.56, 0.74, 0.03]} />
                </mesh>
                <mesh position={[px, py, -(DOOR_D / 2 + 0.014)]} material={doorPaintMat} castShadow receiveShadow>
                  <boxGeometry args={[0.56, 0.74, 0.03]} />
                </mesh>
              </group>
            ))}

            {/* Rusted handle & backplate */}
            <mesh position={[DOOR_W / 2 - 0.17, -0.05, DOOR_D / 2 + 0.015]} material={rustMat}>
              <boxGeometry args={[0.06, 0.22, 0.02]} />
            </mesh>
            <mesh position={[DOOR_W / 2 - 0.17, -0.04, DOOR_D / 2 + 0.06]} material={rustMat} castShadow>
              <sphereGeometry args={[0.048, 16, 16]} />
            </mesh>
          </group>
        </group>
      </group>

      {/* Sunlit pollen / petal particles */}
      <Scene1Particles isMobile={isMobile} reducedMotion={reducedMotion} />

      {/* Desktop post-processing: subtle bloom, saturated grading, vignette */}
      {!isMobile && <Scene1PostProcessing bloomRef={bloomRef} />}
    </>
  )
}
