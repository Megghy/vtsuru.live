import type { DialogProviderInst, LoadingBarProviderInst, MessageProviderInst, ModalProviderInst, NotificationProviderInst } from 'naive-ui'
import type { useRoute } from 'vue-router'

declare module 'vue3-aplayer' {
  const content: any
  export = content
}
declare module 'file-saver' {
  export function saveAs(blob: Blob | null | undefined, fileName: string): void
}

declare module '*.js' {
  const content: any
  export = content
}

declare module 'naive-ui' {
  interface TabPaneSlots {
    tab?: () => VNode[]
  }
}

declare global {
  interface Window {
    $message: MessageProviderInst
    $loadingBar: LoadingBarProviderInst
    $route: ReturnType<typeof useRoute>
    $modal: ModalProviderInst
    $mitt: Emitter<MittType>
    $notification: NotificationProviderInst
    $dialog: DialogProviderInst
  }
}
