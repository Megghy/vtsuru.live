import { onScopeDispose } from 'vue'

import type { PngtuberExpression, PngtuberRuntime } from '@/shared/pngtuber/types'

/** Browser hotkeys deliberately ignore editable targets and release holds on focus loss. */
export function usePngtuberHotkeys(options: {
  expressions: () => PngtuberExpression[]
  runtime: () => PngtuberRuntime
  enabled: () => boolean
  control: (expressionId: string, durationMs?: number) => Promise<void>
}) {
  const holds = new Map<string, { id: string; previous: string }>()
  let queue = Promise.resolve()
  function send(id: string, duration = 0) {
    queue = queue.then(() => options.control(id, duration)).catch(() => {})
  }
  function down(event: KeyboardEvent) {
    const target = event.target instanceof Element ? event.target : null
    if (
      !options.enabled() ||
      event.repeat ||
      target?.closest('input,textarea,select,[contenteditable="true"],[role="textbox"]')
    )
      return
    const key = [
      ...(event.ctrlKey ? ['Ctrl'] : []),
      ...(event.altKey ? ['Alt'] : []),
      ...(event.shiftKey ? ['Shift'] : []),
      ...(event.metaKey ? ['Meta'] : []),
      event.code,
    ].join('+')
    const expression = options.expressions().find((e) => e.hotkey === key)
    if (!expression) return
    event.preventDefault()
    const current = options.runtime().expressionId
    if (expression.hotkeyMode === 'hold') {
      if (holds.has(event.code)) return
      holds.set(event.code, { id: expression.id, previous: [...holds.values()].at(-1)?.id ?? current })
      send(expression.id)
    } else
      send(
        expression.hotkeyMode === 'toggle' && current === expression.id ? '' : expression.id,
        expression.hotkeyMode === 'timed' ? expression.durationMs : 0,
      )
  }
  function up(event: KeyboardEvent) {
    const held = holds.get(event.code)
    if (!held) return
    const last = [...holds.keys()].at(-1) === event.code
    holds.delete(event.code)
    for (const item of holds.values()) if (item.previous === held.id) item.previous = held.previous
    if (last) send(held.previous)
  }
  function release() {
    const first = holds.values().next().value
    holds.clear()
    if (first) send(first.previous)
  }
  function hidden() {
    if (document.hidden) release()
  }
  window.addEventListener('keydown', down)
  window.addEventListener('keyup', up)
  window.addEventListener('blur', release)
  document.addEventListener('visibilitychange', hidden)
  onScopeDispose(() => {
    release()
    window.removeEventListener('keydown', down)
    window.removeEventListener('keyup', up)
    window.removeEventListener('blur', release)
    document.removeEventListener('visibilitychange', hidden)
  })
  return { release }
}
