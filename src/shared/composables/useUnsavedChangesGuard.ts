import { toValue, type MaybeRefOrGetter, onActivated, onBeforeUnmount, onDeactivated, onMounted } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'

import { dialog } from '@/shared/utils'

export function useUnsavedChangesGuard(
  isDirty: MaybeRefOrGetter<boolean>,
  message = '当前页面有未保存的更改，离开后将会丢失，确定要离开吗？',
) {
  function onBeforeUnload(event: BeforeUnloadEvent) {
    if (!toValue(isDirty)) return
    event.preventDefault()
    event.returnValue = ''
  }

  onBeforeRouteLeave(() => {
    if (!toValue(isDirty)) return true
    return new Promise<boolean>((resolve) => {
      let settled = false
      const settle = (value: boolean) => {
        if (settled) return
        settled = true
        resolve(value)
      }
      dialog.warning({
        title: '离开确认',
        content: message,
        positiveText: '离开页面',
        negativeText: '继续编辑',
        onPositiveClick: () => settle(true),
        onNegativeClick: () => settle(false),
        onClose: () => settle(false),
      })
    })
  })

  let isListenerAttached = false

  function attachBeforeUnload() {
    if (isListenerAttached) return
    window.addEventListener('beforeunload', onBeforeUnload)
    isListenerAttached = true
  }

  function detachBeforeUnload() {
    if (!isListenerAttached) return
    window.removeEventListener('beforeunload', onBeforeUnload)
    isListenerAttached = false
  }

  onMounted(attachBeforeUnload)
  onActivated(attachBeforeUnload)
  onDeactivated(detachBeforeUnload)
  onBeforeUnmount(detachBeforeUnload)
}
