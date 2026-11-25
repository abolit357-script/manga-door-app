import { useEffect, useMemo, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import type { MangaBook } from '../types/manga'

gsap.registerPlugin(ScrollTrigger)

type LibraryStoryProps = {
  books: MangaBook[]
  onSelectBook: (book: MangaBook) => void
  onExploreShelf: () => void
}

type GenrePanelSpec = {
  id: string
  title: string
  tagline: string
  moodClass: string
  matchGenres: string[]
}

const GENRE_PANELS: GenrePanelSpec[] = [
  {
    id: 'romance',
    title: 'Romance & Tranche de vie',
    tagline: 'Silences retenus, éclats de rire et promesses du quotidien.',
    moodClass: 'mood-romance',
    matchGenres: ['Romance', 'Comédie'],
  },
  {
    id: 'fantasy',
    title: 'Fantasy & Aventure',
    tagline: 'Contes d’ailleurs, sortilèges et compagnons de route.',
    moodClass: 'mood-fantasy',
    matchGenres: ['Fantasy', 'Aventure', 'Isekai'],
  },
  {
    id: 'action',
    title: 'Action & Shōnen',
    tagline: 'Lames affûtées, pactes anciens et combats décisifs.',
    moodClass: 'mood-action',
    matchGenres: ['Action', 'Shōnen', 'Fantasy sombre'],
  },
  {
    id: 'mystery',
    title: 'Mystère & Historique',
    tagline: 'Intrigues de palais, poisons subtils et destins croisés.',
    moodClass: 'mood-mystery',
    matchGenres: ['Mystère', 'Historique', 'Drame'],
  },
]

function shortenSynopsis(text: string): string {
  const firstPeriod = text.indexOf('.')
  if (firstPeriod > 25 && firstPeriod < text.length - 1) {
    return text.slice(0, firstPeriod + 1)
  }
  return text
}

export default function LibraryStory({
  books,
  onSelectBook,
  onExploreShelf,
}: LibraryStoryProps) {
  const rootRef = useRef<HTMLDivElement>(null)

  const featuredBook = useMemo(
    () => books.find((b) => b.id === 'kusuriya-no-hitorigoto') ?? books[0],
    [books],
  )

  const genreGroups = useMemo(
    () =>
      GENRE_PANELS.map((panel) => ({
        ...panel,
        items: books.filter((b) =>
          b.genres.some((g) => panel.matchGenres.includes(g)),
        ),
      })),
    [books],
  )

  const finaleRowOne = useMemo(() => books, [books])
  const finaleRowTwo = useMemo(
    () => [...books.slice(5), ...books.slice(0, 5)],
    [books],
  )

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return

    const ctx = gsap.context(() => {
      // 1. Accroche
      gsap.from('.story-hook-inner > *', {
        y: 26,
        opacity: 0,
        duration: 0.75,
        stagger: 0.1,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: '.story-hook',
          start: 'top 76%',
          once: true,
        },
      })

      // 2. Manga vedette : la couverture se détache et s'agrandit, puis révèle le texte
      const featuredTl = gsap.timeline({
        scrollTrigger: {
          trigger: '.story-featured',
          start: 'top 72%',
          once: true,
        },
      })
      featuredTl
        .fromTo(
          '.story-featured-cover-wrap',
          { scale: 0.86, y: 28, opacity: 0 },
          { scale: 1, y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' },
        )
        .from(
          '.story-featured-copy > *',
          { y: 18, opacity: 0, duration: 0.55, stagger: 0.08, ease: 'power2.out' },
          '-=0.32',
        )

      // 3. Panneaux de genres
      gsap.utils.toArray<HTMLElement>('.story-genre-panel').forEach((panel) => {
        gsap.from(panel.querySelectorAll('.story-genre-head, .story-genre-card'), {
          y: 24,
          opacity: 0,
          duration: 0.65,
          stagger: 0.07,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: panel,
            start: 'top 78%',
            once: true,
          },
        })
      })

      // 4. Sélection finale
      gsap.from('.story-finale-inner > *', {
        y: 22,
        opacity: 0,
        duration: 0.65,
        stagger: 0.09,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: '.story-finale',
          start: 'top 78%',
          once: true,
        },
      })
    }, root)

    return () => ctx.revert()
  }, [])

  if (!featuredBook) return null

  return (
    <div ref={rootRef} className="library-story">
      {/* 1. Accroche éditoriale */}
      <section id="story-hook" className="story-section story-hook" aria-label="Introduction à la visite">
        <div className="story-hook-inner">
          <p className="story-eyebrow">Bibliothèque · {books.length} œuvres</p>
          <h2 className="story-headline">Choisis ton prochain voyage</h2>
          <p className="story-lead">
            Chaque dos sur l’étagère ouvre un monde à part. Fais défiler la visite pour découvrir nos coups de projecteur et nos ambiances.
          </p>
          <div className="story-scroll-line" aria-hidden="true" />
        </div>
      </section>

      {/* 2. Manga vedette */}
      <section className="story-section story-featured" aria-label={`Œuvre vedette : ${featuredBook.titre}`}>
        <div className="story-featured-grid">
          <button
            type="button"
            className="story-featured-cover-wrap"
            onClick={() => onSelectBook(featuredBook)}
            aria-label={`Ouvrir la fiche de ${featuredBook.titre}`}
          >
            <img
              src={featuredBook.couverture}
              alt={`Couverture de ${featuredBook.titre}`}
              width={640}
              height={960}
              loading="lazy"
              className="story-featured-cover"
            />
          </button>

          <div className="story-featured-copy">
            <p className="story-eyebrow">À la une · {featuredBook.format}</p>
            <h2 className="story-featured-title">{featuredBook.titre}</h2>
            <ul className="story-genre-pills" aria-label="Genres">
              {featuredBook.genres.map((genre) => (
                <li key={genre} className="story-genre-pill">
                  {genre}
                </li>
              ))}
            </ul>
            <p className="story-featured-synopsis">{shortenSynopsis(featuredBook.synopsis)}</p>
            <button
              type="button"
              className="story-cta-btn"
              onClick={() => onSelectBook(featuredBook)}
            >
              Ouvrir sa fiche
            </button>
          </div>
        </div>
      </section>

      {/* 3. Grands panneaux visuels par genres */}
      <section className="story-genres-wrapper" aria-label="Explorer par genre">
        <header className="story-genres-intro">
          <p className="story-eyebrow">Parcours par genres</p>
          <h2 className="story-subheadline">Quatre atmosphères à parcourir</h2>
        </header>

        <div className="story-genres-stack">
          {genreGroups.map((group) => (
            <article
              key={group.id}
              className={`story-genre-panel ${group.moodClass}`}
              aria-labelledby={`genre-title-${group.id}`}
            >
              <div className="story-genre-head">
                <h3 id={`genre-title-${group.id}`} className="story-genre-title">
                  {group.title}
                </h3>
                <p className="story-genre-tagline">{group.tagline}</p>
              </div>

              <div className="story-genre-cards">
                {group.items.map((book) => (
                  <button
                    key={`${group.id}-${book.id}`}
                    type="button"
                    className="story-genre-card"
                    onClick={() => onSelectBook(book)}
                    aria-label={`Découvrir ${book.titre}`}
                  >
                    <div className="story-card-cover-box">
                      <img
                        src={book.couverture}
                        alt={book.titre}
                        width={640}
                        height={960}
                        loading="lazy"
                        className="story-card-cover"
                      />
                    </div>
                    <span className="story-card-title">{book.titre}</span>
                    <span className="story-card-format">{book.format}</span>
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* 4. Sélection finale de couvertures (2 rangées opposées) & retour à l'étagère */}
      <section className="story-section story-finale" aria-label="Explorer la bibliothèque">
        <div className="story-finale-inner">
          <p className="story-eyebrow">Prêt à choisir ?</p>
          <h2 className="story-headline">Prends un tome en main</h2>

          <div className="story-marquees">
            {/* Rangée 1 : défilement gauche -> droite */}
            <div className="story-marquee-row" aria-label="Première rangée de couvertures">
              <div className="story-marquee-track story-marquee-ltr">
                {[0, 1].map((dup) => (
                  <div
                    key={dup}
                    className="story-marquee-group"
                    aria-hidden={dup === 1 || undefined}
                  >
                    {finaleRowOne.map((book) => (
                      <button
                        key={`r1-${dup}-${book.id}`}
                        type="button"
                        className="story-marquee-card"
                        tabIndex={dup === 1 ? -1 : undefined}
                        onClick={() => onSelectBook(book)}
                        aria-label={dup === 0 ? `Ouvrir ${book.titre}` : undefined}
                      >
                        <img
                          src={book.couverture}
                          alt={dup === 0 ? book.titre : ''}
                          width={640}
                          height={960}
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Rangée 2 : défilement droite -> gauche */}
            <div className="story-marquee-row" aria-label="Seconde rangée de couvertures">
              <div className="story-marquee-track story-marquee-rtl">
                {[0, 1].map((dup) => (
                  <div
                    key={dup}
                    className="story-marquee-group"
                    aria-hidden={dup === 1 || undefined}
                  >
                    {finaleRowTwo.map((book) => (
                      <button
                        key={`r2-${dup}-${book.id}`}
                        type="button"
                        className="story-marquee-card"
                        tabIndex={dup === 1 ? -1 : undefined}
                        onClick={() => onSelectBook(book)}
                        aria-label={dup === 0 ? `Ouvrir ${book.titre}` : undefined}
                      >
                        <img
                          src={book.couverture}
                          alt={dup === 0 ? book.titre : ''}
                          width={640}
                          height={960}
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="story-cta-btn story-cta-large"
            onClick={onExploreShelf}
          >
            Explorer la bibliothèque
          </button>
        </div>
      </section>
    </div>
  )
}
