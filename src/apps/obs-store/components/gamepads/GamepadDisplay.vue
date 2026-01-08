<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import type { BodyOptionConfig, ControllerComponentStructure } from '@/apps/obs-store/data/gamepadConfigs'
import type { GamepadConfig, GamepadType, LogicalButton } from '@/types/gamepad'
import { useRouteQuery } from '@vueuse/router'
import { NCard, NText } from 'naive-ui'
import { computed, nextTick, onMounted, ref, shallowRef, watch, watchEffect } from 'vue'
import { controllerBodies, controllerStructures, gamepadConfigs } from '@/apps/obs-store/data/gamepadConfigs'
import { useGamepadStore } from '@/store/useGamepadStore'
import { LogicalButtonsList } from '@/types/gamepad'
import GamepadButton from './GamepadButton.vue'
import GamepadStick from './GamepadStick.vue'

interface Props {
  fullscreenMode?: boolean // 是否以全屏模式显示
  type?: GamepadType // 控制器类型
  bodyId?: string // 控制器主体ID
  overlay?: boolean // 是否使用叠加式按钮
  pressedColor?: string | null // 按下颜色
  viewBox?: string // 视图框
  inlineMode?: boolean // 是否为页内嵌入模式
  stickSensitivity?: number // 摇杆移动灵敏度
}

const props = withDefaults(defineProps<Props>(), {
  fullscreenMode: true,
  type: undefined,
  bodyId: undefined,
  overlay: undefined,
  pressedColor: undefined,
  viewBox: undefined,
  inlineMode: false,
  stickSensitivity: undefined, // 默认未定义，将从query或配置中获取
})

// 字符串转布尔辅助函数
const stringToBoolean = (v: string | null | undefined): boolean => v === 'true'

// 路由查询参数
const querySelectedType = useRouteQuery<GamepadType>('type', 'xbox', { transform: String as (v: any) => GamepadType })
const querySelectedBodyId = useRouteQuery<string>('bodyId', '')
const queryUseOverlayButtons = useRouteQuery('overlay', 'true')
const queryCustomPressedColor = useRouteQuery<string | null>('pressedColor', null, { transform: v => v === 'null' ? null : String(v) })
const queryCustomViewBox = useRouteQuery<string>('viewBox', '')
const queryStickSensitivity = useRouteQuery<number>('stickSensitivity', 5, { transform: (v) => {
  const num = Number(v)
  return Number.isNaN(num) ? 5 : num
} })

// 优先使用 props，没有则使用 query
const selectedType = computed<GamepadType>(() => props.type !== undefined ? props.type : querySelectedType.value)
const selectedBodyId = computed<string>(() => props.bodyId !== undefined ? props.bodyId : querySelectedBodyId.value)
const useOverlayButtonsValue = computed<boolean>(() => props.overlay !== undefined ? props.overlay : stringToBoolean(queryUseOverlayButtons.value))
const customPressedColorValue = computed<string | null>(() => props.pressedColor !== undefined ? props.pressedColor : queryCustomPressedColor.value)
const customViewBoxValue = computed<string>(() => props.viewBox !== undefined ? props.viewBox : queryCustomViewBox.value)
const stickSensitivityValue = computed<number>(() => props.stickSensitivity !== undefined ? props.stickSensitivity : queryStickSensitivity.value)

// 组件状态
const svgContainerRef = ref<HTMLElement | null>(null)
const bodySvgRef = ref<ComponentPublicInstance<Record<string, never>, Record<string, never>, SVGElement> | null>(null)
const originalElementFills = shallowRef<Map<string, string | null>>(new Map())
const originalElementTransforms = shallowRef<Map<string, string>>(new Map())
const defaultPressedHighlightColor = ref('#FFFFFF80')

const gamepad = useGamepadStore()

// 配置和可用主体
const currentConfigFromQuery = computed<GamepadConfig | undefined>(() => gamepadConfigs[selectedType.value])
const availableBodiesFromQuery = computed<BodyOptionConfig[]>(() => controllerBodies[selectedType.value] || [])
const useOverlayButtons = useOverlayButtonsValue
const currentBodySvgComponentFromQuery = shallowRef<any>(null)

// 当选择手柄类型或主体变化时，更新SVG组件
watch(() => [selectedBodyId.value, selectedType.value, availableBodiesFromQuery.value], async () => {
  const bodyId = selectedBodyId.value
  const bodies = availableBodiesFromQuery.value
  const config = currentConfigFromQuery.value

  let componentToLoad = null
  if (bodyId && bodies.length > 0) {
    const selectedBody = bodies.find(b => b.name === bodyId)
    componentToLoad = selectedBody ? selectedBody.body : (config?.bodySvg || null)
  } else if (config) {
    componentToLoad = config.bodySvg || null
  }
  currentBodySvgComponentFromQuery.value = componentToLoad

  // 当主体/类型变化时重置状态
  originalElementFills.value.clear()
  originalElementTransforms.value.clear()
  if (bodySvgRef.value?.$el) {
    resetAllElementStyles(bodySvgRef.value.$el)
  }
  nextTick(() => analyzeSvgStructure())
}, { immediate: true, deep: true })

// 视图框计算
const defaultViewBoxForCurrentBodyFromQuery = computed<string>(() => {
  const selectedBodyConfig = availableBodiesFromQuery.value.find(b => b.name === selectedBodyId.value)
  if (selectedBodyConfig?.defaultViewBox) {
    return selectedBodyConfig.defaultViewBox
  }
  return currentConfigFromQuery.value?.defaultViewBox || '0 0 1000 1000'
})

const effectiveViewBoxFromQuery = computed<string | undefined>(() => {
  return customViewBoxValue.value || defaultViewBoxForCurrentBodyFromQuery.value
})

const svgStyle = computed(() => ({
  maxWidth: '100%',
  maxHeight: '100%',
  objectFit: 'contain',
  margin: 'auto',
}))

// SVG结构分析相关
interface SvgElementInfoForDisplay {
  id: string | null
  label: string | null
  element?: Element | null
  componentName?: string
}

const svgStructureForDisplay = ref<SvgElementInfoForDisplay[]>([])
const controllerComponentsFromQuery = computed(() => controllerStructures[selectedType.value] || [])

// 分析SVG结构
function analyzeSvgStructure() {
  if (!bodySvgRef.value || useOverlayButtons.value) return

  const svgElement = bodySvgRef.value.$el
  if (!svgElement) return

  svgStructureForDisplay.value = []
  originalElementFills.value.clear()
  originalElementTransforms.value.clear()

  function processComponent(component: ControllerComponentStructure) {
    if (component.path) {
      const element = findElementByPath(svgElement, component.path)
      if (element) {
        svgStructureForDisplay.value.push({
          id: element.id || null,
          label: element.getAttribute('inkscape:label') || null,
          element,
          componentName: component.name,
        })

        const targetElement = findTargetElement(element)
        originalElementFills.value.set(component.path, targetElement.getAttribute('fill') || window.getComputedStyle(targetElement).fill || 'none')
        if (component.type === 'stick') {
          originalElementTransforms.value.set(component.path, element.getAttribute('transform') || '')
        }
      }
    }
    if (component.childComponents) {
      component.childComponents.forEach(processComponent)
    }
  }
  controllerComponentsFromQuery.value.forEach(processComponent)
}

// 当SVG组件加载完成后分析结构
watch(currentBodySvgComponentFromQuery, () => {
  nextTick(() => {
    if (bodySvgRef.value?.$el) {
      analyzeSvgStructure()
    }
  })
}, { immediate: true })

// 监听手柄状态变化，更新SVG样式
watchEffect(() => {
  if (!gamepad.isGamepadConnected || !currentBodySvgComponentFromQuery.value || !bodySvgRef.value?.$el || useOverlayButtons.value) {
    if (bodySvgRef.value?.$el && !useOverlayButtons.value) {
      resetAllElementStyles(bodySvgRef.value.$el)
    }
    return
  }

  const state = gamepad.normalizedGamepadState
  LogicalButtonsList.forEach((logicalButton) => {
    const buttonState = state.buttons[logicalButton]
    if (buttonState) {
      if (logicalButton === 'LEFT_SHOULDER_2' || logicalButton === 'RIGHT_SHOULDER_2') {
        handleTriggerStateChange(logicalButton, buttonState.value)
      } else {
        handleButtonStateChange(logicalButton, buttonState.pressed)
      }
    }
  })

  const stickKeys: Array<keyof typeof state.sticks> = ['LEFT_STICK', 'RIGHT_STICK']
  stickKeys.forEach((stickKey) => {
    const stickAxes = state.sticks[stickKey]
    if (stickAxes) {
      handleStickStateChange(stickKey as LogicalButton, stickAxes)
    }
  })
})

// 重置所有元素样式
function resetAllElementStyles(svgElement: Element) {
  controllerComponentsFromQuery.value.forEach((componentDef) => {
    if (componentDef.path) {
      const element = findElementByPath(svgElement, componentDef.path)
      if (element) {
        if (componentDef.type === 'stick') {
          const originalTransform = originalElementTransforms.value.get(componentDef.path)
          if (originalTransform !== undefined) {
            element.setAttribute('transform', originalTransform)
          } else {
            element.removeAttribute('transform')
          }
        } else {
          resetElementStyle(element, componentDef.path)
        }
      }
    }
  })
}

// 通过路径查找SVG元素
function findElementByPath(svgElement: Element, path: string): Element | null {
  if (!path || !svgElement) return null

  // 先尝试通过inkscape:label查找
  let element = Array.from(svgElement.querySelectorAll('*')).find(
    el => el.getAttribute('inkscape:label') === path,
  )

  // 如果找不到，尝试通过ID查找
  if (!element) {
    try {
      if (/^[a-z][\w:.-]*$/i.test(path)) {
        const foundElement = svgElement.querySelector(`#${path.replace(/:/g, '\\:')}`)
        if (foundElement) element = foundElement
      }
    } catch {}
  }

  // 部分匹配回退
  if (!element) {
    const pathWords = path.split(/\s+/)
    for (const word of pathWords) {
      if (word.length < 3) continue
      element = Array.from(svgElement.querySelectorAll('*')).find(
        el => el.getAttribute('inkscape:label')
          && el.getAttribute('inkscape:label')!.includes(word),
      )
      if (element) break
    }
  }
  return element || null
}

// 查找可应用样式的目标元素
function findTargetElement(element: Element): Element {
  let colorElement = Array.from(element.querySelectorAll('*')).find(
    el => el.getAttribute('inkscape:label') === 'Color'
      || el.getAttribute('inkscape:label')?.toLowerCase().includes('color'),
  )
  colorElement ??= element.children[0]
  return colorElement || element
}

// 颜色反转
function invertColor(hex: string): string {
  if (hex.indexOf('#') === 0) hex = hex.slice(1)
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
  if (hex.length !== 6) return defaultPressedHighlightColor.value

  const r = (255 - Number.parseInt(hex.slice(0, 2), 16)).toString(16)
  const g = (255 - Number.parseInt(hex.slice(2, 4), 16)).toString(16)
  const b = (255 - Number.parseInt(hex.slice(4, 6), 16)).toString(16)
  const padZero = (str: string) => (`00${str}`).slice(-2)
  return `#${padZero(r)}${padZero(g)}${padZero(b)}`
}

// 应用按下样式
function applyPressedStyle(element: Element, pathId: string) {
  if (!element) return
  const targetElement = findTargetElement(element)
  const currentFill = targetElement.getAttribute('fill') || window.getComputedStyle(targetElement).fill

  if (!originalElementFills.value.has(pathId)) {
    originalElementFills.value.set(pathId, currentFill === 'none' ? null : currentFill)
  }

  let pressedFill = customPressedColorValue.value
  if (!pressedFill) {
    if (currentFill && currentFill !== 'none' && currentFill.startsWith('#')) {
      pressedFill = invertColor(currentFill)
    } else {
      pressedFill = defaultPressedHighlightColor.value
    }
  }
  targetElement.setAttribute('fill', pressedFill)
}

// 重置元素样式
function resetElementStyle(element: Element, pathId: string) {
  if (!element) return
  const targetElement = findTargetElement(element)
  if (originalElementFills.value.has(pathId)) {
    const originalFill = originalElementFills.value.get(pathId)
    if (originalFill !== null && originalFill !== undefined) {
      targetElement.setAttribute('fill', originalFill)
    } else {
      targetElement.removeAttribute('fill')
    }
  }
}

// 查找关联组件
function findAssociatedComponents(
  components: ControllerComponentStructure[],
  logicalButton: LogicalButton,
  componentType?: string,
): ControllerComponentStructure[] {
  const result: ControllerComponentStructure[] = []
  function traverse(comps: ControllerComponentStructure[]) {
    comps.forEach((comp) => {
      if (comp.logicalButton === logicalButton) {
        if (componentType) {
          if (comp.type === componentType) {
            result.push(comp)
          }
        } else {
          result.push(comp)
        }
      }
      if (comp.childComponents) {
        traverse(comp.childComponents)
      }
    })
  }
  traverse(components)
  return result
}

// 处理按钮状态变化
function handleButtonStateChange(logicalButton: LogicalButton, isPressed: boolean) {
  if (useOverlayButtons.value || !bodySvgRef.value?.$el) return
  if (logicalButton === 'LEFT_SHOULDER_2' || logicalButton === 'RIGHT_SHOULDER_2') {
    const value = gamepad.normalizedGamepadState.buttons[logicalButton]?.value || 0
    handleTriggerStateChange(logicalButton, value)
    return
  }

  const svgElement = bodySvgRef.value.$el
  const associatedComponents = findAssociatedComponents(controllerComponentsFromQuery.value, logicalButton)

  associatedComponents.forEach((componentDef) => {
    if (componentDef.path) {
      const targetElement = findElementByPath(svgElement, componentDef.path)
      if (targetElement) {
        if (isPressed) applyPressedStyle(targetElement, componentDef.path)
        else resetElementStyle(targetElement, componentDef.path)
      }
    }
  })
}

// 处理扳机键状态变化
function handleTriggerStateChange(logicalButton: LogicalButton, value: number) {
  if (useOverlayButtons.value || !bodySvgRef.value?.$el) return
  const svgElement = bodySvgRef.value.$el
  const associatedComponents = findAssociatedComponents(
    controllerComponentsFromQuery.value,
    logicalButton,
    'trigger',
  )
  associatedComponents.forEach((componentDef) => {
    if (componentDef.path) {
      const targetElement = findElementByPath(svgElement, componentDef.path)
      if (targetElement) {
        applyTriggerStyle(targetElement, componentDef.path, value)
      }
    }
  })
}

// 应用扳机键样式
function applyTriggerStyle(element: Element, pathId: string, value: number) {
  if (!element) return
  const targetElement = findTargetElement(element)
  const originalFillMap = originalElementFills.value
  const originalTransformMap = originalElementTransforms.value

  // 保存原始样式
  if (!originalFillMap.has(pathId)) {
    const currentFill = targetElement.getAttribute('fill') || window.getComputedStyle(targetElement).fill || 'none'
    originalFillMap.set(pathId, currentFill)
  }

  if (!originalTransformMap.has(pathId)) {
    const currentTransform = element.getAttribute('transform') || ''
    originalTransformMap.set(pathId, currentTransform)
  }

  const originalFill = originalFillMap.get(pathId)
  const originalTransform = originalTransformMap.get(pathId) || ''

  // 力度非常小时恢复原始状态
  if (value <= 0.01) {
    if (originalFill !== null && originalFill !== undefined && originalFill !== 'none') {
      targetElement.setAttribute('fill', originalFill)
    } else {
      targetElement.removeAttribute('fill')
    }
    element.setAttribute('transform', originalTransform)
    return
  }

  // 目标颜色（按下状态的颜色）
  const targetColor = customPressedColorValue.value || '#FFFFFF'

  // 解析颜色函数
  function parseColor(color: string): { r: number, g: number, b: number } {
    if (color === 'none' || !color) {
      return { r: 200, g: 200, b: 200 } // 默认灰色
    }

    // 处理十六进制颜色
    if (color.startsWith('#')) {
      let hex = color.slice(1)
      // 规范化颜色格式
      if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
      } else if (hex.length === 4) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
      } else if (hex.length === 8) {
        hex = hex.slice(0, 6) // 移除alpha通道
      }

      return {
        r: Number.parseInt(hex.slice(0, 2), 16),
        g: Number.parseInt(hex.slice(2, 4), 16),
        b: Number.parseInt(hex.slice(4, 6), 16),
      }
    }

    // 处理rgb/rgba颜色
    const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/)
    if (rgbMatch) {
      return {
        r: Number.parseInt(rgbMatch[1]),
        g: Number.parseInt(rgbMatch[2]),
        b: Number.parseInt(rgbMatch[3]),
      }
    }

    // 无法解析的颜色返回默认值
    return { r: 200, g: 200, b: 200 }
  }

  // 将RGB转回十六进制
  function rgbToHex(r: number, g: number, b: number): string {
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  }

  // 在两种颜色间进行插值
  function interpolateColor(color1: { r: number, g: number, b: number }, color2: { r: number, g: number, b: number }, factor: number) {
    return {
      r: Math.round(color1.r + (color2.r - color1.r) * factor),
      g: Math.round(color1.g + (color2.g - color1.g) * factor),
      b: Math.round(color1.b + (color2.b - color1.b) * factor),
    }
  }

  // 解析原始颜色和目标颜色
  const sourceColor = parseColor(originalFill || '#808080')
  const destColor = parseColor(targetColor)

  // 根据力度插值计算当前颜色
  const currentColor = interpolateColor(sourceColor, destColor, value)
  const fillColor = rgbToHex(currentColor.r, currentColor.g, currentColor.b)

  // 应用颜色变化
  targetElement.setAttribute('fill', fillColor)

  // 保留位移效果
  const isLeftTrigger = pathId.toLowerCase().includes('left') || pathId.toLowerCase().includes('l2')
  const movement = value * 5 // 最大移动2像素

  let newTransform = originalTransform
  if (originalTransform.includes('translate')) {
    newTransform = newTransform.replace(/translate\([^)]+\)/, isLeftTrigger ? `translate(0, ${movement})` : `translate(0, ${movement})`)
  } else {
    newTransform = `translate(0, ${movement}) ${newTransform}`.trim()
  }

  element.setAttribute('transform', newTransform)
}

// 处理摇杆状态变化
function handleStickStateChange(logicalStick: LogicalButton, axes: { x: number, y: number }) {
  if (useOverlayButtons.value || !bodySvgRef.value?.$el) return
  const svgElement = bodySvgRef.value.$el
  const associatedComponents = findAssociatedComponents(controllerComponentsFromQuery.value, logicalStick, 'stick')

  associatedComponents.forEach((componentDef) => {
    if (componentDef.path) {
      const stickElement = findElementByPath(svgElement, componentDef.path)
      if (stickElement) {
        // 优先使用组件配置的灵敏度，否则使用全局灵敏度设置，再否则使用默认值5
        const defaultSensitivity = typeof (componentDef as any).sensitivity === 'number' ? (componentDef as any).sensitivity : 5
        const sensitivity = stickSensitivityValue.value || defaultSensitivity

        const translateX = axes.x * sensitivity
        const translateY = axes.y * sensitivity

        const transformMap = originalElementTransforms.value
        const pathId = componentDef.path

        if (!transformMap.has(pathId)) {
          transformMap.set(pathId, stickElement.getAttribute('transform') || '')
        }
        const baseTransform = transformMap.get(pathId) || ''

        let dynamicTranslatePart = ''
        if (Math.abs(translateX) > 0.01 || Math.abs(translateY) > 0.01) {
          dynamicTranslatePart = `translate(${translateX.toFixed(2)}, ${translateY.toFixed(2)})`
        }

        const newTransform = (dynamicTranslatePart + (baseTransform ? ` ${baseTransform}` : '')).trim()
        stickElement.setAttribute('transform', newTransform)
      }
    }
  })
}

onMounted(() => {
  nextTick(() => {
    if (bodySvgRef.value?.$el) {
      analyzeSvgStructure()
    }
  })
})
</script>

<template>
  <div :class="props.inlineMode ? 'gamepad-display-wrapper-inline' : 'gamepad-display-wrapper'">
    <div
      v-if="currentConfigFromQuery"
      class="gamepad-viewer"
    >
      <div
        ref="svgContainerRef"
        class="svg-container"
      >
        <component
          :is="currentBodySvgComponentFromQuery"
          v-if="currentBodySvgComponentFromQuery"
          ref="bodySvgRef"
          class="gamepad-body"
          :style="svgStyle"
          :viewBox="effectiveViewBoxFromQuery"
          preserveAspectRatio="xMidYMid meet"
        /> <NText v-else>
          无法加载手柄SVG组件 (类型: {{ selectedType }}, 主体ID: {{ selectedBodyId }}).
        </NText>
      </div>
      <div
        v-if="useOverlayButtons"
        class="overlay-controls"
      >
        <template
          v-for="(component, index) in currentConfigFromQuery.components"
          :key="`${selectedType}-${index}`"
        >
          <GamepadButton
            v-if="component.type === 'button'"
            :name="component.name"
            :svg="component.svg"
            :position="component.position"
            :is-pressed="gamepad.normalizedGamepadState.buttons[component.logicalButton]?.pressed ?? false"
          />
          <GamepadStick
            v-else-if="component.type === 'stick'"
            :svg="component.svg"
            :position="component.position"
            :axes="gamepad.normalizedGamepadState.sticks[component.logicalButton] || { x: 0, y: 0 }"
          />
        </template>
      </div>
    </div> <NCard
      v-else
      class="error-card"
    >
      无效的游戏手柄类型或配置: {{ selectedType }}
    </NCard>
  </div>
</template>

<style scoped>
  .gamepad-display-wrapper {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 20px;
    box-sizing: border-box;
    overflow: hidden;
  }

  .gamepad-display-wrapper-inline {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    box-sizing: border-box;
    overflow: hidden;
  }

  .gamepad-viewer {
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    position: relative;
  }

  .svg-container {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
    max-width: 100%;
    max-height: 100%;
  }

  .gamepad-body {
    width: auto !important;
    height: auto !important;
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    margin: auto;
  }

  .overlay-controls {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .overlay-controls>* {
    pointer-events: all;
  }

  .connection-status-overlay {
    position: absolute;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    color: white;
    padding: 5px 10px;
    border-radius: var(--n-border-radius);
    z-index: 10;
  }

  .error-card {
    max-width: 400px;
  }
</style>
