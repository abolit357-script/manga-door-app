import * as THREE from 'three'

export type BookTransitionState = {
  activeBookId: string | null
  mode: 'idle' | 'toBook' | 'inBook' | 'toShelf' | 'reduced'
  selectProgress: number
  pathProgress: number
  bounceOffset: number
  dimAmount: number
  reducedFade: number
  swapYaw: number
  swapOffsetX: number
  relayToTarget: boolean
  startPos: THREE.Vector3
  selectPos: THREE.Vector3
  midPos: THREE.Vector3
  targetPos: THREE.Vector3
  startQuat: THREE.Quaternion
  selectQuat: THREE.Quaternion
  targetQuat: THREE.Quaternion
  targetScale: number
  camStartPos: THREE.Vector3
  camEndPos: THREE.Vector3
  camStartLook: THREE.Vector3
  camEndLook: THREE.Vector3
}

export function createInitialTransitionState(): BookTransitionState {
  return {
    activeBookId: null,
    mode: 'idle',
    selectProgress: 0,
    pathProgress: 0,
    bounceOffset: 0,
    dimAmount: 0,
    reducedFade: 0,
    swapYaw: 0,
    swapOffsetX: 0,
    relayToTarget: false,
    startPos: new THREE.Vector3(),
    selectPos: new THREE.Vector3(),
    midPos: new THREE.Vector3(),
    targetPos: new THREE.Vector3(),
    startQuat: new THREE.Quaternion(),
    selectQuat: new THREE.Quaternion(),
    targetQuat: new THREE.Quaternion(),
    targetScale: 1,
    camStartPos: new THREE.Vector3(0, 1.6, 0.42),
    camEndPos: new THREE.Vector3(0, 1.58, 0.08),
    camStartLook: new THREE.Vector3(0, 1.54, -2.05),
    camEndLook: new THREE.Vector3(0, 1.55, -2.05),
  }
}

export function computeShelfCameraZ(aspect: number): number {
  return Math.max(0.42, 2.55 / Math.max(aspect, 0.45) - 2.08)
}

export function computeDetailCameraPose(aspect: number) {
  const shelfZ = computeShelfCameraZ(aspect)
  return {
    pos: new THREE.Vector3(0, 1.58, shelfZ - 0.36),
    lookAt: new THREE.Vector3(0, 1.55, -2.05),
  }
}

const _fwd = new THREE.Vector3()
const _right = new THREE.Vector3()
const _up = new THREE.Vector3()
const _worldUp = new THREE.Vector3(0, 1, 0)
const _xAxis = new THREE.Vector3()
const _yAxis = new THREE.Vector3()
const _zAxis = new THREE.Vector3()
const _basis = new THREE.Matrix4()
const _tiltQuat = new THREE.Quaternion()
const _yLocal = new THREE.Vector3(0, 1, 0)

/**
 * Computes a quaternion orienting the book's +X front cover toward the camera
 * with an optional slight yaw angle so the spine edge remains subtly visible.
 */
export function computeFrontFacingQuat(
  camPos: THREE.Vector3,
  bookPos: THREE.Vector3,
  yawOffsetRad = 0,
  out = new THREE.Quaternion(),
): THREE.Quaternion {
  _xAxis.subVectors(camPos, bookPos).normalize()
  _yAxis.copy(_worldUp)
  // Orthogonalize Y against X
  _yAxis.addScaledVector(_xAxis, -_yAxis.dot(_xAxis)).normalize()
  _zAxis.crossVectors(_xAxis, _yAxis).normalize()

  _basis.makeBasis(_xAxis, _yAxis, _zAxis)
  out.setFromRotationMatrix(_basis)

  if (yawOffsetRad !== 0) {
    _tiltQuat.setFromAxisAngle(_yLocal, yawOffsetRad)
    out.multiply(_tiltQuat)
  }
  return out
}

export function computeTargetBookPose(
  slotRect: DOMRect,
  viewportW: number,
  viewportH: number,
  scrollOffsetDeltaY: number,
  camPos: THREE.Vector3,
  camLookAt: THREE.Vector3,
  fovDeg: number,
  bookHeight: number,
  dTarget = 1.55,
) {
  _fwd.subVectors(camLookAt, camPos).normalize()
  _right.crossVectors(_fwd, _worldUp).normalize()
  _up.crossVectors(_right, _fwd).normalize()

  const centerX = slotRect.left + slotRect.width / 2
  const centerY = slotRect.top + scrollOffsetDeltaY + slotRect.height / 2

  const ndcX = (centerX / Math.max(viewportW, 1)) * 2 - 1
  const ndcY = 1 - (centerY / Math.max(viewportH, 1)) * 2

  const halfH = dTarget * Math.tan(THREE.MathUtils.degToRad(fovDeg) * 0.5)
  const halfW = halfH * (viewportW / Math.max(viewportH, 1))

  const position = new THREE.Vector3()
    .copy(camPos)
    .addScaledVector(_fwd, dTarget)
    .addScaledVector(_right, ndcX * halfW)
    .addScaledVector(_up, ndcY * halfH)

  const desiredWorldH = (slotRect.height / Math.max(viewportH, 1)) * (2 * halfH)
  const scale = Math.max(0.5, desiredWorldH / Math.max(bookHeight, 0.01))
  const quaternion = computeFrontFacingQuat(camPos, position, -0.18)

  return { position, quaternion, scale }
}
