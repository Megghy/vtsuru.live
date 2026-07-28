import type { BlockNode } from '@/apps/user-page/block/schema'
import { getBlockPropertyNumberRange, getBlockPropertyValues, isBlockPropertyAvailable } from '@/apps/user-page/block/propertyCapabilities'
import { computed, inject, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { UserPageEditorKey } from '../../context'

export function useBlockPropsEditor(blockSource: MaybeRefOrGetter<BlockNode>) {
  const editor = inject(UserPageEditorKey)
  if (!editor) throw new Error('UserPageEditor context is missing')

  const block = computed(() => toValue(blockSource))
  const blockProps = computed<Record<string, any>>(() => editor.ensurePropsObject(block.value))

  function ensureArrayProp<T = Record<string, any>>(key: string): T[] {
    const value = blockProps.value[key]
    if (Array.isArray(value)) return value as T[]
    const items: T[] = []
    blockProps.value[key] = items
    return items
  }

  function propertyAvailable(property: string) {
    return isBlockPropertyAvailable(block.value.type, blockProps.value, property)
  }

  function propertyNumberRange(property: string) {
    return getBlockPropertyNumberRange(block.value.type, blockProps.value, property)
  }

  function propertyValues(property: string) {
    return getBlockPropertyValues(block.value.type, blockProps.value, property)
  }

  const internalPageOptions = computed(() => {
    const pages = editor.settings.value.pages ?? {}
    const entries = Object.entries(pages)
      .map(([slug, config]) => ({
        slug,
        navVisible: config.navVisible !== false,
        navOrder: config.navOrder ?? 0,
        title: config.title?.trim() || `/${slug}`,
      }))
      .toSorted((a, b) => (a.navOrder - b.navOrder) || a.slug.localeCompare(b.slug))

    return [
      { label: '主页', value: 'home' },
      ...entries.map(page => ({
        label: `${page.title}${page.navVisible ? '' : ' · 隐藏'}`,
        value: page.slug,
      })),
    ]
  })

  return { editor, block, blockProps, ensureArrayProp, propertyAvailable, propertyNumberRange, propertyValues, internalPageOptions }
}
