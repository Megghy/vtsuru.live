import { formatRgb } from 'culori'
import { computed, ref, watch } from 'vue'
import type { Ref } from 'vue'

import { compositeOpaque, parseRgb } from '@/shared/config/theme/contrast'

import { getPageBackgroundCssVars, type ResolvedPageBackground } from './background'

const imageColorCache = new Map<string, string>()

function sampleImageAverageColor(url: string) {
  return new Promise<string | undefined>((resolve) => {
    if (typeof Image === 'undefined') {
      resolve(undefined)
      return
    }

    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.decoding = 'async'
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 16
        canvas.height = 16
        const context = canvas.getContext('2d')
        if (!context) {
          resolve(undefined)
          return
        }
        context.drawImage(image, 0, 0, 16, 16)
        const data = context.getImageData(0, 0, 16, 16).data
        let r = 0
        let g = 0
        let b = 0
        let count = 0
        for (let index = 0; index < data.length; index += 4) {
          if (data[index + 3] < 16) continue
          r += data[index]
          g += data[index + 1]
          b += data[index + 2]
          count++
        }
        if (!count) {
          resolve(undefined)
          return
        }
        resolve(
          formatRgb({
            mode: 'rgb',
            r: r / count / 255,
            g: g / count / 255,
            b: b / count / 255,
          }),
        )
      } catch {
        resolve(undefined)
      }
    }
    image.onerror = () => resolve(undefined)
    image.src = url
  })
}

function useBackgroundImageAverageColor(imagePath: Ref<string>) {
  const color = ref<string | undefined>(imageColorCache.get(imagePath.value))

  watch(
    imagePath,
    async (url) => {
      if (!url) {
        color.value = undefined
        return
      }
      const cached = imageColorCache.get(url)
      if (cached) {
        color.value = cached
        return
      }
      const sampled = await sampleImageAverageColor(url)
      if (sampled) imageColorCache.set(url, sampled)
      if (imagePath.value === url) color.value = sampled
    },
    { immediate: true },
  )

  return color
}

export function resolvePageCanvasColor(
  background: ResolvedPageBackground | null | undefined,
  effectiveIsDark: boolean,
  sampledImageColor?: string,
) {
  if (!background) return
  const base =
    background.type === 'color'
      ? background.color
      : sampledImageColor || (background.color !== 'transparent' ? background.color : '')
  if (!base || base === 'transparent') return

  const baseRgb = parseRgb(base)
  if (!baseRgb) return

  const scrim = getPageBackgroundCssVars(background, effectiveIsDark)['--user-page-bg-scrim']
  const scrimRgb = scrim && scrim !== 'transparent' ? parseRgb(scrim) : undefined
  return formatRgb(scrimRgb ? compositeOpaque(scrimRgb, { ...baseRgb, alpha: 1 }) : { ...baseRgb, alpha: 1 })
}

export function usePageCanvasColor(
  background: Ref<ResolvedPageBackground | null | undefined>,
  effectiveIsDark: Ref<boolean>,
) {
  const imagePath = computed(() => (background.value?.type === 'image' ? background.value.imagePath.trim() : ''))
  const sampled = useBackgroundImageAverageColor(imagePath)
  return computed(() => resolvePageCanvasColor(background.value, effectiveIsDark.value, sampled.value))
}
