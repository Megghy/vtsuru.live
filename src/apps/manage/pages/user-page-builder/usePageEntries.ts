import { computed } from 'vue'

import type { UserPageEditor } from './useUserPageEditor'

export interface PageEntry {
  slug: string
  navVisible: boolean
  navOrder: number
  title: string
}

export function usePageEntries(editor: UserPageEditor) {
  const pageEntries = computed<PageEntry[]>(() =>
    Object.entries(editor.settings.value.pages ?? {})
      .map(([slug, config]) => ({
        slug,
        navVisible: config.navVisible !== false,
        navOrder: config.navOrder ?? 0,
        title: editor.getPageLabel(slug),
      }))
      .toSorted((a, b) => a.navOrder - b.navOrder || a.slug.localeCompare(b.slug)),
  )

  return {
    pageEntries,
    visiblePages: computed(() => pageEntries.value.filter((page) => page.navVisible)),
    hiddenPages: computed(() => pageEntries.value.filter((page) => !page.navVisible)),
  }
}
