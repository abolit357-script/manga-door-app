import { useEffect, useMemo, useRef, useState } from 'react'
import { useScene } from '../store'

type Scene1VideoProps = {
  soundEnabled: boolean
  onToggleSound: () => void
  onFlashChange: (active: boolean) => void
}

export default function Scene1Video({
  soundEnabled,
  onToggleSound,
  onFlashChange,
}: Scene1VideoProps) {
  const phase = useScene((s) => s.phase)
  const startOpening = useScene((s) => s.startOpening)
  const enterShelf = useScene((s) => s.enterShelf)

  const videoRef = useRef<HTMLVideoElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [videoReady, setVideoReady] = useState(false)

  const reducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  // Reset video cleanly to frame 0 whenever returning to the door
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (phase === 'door') {
      onFlashChange(false)
      video.pause()
      try {
        video.currentTime = 0
      } catch {
        // Ignore if metadata isn't loaded yet
      }
    }
  }, [phase, onFlashChange])

  // Subtle pointer parallax at rest without React re-renders
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || reducedMotion || phase !== 'door') {
      if (wrap) wrap.style.transform = 'scale(1.02) translate3d(0px, 0px, 0)'
      return
    }

    let targetX = 0
    let targetY = 0
    let curX = 0
    let curY = 0
    let raf = 0

    const onMove = (e: PointerEvent) => {
      const nx = (e.clientX / Math.max(window.innerWidth, 1) - 0.5) * 2
      const ny = (e.clientY / Math.max(window.innerHeight, 1) - 0.5) * 2
      targetX = -nx * 10
      targetY = -ny * 6
    }

    const tick = () => {
      curX += (targetX - curX) * 0.08
      curY += (targetY - curY) * 0.08
      wrap.style.transform = `scale(1.03) translate3d(${curX.toFixed(2)}px, ${curY.toFixed(2)}px, 0)`
      raf = requestAnimationFrame(tick)
    }

    window.addEventListener('pointermove', onMove)
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
    }
  }, [phase, reducedMotion])

  // Play video and synchronize warm golden flash at the end into Scene 2
  useEffect(() => {
    if (phase !== 'opening') return
    const video = videoRef.current

    if (reducedMotion || !video) {
      onFlashChange(true)
      const t = window.setTimeout(() => enterShelf(), 320)
      return () => window.clearTimeout(t)
    }

    let finished = false
    let fallbackTimer: number | null = null

    const finish = () => {
      if (finished) return
      finished = true
      if (fallbackTimer !== null) window.clearTimeout(fallbackTimer)
      enterShelf()
    }

    const onTimeUpdate = () => {
      if (!video.duration || Number.isNaN(video.duration)) return
      const remaining = video.duration - video.currentTime
      if (remaining <= 0.85) {
        onFlashChange(true)
      }
    }

    const onEnded = () => {
      onFlashChange(true)
      finish()
    }

    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('ended', onEnded)

    video.muted = !soundEnabled
    try {
      video.currentTime = 0
    } catch {
      // Ignore seek errors if not yet seekable
    }

    const playPromise = video.play()
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        video.muted = true
        video.play().catch(() => {
          onFlashChange(true)
          fallbackTimer = window.setTimeout(finish, 400)
        })
      })
    }

    fallbackTimer = window.setTimeout(() => {
      onFlashChange(true)
      window.setTimeout(finish, 500)
    }, 7000)

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('ended', onEnded)
      if (fallbackTimer !== null) window.clearTimeout(fallbackTimer)
    }
  }, [phase, reducedMotion, soundEnabled, enterShelf, onFlashChange])

  return (
    <div className="scene1-video-stage">
      <div ref={wrapRef} className={`scene1-video-wrap ${phase}`}>
        <video
          ref={videoRef}
          className="scene1-video"
          src="/videos/ouverture-porte.mp4"
          poster="/videos/door-poster.jpg"
          preload="auto"
          playsInline
          muted={!soundEnabled}
          onLoadedData={() => setVideoReady(true)}
        />
      </div>

      {!videoReady && (
        <span className="sr-only" role="status" aria-live="polite">
          Chargement de la vidéo d&apos;entrée...
        </span>
      )}

      <button
        type="button"
        className={`enter ${phase}`}
        onClick={startOpening}
        aria-label="Entrer dans l'univers des manga"
      >
        <span className="head">
          <span className="title">Bienvenue dans l&apos;univers des manga</span>
          <span className="jp" lang="ja">
            漫画の世界へようこそ
          </span>
        </span>
        <span className="hint">Clique pour entrer</span>
      </button>

      {phase === 'door' && (
        <button
          type="button"
          className="sound-toggle"
          aria-pressed={soundEnabled}
          aria-label={soundEnabled ? 'Couper le son' : 'Activer le son'}
          title={soundEnabled ? 'Son activé' : 'Son désactivé'}
          onClick={(e) => {
            e.stopPropagation()
            onToggleSound()
          }}
        >
          {soundEnabled ? '🔊' : '🔇'}
        </button>
      )}
    </div>
  )
}
