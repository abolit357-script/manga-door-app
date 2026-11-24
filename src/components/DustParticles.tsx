import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getDustTexture } from '../utils/bookTextures'

type ParticleSeed = {
  baseX: number
  baseY: number
  baseZ: number
  speedY: number
  phase: number
  ampX: number
  ampZ: number
}

const COUNT = 84

export default function DustParticles() {
  const pointsRef = useRef<THREE.Points>(null)
  const reducedMotion = useRef(
    typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  const dustTexture = useMemo(() => getDustTexture(), [])

  const { positions, seeds } = useMemo(() => {
    const pos = new Float32Array(COUNT * 3)
    const meta: ParticleSeed[] = []
    for (let i = 0; i < COUNT; i++) {
      // Deterministic golden-ratio spread inside the warm reading alcove light cone
      const u = ((i * 0.6180339887) % 1)
      const v = ((i * 0.3819660113 + 0.17) % 1)
      const w = ((i * 0.7548776662 + 0.31) % 1)

      const x = (u - 0.5) * 3.2
      const y = 0.45 + v * 2.25
      const z = -2.0 + w * 2.4

      pos[i * 3] = x
      pos[i * 3 + 1] = y
      pos[i * 3 + 2] = z

      meta.push({
        baseX: x,
        baseY: y,
        baseZ: z,
        speedY: 0.025 + (i % 7) * 0.006,
        phase: i * 1.37,
        ampX: 0.04 + (i % 5) * 0.014,
        ampZ: 0.03 + (i % 4) * 0.012,
      })
    }
    return { positions: pos, seeds: meta }
  }, [])

  useFrame((state) => {
    const points = pointsRef.current
    if (!points) return
    const attr = points.geometry.attributes.position as THREE.BufferAttribute
    const arr = attr.array as Float32Array
    const t = state.clock.elapsedTime * (reducedMotion.current ? 0.2 : 1)

    for (let i = 0; i < COUNT; i++) {
      const s = seeds[i]
      const span = 2.25
      const yOffset = ((s.baseY - 0.45 + t * s.speedY) % span) + 0.45
      arr[i * 3] = s.baseX + Math.sin(t * 0.45 + s.phase) * s.ampX
      arr[i * 3 + 1] = yOffset
      arr[i * 3 + 2] = s.baseZ + Math.cos(t * 0.35 + s.phase * 1.1) * s.ampZ
    }
    attr.needsUpdate = true
  })

  return (
    <points ref={pointsRef} raycast={() => null}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={COUNT}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        map={dustTexture}
        color="#ffe6b3"
        size={0.032}
        sizeAttenuation
        transparent
        opacity={0.62}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}
