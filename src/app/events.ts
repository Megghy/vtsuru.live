import type { Toast } from '@nuxt/ui/composables'
import type { EventBusKey } from '@vueuse/core'

export type AppToast = Omit<Partial<Toast>, 'id'>

export const toastEventKey: EventBusKey<AppToast> = Symbol('toast')
export const obsUpdateEventKey: EventBusKey<void> = Symbol('obs-update')
