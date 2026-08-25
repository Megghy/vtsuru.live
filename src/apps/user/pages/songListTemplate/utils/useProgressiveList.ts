import { useIntersectionObserver } from '@vueuse/core'
import { computed, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'

export function useProgressiveList<T>(items: MaybeRefOrGetter<readonly T[]>, chunkSize: number) {
  const visibleCount = ref(chunkSize)
  const loadMoreTrigger = ref<HTMLElement | null>(null)

  const visibleItems = computed(() => toValue(items).slice(0, visibleCount.value))
  const hasMore = computed(() => visibleCount.value < toValue(items).length)

  function loadMore() {
    visibleCount.value = Math.min(visibleCount.value + chunkSize, toValue(items).length)
  }

  watch(
    () => toValue(items),
    () => {
      visibleCount.value = chunkSize
    },
    { flush: 'sync' },
  )

  useIntersectionObserver(
    loadMoreTrigger,
    ([entry]) => {
      if (entry?.isIntersecting) loadMore()
    },
    { rootMargin: '480px 0px' },
  )

  return { visibleItems, hasMore, loadMoreTrigger, loadMore }
}
