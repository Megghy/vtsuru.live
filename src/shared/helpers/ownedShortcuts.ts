import type { ShortcutEvent } from '@tauri-apps/plugin-global-shortcut'

export interface ShortcutAdapter {
  isRegistered(shortcut: string): Promise<boolean>
  register(shortcut: string, handler: (event: ShortcutEvent) => void): Promise<void>
  unregister(shortcut: string): Promise<void>
}

/** Own only this instance's shortcuts; serialize registration and disposal. */
export function createOwnedShortcuts(adapter: ShortcutAdapter) {
  const owned = new Set<string>()
  let queue = Promise.resolve()
  function replace(bindings: { shortcut: string; handler: (event: ShortcutEvent) => void }[]) {
    const task = queue.then(async () => {
      for (const key of owned) {
        await adapter.unregister(key)
        owned.delete(key)
      }
      try {
        for (const binding of bindings) {
          if (await adapter.isRegistered(binding.shortcut)) throw new Error(`快捷键冲突：${binding.shortcut}`)
          await adapter.register(binding.shortcut, binding.handler)
          owned.add(binding.shortcut)
        }
      } catch (error) {
        for (const key of owned) {
          await adapter.unregister(key)
          owned.delete(key)
        }
        throw error
      }
    })
    queue = task.catch(() => {})
    return task
  }
  return { replace, dispose: () => replace([]) }
}
