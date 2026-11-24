export type MangaBook = {
  id: string
  titre: string
  auteur: string
  annee: number
  genres: string[]
  tomes: number
  format: string
  synopsis: string
  pourquoiLire: string
  couverture: string
  couleurDos: string
  note?: number
  anime?: boolean
  lienMAL?: string
  lienAmazon?: string
}
