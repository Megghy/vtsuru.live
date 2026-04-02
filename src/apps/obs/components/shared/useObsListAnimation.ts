import { useElementSize } from '@vueuse/core'
import { computed, ref, type Ref } from 'vue'

export function useObsListAnimation(items: Readonly<Ref<readonly unknown[]>>, speedMultiplier: Readonly<Ref<number>>) {
  const listContainerRef = ref<HTMLElement | null>(null)
  const listInnerRef = ref<HTMLElement | null>(null)

  const { height, width } = useElementSize(listContainerRef)
  const { height: innerListHeight } = useElementSize(listInnerRef)

  const totalContentHeight = computed(() => {
    if (items.value.length === 0 || innerListHeight.value <= 0) {
      return 0
    }
    return innerListHeight.value
  })

  const isMoreThanContainer = computed(() => {
    return totalContentHeight.value > height.value
  })

  const animationTranslateY = computed(() => {
    if (!isMoreThanContainer.value || height.value <= 0) {
      return 0
    }
    return height.value - totalContentHeight.value
  })

  const animationTranslateYCss = computed(() => `${animationTranslateY.value}px`)

  const animationDuration = computed(() => {
    const baseDuration = items.value.length * 1
    const adjustedDuration = baseDuration / speedMultiplier.value
    return Math.max(adjustedDuration, 1)
  })

  const animationDurationCss = computed(() => `${animationDuration.value}s`)

  const scrollStyle = computed(() => `width: ${width.value}px; --item-parent-width: ${width.value}px`)

  return {
    listContainerRef,
    listInnerRef,
    isMoreThanContainer,
    animationTranslateYCss,
    animationDurationCss,
    scrollStyle,
  }
}
