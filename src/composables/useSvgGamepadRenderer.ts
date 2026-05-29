import type { ComponentPublicInstance, Ref } from 'vue'
import type { ControllerComponentStructure } from '@/apps/obs-store/data/gamepadConfigs'
import type { LogicalButton } from '@/types/gamepad'
import { shallowRef, watchEffect } from 'vue'
import { LogicalButtonsList } from '@/types/gamepad'
import { useGamepadStore } from '@/store/useGamepadStore'

export interface SvgRendererOptions {
  bodySvgRef: Ref<ComponentPublicInstance | null>
  components: Ref<ControllerComponentStructure[]>
  pressedColor: Ref<string | null>
  stickSensitivity: Ref<number>
  useOverlay: Ref<boolean>
}

export function useSvgGamepadRenderer(options: SvgRendererOptions) {
  const { bodySvgRef, components, pressedColor, stickSensitivity, useOverlay } = options
  const gamepad = useGamepadStore()

  const originalFills = shallowRef<Map<string, string | null>>(new Map())
  const originalTransforms = shallowRef<Map<string, string>>(new Map())

  function findElementByPath(svgEl: Element, path: string): Element | null {
    if (!path || !svgEl) return null
    // 精确匹配 inkscape:label
    let el = Array.from(svgEl.querySelectorAll('*')).find(
      e => e.getAttribute('inkscape:label') === path,
    )
    // 回退到 ID 匹配
    if (!el && /^[a-z][\w:.-]*$/i.test(path)) {
      try {
        el = svgEl.querySelector(`#${CSS.escape(path)}`) ?? undefined
      } catch {}
    }
    return el ?? null
  }

  function findColorTarget(element: Element): Element {
    const colorEl = Array.from(element.querySelectorAll('*')).find(
      el => el.getAttribute('inkscape:label')?.toLowerCase().includes('color'),
    )
    return colorEl ?? element.children[0] ?? element
  }

  // --- 颜色工具 ---

  function parseColor(color: string): { r: number; g: number; b: number } {
    if (!color || color === 'none') return { r: 200, g: 200, b: 200 }
    if (color.startsWith('#')) {
      let hex = color.slice(1)
      if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
      else if (hex.length === 8 || hex.length === 4) hex = hex.slice(0, hex.length <= 4 ? 3 : 6)
      if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
      return {
        r: Number.parseInt(hex.slice(0, 2), 16),
        g: Number.parseInt(hex.slice(2, 4), 16),
        b: Number.parseInt(hex.slice(4, 6), 16),
      }
    }
    const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
    if (m) return { r: +m[1], g: +m[2], b: +m[3] }
    return { r: 200, g: 200, b: 200 }
  }

  function toHex(r: number, g: number, b: number): string {
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  }

  function invertColor(hex: string): string {
    const c = parseColor(hex)
    return toHex(255 - c.r, 255 - c.g, 255 - c.b)
  }

  function lerpColor(a: string, b: string, t: number): string {
    const ca = parseColor(a)
    const cb = parseColor(b)
    return toHex(
      Math.round(ca.r + (cb.r - ca.r) * t),
      Math.round(ca.g + (cb.g - ca.g) * t),
      Math.round(ca.b + (cb.b - ca.b) * t),
    )
  }

  // --- SVG 结构分析 ---

  function analyzeSvg() {
    if (!bodySvgRef.value?.$el || useOverlay.value) return
    const svgEl = bodySvgRef.value.$el as Element
    originalFills.value.clear()
    originalTransforms.value.clear()

    function walk(comp: ControllerComponentStructure) {
      if (comp.path) {
        const el = findElementByPath(svgEl, comp.path)
        if (el) {
          const target = findColorTarget(el)
          originalFills.value.set(comp.path, target.getAttribute('fill') || window.getComputedStyle(target).fill || 'none')
          if (comp.type === 'stick') {
            originalTransforms.value.set(comp.path, el.getAttribute('transform') || '')
          }
        }
      }
      comp.childComponents?.forEach(walk)
    }
    components.value.forEach(walk)
  }

  // --- 样式操作 ---

  function applyPressed(element: Element, pathId: string) {
    const target = findColorTarget(element)
    const currentFill = target.getAttribute('fill') || window.getComputedStyle(target).fill
    if (!originalFills.value.has(pathId)) {
      originalFills.value.set(pathId, currentFill === 'none' ? null : currentFill)
    }
    const color = pressedColor.value
      || (currentFill?.startsWith('#') ? invertColor(currentFill) : '#FFFFFF80')
    target.setAttribute('fill', color)
  }

  function resetStyle(element: Element, pathId: string) {
    const target = findColorTarget(element)
    const original = originalFills.value.get(pathId)
    if (original != null) target.setAttribute('fill', original)
    else target.removeAttribute('fill')
  }

  function resetAll() {
    const svgEl = bodySvgRef.value?.$el as Element | undefined
    if (!svgEl) return
    function walk(comp: ControllerComponentStructure) {
      if (!comp.path) { comp.childComponents?.forEach(walk); return }
      const el = findElementByPath(svgEl, comp.path)
      if (!el) { comp.childComponents?.forEach(walk); return }
      if (comp.type === 'stick') {
        const t = originalTransforms.value.get(comp.path)
        if (t !== undefined) el.setAttribute('transform', t)
        else el.removeAttribute('transform')
      } else {
        resetStyle(el, comp.path)
      }
      comp.childComponents?.forEach(walk)
    }
    components.value.forEach(walk)
  }

  // --- 状态变化处理 ---

  function findComponents(logicalButton: string, type?: string): ControllerComponentStructure[] {
    const result: ControllerComponentStructure[] = []
    function walk(comps: ControllerComponentStructure[]) {
      for (const c of comps) {
        if (c.logicalButton === logicalButton && (!type || c.type === type)) result.push(c)
        if (c.childComponents) walk(c.childComponents)
      }
    }
    walk(components.value)
    return result
  }

  function handleButton(logicalButton: LogicalButton, pressed: boolean) {
    if (useOverlay.value || !bodySvgRef.value?.$el) return
    const svgEl = bodySvgRef.value.$el as Element
    for (const comp of findComponents(logicalButton)) {
      if (!comp.path) continue
      const el = findElementByPath(svgEl, comp.path)
      if (!el) continue
      if (pressed) applyPressed(el, comp.path)
      else resetStyle(el, comp.path)
    }
  }

  function handleTrigger(logicalButton: LogicalButton, value: number) {
    if (useOverlay.value || !bodySvgRef.value?.$el) return
    const svgEl = bodySvgRef.value.$el as Element
    for (const comp of findComponents(logicalButton, 'trigger')) {
      if (!comp.path) continue
      const el = findElementByPath(svgEl, comp.path)
      if (!el) continue
      const target = findColorTarget(el)

      if (!originalFills.value.has(comp.path)) {
        originalFills.value.set(comp.path, target.getAttribute('fill') || window.getComputedStyle(target).fill || 'none')
      }
      if (!originalTransforms.value.has(comp.path)) {
        originalTransforms.value.set(comp.path, el.getAttribute('transform') || '')
      }

      const origFill = originalFills.value.get(comp.path) || '#808080'
      const baseTransform = originalTransforms.value.get(comp.path) || ''

      if (value <= 0.01) {
        if (origFill && origFill !== 'none') target.setAttribute('fill', origFill)
        else target.removeAttribute('fill')
        el.setAttribute('transform', baseTransform)
        continue
      }

      const targetColor = pressedColor.value || '#FFFFFF'
      target.setAttribute('fill', lerpColor(origFill, targetColor, value))
      const movement = value * 5
      const newTransform = `translate(0, ${movement}) ${baseTransform}`.trim()
      el.setAttribute('transform', newTransform)
    }
  }

  function handleStick(logicalStick: LogicalButton, axes: { x: number; y: number }) {
    if (useOverlay.value || !bodySvgRef.value?.$el) return
    const svgEl = bodySvgRef.value.$el as Element
    for (const comp of findComponents(logicalStick, 'stick')) {
      if (!comp.path) continue
      const el = findElementByPath(svgEl, comp.path)
      if (!el) continue

      if (!originalTransforms.value.has(comp.path)) {
        originalTransforms.value.set(comp.path, el.getAttribute('transform') || '')
      }
      const base = originalTransforms.value.get(comp.path) || ''
      const s = stickSensitivity.value || 5
      const tx = axes.x * s
      const ty = axes.y * s

      if (Math.abs(tx) < 0.01 && Math.abs(ty) < 0.01) {
        el.setAttribute('transform', base)
      } else {
        el.setAttribute('transform', `translate(${tx.toFixed(2)}, ${ty.toFixed(2)}) ${base}`.trim())
      }
    }
  }

  // --- 主循环：监听手柄状态，更新 SVG ---

  watchEffect(() => {
    if (!gamepad.isGamepadConnected || useOverlay.value || !bodySvgRef.value?.$el) {
      if (bodySvgRef.value?.$el && !useOverlay.value) resetAll()
      return
    }
    const state = gamepad.normalizedGamepadState
    LogicalButtonsList.forEach((btn) => {
      const s = state.buttons[btn]
      if (!s) return
      if (btn === 'LEFT_SHOULDER_2' || btn === 'RIGHT_SHOULDER_2') handleTrigger(btn, s.value)
      else handleButton(btn, s.pressed)
    })
    const stickKeys = ['LEFT_STICK', 'RIGHT_STICK'] as const
    for (const key of stickKeys) {
      const a = state.sticks[key]
      if (a) handleStick(key as LogicalButton, a)
    }
  })

  return { analyzeSvg, resetAll, findElementByPath }
}

