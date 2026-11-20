import { stripImageTransformFromUrl } from '@/shared/services/imageTransform'

export interface GalleryItemLike {
  path?: string
  url?: string
  src?: string
  name?: string
  alt?: string
}

export type GallerySource = string | GalleryItemLike

export interface ResolvedPreviewImage {
  src: string
  alt: string
}

export function resolvePreviewImages(imgs?: GallerySource[], fallbackAlt = '图片预览'): ResolvedPreviewImage[] {
  if (!imgs?.length) return []
  const result: ResolvedPreviewImage[] = []
  for (const item of imgs) {
    if (typeof item === 'string') {
      const clean = stripImageTransformFromUrl(item)
      if (clean) result.push({ src: clean, alt: fallbackAlt })
      continue
    }
    const raw = item?.path || item?.url || item?.src || ''
    const src = stripImageTransformFromUrl(raw)
    if (!src) continue
    result.push({
      src,
      alt: item.alt || item.name || fallbackAlt,
    })
  }
  return result
}
