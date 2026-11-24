import { create } from 'zustand'
import type { MangaBook } from './types/manga'

export type Phase = 'door' | 'opening' | 'shelf' | 'book'
export type TransitionDirection = 'toBook' | 'toBookDirect' | 'toShelf' | null

type SceneState = {
  phase: Phase
  selectedBook: MangaBook | null
  isTransitioning: boolean
  transitionDirection: TransitionDirection
  startOpening: () => void
  enterShelf: () => void
  returnToDoor: () => void
  beginToBook: (book: MangaBook) => boolean
  beginDirectToBook: (book: MangaBook) => boolean
  finishToBook: () => void
  beginToShelf: () => boolean
  finishToShelf: () => void
  switchBook: (book: MangaBook) => void
  unlockTransition: (fallbackPhase?: Phase) => void
}

export const useScene = create<SceneState>((set, get) => ({
  phase: 'door',
  selectedBook: null,
  isTransitioning: false,
  transitionDirection: null,
  startOpening: () => {
    if (get().phase === 'door' && !get().isTransitioning) {
      set({ phase: 'opening' })
    }
  },
  enterShelf: () => {
    if (get().phase === 'opening') {
      set({ phase: 'shelf', isTransitioning: false, transitionDirection: null })
    }
  },
  returnToDoor: () => {
    if (get().isTransitioning) return
    const p = get().phase
    if (p === 'shelf' || p === 'book') {
      set({
        phase: 'door',
        selectedBook: null,
        isTransitioning: false,
        transitionDirection: null,
      })
    }
  },
  beginToBook: (book) => {
    const s = get()
    if (s.isTransitioning || s.phase !== 'shelf') return false
    set({
      selectedBook: book,
      isTransitioning: true,
      transitionDirection: 'toBook',
    })
    return true
  },
  beginDirectToBook: (book) => {
    const s = get()
    if (s.isTransitioning || s.phase !== 'shelf') return false
    set({
      selectedBook: book,
      isTransitioning: true,
      transitionDirection: 'toBookDirect',
    })
    return true
  },
  finishToBook: () => {
    set({
      phase: 'book',
      isTransitioning: false,
      transitionDirection: null,
    })
  },
  beginToShelf: () => {
    const s = get()
    if (s.isTransitioning || s.phase !== 'book') return false
    set({
      isTransitioning: true,
      transitionDirection: 'toShelf',
    })
    return true
  },
  finishToShelf: () => {
    set({
      phase: 'shelf',
      selectedBook: null,
      isTransitioning: false,
      transitionDirection: null,
    })
  },
  switchBook: (book) => {
    const s = get()
    if (s.isTransitioning || s.phase !== 'book') return
    set({ selectedBook: book })
  },
  unlockTransition: (fallbackPhase) => {
    const s = get()
    const nextPhase = fallbackPhase ?? (s.phase === 'book' ? 'book' : 'shelf')
    set({
      phase: nextPhase,
      selectedBook: nextPhase === 'shelf' ? null : s.selectedBook,
      isTransitioning: false,
      transitionDirection: null,
    })
  },
}))
