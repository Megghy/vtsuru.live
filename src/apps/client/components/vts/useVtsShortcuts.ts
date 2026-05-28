import { ref, watch } from 'vue'
import { isTauri } from '@/shared/config'
import { useTauriStore } from '@/apps/client/store/useTauriStore'
import type { StoreTarget } from '@/apps/client/store/useTauriStore'

export interface VtsShortcutBinding {
  id: string
  label: string
  shortcut: string
  actionType: 'hotkey' | 'macro' | 'preset' | 'panic-calibrate' | 'panic-reset'
  targetId: string
}

const STORE_KEY = 'vts.shortcuts'

let registered = false
let currentBindings: VtsShortcutBinding[] = []
let actionHandler: ((binding: VtsShortcutBinding) => void) | null = null

export function useVtsShortcuts() {
  const tauriStore = useTauriStore()
  const target: StoreTarget<VtsShortcutBinding[]> = tauriStore.getTarget(STORE_KEY, [])
  const bindings = ref<VtsShortcutBinding[]>([])
  const ready = ref(false)

  async function init() {
    if (!isTauri()) return
    bindings.value = (await target.get()) ?? []
    ready.value = true
    await registerAll()
  }

  async function registerAll() {
    if (!isTauri()) return
    const { unregisterAll, register } = await import('@tauri-apps/plugin-global-shortcut')
    if (registered) await unregisterAll()
    registered = false
    currentBindings = bindings.value

    for (const b of currentBindings) {
      if (!b.shortcut) continue
      try {
        await register(b.shortcut, (event) => {
          if (event.state === 'Pressed' && actionHandler) {
            actionHandler(b)
          }
        })
      } catch (err) {
        console.warn(`[VtsShortcut] 注册失败: ${b.shortcut}`, err)
      }
    }
    registered = true
  }

  function onAction(handler: (binding: VtsShortcutBinding) => void) {
    actionHandler = handler
  }

  async function save(next: VtsShortcutBinding[]) {
    bindings.value = next
    await target.set(next)
    await registerAll()
  }

  async function addBinding(binding: Omit<VtsShortcutBinding, 'id'>) {
    const id = `shortcut-${crypto.randomUUID().slice(0, 8)}`
    await save([...bindings.value, { ...binding, id }])
  }

  async function updateBinding(id: string, patch: Partial<VtsShortcutBinding>) {
    const list = bindings.value.map(b => b.id === id ? { ...b, ...patch } : b)
    await save(list)
  }

  async function removeBinding(id: string) {
    await save(bindings.value.filter(b => b.id !== id))
  }

  async function cleanup() {
    if (!isTauri()) return
    const { unregisterAll } = await import('@tauri-apps/plugin-global-shortcut')
    await unregisterAll()
    registered = false
    actionHandler = null
  }

  return {
    bindings,
    ready,
    init,
    onAction,
    addBinding,
    updateBinding,
    removeBinding,
    cleanup,
  }
}
