import type { BlockPageProject } from '@/apps/user-page/block/schema'
import type { UserPagesSettingsV1 } from '@/apps/user-page/types'
import { cloneBlockNode, deepCloneJson } from './editorHelpers'
import type { Ref } from 'vue'

export interface UseUserPagePagesOptions {
  settings: Ref<UserPagesSettingsV1>
  currentKey: Ref<string>
  history: { batch: (fn: () => void) => void }
  clearSelection: () => void
  createDefaultProject: () => BlockPageProject
  maxPagesCount: number
}

export function useUserPagePages(opts: UseUserPagePagesOptions) {
  function slugOk(slug: string) {
    return /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(slug)
  }

  function getPageLabel(slug: string) {
    const title = opts.settings.value.pages?.[slug]?.title
    if (typeof title === 'string' && title.trim().length) return `${title.trim()} /${slug}`
    return `/${slug}`
  }

  function cloneProjectWithNewIds(project: BlockPageProject): BlockPageProject {
    const copied = deepCloneJson(project)
    copied.blocks = copied.blocks.map(b => cloneBlockNode(b))
    return copied
  }

  function createPage(slugInput: string) {
    const slug = slugInput.trim()
    if (!slugOk(slug)) throw new Error('slug 仅支持小写字母/数字/短横线，且长度 1~40（不能以 - 开头/结尾）')
    opts.settings.value.pages ??= {}
    if (Object.keys(opts.settings.value.pages).length >= opts.maxPagesCount) throw new Error(`子页面最多只能创建 ${opts.maxPagesCount} 个`)
    if (opts.settings.value.pages[slug]) throw new Error('该 slug 已存在')
    opts.history.batch(() => {
      opts.settings.value.pages[slug] = { mode: 'block', block: opts.createDefaultProject() }
      opts.currentKey.value = slug
      opts.clearSelection()
    })
  }

  function removePage(slug: string) {
    if (!opts.settings.value.pages?.[slug]) return
    opts.history.batch(() => {
      delete opts.settings.value.pages[slug]
      if (opts.currentKey.value === slug) opts.currentKey.value = 'home'
      opts.clearSelection()
    })
  }

  function renamePage(from: string, toInput: string) {
    const to = toInput.trim()
    if (!from || from === 'home') return
    if (!slugOk(to)) throw new Error('slug 仅支持小写字母/数字/短横线，且长度 1~40（不能以 - 开头/结尾）')
    if (from === to) return
    opts.settings.value.pages ??= {}
    const src = opts.settings.value.pages[from]
    if (!src) return
    if (opts.settings.value.pages[to]) throw new Error('该 slug 已存在')
    opts.history.batch(() => {
      opts.settings.value.pages[to] = src
      delete opts.settings.value.pages[from]
      if (opts.currentKey.value === from) opts.currentKey.value = to
      opts.clearSelection()
    })
  }

  function duplicatePage(from: string, toInput: string) {
    const to = toInput.trim()
    if (!from || from === 'home') return
    if (!slugOk(to)) throw new Error('slug 仅支持小写字母/数字/短横线，且长度 1~40（不能以 - 开头/结尾）')
    if (from === to) throw new Error('新 slug 不能与原 slug 相同')
    opts.settings.value.pages ??= {}
    if (Object.keys(opts.settings.value.pages).length >= opts.maxPagesCount) throw new Error(`子页面最多只能创建 ${opts.maxPagesCount} 个`)
    const src = opts.settings.value.pages[from]
    if (!src) return
    if (opts.settings.value.pages[to]) throw new Error('该 slug 已存在')

    const copied = deepCloneJson(src)
    if (copied.mode === 'block' && copied.block) copied.block = cloneProjectWithNewIds(copied.block)

    opts.history.batch(() => {
      opts.settings.value.pages[to] = copied
      opts.currentKey.value = to
      opts.clearSelection()
    })
  }

  return {
    slugOk,
    getPageLabel,
    createPage,
    removePage,
    renamePage,
    duplicatePage,
  }
}
