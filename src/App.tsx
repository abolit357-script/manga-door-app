import { useCallback, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import gsap from 'gsap'
import { ScrollToPlugin } from 'gsap/ScrollToPlugin'
import FerrofluidArrowButton from './components/FerrofluidArrowButton'
import LibraryStory from './components/LibraryStory'
import Scene1Video from './scenes/Scene1Video'
import Scene2Library, { MANGAS } from './scenes/Scene2Library'
import Scene3BookDetail from './scenes/Scene3BookDetail'
import { useScene } from './store'
import type { MangaBook } from './types/manga'
import { preloadBookCovers } from './utils/bookTextures'
import './scene1.css'

gsap.registerPlugin(ScrollToPlugin)

export default function App() {
  const phase = useScene((s) => s.phase)
  const selectedBook = useScene((s) => s.selectedBook)
  const isTransitioning = useScene((s) => s.isTransitioning)
  const returnToDoor = useScene((s) => s.returnToDoor)

  const tooltipRef = useRef<HTMLDivElement>(null)
  const slotRef = useRef<HTMLDivElement>(null)
  const sheetSectionRef = useRef<HTMLElement>(null)
  const sheetTextRef = useRef<HTMLDivElement>(null)
  const sheetTitleRef = useRef<HTMLHeadingElement>(null)
  const crossfadeRef = useRef<HTMLDivElement>(null)
  const openBookTriggerRef = useRef<((book: MangaBook) => void) | null>(null)
  const openDirectBookTriggerRef = useRef<((book: MangaBook) => void) | null>(null)
  const returnShelfTriggerRef = useRef<(() => void) | null>(null)
  const switchBookTriggerRef = useRef<((book: MangaBook, dir: 'prev' | 'next') => void) | null>(null)

  const [hoveredBook, setHoveredBook] = useState<MangaBook | null>(null)
  const [isDraggingBook, setIsDraggingBook] = useState(false)
  const [keyboardFocusedBookId, setKeyboardFocusedBookId] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [doorFlash, setDoorFlash] = useState(false)
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 768,
  )

  const inLibrary = phase === 'shelf' || phase === 'book'

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Preload all 10 cover textures early so Scene 2 & Scene 3 display immediately
  useEffect(() => {
    preloadBookCovers(MANGAS)
  }, [])

  // Fade out the warm golden flash smoothly right after Scene 2 paints its first frames
  useEffect(() => {
    if (phase !== 'shelf' || !doorFlash) return
    const timer = window.setTimeout(() => {
      setDoorFlash(false)
    }, 80)
    return () => window.clearTimeout(timer)
  }, [phase, doorFlash])

  // Lock page scroll only during door/opening; allow scrolling through Scene 2 story and Scene 3
  useEffect(() => {
    const html = document.documentElement
    const lockScroll = !inLibrary
    html.classList.toggle('lock-scroll', lockScroll)
    if (lockScroll && window.scrollY !== 0) {
      window.scrollTo(0, 0)
    }
  }, [inLibrary])

  // Clear hover tooltip if the user scrolls down into the editorial story
  useEffect(() => {
    if (phase !== 'shelf') return
    const onScroll = () => {
      if (window.scrollY > 40) {
        setHoveredBook(null)
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [phase])

  useEffect(() => {
    if (!isTransitioning) return

    const preventWheelOrTouch = (e: Event) => {
      e.preventDefault()
    }
    const preventScrollKeys = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Space', 'Home', 'End', ' '].includes(e.key)) {
        e.preventDefault()
      }
    }

    window.addEventListener('wheel', preventWheelOrTouch, { passive: false })
    window.addEventListener('touchmove', preventWheelOrTouch, { passive: false })
    window.addEventListener('keydown', preventScrollKeys)

    return () => {
      window.removeEventListener('wheel', preventWheelOrTouch)
      window.removeEventListener('touchmove', preventWheelOrTouch)
      window.removeEventListener('keydown', preventScrollKeys)
    }
  }, [isTransitioning])

  const handleHoveredBookChange = useCallback((book: MangaBook | null) => {
    setHoveredBook(book)
  }, [])

  const handleBackToDoor = useCallback(() => {
    if (useScene.getState().isTransitioning) return
    setHoveredBook(null)
    setKeyboardFocusedBookId(null)
    setAnnouncement('')
    setDoorFlash(false)
    window.scrollTo(0, 0)
    returnToDoor()
  }, [returnToDoor])

  const handleBackToShelf = useCallback(() => {
    returnShelfTriggerRef.current?.()
  }, [])

  const handleKeyboardSelect = useCallback((book: MangaBook) => {
    setKeyboardFocusedBookId(null)
    openBookTriggerRef.current?.(book)
  }, [])

  const handleToggleSound = useCallback(() => {
    setSoundEnabled((prev) => !prev)
  }, [])

  const handleFilterToggle = useCallback((filter: string) => {
    setActiveFilter((prev) => (prev === filter ? null : filter))
  }, [])

  const browsableBooks = (() => {
    if (!activeFilter) return MANGAS
    const filtered = MANGAS.filter((m) => m.format === activeFilter)
    if (selectedBook && !filtered.some((m) => m.id === selectedBook.id)) {
      return MANGAS
    }
    return filtered.length > 0 ? filtered : MANGAS
  })()

  const selectedBookIndex = selectedBook
    ? Math.max(0, browsableBooks.findIndex((b) => b.id === selectedBook.id))
    : 0

  const handlePrevBook = useCallback(() => {
    if (!selectedBook || browsableBooks.length <= 1) return
    const prevIdx = (selectedBookIndex - 1 + browsableBooks.length) % browsableBooks.length
    switchBookTriggerRef.current?.(browsableBooks[prevIdx], 'prev')
  }, [selectedBook, browsableBooks, selectedBookIndex])

  const handleNextBook = useCallback(() => {
    if (!selectedBook || browsableBooks.length <= 1) return
    const nextIdx = (selectedBookIndex + 1) % browsableBooks.length
    switchBookTriggerRef.current?.(browsableBooks[nextIdx], 'next')
  }, [selectedBook, browsableBooks, selectedBookIndex])

  const handleScrollToStory = useCallback(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const target = document.getElementById('story-hook')
    if (!target) return
    if (reduced) {
      window.scrollTo(0, target.offsetTop)
    } else {
      gsap.to(window, { scrollTo: { y: target, autoKill: true }, duration: 0.85, ease: 'power3.inOut' })
    }
  }, [])

  const handleExploreLibrary = useCallback(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      window.scrollTo(0, 0)
    } else {
      gsap.to(window, { scrollTo: { y: 0, autoKill: true }, duration: 0.95, ease: 'power3.inOut' })
    }
  }, [])

  const handleStorySelectBook = useCallback((book: MangaBook) => {
    if (window.scrollY < 40) {
      openBookTriggerRef.current?.(book)
    } else {
      openDirectBookTriggerRef.current?.(book)
    }
  }, [])

  return (
    <div
      className={`app-shell ${isTransitioning ? 'is-transitioning' : ''} ${isDraggingBook ? 'dragging-book' : ''}`}
    >
      {!inLibrary && (
        <Scene1Video
          soundEnabled={soundEnabled}
          onToggleSound={handleToggleSound}
          onFlashChange={setDoorFlash}
        />
      )}

      {inLibrary && (
        <Canvas
          className="stage-canvas"
          shadows
          camera={{ position: [0, 1.7, 1], fov: 50 }}
          dpr={isMobile ? [1, 1.5] : [1, 1.75]}
        >
          <Scene2Library
            tooltipRef={tooltipRef}
            slotRef={slotRef}
            sheetSectionRef={sheetSectionRef}
            sheetTextRef={sheetTextRef}
            sheetTitleRef={sheetTitleRef}
            crossfadeRef={crossfadeRef}
            keyboardFocusedBookId={keyboardFocusedBookId}
            openBookTriggerRef={openBookTriggerRef}
            openDirectBookTriggerRef={openDirectBookTriggerRef}
            returnShelfTriggerRef={returnShelfTriggerRef}
            switchBookTriggerRef={switchBookTriggerRef}
            onHoveredBookChange={handleHoveredBookChange}
            onDragActiveChange={setIsDraggingBook}
            onAnnounce={setAnnouncement}
            activeFilter={activeFilter}
            soundEnabled={soundEnabled}
          />
        </Canvas>
      )}

      <div className={`flash ${doorFlash ? 'active' : ''} ${phase}`} aria-hidden="true" />
      <div ref={crossfadeRef} className="reduced-crossfade" aria-hidden="true" />

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      {inLibrary && (
        <main className="library-scroll-flow">
          <section id="scene-library" className="library-section" aria-label="Bibliothèque de mangas">
            {phase === 'shelf' && (
              <>
                {!selectedBook && !isTransitioning && (
                  <FerrofluidArrowButton
                    disabled={isTransitioning}
                    onClick={handleBackToDoor}
                  />
                )}

                {/* Filtres format */}
                {!isTransitioning && (
                  <div className="library-filters" role="group" aria-label="Filtrer par format">
                    {['Manga', 'Light novel', 'Roman visuel'].map((f) => {
                      const label = f === 'Light novel' ? 'LN' : f === 'Roman visuel' ? 'VN' : 'MG'
                      return (
                        <button
                          key={f}
                          type="button"
                          className={`filter-btn ${activeFilter === f ? 'active' : ''}`}
                          onClick={() => handleFilterToggle(f)}
                          aria-pressed={activeFilter === f}
                        >
                          {label}
                        </button>
                      )
                    })}
                    {activeFilter && (
                      <button
                        type="button"
                        className="filter-btn filter-clear"
                        onClick={() => setActiveFilter(null)}
                        aria-label="Effacer le filtre"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )}

                {/* Compteur de titres */}
                {!isTransitioning && (
                  <p className="library-count" aria-live="polite">
                    {activeFilter
                      ? `${MANGAS.filter((m) => m.format === activeFilter).length} titre${MANGAS.filter((m) => m.format === activeFilter).length > 1 ? 's' : ''} · ${activeFilter}`
                      : `${MANGAS.length} titres dans la bibliothèque`}
                  </p>
                )}

                {/* Keyboard-accessible book navigation matching the 3D click animation */}
                <nav className="keyboard-shelf-nav" aria-label="Sélectionner un livre au clavier">
                  {MANGAS.map((book) => (
                    <button
                      key={book.id}
                      type="button"
                      className="sr-book-btn"
                      disabled={isTransitioning}
                      onFocus={() => setKeyboardFocusedBookId(book.id)}
                      onBlur={() =>
                        setKeyboardFocusedBookId((prev) => (prev === book.id ? null : prev))
                      }
                      onClick={() => handleKeyboardSelect(book)}
                    >
                      Ouvrir : {book.titre}
                    </button>
                  ))}
                </nav>

                <div
                  ref={tooltipRef}
                  className={`book-tooltip ${hoveredBook && !isTransitioning ? 'visible' : ''}`}
                  role="tooltip"
                  aria-hidden={!hoveredBook || isTransitioning}
                >
                  {hoveredBook && (
                    <>
                      <span className="book-tooltip-title">{hoveredBook.titre}</span>
                      <span className="book-tooltip-tome">{hoveredBook.format}</span>
                    </>
                  )}
                </div>

                {!isTransitioning && (
                  <div className="library-bottom-bar">
                    <p className="library-hint">
                      Survoler un livre · Glisser pour le faire pivoter · Cliquer pour ouvrir sa fiche
                    </p>
                    {!selectedBook && (
                      <button
                        type="button"
                        className="story-scroll-cue"
                        onClick={handleScrollToStory}
                      >
                        Continuer la visite ↓
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </section>

          {phase === 'shelf' && !selectedBook && (
            <LibraryStory
              books={MANGAS}
              onSelectBook={handleStorySelectBook}
              onExploreShelf={handleExploreLibrary}
            />
          )}

          {selectedBook && (
            <Scene3BookDetail
              book={selectedBook}
              currentIndex={selectedBookIndex}
              totalCount={browsableBooks.length}
              isInteractive={phase === 'book' && !isTransitioning}
              isTransitioning={isTransitioning}
              sectionRef={sheetSectionRef}
              slotRef={slotRef}
              textRef={sheetTextRef}
              titleRef={sheetTitleRef}
              onPrev={handlePrevBook}
              onNext={handleNextBook}
              onBack={handleBackToShelf}
            />
          )}
        </main>
      )}
    </div>
  )
}
