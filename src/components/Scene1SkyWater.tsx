import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Cloud, Clouds, Environment, MeshReflectorMaterial } from '@react-three/drei'
import * as THREE from 'three'
import { getCloudDataUrl, getWaterNormalMap } from '../utils/scene1Textures'

type Scene1SkyWaterProps = {
  isMobile: boolean
  reducedMotion: boolean
}

const SKY_VS = /* glsl */ `
varying vec3 vWorldDir;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldDir = normalize(position);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

const SKY_FS = /* glsl */ `
varying vec3 vWorldDir;
void main() {
  float h = clamp(vWorldDir.y, -0.2, 1.0);
  vec3 zenith = vec3(0.08, 0.42, 0.84);
  vec3 mid = vec3(0.24, 0.64, 0.93);
  vec3 horizon = vec3(0.72, 0.90, 0.98);
  vec3 below = vec3(0.20, 0.48, 0.56);

  vec3 col = mix(horizon, mid, smoothstep(0.0, 0.28, h));
  col = mix(col, zenith, smoothstep(0.25, 0.85, h));
  if (h < 0.0) {
    col = mix(horizon, below, smoothstep(0.0, -0.15, h));
  }

  // Soft warm sunlit glow in upper-left sky matching the reference
  vec3 sunDir = normalize(vec3(-0.35, 0.48, -0.80));
  float sunAmt = max(dot(normalize(vWorldDir), sunDir), 0.0);
  col += vec3(0.28, 0.24, 0.16) * pow(sunAmt, 8.0);
  col += vec3(0.45, 0.42, 0.34) * pow(sunAmt, 42.0);

  gl_FragColor = vec4(col, 1.0);
}
`

function SkyDomeMesh() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: SKY_VS,
        fragmentShader: SKY_FS,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    [],
  )

  useEffect(() => {
    return () => material.dispose()
  }, [material])

  return (
    <mesh material={material} scale={78}>
      <sphereGeometry args={[1, 40, 28]} />
    </mesh>
  )
}

export default function Scene1SkyWater({
  isMobile,
  reducedMotion,
}: Scene1SkyWaterProps) {
  const cloudTextureUrl = useMemo(() => getCloudDataUrl(), [])
  const waterNormal = useMemo(() => getWaterNormalMap(), [])
  const normalScale = useMemo(() => new THREE.Vector2(0.14, 0.22), [])

  useFrame((_, delta) => {
    if (reducedMotion) return
    const dt = Math.min(delta, 0.05)
    waterNormal.offset.x = (waterNormal.offset.x + dt * 0.014) % 1
    waterNormal.offset.y = (waterNormal.offset.y + dt * 0.008) % 1
  })

  const cloudSegments = isMobile ? 12 : 22
  const cloudSpeed = reducedMotion ? 0 : 0.06

  return (
    <>
      <color attach="background" args={['#6dc2ee']} />
      <fog attach="fog" args={['#b6e1f4', 15, 52]} />

      {/* Saturated anime blue sky dome */}
      <SkyDomeMesh />

      {/* Baked sky IBL for authentic sky + sun reflections on door & metal */}
      <Environment resolution={256} frames={1}>
        <SkyDomeMesh />
      </Environment>

      {/* Fluffy animated/procedural anime clouds */}
      <Clouds
        texture={cloudTextureUrl}
        material={THREE.MeshBasicMaterial}
        limit={isMobile ? 60 : 120}
        frustumCulled={false}
      >
        <Cloud
          seed={11}
          segments={cloudSegments}
          bounds={[14, 3.2, 4]}
          volume={6.5}
          color="#ffffff"
          opacity={0.92}
          speed={cloudSpeed}
          position={[-10, 9.2, -26]}
        />
        <Cloud
          seed={24}
          segments={cloudSegments}
          bounds={[16, 3.8, 4]}
          volume={7.5}
          color="#f9fcff"
          opacity={0.9}
          speed={cloudSpeed}
          position={[0.5, 11.2, -30]}
        />
        <Cloud
          seed={37}
          segments={cloudSegments}
          bounds={[13, 3.2, 4]}
          volume={6.2}
          color="#ffffff"
          opacity={0.92}
          speed={cloudSpeed}
          position={[11, 9.5, -25]}
        />
        {!isMobile && (
          <>
            <Cloud
              seed={52}
              segments={18}
              bounds={[10, 2.5, 3]}
              volume={5.0}
              color="#eef7ff"
              opacity={0.82}
              speed={cloudSpeed}
              position={[-18, 7.2, -29]}
            />
            <Cloud
              seed={68}
              segments={18}
              bounds={[10, 2.6, 3]}
              volume={5.2}
              color="#eef7ff"
              opacity={0.82}
              speed={cloudSpeed}
              position={[19, 7.6, -28]}
            />
          </>
        )}
      </Clouds>

      {/* Reflective shallow turquoise-blue water surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -4]} receiveShadow>
        <planeGeometry args={[96, 96]} />
        <MeshReflectorMaterial
          resolution={isMobile ? 256 : 512}
          blur={isMobile ? [0, 0] : [220, 60]}
          mixBlur={isMobile ? 0 : 0.65}
          mixStrength={1.25}
          mirror={0.78}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.4}
          depthScale={0.25}
          roughness={0.22}
          metalness={0.12}
          color="#2c6f7d"
          normalMap={waterNormal}
          normalScale={normalScale}
          distortionMap={waterNormal}
          distortion={reducedMotion ? 0 : 0.035}
        />
      </mesh>
    </>
  )
}
