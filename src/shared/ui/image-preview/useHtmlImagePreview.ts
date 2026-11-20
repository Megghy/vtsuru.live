import { ref } from 'vue'

import { stripImageTransformFromUrl } from '@/shared/services/imageTransform'

import type { GallerySource } from './types'

/**
 * 为 `v-html` 富文本容器提供点击图片放大预览，自动忽略链接内图片及标记了 `data-no-preview` 的图片。
 * 若内嵌图片使用了实时缩放参数，点开灯箱时自动还原为原图地址。
 */
export function useHtmlImagePreview() {
  const open = ref(false)
  const imgs = ref<GallerySource[]>([])
  const index = ref(0)

  function resolveRawSrc(img: HTMLImageElement): string {
    const raw = img.getAttribute('data-preview-src') || img.currentSrc || img.getAttribute('src') || ''
    return stripImageTransformFromUrl(raw)
  }

  function handleHtmlClick(event: MouseEvent) {
    const target = event.target
    if (!(target instanceof HTMLImageElement)) return
    if (target.closest('a') || target.hasAttribute('data-no-preview')) return
    const src = resolveRawSrc(target)
    if (!src) return

    const container = event.currentTarget instanceof HTMLElement ? event.currentTarget : target.parentElement
    const nodes = container
      ? Array.from(container.querySelectorAll('img')).filter(
          (img) => !img.closest('a') && !img.hasAttribute('data-no-preview') && Boolean(resolveRawSrc(img)),
        )
      : [target]
    const list = nodes.map((img) => ({
      src: resolveRawSrc(img),
      alt: img.alt || '图片预览',
    }))
    const clickedIndex = nodes.indexOf(target)
    imgs.value = list
    index.value = clickedIndex >= 0 ? clickedIndex : 0
    open.value = true
  }

  return { open, imgs, index, handleHtmlClick }
}
