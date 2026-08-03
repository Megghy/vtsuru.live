import { useEventBus } from '@vueuse/core'

import type { AppToast } from '@/app/events'
import { toastEventKey } from '@/app/events'

const toastBus = useEventBus(toastEventKey)

export function showToast(toast: AppToast) {
  toastBus.emit(toast)
}

export function showSuccessToast(title: string) {
  showToast({ title, color: 'success', icon: 'i-lucide-check' })
}

export function showErrorToast(title: string) {
  showToast({ title, color: 'error', icon: 'i-lucide-circle-x' })
}

export function showInfoToast(title: string) {
  showToast({ title, color: 'info', icon: 'i-lucide-info' })
}

export function showWarningToast(title: string) {
  showToast({ title, color: 'warning', icon: 'i-lucide-triangle-alert' })
}
