import { useEffect } from 'react'
import type { MangaBook } from '../types/manga'

type Scene3BookDetailProps = {
  book: MangaBook
  currentIndex: number
  totalCount: number
  isInteractive: boolean
  isTransitioning: boolean
  sectionRef: React.RefObject<HTMLElement>
  slotRef: React.RefObject<HTMLDivElement>
  textRef: React.RefObject<HTMLDivElement>
  titleRef: React.RefObject<HTMLHeadingElement>
  onPrev: () => void
  onNext: () => void
  onBack: () => void
}

function StarRating({ note }: { note: number }) {
  return (
    <div className="book-sheet-stars" aria-label={`Note : ${note} sur 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`star ${i <= note ? 'filled' : ''}`} aria-hidden="true">
          {i <= note ? '★' : '☆'}
        </span>
      ))}
    </div>
  )
}

export default function Scene3BookDetail({
  book,
  currentIndex,
  totalCount,
  isInteractive,
  isTransitioning,
  sectionRef,
  slotRef,
  textRef,
  titleRef,
  onPrev,
  onNext,
  onBack,
}: Scene3BookDetailProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isInteractive || isTransitioning) return
      if (e.key === 'Escape') {
        onBack()
      } else if (e.key === 'ArrowLeft' && !e.altKey && !e.ctrlKey && !e.metaKey) {
        onPrev()
      } else if (e.key === 'ArrowRight' && !e.altKey && !e.ctrlKey && !e.metaKey) {
        onNext()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isInteractive, isTransitioning, onBack, onPrev, onNext])

  const volumeLabel = book.tomes > 1 ? `${book.tomes} tomes` : '1 tome'

  return (
    <section
      id="scene-book-detail"
      ref={sectionRef}
      className={`book-sheet-section ${isInteractive ? 'active' : ''}`}
      aria-label={`Fiche de ${book.titre}`}
    >
      <div className="book-sheet-layout">
        {/* Transparent layout slot where the 3D book inside the Canvas lands */}
        <div
          ref={slotRef}
          className="book-target-slot"
          aria-hidden="true"
        />

        <div ref={textRef} className="book-sheet-info-panel">
          <div className="book-sheet-nav-bar">
            <div className="book-sheet-nav-group" role="group" aria-label="Changer de livre">
              <button
                type="button"
                className="book-sheet-nav-btn"
                onClick={onPrev}
                disabled={isTransitioning || totalCount <= 1}
                aria-label="Livre précédent"
              >
                ← Précédent
              </button>
              <span className="book-sheet-nav-counter" aria-live="off">
                {currentIndex + 1} / {totalCount}
              </span>
              <button
                type="button"
                className="book-sheet-nav-btn"
                onClick={onNext}
                disabled={isTransitioning || totalCount <= 1}
                aria-label="Livre suivant"
              >
                Suivant →
              </button>
            </div>

            <button
              type="button"
              className="book-sheet-back"
              onClick={onBack}
              disabled={isTransitioning}
            >
              ← Bibliothèque
            </button>
          </div>

          <div className="book-sheet-meta-row">
            <p className="book-sheet-meta">
              {book.format} · {book.annee} · {volumeLabel}
            </p>
            {book.anime && (
              <span className="book-sheet-anime-badge" title="Adapté en anime">
                📺 Anime
              </span>
            )}
          </div>

          <h1 ref={titleRef} tabIndex={-1} className="book-sheet-title">
            {book.titre}
          </h1>
          <p className="book-sheet-author">Par {book.auteur}</p>

          {book.note !== undefined && <StarRating note={book.note} />}

          <ul className="book-sheet-genres" aria-label="Genres">
            {book.genres.map((genre) => (
              <li key={genre} className="book-sheet-genre">
                {genre}
              </li>
            ))}
          </ul>

          <p className="book-sheet-synopsis">{book.synopsis}</p>

          <div className="book-sheet-why">
            <span className="book-sheet-why-label">Pourquoi le lire</span>
            <p className="book-sheet-why-text">{book.pourquoiLire}</p>
          </div>

          {/* Liens externes supprimés */}
        </div>
      </div>
    </section>
  )
}
