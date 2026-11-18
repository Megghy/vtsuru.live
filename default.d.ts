import type { Emitter } from 'mitt'

import type { MittType } from './src/app/mitt'

type ToastHandle = { destroy: () => void }

interface AppMessageApi {
  success: (msg: unknown, options?: Record<string, unknown>) => unknown
  error: (msg: unknown, options?: Record<string, unknown>) => unknown
  warning: (msg: unknown, options?: Record<string, unknown>) => unknown
  info: (msg: unknown, options?: Record<string, unknown>) => unknown
  loading: (msg: unknown, options?: Record<string, unknown>) => unknown
  destroy: () => void
}

interface AppNotificationApi {
  create: (opts: unknown) => ToastHandle
  info: (opts: unknown) => ToastHandle
  success: (opts: unknown) => ToastHandle
  warning: (opts: unknown) => ToastHandle
  error: (opts: unknown) => ToastHandle
}

interface AppDialogApi {
  create: (opts: unknown) => void
  warning: (opts: unknown) => void
  error: (opts: unknown) => void
  info: (opts: unknown) => void
  success: (opts: unknown) => void
}

interface AppLoadingBarApi {
  start: () => void
  finish: () => void
  error: () => void
}

declare global {
  interface Window {
    $message: AppMessageApi
    $loadingBar: AppLoadingBarApi
    $notification: AppNotificationApi
    $dialog: AppDialogApi
    $mitt: Emitter<MittType>
  }
}
