import type { ShortcutEvent } from '@tauri-apps/plugin-global-shortcut'

import type { PngtuberExpression } from '@/shared/pngtuber/types'

/** Serialize key transitions so rapid presses observe the preceding control result. */
export function createExpressionHotkeys(options: {
  current: () => string
  enabled: () => boolean
  control: (expressionId: string, durationMs: number) => Promise<void>
  onError: (cause: unknown) => void
}) {
  const pressed = new Set<string>()
  const holds = new Map<string, { id: string; previous: string }>()
  let queue = Promise.resolve()
  function enqueue(action: () => Promise<void>) {
    queue = queue.then(async () => {
      if (options.enabled()) await action()
    }).catch(options.onError)
    return queue
  }
  function bind(expression: PngtuberExpression) {
    return (event: ShortcutEvent) => {
      if (!options.enabled()) return
      if (event.state === 'Released') {
        if (!pressed.delete(expression.hotkey)) return
        void enqueue(async () => {
          const held = holds.get(expression.hotkey)
          if (!held) return
          const last = [...holds.keys()].at(-1) === expression.hotkey
          holds.delete(expression.hotkey)
          for (const value of holds.values()) if (value.previous === held.id) value.previous = held.previous
          if (last) await options.control(held.previous, 0)
        })
        return
      }
      if (pressed.has(expression.hotkey)) return
      pressed.add(expression.hotkey)
      void enqueue(async () => {
        if (expression.hotkeyMode === 'hold') {
          const previous = [...holds.values()].at(-1)?.id ?? options.current()
          await options.control(expression.id, 0)
          holds.set(expression.hotkey, { id: expression.id, previous })
        } else {
          await options.control(
            expression.hotkeyMode === 'toggle' && options.current() === expression.id ? '' : expression.id,
            expression.hotkeyMode === 'timed' ? expression.durationMs : 0,
          )
        }
      })
    }
  }
  function release() {
    pressed.clear()
    return enqueue(async () => {
      const first = holds.values().next().value
      holds.clear()
      if (first) await options.control(first.previous, 0)
    })
  }
  return { bind, release }
}
