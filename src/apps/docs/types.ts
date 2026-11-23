import type { Component } from 'vue'

export type DocCategoryId = 'getting-started' | 'obs' | 'live' | 'client' | 'page' | 'ops'

export interface DocFrontmatter {
  title: string
  description?: string
  category?: DocCategoryId
  order?: number
  badge?: string
  tags?: string[]
  manageRoute?: string
  manageLabel?: string
  updatedAt?: string
}

export interface DocEntry {
  slug: string
  title: string
  description: string
  category: DocCategoryId
  order: number
  badge?: string
  tags: string[]
  manageRoute?: string
  manageLabel?: string
  updatedAt?: string
  loadComponent: () => Promise<{ default: Component }>
}

export interface DocCategoryMeta {
  id: DocCategoryId
  title: string
  description: string
  order: number
}

export interface DocCategoryGroup extends DocCategoryMeta {
  items: DocEntry[]
}

export interface DocTocItem {
  id: string
  text: string
  level: 2 | 3 | 4
}

export interface DocSearchResult {
  entry: DocEntry
  categoryTitle: string
  snippet: string
  score: number
}
