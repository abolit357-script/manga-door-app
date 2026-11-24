import { useMemo } from 'react'
import * as THREE from 'three'
import { getConcreteRuinTexture, getIvyTexture, getRustTexture } from '../utils/scene1Textures'

type Side = -1 | 1

const IVY_PATCHES: { pos: [number, number, number]; rotY: number; scale: [number, number, number] }[] = [
  { pos: [-4.6, 2.2, -9.8], rotY: 0.2, scale: [1.8, 2.4, 1] },
  { pos: [-6.4, 3.1, -10.2], rotY: -0.1, scale: [2.2, 1.8, 1] },
  { pos: [-9.2, 2.5, -10.6], rotY: 0.15, scale: [2.4, 2.2, 1] },
  { pos: [-5.1, 4.1, -9.9], rotY: 0.35, scale: [1.5, 2.0, 1] },
  { pos: [4.6, 2.1, -9.8], rotY: -0.2, scale: [1.8, 2.4, 1] },
  { pos: [6.8, 3.2, -10.2], rotY: 0.1, scale: [2.2, 1.8, 1] },
  { pos: [9.4, 2.4, -10.6], rotY: -0.15, scale: [2.4, 2.2, 1] },
  { pos: [5.4, 4.2, -9.9], rotY: -0.35, scale: [1.5, 2.0, 1] },
]

function RuinWing({ side }: { side: Side }) {
  const concreteTex = useMemo(() => getConcreteRuinTexture(), [])
  const rustTex = useMemo(() => getRustTexture(), [])

  const concreteMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: concreteTex,
        color: '#a3adb2',
        roughness: 0.88,
        metalness: 0.04,
      }),
    [concreteTex],
  )

  const glassMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#18252d',
        roughness: 0.3,
        metalness: 0.2,
      }),
    [],
  )

  const rustMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: rustTex,
        color: '#8e553b',
        roughness: 0.78,
        metalness: 0.45,
      }),
    [rustTex],
  )

  const windowOffsets = [-3.6, -1.9, -0.2, 1.5, 3.2]
  const archOffsets = [-3.0, -1.0, 1.0, 3.0]
  const girderSpecs: { x: number; z: number; h: number; tiltZ: number; tiltX: number }[] = [
    { x: 4.9 * side, z: -9.6, h: 9.8, tiltZ: 0.16 * side, tiltX: 0.04 },
    { x: 7.4 * side, z: -10.4, h: 11.4, tiltZ: 0.21 * side, tiltX: 0.06 },
    { x: 10.6 * side, z: -11.4, h: 12.6, tiltZ: 0.24 * side, tiltX: 0.05 },
  ]

  return (
    <group>
      {/* Low ruined building wing */}
      <group position={[9.2 * side, 0, -12.4]}>
        {/* Main concrete facade */}
        <mesh position={[0, 1.9, 0]} material={concreteMat} castShadow receiveShadow>
          <boxGeometry args={[10.5, 3.8, 3.2]} />
        </mesh>

        {/* Upper cornice & parapet */}
        <mesh position={[0, 3.92, 0.1]} material={concreteMat} castShadow receiveShadow>
          <boxGeometry args={[10.8, 0.28, 3.45]} />
        </mesh>

        {/* Recessed dark windows row */}
        {windowOffsets.map((wx, idx) => (
          <mesh key={idx} position={[wx, 2.0, 1.56]} material={glassMat}>
            <boxGeometry args={[1.25, 1.65, 0.16]} />
          </mesh>
        ))}

        {/* Arched lower bays along the front face */}
        {archOffsets.map((ax, idx) => (
          <group key={idx} position={[ax, 0, 1.68]}>
            <mesh position={[-0.48, 0.85, 0]} material={concreteMat}>
              <boxGeometry args={[0.24, 1.7, 0.26]} />
            </mesh>
            <mesh position={[0.48, 0.85, 0]} material={concreteMat}>
              <boxGeometry args={[0.24, 1.7, 0.26]} />
            </mesh>
            <mesh
              position={[0, 1.7, 0]}
              rotation={[Math.PI / 2, 0, 0]}
              material={concreteMat}
            >
              <cylinderGeometry args={[0.6, 0.6, 0.26, 12, 1, false, 0, Math.PI]} />
            </mesh>
          </group>
        ))}

        {/* Rooftop skeletal truss / tank silhouettes */}
        <mesh position={[-2.2 * side, 4.5, -0.3]} material={concreteMat}>
          <boxGeometry args={[1.4, 1.0, 1.2]} />
        </mesh>
        <mesh position={[1.2 * side, 4.45, -0.4]} material={concreteMat}>
          <cylinderGeometry args={[0.48, 0.48, 0.9, 12]} />
        </mesh>
        <mesh position={[0, 4.75, 1.35]} material={rustMat}>
          <boxGeometry args={[10.2, 0.14, 0.14]} />
        </mesh>
      </group>

      {/* Tilted rusty steel girders rising into the sky */}
      {girderSpecs.map((g, idx) => (
        <group key={idx} position={[g.x, 0, g.z]} rotation={[g.tiltX, 0, g.tiltZ]}>
          <mesh position={[0, g.h / 2, 0]} material={rustMat} castShadow>
            <cylinderGeometry args={[0.085, 0.115, g.h, 8]} />
          </mesh>
          {/* Angled upper cross-arm */}
          <mesh
            position={[-1.1 * side, g.h * 0.74, 0]}
            rotation={[0, 0, Math.PI / 2 - 0.14 * side]}
            material={rustMat}
          >
            <cylinderGeometry args={[0.055, 0.055, 2.8, 6]} />
          </mesh>
          <mesh
            position={[-0.6 * side, g.h * 0.56, 0]}
            rotation={[0, 0, Math.PI / 2 + 0.08 * side]}
            material={rustMat}
          >
            <cylinderGeometry args={[0.05, 0.05, 2.2, 6]} />
          </mesh>
        </group>
      ))}

      {/* Longitudinal connecting rusty beams linking girders */}
      <mesh
        position={[7.8 * side, 7.6, -10.5]}
        rotation={[0, 0.28 * side, -0.1 * side]}
        material={rustMat}
      >
        <cylinderGeometry args={[0.055, 0.055, 6.8, 6]} />
      </mesh>
      <mesh
        position={[8.2 * side, 5.2, -10.8]}
        rotation={[0, 0.22 * side, -0.06 * side]}
        material={rustMat}
      >
        <cylinderGeometry args={[0.05, 0.05, 7.2, 6]} />
      </mesh>
    </group>
  )
}

export default function Scene1Ruins() {
  const ivyTex = useMemo(() => getIvyTexture(), [])
  const ivyMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: ivyTex,
        alphaTest: 0.45,
        side: THREE.DoubleSide,
        roughness: 0.85,
      }),
    [ivyTex],
  )

  return (
    <group>
      <RuinWing side={-1} />
      <RuinWing side={1} />

      {/* Distant sunlit green hill on the far right horizon */}
      <mesh position={[21, 0.9, -26]} rotation={[0, -0.3, 0]}>
        <sphereGeometry args={[5.5, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
        <meshStandardMaterial color="#4e943f" roughness={0.95} />
      </mesh>

      {/* Alpha-cutout ivy clusters climbing girders & facades */}
      {IVY_PATCHES.map((patch, idx) => (
        <mesh
          key={idx}
          position={patch.pos}
          rotation={[0, patch.rotY, 0]}
          scale={patch.scale}
          material={ivyMat}
        >
          <planeGeometry args={[1, 1]} />
        </mesh>
      ))}
    </group>
  )
}
