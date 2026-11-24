import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import gsap from 'gsap'
import { ScrollToPlugin } from 'gsap/ScrollToPlugin'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import mangasData from '../data/mangas.json'
import type { MangaBook } from '../types/manga'
import Book, { type AnchorGetter, type BookHandle } from '../components/Book'
import DustParticles from '../components/DustParticles'
import Scene3TargetBook, { type TargetBookHandle } from '../components/Scene3TargetBook'
import { getDarkWoodTexture, getWoodTexture } from '../utils/bookTextures'
import {
  computeDetailCameraPose,
  computeFrontFacingQuat,
  computeShelfCameraZ,
  computeTargetBookPose,
  createInitialTransitionState,
} from '../utils/transitionMath'
import { playDoorCreak } from '../utils/creakAudio'
import { useScene } from '../store'

gsap.registerPlugin(ScrollToPlugin, ScrollTrigger)

export const MANGAS = mangasData as MangaBook[]

const SHELF_YS = [1.84, 1.26, 0.68] as const
const SHELF_THICKNESS = 0.04
const SHELF_Z = -2.08
const BOOK_BASE_Z = -2.04

const ROOM_BG = '#14111a'
const WALL_COLOR_BASE = new THREE.Color('#1d1a26')
const WALL_COLOR_DIM = new THREE.Color('#0c0b12')
const WOOD_COLOR_BASE = new THREE.Color('#ffffff')
const WOOD_COLOR_DIM = new THREE.Color('#756960')

type PlacedBook = {
  book: MangaBook
  position: [number, number, number]
  dimensions: [number, number, number]
}

type ShelfCluster = {
  shelfY: number
  minX: number
  maxX: number
}

function buildShelfLayout(): { placed: PlacedBook[]; clusters: ShelfCluster[] } {
  const counts = [3, 4, 3]
  const placed: PlacedBook[] = []
  const clusters: ShelfCluster[] = []
  let idx = 0

  counts.forEach((count, shelfIdx) => {
    const shelfY = SHELF_YS[shelfIdx]
    const shelfTop = shelfY + SHELF_THICKNESS / 2
    const slice = MANGAS.slice(idx, idx + count)
    idx += count

    const dims = slice.map((_, localIdx) => {
      const thickness = 0.084 + ((localIdx + shelfIdx) % 3) * 0.006
      const height = 0.408 + ((localIdx * 2 + shelfIdx) % 3) * 0.015
      const depth = height * (2 / 3)
      return [thickness, height, depth] as [number, number, number]
    })

    const gap = 0.068
    const totalW = dims.reduce((sum, d) => sum + d[0], 0) + gap * (count - 1)
    let cursorX = -totalW / 2
    const minX = cursorX
    const maxX = totalW / 2

    slice.forEach((book, localIdx) => {
      const [thickness, height, depth] = dims[localIdx]
      const x = cursorX + thickness / 2
      const y = shelfTop + height / 2
      placed.push({
        book,
        position: [x, y, BOOK_BASE_Z],
        dimensions: [thickness, height, depth],
      })
      cursorX += thickness + gap
    })

    clusters.push({ shelfY: shelfTop, minX, maxX })
  })

  return { placed, clusters }
}

type Scene2LibraryProps = {
  tooltipRef: React.RefObject<HTMLDivElement>
  slotRef: React.RefObject<HTMLDivElement>
  sheetSectionRef: React.RefObject<HTMLElement>
  sheetTextRef: React.RefObject<HTMLDivElement>
  sheetTitleRef: React.RefObject<HTMLHeadingElement>
  crossfadeRef: React.RefObject<HTMLDivElement>
  keyboardFocusedBookId: string | null
  openBookTriggerRef: React.MutableRefObject<((book: MangaBook) => void) | null>
  openDirectBookTriggerRef: React.MutableRefObject<((book: MangaBook) => void) | null>
  returnShelfTriggerRef: React.MutableRefObject<(() => void) | null>
  switchBookTriggerRef: React.MutableRefObject<((book: MangaBook, dir: 'prev' | 'next') => void) | null>
  onHoveredBookChange: (book: MangaBook | null) => void
  onDragActiveChange: (dragging: boolean) => void
  onAnnounce: (msg: string) => void
  activeFilter?: string | null
  soundEnabled?: boolean
}

export default function Scene2Library({
  tooltipRef,
  slotRef,
  sheetSectionRef,
  sheetTextRef,
  sheetTitleRef,
  crossfadeRef,
  keyboardFocusedBookId,
  openBookTriggerRef,
  openDirectBookTriggerRef,
  returnShelfTriggerRef,
  switchBookTriggerRef,
  onHoveredBookChange,
  onDragActiveChange,
  onAnnounce,
  activeFilter = null,
  soundEnabled = false,
}: Scene2LibraryProps) {
  const phase = useScene((s) => s.phase)
  const selectedBook = useScene((s) => s.selectedBook)
  const isTransitioning = useScene((s) => s.isTransitioning)
  const transitionDirection = useScene((s) => s.transitionDirection)
  const beginToBook = useScene((s) => s.beginToBook)
  const beginDirectToBook = useScene((s) => s.beginDirectToBook)
  const finishToBook = useScene((s) => s.finishToBook)
  const beginToShelf = useScene((s) => s.beginToShelf)
  const finishToShelf = useScene((s) => s.finishToShelf)
  const switchBook = useScene((s) => s.switchBook)
  const unlockTransition = useScene((s) => s.unlockTransition)

  const interactive = phase === 'shelf' && !isTransitioning
  const { camera, pointer, size } = useThree()

  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const activeDragRef = useRef<string | null>(null)
  const hoverStateRef = useRef<{ book: MangaBook; getAnchor: AnchorGetter } | null>(null)
  const lookAtRef = useRef(new THREE.Vector3(0, 1.7, -2))
  const projVec = useMemo(() => new THREE.Vector3(), [])

  const transitionRef = useRef(createInitialTransitionState())
  const bookHandlesRef = useRef(new Map<string, BookHandle>())
  const targetHandleRef = useRef<TargetBookHandle | null>(null)
  const pendingStartRef = useRef<{
    bookId: string
    position: THREE.Vector3
    quaternion: THREE.Quaternion
    dimensions: [number, number, number]
  } | null>(null)
  const activeTimelineRef = useRef<gsap.core.Timeline | null>(null)
  const swapTimelineRef = useRef<gsap.core.Timeline | null>(null)

  const hemiLightRef = useRef<THREE.HemisphereLight>(null)
  const keyLightRef = useRef<THREE.DirectionalLight>(null)
  const overheadLightRef = useRef<THREE.PointLight>(null)
  const lanternLightRef = useRef<THREE.PointLight>(null)
  const detailLightRef = useRef<THREE.PointLight>(null)
  const wallMatsRef = useRef<(THREE.MeshStandardMaterial | null)[]>([])
  const woodMatsRef = useRef<(THREE.MeshStandardMaterial | null)[]>([])

  const woodTexture = useMemo(() => getWoodTexture(), [])
  const darkWoodTexture = useMemo(() => getDarkWoodTexture(), [])
  const { placed, clusters } = useMemo(() => buildShelfLayout(), [])

  const selectedBookDims = useMemo(() => {
    if (!selectedBook) return null
    return placed.find((p) => p.book.id === selectedBook.id)?.dimensions ?? null
  }, [selectedBook, placed])

  const getReducedMotion = () =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const registerHandle = useCallback((id: string, handle: BookHandle | null) => {
    if (handle) bookHandlesRef.current.set(id, handle)
    else bookHandlesRef.current.delete(id)
  }, [])

  const registerTargetHandle = useCallback((handle: TargetBookHandle | null) => {
    targetHandleRef.current = handle
  }, [])

  useLayoutEffect(() => {
    if (camera.position.z > 2 || camera.position.z < -0.5) {
      camera.position.set(0, 1.7, 1)
    }
    lookAtRef.current.set(0, 1.7, -2)
    camera.lookAt(lookAtRef.current)
  }, [camera])

  const soundEnabledRef = useRef(soundEnabled)
  soundEnabledRef.current = soundEnabled

  const handleSelectBook = useCallback(
    (book: MangaBook) => {
      const s = useScene.getState()
      if (s.isTransitioning || s.phase !== 'shelf') return

      activeTimelineRef.current?.kill()
      activeTimelineRef.current = null
      hoverStateRef.current = null
      onHoveredBookChange(null)
      document.body.style.cursor = 'auto'

      if (soundEnabledRef.current) {
        playDoorCreak()
      }

      const handle = bookHandlesRef.current.get(book.id)
      const livePose = handle
        ? handle.getLivePose()
        : { position: new THREE.Vector3(0, 1.4, BOOK_BASE_Z), quaternion: new THREE.Quaternion() }

      pendingStartRef.current = {
        bookId: book.id,
        position: livePose.position,
        quaternion: livePose.quaternion,
        dimensions: handle?.dimensions ?? [0.09, 0.42, 0.28],
      }

      if (!beginToBook(book)) {
        pendingStartRef.current = null
      }
    },
    [beginToBook, onHoveredBookChange],
  )

  const handleRequestReturnToShelf = useCallback(() => {
    const s = useScene.getState()
    if (s.isTransitioning || s.phase !== 'book') return
    swapTimelineRef.current?.kill()
    swapTimelineRef.current = null
    transitionRef.current.swapYaw = 0
    transitionRef.current.swapOffsetX = 0
    activeTimelineRef.current?.kill()
    activeTimelineRef.current = null
    beginToShelf()
  }, [beginToShelf])

  const handleSwitchBookInDetail = useCallback(
    (nextBook: MangaBook, dir: 'prev' | 'next') => {
      const s = useScene.getState()
      if (s.isTransitioning || s.phase !== 'book') return
      const prevId = s.selectedBook?.id
      if (prevId && prevId !== nextBook.id) {
        bookHandlesRef.current.get(prevId)?.resetRest()
      }

      const tState = transitionRef.current
      tState.activeBookId = nextBook.id
      tState.relayToTarget = true
      tState.mode = 'inBook'
      tState.dimAmount = 1

      swapTimelineRef.current?.kill()
      const reduced = getReducedMotion()
      const textEl = sheetTextRef.current
      const sign = dir === 'next' ? 1 : -1

      switchBook(nextBook)
      onAnnounce(`Fiche : ${nextBook.titre}`)

      if (reduced) {
        tState.swapYaw = 0
        tState.swapOffsetX = 0
        if (textEl) {
          gsap.fromTo(textEl, { opacity: 0 }, { opacity: 1, duration: 0.16, ease: 'power1.out' })
        }
        return
      }

      tState.swapYaw = sign * 0.42
      tState.swapOffsetX = sign * 0.12
      const stl = gsap.timeline()
      stl.to(
        tState,
        {
          swapYaw: 0,
          swapOffsetX: 0,
          duration: 0.3,
          ease: 'power2.out',
        },
        0,
      )
      if (textEl) {
        stl.fromTo(
          textEl,
          { opacity: 0.25, x: sign * 18 },
          { opacity: 1, x: 0, duration: 0.24, ease: 'power2.out' },
          0,
        )
      }
      swapTimelineRef.current = stl
    },
    [switchBook, sheetTextRef, onAnnounce],
  )

  const handleOpenDirectBook = useCallback(
    (book: MangaBook) => {
      const s = useScene.getState()
      if (s.isTransitioning || s.phase !== 'shelf') return
      activeTimelineRef.current?.kill()
      activeTimelineRef.current = null
      hoverStateRef.current = null
      onHoveredBookChange(null)
      document.body.style.cursor = 'auto'
      beginDirectToBook(book)
    },
    [beginDirectToBook, onHoveredBookChange],
  )

  useEffect(() => {
    openBookTriggerRef.current = handleSelectBook
    openDirectBookTriggerRef.current = handleOpenDirectBook
    returnShelfTriggerRef.current = handleRequestReturnToShelf
    switchBookTriggerRef.current = handleSwitchBookInDetail
    return () => {
      openBookTriggerRef.current = null
      openDirectBookTriggerRef.current = null
      returnShelfTriggerRef.current = null
      switchBookTriggerRef.current = null
    }
  }, [
    openBookTriggerRef,
    openDirectBookTriggerRef,
    returnShelfTriggerRef,
    switchBookTriggerRef,
    handleSelectBook,
    handleOpenDirectBook,
    handleRequestReturnToShelf,
    handleSwitchBookInDetail,
  ])

  // Direct Open GSAP Transition: From Editorial Story -> Scene 3 Book Sheet
  useEffect(() => {
    if (transitionDirection !== 'toBookDirect' || !selectedBook) return

    let disposed = false
    let tl: gsap.core.Timeline | null = null

    const rafId = requestAnimationFrame(() => {
      if (disposed) return
      activeTimelineRef.current?.kill()
      const tState = transitionRef.current
      const reduced = getReducedMotion()

      const slotEl = slotRef.current
      const sectionEl = sheetSectionRef.current
      const textEl = sheetTextRef.current
      const handle = bookHandlesRef.current.get(selectedBook.id)

      if (!slotEl || !sectionEl || !textEl || !handle) {
        unlockTransition('shelf')
        return
      }

      try {
        ScrollTrigger.refresh()
        const vw = window.innerWidth
        const vh = window.innerHeight
        const aspect = vw / Math.max(vh, 1)

        const targetScrollY = Math.min(
          sectionEl.offsetTop,
          Math.max(0, document.documentElement.scrollHeight - vh),
        )
        window.scrollTo(0, targetScrollY)

        const shelfCamZ = computeShelfCameraZ(aspect)
        const detailCam = computeDetailCameraPose(aspect)
        camera.position.copy(detailCam.pos)
        lookAtRef.current.copy(detailCam.lookAt)
        camera.lookAt(lookAtRef.current)

        const slotRect = slotEl.getBoundingClientRect()
        const fov = (camera as THREE.PerspectiveCamera).fov || 50
        const targetPose = computeTargetBookPose(
          slotRect,
          vw,
          vh,
          0,
          detailCam.pos,
          detailCam.lookAt,
          fov,
          handle.dimensions[1],
        )

        tState.activeBookId = selectedBook.id
        tState.selectProgress = 1
        tState.pathProgress = 1
        tState.bounceOffset = 0
        tState.dimAmount = 1
        tState.relayToTarget = true
        tState.mode = 'inBook'
        tState.camStartPos.set(0, 1.6, shelfCamZ)
        tState.camEndPos.copy(detailCam.pos)
        tState.camStartLook.set(0, 1.54, -2.05)
        tState.camEndLook.copy(detailCam.lookAt)
        tState.targetPos.copy(targetPose.position)
        tState.targetQuat.copy(targetPose.quaternion)
        tState.targetScale = targetPose.scale

        if (reduced) {
          tState.swapYaw = 0
          tState.swapOffsetX = 0
          gsap.set(textEl, { opacity: 1, y: 0 })
          ScrollTrigger.refresh()
          finishToBook()
          onAnnounce(`Fiche : ${selectedBook.titre}`)
          requestAnimationFrame(() => {
            sheetTitleRef.current?.focus({ preventScroll: true })
          })
          return
        }

        tState.swapYaw = 0.36
        tState.swapOffsetX = 0.08
        gsap.set(textEl, { opacity: 0, y: 16 })

        let completed = false
        tl = gsap.timeline({
          onComplete: () => {
            completed = true
            tState.swapYaw = 0
            tState.swapOffsetX = 0
            ScrollTrigger.refresh()
            finishToBook()
            onAnnounce(`Fiche : ${selectedBook.titre}`)
            requestAnimationFrame(() => {
              sheetTitleRef.current?.focus({ preventScroll: true })
            })
          },
          onInterrupt: () => {
            if (!completed && !disposed) {
              unlockTransition(useScene.getState().phase)
            }
          },
        })

        tl.to(
          tState,
          { swapYaw: 0, swapOffsetX: 0, duration: 0.35, ease: 'power2.out' },
          0,
        )
        tl.to(
          textEl,
          { opacity: 1, y: 0, duration: 0.32, ease: 'power2.out' },
          0.04,
        )
        activeTimelineRef.current = tl
      } catch {
        tl?.kill()
        unlockTransition('shelf')
      }
    })

    return () => {
      disposed = true
      cancelAnimationFrame(rafId)
      tl?.kill()
    }
  }, [
    transitionDirection,
    selectedBook,
    camera,
    slotRef,
    sheetSectionRef,
    sheetTextRef,
    sheetTitleRef,
    finishToBook,
    unlockTransition,
    onAnnounce,
  ])

  // Forward GSAP Timeline: Library Shelf -> Scene 3 Book Sheet
  useEffect(() => {
    if (transitionDirection !== 'toBook' || !selectedBook) return

    let disposed = false
    let tl: gsap.core.Timeline | null = null

    const rafId = requestAnimationFrame(() => {
      if (disposed) return
      activeTimelineRef.current?.kill()
      const tState = transitionRef.current
      const reduced = getReducedMotion()

      const slotEl = slotRef.current
      const sectionEl = sheetSectionRef.current
      const textEl = sheetTextRef.current
      const fadeEl = crossfadeRef.current
      const handle = bookHandlesRef.current.get(selectedBook.id)

      if (!slotEl || !sectionEl || !textEl || !handle) {
        unlockTransition('shelf')
        return
      }

      try {
        ScrollTrigger.refresh()

        const vw = window.innerWidth
        const vh = window.innerHeight
        const aspect = vw / Math.max(vh, 1)
        const isMobile = vw < 768
        const speed = isMobile ? 1.0 / 1.5 : 1.0

        const targetScrollY = Math.min(
          sectionEl.offsetTop,
          Math.max(0, document.documentElement.scrollHeight - vh),
        )

        const shelfCamZ = computeShelfCameraZ(aspect)
        const camStartPos = camera.position.clone()
        if (camStartPos.z > shelfCamZ + 0.5) camStartPos.set(0, 1.6, shelfCamZ)
        const detailCam = computeDetailCameraPose(aspect)

        const slotRect = slotEl.getBoundingClientRect()
        const fov = (camera as THREE.PerspectiveCamera).fov || 50
        const targetPose = computeTargetBookPose(
          slotRect,
          vw,
          vh,
          window.scrollY - targetScrollY,
          detailCam.pos,
          detailCam.lookAt,
          fov,
          handle.dimensions[1],
        )

        const pending = pendingStartRef.current
        const startPos =
          pending?.bookId === selectedBook.id
            ? pending.position.clone()
            : new THREE.Vector3(...handle.position)
        const startQuat =
          pending?.bookId === selectedBook.id
            ? pending.quaternion.clone()
            : new THREE.Quaternion()

        const selectPos = new THREE.Vector3(startPos.x, startPos.y, BOOK_BASE_Z + 0.35)
        const selectQuat = computeFrontFacingQuat(camStartPos, selectPos, -0.1)
        const midPos = new THREE.Vector3()
          .lerpVectors(selectPos, targetPose.position, 0.5)
          .add(new THREE.Vector3(0, 0.14, 0.24))

        tState.activeBookId = selectedBook.id
        tState.selectProgress = 0
        tState.pathProgress = 0
        tState.bounceOffset = 0
        tState.dimAmount = 0
        tState.relayToTarget = false
        tState.startPos.copy(startPos)
        tState.selectPos.copy(selectPos)
        tState.midPos.copy(midPos)
        tState.targetPos.copy(targetPose.position)
        tState.startQuat.copy(startQuat)
        tState.selectQuat.copy(selectQuat)
        tState.targetQuat.copy(targetPose.quaternion)
        tState.targetScale = targetPose.scale
        tState.camStartPos.copy(camStartPos)
        tState.camEndPos.copy(detailCam.pos)
        tState.camStartLook.copy(lookAtRef.current)
        tState.camEndLook.copy(detailCam.lookAt)

        let completed = false

        if (reduced) {
          tState.mode = 'reduced'
          gsap.set(textEl, { opacity: 0, y: 0 })
          if (fadeEl) gsap.set(fadeEl, { opacity: 0 })

          tl = gsap.timeline({
            onComplete: () => {
              completed = true
              tState.mode = 'inBook'
              tState.dimAmount = 1
              tState.pathProgress = 1
              tState.selectProgress = 1
              tState.relayToTarget = true
              if (fadeEl) gsap.set(fadeEl, { opacity: 0 })
              ScrollTrigger.refresh()
              finishToBook()
              onAnnounce(`Fiche : ${selectedBook.titre}`)
              requestAnimationFrame(() => {
                sheetTitleRef.current?.focus({ preventScroll: true })
              })
            },
            onInterrupt: () => {
              if (!completed && !disposed) {
                if (fadeEl) gsap.set(fadeEl, { opacity: 0 })
                unlockTransition(useScene.getState().phase)
              }
            },
          })

          if (fadeEl) {
            tl.to(fadeEl, { opacity: 1, duration: 0.15, ease: 'power1.out' }, 0)
          }
          tl.add(() => {
            window.scrollTo(0, targetScrollY)
            camera.position.copy(detailCam.pos)
            lookAtRef.current.copy(detailCam.lookAt)
            camera.lookAt(lookAtRef.current)
            tState.dimAmount = 1
            tState.relayToTarget = true
          }, 0.15)
          tl.to(textEl, { opacity: 1, duration: 0.15, ease: 'power1.out' }, 0.15)
          if (fadeEl) {
            tl.to(fadeEl, { opacity: 0, duration: 0.15, ease: 'power1.in' }, 0.15)
          }
        } else {
          tState.mode = 'toBook'
          gsap.set(textEl, { opacity: 0, y: 18 })

          tl = gsap.timeline({
            onComplete: () => {
              completed = true
              tState.selectProgress = 1
              tState.pathProgress = 1
              tState.bounceOffset = 0
              tState.dimAmount = 1
              tState.relayToTarget = true
              tState.mode = 'inBook'
              ScrollTrigger.refresh()
              finishToBook()
              onAnnounce(`Fiche : ${selectedBook.titre}`)
              requestAnimationFrame(() => {
                sheetTitleRef.current?.focus({ preventScroll: true })
              })
            },
            onInterrupt: () => {
              if (!completed && !disposed) {
                unlockTransition(useScene.getState().phase)
              }
            },
          })

          // 1. Sélection (0 -> 0.3s)
          tl.to(
            tState,
            {
              selectProgress: 1,
              dimAmount: 1,
              duration: 0.3 * speed,
              ease: 'power2.out',
            },
            0,
          )

          // 2. Trajet (0.3s -> 1.1s)
          tl.to(
            tState,
            {
              pathProgress: 1,
              duration: 0.8 * speed,
              ease: 'power3.inOut',
            },
            0.3 * speed,
          )
          tl.to(
            window,
            {
              scrollTo: { y: targetScrollY, autoKill: false },
              duration: 0.8 * speed,
              ease: 'power3.inOut',
            },
            0.3 * speed,
          )

          // 3. Atterrissage (1.1s -> 1.5s)
          tl.to(
            tState,
            {
              bounceOffset: 1,
              duration: 0.14 * speed,
              ease: 'power2.out',
            },
            1.1 * speed,
          )
          tl.to(
            tState,
            {
              bounceOffset: 0,
              duration: 0.26 * speed,
              ease: 'elastic.out(1, 0.55)',
            },
            1.24 * speed,
          )
          tl.to(
            textEl,
            {
              opacity: 1,
              y: 0,
              duration: 0.35 * speed,
              ease: 'power2.out',
            },
            1.15 * speed,
          )
        }

        activeTimelineRef.current = tl
      } catch {
        tl?.kill()
        unlockTransition('shelf')
      }
    })

    return () => {
      disposed = true
      cancelAnimationFrame(rafId)
      tl?.kill()
    }
  }, [
    transitionDirection,
    selectedBook,
    camera,
    slotRef,
    sheetSectionRef,
    sheetTextRef,
    sheetTitleRef,
    crossfadeRef,
    finishToBook,
    unlockTransition,
    onAnnounce,
  ])

  // Reverse GSAP Timeline: Scene 3 Book Sheet -> Library Shelf (~1s)
  useEffect(() => {
    if (transitionDirection !== 'toShelf' || !selectedBook) return

    let disposed = false
    let tl: gsap.core.Timeline | null = null

    const rafId = requestAnimationFrame(() => {
      if (disposed) return
      activeTimelineRef.current?.kill()
      const tState = transitionRef.current
      const reduced = getReducedMotion()

      const textEl = sheetTextRef.current
      const fadeEl = crossfadeRef.current
      const handle = bookHandlesRef.current.get(selectedBook.id)
      const targetHandle = targetHandleRef.current

      if (!handle) {
        tState.activeBookId = null
        tState.mode = 'idle'
        tState.relayToTarget = false
        tState.dimAmount = 0
        window.scrollTo(0, 0)
        finishToShelf()
        return
      }

      if (targetHandle) {
        const liveTarget = targetHandle.getLivePose()
        tState.targetPos.copy(liveTarget.position)
        tState.targetQuat.copy(liveTarget.quaternion)
        tState.targetScale = liveTarget.scale
      }
      tState.relayToTarget = false
      tState.bounceOffset = 0

      tState.startPos.set(...handle.position)
      tState.startQuat.identity()
      tState.selectPos.set(handle.position[0], handle.position[1], BOOK_BASE_Z + 0.35)
      tState.selectQuat.copy(computeFrontFacingQuat(tState.camStartPos, tState.selectPos, -0.1))
      tState.midPos
        .lerpVectors(tState.selectPos, tState.targetPos, 0.5)
        .add(new THREE.Vector3(0, 0.14, 0.24))

      let completed = false

      const finalizeReturn = () => {
        handle.resetRest()
        tState.activeBookId = null
        tState.mode = 'idle'
        tState.selectProgress = 0
        tState.pathProgress = 0
        tState.bounceOffset = 0
        tState.dimAmount = 0
        tState.relayToTarget = false
        if (fadeEl) gsap.set(fadeEl, { opacity: 0 })
        window.scrollTo(0, 0)
        finishToShelf()
        ScrollTrigger.refresh()
      }

      try {
        if (reduced) {
          tState.mode = 'reduced'
          tl = gsap.timeline({
            onComplete: () => {
              completed = true
              finalizeReturn()
            },
            onInterrupt: () => {
              if (!completed && !disposed) finalizeReturn()
            },
          })

          if (fadeEl) {
            tl.to(fadeEl, { opacity: 1, duration: 0.15, ease: 'power1.out' }, 0)
          }
          if (textEl) {
            tl.to(textEl, { opacity: 0, duration: 0.14, ease: 'power1.in' }, 0)
          }
          tl.add(() => {
            window.scrollTo(0, 0)
            camera.position.copy(tState.camStartPos)
            lookAtRef.current.copy(tState.camStartLook)
            camera.lookAt(lookAtRef.current)
            tState.dimAmount = 0
            tState.pathProgress = 0
            tState.selectProgress = 0
          }, 0.15)
          if (fadeEl) {
            tl.to(fadeEl, { opacity: 0, duration: 0.15, ease: 'power1.in' }, 0.15)
          }
        } else {
          tState.mode = 'toShelf'
          const isMobile = window.innerWidth < 768
          const durScale = isMobile ? 0.8 : 1.0

          tl = gsap.timeline({
            onComplete: () => {
              completed = true
              finalizeReturn()
            },
            onInterrupt: () => {
              if (!completed && !disposed) finalizeReturn()
            },
          })

          if (textEl) {
            tl.to(textEl, { opacity: 0, y: 12, duration: 0.22 * durScale, ease: 'power2.in' }, 0)
          }
          tl.to(
            tState,
            {
              pathProgress: 0,
              duration: 0.68 * durScale,
              ease: 'power3.inOut',
            },
            0.06 * durScale,
          )
          tl.to(
            window,
            {
              scrollTo: { y: 0, autoKill: false },
              duration: 0.72 * durScale,
              ease: 'power3.inOut',
            },
            0.05 * durScale,
          )
          tl.to(
            tState,
            {
              selectProgress: 0,
              dimAmount: 0,
              duration: 0.34 * durScale,
              ease: 'power2.inOut',
            },
            0.66 * durScale,
          )
        }

        activeTimelineRef.current = tl
      } catch {
        tl?.kill()
        finalizeReturn()
      }
    })

    return () => {
      disposed = true
      cancelAnimationFrame(rafId)
      tl?.kill()
    }
  }, [transitionDirection, selectedBook, camera, sheetTextRef, crossfadeRef, finishToShelf])

  useEffect(() => {
    return () => {
      swapTimelineRef.current?.kill()
      activeTimelineRef.current?.kill()
      document.body.style.cursor = 'auto'
      onHoveredBookChange(null)
    }
  }, [onHoveredBookChange])

  const handleHoverEnter = useCallback(
    (book: MangaBook, getAnchor: AnchorGetter) => {
      if (useScene.getState().isTransitioning) return
      if (activeDragRef.current && activeDragRef.current !== book.id) return
      hoverStateRef.current = { book, getAnchor }
      onHoveredBookChange(book)
    },
    [onHoveredBookChange],
  )

  const handleHoverLeave = useCallback(
    (id: string) => {
      if (hoverStateRef.current?.book.id === id) {
        hoverStateRef.current = null
        document.body.style.cursor = 'auto'
        onHoveredBookChange(null)
      }
    },
    [onHoveredBookChange],
  )

  const handleDragStart = useCallback(
    (id: string) => {
      activeDragRef.current = id
      setActiveDragId(id)
      onDragActiveChange(true)
    },
    [onDragActiveChange],
  )

  const handleDragMoved = useCallback(
    (id: string) => {
      if (hoverStateRef.current?.book.id === id) {
        onHoveredBookChange(null)
      }
    },
    [onHoveredBookChange],
  )

  const handleDragEnd = useCallback(
    (id: string) => {
      if (activeDragRef.current === id) {
        activeDragRef.current = null
        setActiveDragId(null)
        onDragActiveChange(false)
      }
    },
    [onDragActiveChange],
  )

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const aspect = size.width / Math.max(size.height, 1)
    const tState = transitionRef.current

    // Dim room lighting & surfaces cleanly during transition / Scene 3
    const dim = tState.dimAmount
    if (hemiLightRef.current) hemiLightRef.current.intensity = THREE.MathUtils.lerp(0.9, 0.42, dim)
    if (keyLightRef.current) keyLightRef.current.intensity = THREE.MathUtils.lerp(2.2, 1.35, dim)
    if (overheadLightRef.current) overheadLightRef.current.intensity = THREE.MathUtils.lerp(6.5, 2.5, dim)
    if (lanternLightRef.current) lanternLightRef.current.intensity = THREE.MathUtils.lerp(3.2, 1.1, dim)
    if (detailLightRef.current) detailLightRef.current.intensity = THREE.MathUtils.lerp(0, 2.4, dim)

    for (const mat of wallMatsRef.current) {
      if (mat) mat.color.copy(WALL_COLOR_BASE).lerp(WALL_COLOR_DIM, dim)
    }
    for (const mat of woodMatsRef.current) {
      if (mat) mat.color.copy(WOOD_COLOR_BASE).lerp(WOOD_COLOR_DIM, dim)
    }

    if (tState.mode === 'toBook' || tState.mode === 'toShelf') {
      camera.position.lerpVectors(tState.camStartPos, tState.camEndPos, tState.pathProgress)
      lookAtRef.current.lerpVectors(tState.camStartLook, tState.camEndLook, tState.pathProgress)
      camera.lookAt(lookAtRef.current)
    } else if (tState.mode === 'inBook') {
      const detailCam = computeDetailCameraPose(aspect)
      tState.camEndPos.copy(detailCam.pos)
      tState.camEndLook.copy(detailCam.lookAt)
      camera.position.lerp(detailCam.pos, 0.25)
      lookAtRef.current.lerp(detailCam.lookAt, 0.25)
      camera.lookAt(lookAtRef.current)
    } else if (tState.mode === 'idle') {
      const targetZ = computeShelfCameraZ(aspect)
      const arrivalSpeed = getReducedMotion() ? 8 : 2.6

      camera.position.z = THREE.MathUtils.damp(camera.position.z, targetZ, arrivalSpeed, dt)

      if (activeDragRef.current === null) {
        const parallaxScale = getReducedMotion() ? 0 : 1
        const targetX = pointer.x * 0.08 * parallaxScale
        const targetY = 1.6 + pointer.y * 0.045 * parallaxScale
        camera.position.x = THREE.MathUtils.damp(camera.position.x, targetX, 3.2, dt)
        camera.position.y = THREE.MathUtils.damp(camera.position.y, targetY, 3.2, dt)

        lookAtRef.current.x = THREE.MathUtils.damp(
          lookAtRef.current.x,
          pointer.x * 0.02 * parallaxScale,
          3.2,
          dt,
        )
        lookAtRef.current.y = THREE.MathUtils.damp(lookAtRef.current.y, 1.54, arrivalSpeed, dt)
        lookAtRef.current.z = THREE.MathUtils.damp(lookAtRef.current.z, -2.05, arrivalSpeed, dt)
      }

      camera.lookAt(lookAtRef.current)
    }

    const tooltipEl = tooltipRef.current
    const hovered = hoverStateRef.current
    if (tooltipEl && hovered && activeDragRef.current === null && interactive) {
      hovered.getAnchor(projVec).project(camera)
      const px = THREE.MathUtils.clamp((projVec.x * 0.5 + 0.5) * size.width, 96, size.width - 96)
      const py = THREE.MathUtils.clamp((-projVec.y * 0.5 + 0.5) * size.height, 58, size.height - 40)
      tooltipEl.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0) translate(-50%, calc(-100% - 10px))`
    }
  })

  return (
    <>
      <color attach="background" args={[ROOM_BG]} />
      <fog attach="fog" args={[ROOM_BG, 5.5, 13]} />

      <hemisphereLight ref={hemiLightRef} args={['#ffe3ba', '#241712', 0.9]} />
      <directionalLight
        ref={keyLightRef}
        position={[2.2, 4.1, 2.6]}
        intensity={2.2}
        color="#ffdba8"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
        shadow-camera-near={0.5}
        shadow-camera-far={11}
        shadow-camera-left={-2.5}
        shadow-camera-right={2.5}
        shadow-camera-top={3.2}
        shadow-camera-bottom={-0.5}
      />
      <pointLight
        ref={overheadLightRef}
        position={[0, 2.62, -0.65]}
        intensity={6.5}
        distance={8}
        decay={2}
        color="#ffba68"
      />
      <pointLight
        ref={lanternLightRef}
        position={[-1.55, 1.25, -1.35]}
        intensity={3.2}
        distance={5.5}
        decay={2}
        color="#ff9e4a"
      />
      {/* Warm showcase key light for Scene 3 hero book */}
      <pointLight
        ref={detailLightRef}
        position={[-0.3, 1.9, 0.9]}
        intensity={0}
        distance={5}
        decay={1.8}
        color="#fff0d4"
      />

      {/* Room: floor, walls, ceiling, baseboard */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial
          ref={(m) => {
            woodMatsRef.current[0] = m
          }}
          map={darkWoodTexture}
          roughness={0.68}
        />
      </mesh>
      <mesh position={[0, 2.1, -2.42]} receiveShadow>
        <boxGeometry args={[9, 4.4, 0.2]} />
        <meshStandardMaterial
          ref={(m) => {
            wallMatsRef.current[0] = m
          }}
          color="#1d1a26"
          roughness={0.92}
        />
      </mesh>
      <mesh position={[-3.4, 2.1, 0.5]} receiveShadow>
        <boxGeometry args={[0.2, 4.4, 9]} />
        <meshStandardMaterial
          ref={(m) => {
            wallMatsRef.current[1] = m
          }}
          color="#1d1a26"
          roughness={0.94}
        />
      </mesh>
      <mesh position={[3.4, 2.1, 0.5]} receiveShadow>
        <boxGeometry args={[0.2, 4.4, 9]} />
        <meshStandardMaterial
          ref={(m) => {
            wallMatsRef.current[2] = m
          }}
          color="#1d1a26"
          roughness={0.94}
        />
      </mesh>
      <mesh position={[0, 4.0, 0.5]}>
        <boxGeometry args={[9, 0.2, 9]} />
        <meshStandardMaterial
          ref={(m) => {
            wallMatsRef.current[3] = m
          }}
          color="#14121b"
          roughness={0.95}
        />
      </mesh>
      <mesh position={[0, 0.06, -2.3]} receiveShadow>
        <boxGeometry args={[6.8, 0.12, 0.04]} />
        <meshStandardMaterial
          ref={(m) => {
            woodMatsRef.current[1] = m
          }}
          map={darkWoodTexture}
          roughness={0.75}
        />
      </mesh>

      {/* Wooden bookcase */}
      <group>
        <mesh position={[0, 1.56, -2.26]} receiveShadow>
          <boxGeometry args={[2.16, 1.84, 0.03]} />
          <meshStandardMaterial
            ref={(m) => {
              woodMatsRef.current[2] = m
            }}
            map={darkWoodTexture}
            roughness={0.78}
          />
        </mesh>
        <mesh position={[0, 0.34, -2.09]} castShadow receiveShadow>
          <boxGeometry args={[2.24, 0.68, 0.36]} />
          <meshStandardMaterial
            ref={(m) => {
              woodMatsRef.current[3] = m
            }}
            map={darkWoodTexture}
            roughness={0.72}
          />
        </mesh>
        <mesh position={[-1.1, 1.56, SHELF_Z]} castShadow receiveShadow>
          <boxGeometry args={[0.06, 1.84, 0.38]} />
          <meshStandardMaterial
            ref={(m) => {
              woodMatsRef.current[4] = m
            }}
            map={woodTexture}
            roughness={0.62}
          />
        </mesh>
        <mesh position={[1.1, 1.56, SHELF_Z]} castShadow receiveShadow>
          <boxGeometry args={[0.06, 1.84, 0.38]} />
          <meshStandardMaterial
            ref={(m) => {
              woodMatsRef.current[5] = m
            }}
            map={woodTexture}
            roughness={0.62}
          />
        </mesh>
        <mesh position={[0, 2.5, -2.07]} castShadow receiveShadow>
          <boxGeometry args={[2.32, 0.055, 0.42]} />
          <meshStandardMaterial
            ref={(m) => {
              woodMatsRef.current[6] = m
            }}
            map={woodTexture}
            roughness={0.6}
          />
        </mesh>

        {SHELF_YS.map((y, idx) => (
          <mesh key={y} position={[0, y, SHELF_Z]} castShadow receiveShadow>
            <boxGeometry args={[2.14, SHELF_THICKNESS, 0.36]} />
            <meshStandardMaterial
              ref={(m) => {
                woodMatsRef.current[7 + idx] = m
              }}
              map={woodTexture}
              roughness={0.58}
            />
          </mesh>
        ))}

        {clusters.map((c, idx) => (
          <group key={idx}>
            <mesh position={[c.minX - 0.055, c.shelfY + 0.11, BOOK_BASE_Z]} castShadow receiveShadow>
              <boxGeometry args={[0.035, 0.22, 0.22]} />
              <meshStandardMaterial
                ref={(m) => {
                  woodMatsRef.current[10 + idx * 2] = m
                }}
                map={darkWoodTexture}
                roughness={0.65}
              />
            </mesh>
            <mesh position={[c.maxX + 0.055, c.shelfY + 0.11, BOOK_BASE_Z]} castShadow receiveShadow>
              <boxGeometry args={[0.035, 0.22, 0.22]} />
              <meshStandardMaterial
                ref={(m) => {
                  woodMatsRef.current[11 + idx * 2] = m
                }}
                map={darkWoodTexture}
                roughness={0.65}
              />
            </mesh>
          </group>
        ))}
      </group>

      {/* Floor lantern (andon) */}
      <group position={[-1.56, 0, -1.94]}>
        <mesh position={[0, 0.03, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.3, 0.06, 0.3]} />
          <meshStandardMaterial
            ref={(m) => {
              woodMatsRef.current[16] = m
            }}
            map={darkWoodTexture}
            roughness={0.7}
          />
        </mesh>
        <mesh position={[0, 0.32, 0]} castShadow>
          <boxGeometry args={[0.22, 0.46, 0.22]} />
          <meshStandardMaterial
            color="#ffe5b4"
            emissive="#ffba61"
            emissiveIntensity={0.85}
            roughness={0.9}
          />
        </mesh>
        <mesh position={[0, 0.57, 0]} castShadow>
          <boxGeometry args={[0.28, 0.04, 0.28]} />
          <meshStandardMaterial
            ref={(m) => {
              woodMatsRef.current[17] = m
            }}
            map={darkWoodTexture}
            roughness={0.7}
          />
        </mesh>
      </group>

      {/* 10 standing manga books */}
      {placed.map(({ book, position, dimensions }) => (
        <Book
          key={book.id}
          book={book}
          position={position}
          dimensions={dimensions}
          interactive={interactive && (activeFilter === null || book.format === activeFilter)}
          keyboardFocused={keyboardFocusedBookId === book.id}
          activeDragId={activeDragId}
          filterDimmed={activeFilter !== null && book.format !== activeFilter}
          transitionRef={transitionRef}
          registerHandle={registerHandle}
          onDragStart={handleDragStart}
          onDragMoved={handleDragMoved}
          onDragEnd={handleDragEnd}
          onHoverEnter={handleHoverEnter}
          onHoverLeave={handleHoverLeave}
          onSelect={handleSelectBook}
        />
      ))}

      {/* Scene 3 target book sharing the exact same Canvas, lights, and materials */}
      <Scene3TargetBook
        book={selectedBook}
        dimensions={selectedBookDims}
        slotRef={slotRef}
        transitionRef={transitionRef}
        isInteractiveDetail={phase === 'book' && !isTransitioning}
        reducedMotion={getReducedMotion()}
        registerTargetHandle={registerTargetHandle}
      />

      <DustParticles />
    </>
  )
}
