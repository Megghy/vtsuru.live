import { useRafFn } from '@vueuse/core'
import type { ComponentPublicInstance, Ref } from 'vue'
import { shallowRef, toValue, watch } from 'vue'

import { useGamepadStore } from '@/store/useGamepadStore'
import type { GamepadType, LogicalButton, LogicalStickName } from '@/types/gamepad'
import { LogicalButtonsList } from '@/types/gamepad'

// --- 按手柄体系分类的精准别名映射字典 ---

// 别名只认 VSCView 底壳里实际存在的 inkscape:label，禁止短名 / 原始 ID
export const TYPE_BUTTON_ALIASES: Record<GamepadType, Record<LogicalButton, string[]>> = {
  xbox: {
    ACTION_DOWN: ['A Button'],
    ACTION_RIGHT: ['B Button'],
    ACTION_LEFT: ['X Button'],
    ACTION_UP: ['Y Button'],
    DPAD_UP: ['D-PAD Up'],
    DPAD_DOWN: ['D-PAD Down'],
    DPAD_LEFT: ['D-PAD Left'],
    DPAD_RIGHT: ['D-PAD Right'],
    LEFT_SHOULDER_1: ['Left Bumper'],
    RIGHT_SHOULDER_1: ['Right Bumper'],
    LEFT_SHOULDER_2: ['Left Trigger'],
    RIGHT_SHOULDER_2: ['Right Trigger', 'Right Triggers'],
    LEFT_STICK_PRESS: [],
    RIGHT_STICK_PRESS: [],
    SELECT: ['View Button'],
    START: ['Menu Button'],
    HOME: ['Xbox Guide Button'],
    PS_TOUCHPAD: ['Share Button'],
    NINTENDO_CAPTURE: [],
  },
  ps: {
    ACTION_DOWN: ['Cross'],
    ACTION_RIGHT: ['Circle'],
    ACTION_LEFT: ['Square'],
    ACTION_UP: ['Triangle'],
    DPAD_UP: ['D-PAD Up'],
    DPAD_DOWN: ['D-PAD Down'],
    DPAD_LEFT: ['D-PAD Left'],
    DPAD_RIGHT: ['D-PAD Right'],
    LEFT_SHOULDER_1: ['L1'],
    RIGHT_SHOULDER_1: ['R1'],
    LEFT_SHOULDER_2: ['Left Trigger', 'L2 Trigger', 'L2 Triggers'],
    RIGHT_SHOULDER_2: ['Right Trigger', 'R2 Trigger'],
    LEFT_STICK_PRESS: [],
    RIGHT_STICK_PRESS: [],
    SELECT: ['Create Button', 'Share Button'],
    START: ['Option Button', 'Options Button'],
    HOME: ['PS Button'],
    PS_TOUCHPAD: ['Touchpad'],
    NINTENDO_CAPTURE: ['Mute'],
  },
  nintendo: {
    ACTION_DOWN: ['B Button'],
    ACTION_RIGHT: ['A Button'],
    ACTION_LEFT: ['Y Button'],
    ACTION_UP: ['X Button'],
    DPAD_UP: ['D-PAD Up'],
    DPAD_DOWN: ['D-PAD Down'],
    DPAD_LEFT: ['D-PAD Left'],
    DPAD_RIGHT: ['D-PAD Right'],
    LEFT_SHOULDER_1: ['L Bumper'],
    RIGHT_SHOULDER_1: ['R Bumper'],
    LEFT_SHOULDER_2: ['ZL Trigger'],
    RIGHT_SHOULDER_2: ['ZR Trigger'],
    LEFT_STICK_PRESS: [],
    RIGHT_STICK_PRESS: [],
    SELECT: ['Minus'],
    START: ['Plus'],
    HOME: ['Home'],
    PS_TOUCHPAD: [],
    NINTENDO_CAPTURE: ['Capture'],
  },
}

const STICK_ALIASES: Record<LogicalStickName, string[]> = {
  LEFT_STICK: ['Left Stick', 'Left Joystick', 'Analog Stick Left', 'shared-Left Joystick'],
  RIGHT_STICK: ['Right Stick', 'Right Joystick', 'Analog Stick Right', 'shared-Right Joystick'],
}

const DPAD_PLATE_ALIASES = [
  'Main D-PAD',
  'Xbox Series Controller D-PAD',
  'Directional Pads',
  'Directional Pad',
  'D-PAD',
]

// --- 属性读取与颜色处理工具 ---

export function getElementLabel(el: Element): string | null {
  if (!el) return null
  return (
    el.getAttribute('inkscape:label') ??
    el.getAttribute('label') ??
    el.getAttributeNS('http://www.inkscape.org/namespaces/inkscape', 'label') ??
    null
  )
}

export function parseHexOrRgb(color: string): { r: number; g: number; b: number } {
  if (!color || color === 'none' || color === 'transparent') {
    return { r: 56, g: 189, b: 248 }
  }
  if (color.startsWith('#')) {
    let hex = color.slice(1)
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
    else if (hex.length >= 6) hex = hex.slice(0, 6)
    if (hex.length === 6) {
      return {
        r: Number.parseInt(hex.slice(0, 2), 16),
        g: Number.parseInt(hex.slice(2, 4), 16),
        b: Number.parseInt(hex.slice(4, 6), 16),
      }
    }
  }
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (m) {
    return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) }
  }
  return { r: 56, g: 189, b: 248 }
}

export function toHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g).toString(16).padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`
}

export function lerpColor(from: string, to: string, t: number): string {
  const c1 = parseHexOrRgb(from)
  const c2 = parseHexOrRgb(to)
  return toHex(
    c1.r + (c2.r - c1.r) * t,
    c1.g + (c2.g - c1.g) * t,
    c1.b + (c2.b - c1.b) * t,
  )
}

export function getAutoPressedColor(origColor: string | null): string {
  if (!origColor || origColor === 'none') return '#38bdf8'
  const { r, g, b } = parseHexOrRgb(origColor)
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b
  return luminance < 100 ? '#38bdf8' : '#0284c7'
}

// 提取元素样式与属性中的原始 fill，以穿透内联 style 覆盖
export function extractOriginalFill(el: Element): {
  fillAttr: string | null
  styleFill: string | null
  effectiveColor: string | null
} {
  const fillAttr = el.getAttribute('fill')
  const styleStr = el.getAttribute('style') || ''
  const m = styleStr.match(/(?:^|;)\s*fill\s*:\s*([^;]+)/i)
  const styleFill = m ? m[1].trim() : (el as HTMLElement).style?.fill || null
  const effectiveColor = styleFill || fillAttr || null
  return { fillAttr, styleFill, effectiveColor }
}

export function applyColorToElement(
  el: Element,
  color: string,
  _target: ColorTarget,
) {
  el.setAttribute('fill', color)
  if ('style' in el && (el as HTMLElement).style) {
    ;(el as HTMLElement).style.fill = color
  }
}

export function restoreElementColor(el: Element, target: ColorTarget) {
  if (target.originalFill !== null) {
    el.setAttribute('fill', target.originalFill)
  } else {
    el.removeAttribute('fill')
  }

  if (target.originalStyleFill !== null) {
    if ('style' in el && (el as HTMLElement).style) {
      ;(el as HTMLElement).style.fill = target.originalStyleFill
    }
  } else if ('style' in el && (el as HTMLElement).style) {
    ;(el as HTMLElement).style.removeProperty('fill')
  }
}

// --- 元素绑定结构 ---

export interface ColorTarget {
  el: Element
  originalFill: string | null
  originalStyleFill: string | null
  effectiveColor: string | null
}

export interface ButtonBinding {
  container: Element
  colorTargets: ColorTarget[]
}

export interface StickBinding {
  container: Element
  originalTransform: string
  colorTargets: ColorTarget[]
}

export interface TriggerBinding {
  container: Element
  originalTransform: string
  colorTargets: ColorTarget[]
}

export interface DpadPlateBinding {
  container: Element
  originalTransform: string
  colorTargets: ColorTarget[]
}

export interface SvgGamepadRendererOptions {
  svgContainerRef: Ref<ComponentPublicInstance | Element | null>
  gamepadType?: Ref<GamepadType> | GamepadType
  pressedColor?: Ref<string | null> | string | null
  stickSensitivity?: Ref<number | undefined> | number
}

// --- 元素查找与着色提取工具 ---

export function findElementByAliases(
  root: Element,
  aliases: string[],
  usedElements?: Set<Element>,
): Element | null {
  const allEls = Array.from(root.querySelectorAll('*'))
  const normalizedAliases = aliases.map((a) => a.trim().toLowerCase())

  for (const targetAlias of normalizedAliases) {
    // 1. 精确匹配 inkscape:label (忽略大小写)
    const match = allEls.find((el) => {
      if (usedElements?.has(el)) return false
      const label = getElementLabel(el)?.trim().toLowerCase()
      return label === targetAlias
    })
    if (match) return match

    // 2. ID 匹配
    const matchById = allEls.find((el) => {
      if (usedElements?.has(el)) return false
      return el.id?.trim().toLowerCase() === targetAlias
    })
    if (matchById) return matchById
  }

  return null
}

export function findColorTargets(container: Element): ColorTarget[] {
  const results: ColorTarget[] = []

  function addTarget(el: Element) {
    const { fillAttr, styleFill, effectiveColor } = extractOriginalFill(el)
    results.push({ el, originalFill: fillAttr, originalStyleFill: styleFill, effectiveColor })
  }

  // 优先查找带有 inkscape:label 包含 "color" 的子元素
  const colorEls = Array.from(container.querySelectorAll('*')).filter((el) => {
    const label = getElementLabel(el)?.toLowerCase() ?? ''
    return label.includes('color') && !label.includes('body color')
  })

  if (colorEls.length > 0) {
    for (const el of colorEls) {
      addTarget(el)
    }
    return results
  }

  // 如果未明确标 color，提取非 outline/text/icon/symbol/led 的图形节点
  const graphicEls = Array.from(
    container.querySelectorAll('path, ellipse, circle, rect, polygon'),
  ).filter((el) => {
    const label = getElementLabel(el)?.toLowerCase() ?? ''
    const isExclude =
      label.includes('outline') ||
      label.includes('text') ||
      label.includes('icon') ||
      label.includes('symbol') ||
      label.includes('led') ||
      label.includes('speaker')
    return !isExclude
  })

  if (graphicEls.length > 0) {
    for (const el of graphicEls) {
      addTarget(el)
    }
    return results
  }

  // 最终回退到容器自身
  addTarget(container)
  return results
}

export function useSvgGamepadRenderer(options: SvgGamepadRendererOptions) {
  const { svgContainerRef, gamepadType, pressedColor, stickSensitivity } = options
  const gamepad = useGamepadStore()

  // 缓存的 DOM 绑定映射
  const buttonBindings = shallowRef<Map<LogicalButton, ButtonBinding>>(new Map())
  const stickBindings = shallowRef<Map<LogicalStickName, StickBinding>>(new Map())
  const triggerBindings = shallowRef<Map<LogicalButton, TriggerBinding>>(new Map())
  const dpadPlateBinding = shallowRef<DpadPlateBinding | null>(null)
  // 当前 SVG 缩放系数（以 1000px 宽度 viewBox 为基准，统一跨底壳位移幅度）
  const scaleFactor = shallowRef<number>(1.0)

  // 获取当前 SVG 根元素
  function getSvgElement(): SVGSVGElement | null {
    const raw = toValue(svgContainerRef)
    if (!raw) return null
    const root: Element | null =
      typeof (raw as any)?.$el !== 'undefined'
        ? (raw as any).$el
        : raw instanceof Element
          ? raw
          : (raw as any)
    if (!root || typeof (root as Element).querySelector !== 'function') return null

    return (root as Element).tagName?.toLowerCase() === 'svg'
      ? (root as SVGSVGElement)
      : (root as Element).querySelector('svg')
  }

  // 解析并构建 SVG 绑定索引
  function analyzeAndBindSvg() {
    const svgEl = getSvgElement()
    if (!svgEl) return

    // 计算当前底壳 SVG 的 viewBox 缩放系数
    const viewBoxStr = svgEl.getAttribute('viewBox')
    let viewBoxWidth = 1000
    if (viewBoxStr) {
      const parts = viewBoxStr.trim().split(/[\s,]+/).map(Number)
      if (parts.length === 4 && parts[2] > 0) {
        viewBoxWidth = parts[2]
      }
    } else if (svgEl.hasAttribute('width')) {
      const w = Number.parseFloat(svgEl.getAttribute('width') || '1000')
      if (!Number.isNaN(w) && w > 0) viewBoxWidth = w
    }
    scaleFactor.value = viewBoxWidth / 1000

    const effectiveType = toValue(gamepadType) || 'xbox'
    const aliasesForType = TYPE_BUTTON_ALIASES[effectiveType] || TYPE_BUTTON_ALIASES.xbox

    const usedElements = new Set<Element>()
    const newButtons = new Map<LogicalButton, ButtonBinding>()
    const newSticks = new Map<LogicalStickName, StickBinding>()
    const newTriggers = new Map<LogicalButton, TriggerBinding>()

    // 1. 绑定按键、肩键与独立 D-PAD 方向键
    for (const btn of LogicalButtonsList) {
      const aliases = aliasesForType[btn] || []
      if (aliases.length === 0) continue

      if (btn === 'LEFT_SHOULDER_2' || btn === 'RIGHT_SHOULDER_2') {
        const el = findElementByAliases(svgEl, aliases, usedElements)
        if (el) {
          usedElements.add(el)
          newTriggers.set(btn, {
            container: el,
            originalTransform: el.getAttribute('transform') || '',
            colorTargets: findColorTargets(el),
          })
        }
        continue
      }

      const el = findElementByAliases(svgEl, aliases, usedElements)
      if (el) {
        usedElements.add(el)
        newButtons.set(btn, {
          container: el,
          colorTargets: findColorTargets(el),
        })
      }
    }

    // 2. 绑定摇杆
    const stickKeys: LogicalStickName[] = ['LEFT_STICK', 'RIGHT_STICK']
    for (const key of stickKeys) {
      const el = findElementByAliases(svgEl, STICK_ALIASES[key], usedElements)
      if (el) {
        usedElements.add(el)
        newSticks.set(key, {
          container: el,
          originalTransform: el.getAttribute('transform') || '',
          colorTargets: findColorTargets(el),
        })
      }
    }

    // 3. 绑定一体式十字盘（物理微动平移倾斜 + 未分向时的整体高亮）
    const plateEl = findElementByAliases(svgEl, DPAD_PLATE_ALIASES, usedElements)
    if (plateEl) {
      dpadPlateBinding.value = {
        container: plateEl,
        originalTransform: plateEl.getAttribute('transform') || '',
        colorTargets: findColorTargets(plateEl),
      }
    } else {
      dpadPlateBinding.value = null
    }

    buttonBindings.value = newButtons
    stickBindings.value = newSticks
    triggerBindings.value = newTriggers
  }

  // --- 样式重置与还原 ---

  function resetAll() {
    for (const [, binding] of buttonBindings.value) {
      for (const target of binding.colorTargets) {
        restoreElementColor(target.el, target)
      }
    }

    for (const [, binding] of stickBindings.value) {
      if (binding.originalTransform) binding.container.setAttribute('transform', binding.originalTransform)
      else binding.container.removeAttribute('transform')
      for (const target of binding.colorTargets) {
        restoreElementColor(target.el, target)
      }
    }

    for (const [, binding] of triggerBindings.value) {
      if (binding.originalTransform) binding.container.setAttribute('transform', binding.originalTransform)
      else binding.container.removeAttribute('transform')
      for (const target of binding.colorTargets) {
        restoreElementColor(target.el, target)
      }
    }

    if (dpadPlateBinding.value) {
      const plate = dpadPlateBinding.value
      if (plate.originalTransform) plate.container.setAttribute('transform', plate.originalTransform)
      else plate.container.removeAttribute('transform')
    }
  }

  // 检查已绑定元素是否仍在 DOM 树中
  function isBindingValid(): boolean {
    const firstBtn = buttonBindings.value.values().next().value
    if (firstBtn && firstBtn.container && !firstBtn.container.isConnected) {
      return false
    }
    const firstStick = stickBindings.value.values().next().value
    if (firstStick && firstStick.container && !firstStick.container.isConnected) {
      return false
    }
    return true
  }

  // --- 逐帧渲染 ---

  function renderFrame() {
    if (buttonBindings.value.size === 0 || !isBindingValid()) {
      analyzeAndBindSvg()
    }

    const isConnected = gamepad.isGamepadConnected
    const state = gamepad.normalizedGamepadState
    const userColor = toValue(pressedColor) ?? null
    const sensitivityRaw = toValue(stickSensitivity)
    const sensitivity = typeof sensitivityRaw === 'number' && sensitivityRaw > 0 ? sensitivityRaw : 15
    const sf = scaleFactor.value || 1.0

    if (!isConnected) {
      resetAll()
      return
    }

    // 1. 各个按键、肩键与独立 D-PAD 方向键独立着色驱动
    for (const [btn, binding] of buttonBindings.value) {
      const btnState = state.buttons[btn]
      const isPressed = btnState?.pressed ?? false

      for (const target of binding.colorTargets) {
        if (isPressed) {
          const activeColor = userColor || getAutoPressedColor(target.effectiveColor)
          applyColorToElement(target.el, activeColor, target)
        } else {
          restoreElementColor(target.el, target)
        }
      }
    }

    // 2. 线性扳机更新（变色 + 向下手柄内部平移位移）
    const triggerTravelMax = 20 * sf
    for (const [btn, binding] of triggerBindings.value) {
      const btnState = state.buttons[btn]
      const value = btnState?.value ?? 0
      const baseTransform = binding.originalTransform

      if (value <= 0.01) {
        if (baseTransform) binding.container.setAttribute('transform', baseTransform)
        else binding.container.removeAttribute('transform')
        for (const target of binding.colorTargets) {
          restoreElementColor(target.el, target)
        }
      } else {
        const dy = (value * triggerTravelMax).toFixed(2)
        binding.container.setAttribute('transform', `translate(0, ${dy}) ${baseTransform}`.trim())
        for (const target of binding.colorTargets) {
          const targetColor = userColor || getAutoPressedColor(target.effectiveColor)
          const baseColor = target.effectiveColor || '#333333'
          applyColorToElement(target.el, lerpColor(baseColor, targetColor, value), target)
        }
      }
    }

    // 3. 摇杆位移（归一化缩放）与下压高亮（L3/R3）
    const stickPressMap: Record<LogicalStickName, LogicalButton> = {
      LEFT_STICK: 'LEFT_STICK_PRESS',
      RIGHT_STICK: 'RIGHT_STICK_PRESS',
    }

    for (const [key, binding] of stickBindings.value) {
      const axes = state.sticks[key] || { x: 0, y: 0 }
      const pressKey = stickPressMap[key]
      const isPressActive = state.buttons[pressKey]?.pressed ?? false

      const tx = axes.x * sensitivity * sf
      const ty = axes.y * sensitivity * sf
      const baseTransform = binding.originalTransform

      if (Math.abs(tx) < 0.05 && Math.abs(ty) < 0.05) {
        if (baseTransform) binding.container.setAttribute('transform', baseTransform)
        else binding.container.removeAttribute('transform')
      } else {
        binding.container.setAttribute(
          'transform',
          `translate(${tx.toFixed(2)}, ${ty.toFixed(2)}) ${baseTransform}`.trim(),
        )
      }

      for (const target of binding.colorTargets) {
        if (isPressActive) {
          const activeColor = userColor || getAutoPressedColor(target.effectiveColor)
          applyColorToElement(target.el, activeColor, target)
        } else {
          restoreElementColor(target.el, target)
        }
      }
    }

    // 4. 一体式十字盘联动倾斜微动与未分向底壳的高亮
    if (dpadPlateBinding.value) {
      const plate = dpadPlateBinding.value
      const up = state.buttons.DPAD_UP?.pressed ? 1 : 0
      const down = state.buttons.DPAD_DOWN?.pressed ? 1 : 0
      const left = state.buttons.DPAD_LEFT?.pressed ? 1 : 0
      const right = state.buttons.DPAD_RIGHT?.pressed ? 1 : 0
      const anyDpadPressed = up === 1 || down === 1 || left === 1 || right === 1

      const dpadTravel = 5 * sf
      const dpadX = (right - left) * dpadTravel
      const dpadY = (down - up) * dpadTravel

      if (dpadX === 0 && dpadY === 0) {
        if (plate.originalTransform) plate.container.setAttribute('transform', plate.originalTransform)
        else plate.container.removeAttribute('transform')
      } else {
        plate.container.setAttribute(
          'transform',
          `translate(${dpadX.toFixed(2)}, ${dpadY.toFixed(2)}) ${plate.originalTransform}`.trim(),
        )
      }

      // 若没有独立的 4 向 D-PAD 绑定（如 Xbox / Switch Pro），给一体十字盘着色
      const hasSeparateDpad =
        buttonBindings.value.has('DPAD_UP') ||
        buttonBindings.value.has('DPAD_DOWN') ||
        buttonBindings.value.has('DPAD_LEFT') ||
        buttonBindings.value.has('DPAD_RIGHT')

      if (!hasSeparateDpad) {
        for (const target of plate.colorTargets) {
          if (anyDpadPressed) {
            const activeColor = userColor || getAutoPressedColor(target.effectiveColor)
            applyColorToElement(target.el, activeColor, target)
          } else {
            restoreElementColor(target.el, target)
          }
        }
      }
    }
  }

  // 挂载 RAF 逐帧驱动
  useRafFn(renderFrame)

  // 立即在初始化时尝试解析一次
  analyzeAndBindSvg()

  // 监听容器挂载或手柄类型切换
  watch(
    [() => toValue(svgContainerRef), () => toValue(gamepadType)],
    () => {
      analyzeAndBindSvg()
      renderFrame()
    },
    { flush: 'sync' },
  )

  return {
    analyzeAndBindSvg,
    renderFrame,
    resetAll,
    scaleFactor,
    buttonBindings,
    stickBindings,
    triggerBindings,
  }
}
