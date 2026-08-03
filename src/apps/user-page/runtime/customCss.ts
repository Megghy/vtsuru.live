import type { Ref } from 'vue'
import { computed, onActivated, onBeforeUnmount, onDeactivated, ref, watch } from 'vue'

import { inspectCustomCss } from '../block/customHtmlRuntime'
import type { UserPagesSettings } from '../types'

export function usePublicUserCustomCss(settings: Readonly<Ref<UserPagesSettings | null>>) {
  const active = ref(true)
  const css = computed(() => {
    const value = settings.value?.customCss
    if (typeof value !== 'string' || !value.trim()) return ''
    const result = inspectCustomCss(value)
    return result.issues.length ? '' : result.css
  })
  let element: HTMLStyleElement | null = null

  function sync(value: string) {
    element?.remove()
    element = null
    if (!value) return
    element = document.createElement('style')
    element.dataset.vtsuruUserCustomCss = 'true'
    element.textContent = value
    document.head.appendChild(element)
  }

  watch([css, active], ([value, isActive]) => sync(isActive ? value : ''), { immediate: true })
  onActivated(() => {
    active.value = true
  })
  onDeactivated(() => {
    active.value = false
  })
  onBeforeUnmount(() => sync(''))
}
