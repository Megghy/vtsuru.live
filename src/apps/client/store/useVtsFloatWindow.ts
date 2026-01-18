import type { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { WebviewWindow as WebviewWindowClass } from '@tauri-apps/api/webviewWindow'
import { PhysicalPosition, PhysicalSize } from '@tauri-apps/api/dpi'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref, toRaw } from 'vue'
import type { StoreTarget } from '@/apps/client/store/useTauriStore'
import { useTauriStore } from '@/apps/client/store/useTauriStore'
import { isTauri } from '@/shared/config'

export interface VtsFloatWindowSettings {
  width: number
  height: number
  x: number
  y: number
  opacity: number
  alwaysOnTop: boolean
  clickThrough: boolean
}

export const VTS_FLOAT_WINDOW_LABEL = 'vts-float-window'
export const VTS_FLOAT_WINDOW_ROUTE = '/vts-float-window'
export const VTS_FLOAT_WINDOW_BROADCAST_CHANNEL = 'channel.vts.floatWindow'

export type VtsFloatWindowBCData =
  | { type: 'window-ready' }
  | { type: 'update-setting', data: VtsFloatWindowSettings }

const FLOAT_WINDOW_KEY = 'vts.floatWindow'

export const useVtsFloatWindow = defineStore('vtsFloatWindow', () => {
  const tauriStore = useTauriStore()
  const settingTarget: StoreTarget<VtsFloatWindowSettings> = tauriStore.getTarget(FLOAT_WINDOW_KEY, {
    width: 420,
    height: 520,
    x: 80,
    y: 80,
    opacity: 0.92,
    alwaysOnTop: true,
    clickThrough: false,
  })

  const settings = ref<VtsFloatWindowSettings>({
    width: 420,
    height: 520,
    x: 80,
    y: 80,
    opacity: 0.92,
    alwaysOnTop: true,
    clickThrough: false,
  })

  const windowRef = ref<WebviewWindow | null>(null)
  const opened = ref(false)
  const lastError = ref<string | null>(null)
  const listenersBound = ref(false)
  let bc: BroadcastChannel | undefined

  async function init() {
    if (!isTauri()) {
      throw new Error('仅支持在 Tauri 环境使用悬浮小窗')
    }
    settings.value = (await settingTarget.get()) ?? settings.value

    if (!bc) {
      bc = new BroadcastChannel(VTS_FLOAT_WINDOW_BROADCAST_CHANNEL)
      bc.onmessage = (event: MessageEvent<VtsFloatWindowBCData>) => {
        if (event.data.type === 'window-ready') {
          bc?.postMessage({ type: 'update-setting', data: toRaw(settings.value) })
        }
      }
    }
  }

  async function setSettings(next: Partial<VtsFloatWindowSettings>) {
    settings.value = { ...settings.value, ...next }
    await settingTarget.set(toRaw(settings.value))
    bc?.postMessage({ type: 'update-setting', data: toRaw(settings.value) })
    await applyWindowFlags()
  }

  function applyIncomingSettings(next: VtsFloatWindowSettings) {
    settings.value = next
  }

  async function updateGeometry(next: Partial<Pick<VtsFloatWindowSettings, 'x' | 'y' | 'width' | 'height'>>) {
    settings.value = { ...settings.value, ...next }
    await settingTarget.set(toRaw(settings.value))
  }

  async function resolveWindow() {
    if (windowRef.value) return windowRef.value
    const existing = await WebviewWindowClass.getByLabel(VTS_FLOAT_WINDOW_LABEL)
    if (existing) {
      windowRef.value = existing
      return existing
    }
    const created = new WebviewWindowClass(VTS_FLOAT_WINDOW_LABEL, {
      url: VTS_FLOAT_WINDOW_ROUTE,
      title: 'VTS 控制',
      width: settings.value.width,
      height: settings.value.height,
      x: settings.value.x,
      y: settings.value.y,
      resizable: true,
      transparent: true,
      decorations: false,
      skipTaskbar: true,
      alwaysOnTop: settings.value.alwaysOnTop,
      visible: false,
    })
    windowRef.value = created
    return created
  }

  async function applyWindowFlags() {
    const w = windowRef.value
    if (!w) return
    await w.setAlwaysOnTop(settings.value.alwaysOnTop)
    await w.setIgnoreCursorEvents(settings.value.clickThrough)
  }

  async function open() {
    await init()
    lastError.value = null
    const w = await resolveWindow()

    if (!listenersBound.value) {
      listenersBound.value = true
      w.onCloseRequested((event) => {
        event.preventDefault()
        void close()
      })
      w.onMoved(({ payload: pos }) => {
        void updateGeometry({ x: pos.x, y: pos.y })
      })
      w.onResized(({ payload: size }) => {
        void updateGeometry({ width: size.width, height: size.height })
      })
    }

    await w.setSize(new PhysicalSize(settings.value.width, settings.value.height))
    await w.setPosition(new PhysicalPosition(settings.value.x, settings.value.y))
    await applyWindowFlags()
    await w.show()
    opened.value = true
    bc?.postMessage({ type: 'update-setting', data: toRaw(settings.value) })
  }

  async function close() {
    const w = windowRef.value
    if (!w) return
    await w.hide()
    opened.value = false
  }

  async function toggle() {
    if (opened.value) {
      await close()
    } else {
      await open()
    }
  }

  return {
    settings,
    opened,
    lastError,
    init,
    setSettings,
    applyIncomingSettings,
    open,
    close,
    toggle,
  }
})

if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useVtsFloatWindow, import.meta.hot))
