import { useResizeObserver } from '@vueuse/core'
import { computed, onMounted, ref, watch, type Ref } from 'vue'

import {
  canTransformImageUrl,
  deriveSpecForBox,
  transformImageUrl,
  type ImageTransformContext,
  type ImageTransformInput,
} from './imageTransform'

export interface AutoImageOptions extends ImageTransformContext {
  /** 'auto' 根据容器实际尺寸推导；显式规格直接应用；false 禁用处理。 */
  transform?: ImageTransformInput | 'auto' | false
  /** 容器测量尚为 0x0 时的兜底规格。 */
  fallbackTransform?: ImageTransformInput
  /** 是否允许正方形容器做 1c 居中裁切（如头像/正方形缩略图）。 */
  crop?: boolean
}

function unwrapElement(node: unknown): HTMLElement | null {
  if (node instanceof HTMLElement) return node
  if (node && typeof node === 'object' && '$el' in node) {
    const el = (node as { $el?: unknown }).$el
    if (el instanceof HTMLElement) return el
  }
  return null
}

function measureBox(el: HTMLElement | null): { width: number; height: number } {
  if (!el) return { width: 0, height: 0 }
  const rect = el.getBoundingClientRect()
  if (rect.width > 0 || rect.height > 0) {
    return { width: rect.width, height: rect.height }
  }
  const parent = el.parentElement
  if (parent) {
    const parentRect = parent.getBoundingClientRect()
    if (parentRect.width > 0 || parentRect.height > 0) {
      return { width: parentRect.width, height: parentRect.height }
    }
  }
  return { width: 0, height: 0 }
}

/**
 * 为图片容器提供基于实际渲染尺寸的自适应小图地址与一次原图降级能力。
 * 在挂载测量完成前不触发 auto 模式请求，避免先请求兜底尺寸再二次请求实际尺寸。
 */
export function useAutoImageSrc(
  targetRef: Ref<unknown>,
  rawSrcGetter: () => string | null | undefined,
  optionsGetter: () => AutoImageOptions = () => ({}),
) {
  const mounted = ref(false)
  const measured = ref({ width: 0, height: 0 })
  const fallbackToRaw = ref(false)

  function refreshSize() {
    const el = unwrapElement(targetRef.value)
    const next = measureBox(el)
    if (next.width > measured.value.width || next.height > measured.value.height) {
      measured.value = next
    }
  }

  onMounted(() => {
    refreshSize()
    mounted.value = true
  })

  useResizeObserver(
    computed(() => unwrapElement(targetRef.value)),
    (entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      if (width > measured.value.width || height > measured.value.height) {
        measured.value = { width, height }
      }
    },
  )

  watch(
    () => [rawSrcGetter(), optionsGetter().transform, optionsGetter().fileId, optionsGetter().isPublic] as const,
    () => {
      fallbackToRaw.value = false
    },
  )

  const resolvedSrc = computed(() => {
    const raw = rawSrcGetter() || ''
    if (!raw) return ''
    const opts = optionsGetter()
    if (fallbackToRaw.value || opts.transform === false || !canTransformImageUrl(raw, opts)) return raw

    if (opts.transform && opts.transform !== 'auto') {
      return transformImageUrl(raw, opts.transform, {
        fileId: opts.fileId,
        isPublic: opts.isPublic,
        gatewayOrigin: opts.gatewayOrigin,
      })
    }

    if (!mounted.value) return ''

    const spec =
      deriveSpecForBox(measured.value.width, measured.value.height, { crop: opts.crop }) ??
      opts.fallbackTransform ??
      'thumb'

    return transformImageUrl(raw, spec, {
      fileId: opts.fileId,
      isPublic: opts.isPublic,
      gatewayOrigin: opts.gatewayOrigin,
    })
  })

  function handleError(): boolean {
    const raw = rawSrcGetter() || ''
    if (!fallbackToRaw.value && raw && resolvedSrc.value !== raw) {
      fallbackToRaw.value = true
      return true
    }
    return false
  }

  return {
    src: resolvedSrc,
    handleError,
    refreshSize,
  }
}
