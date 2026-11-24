import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getPollenTexture } from '../utils/scene1Textures'

type Scene1ParticlesProps = {
  isMobile: boolean
  reducedMotion: boolean
}

export default function Scene1Particles({
  isMobile,
  reducedMotion,
}: Scene1ParticlesProps) {
  const pointsRef = useRef<THREE.Points>(null)
  const count = isMobile ? 26 : 72
  const texture = useMemo(() => getPollenTexture(), [])

  const { positions, phases } = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const ph = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const u = (i * 0.6180339887) % 1
      const v = (i * 0.3819660113 + 0.19) % 1
      const w = (i * 0.7548776662 + 0.41) % 1
      pos[i * 3] = (u - 0.5) * 11
      pos[i * 3 + 1] = 0.25 + v * 3.8
      pos[i * 3 + 2] = -5 + w * 9
      ph[i] = i * 1.13
    }
    return { positions: pos, phases: ph }
  }, [count])

  useFrame((state) => {
    if (reducedMotion || !pointsRef.current) return
    const attr = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute
    const arr = attr.array as Float32Array
    const t = state.clock.elapsedTime
    for (let i = 0; i < count; i++) {
      const ph = phases[i]
      arr[i * 3] += Math.sin(t * 0.45 + ph) * 0.0018
      arr[i * 3 + 1] += Math.cos(t * 0.38 + ph * 1.2) * 0.0012
    }
    attr.needsUpdate = true
  })

  if (reducedMotion) return null

  return (
    <points key={count} ref={pointsRef} raycast={() => null}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        map={texture}
        color="#fff6d6"
        size={0.075}
        sizeAttenuation
        transparent
        opacity={0.78}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}
