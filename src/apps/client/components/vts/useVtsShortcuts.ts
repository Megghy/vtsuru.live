import { ref } from 'vue'

import { useTauriStore } from '@/apps/client/store/useTauriStore'
import type { StoreTarget } from '@/apps/client/store/useTauriStore'
import { isTauri } from '@/shared/config'
import { createOwnedShortcuts } from '@/shared/helpers/ownedShortcuts'

export interface VtsShortcutBinding {
  id: string
  label: string
  shortcut: string
  actionType: 'hotkey' | 'macro' | 'preset' | 'panic-calibrate' | 'panic-reset'
  targetId: string
}

const STORE_KEY = 'vts.shortcuts'

let shortcuts: ReturnType<typeof createOwnedShortcuts> | undefined
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
    const adapter = await import('@tauri-apps/plugin-global-shortcut')
    shortcuts ??= createOwnedShortcuts(adapter)
    try {
      await shortcuts.replace(
        bindings.value
          .filter((binding) => binding.shortcut)
          .map((binding) => ({
            shortcut: binding.shortcut,
            handler: (event) => {
              if (event.state === 'Pressed') actionHandler?.(binding)
            },
          })),
      )
    } catch (cause) {
      window.$message?.error(String(cause))
    }
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
    const list = bindings.value.map((b) => (b.id === id ? { ...b, ...patch } : b))
    await save(list)
  }

  async function removeBinding(id: string) {
    await save(bindings.value.filter((b) => b.id !== id))
  }

  async function cleanup() {
    if (!isTauri()) return
    await shortcuts?.dispose()
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
