import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { ref } from 'vue'

import {
  applyColorToElement,
  extractOriginalFill,
  findElementByAliases,
  findColorTargets,
  getAutoPressedColor,
  lerpColor,
  parseHexOrRgb,
  restoreElementColor,
  toHex,
  useSvgGamepadRenderer,
} from '@/composables/useSvgGamepadRenderer'
import { useGamepadStore } from '@/store/useGamepadStore'

describe('useSvgGamepadRenderer 单元测试', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('颜色工具函数', () => {
    it('parseHexOrRgb 解析 16 进制颜色', () => {
      expect(parseHexOrRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 })
      expect(parseHexOrRgb('#00ff00')).toEqual({ r: 0, g: 255, b: 0 })
      expect(parseHexOrRgb('#0000ff')).toEqual({ r: 0, g: 0, b: 255 })
      expect(parseHexOrRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 })
    })

    it('parseHexOrRgb 解析 rgb/rgba 颜色', () => {
      expect(parseHexOrRgb('rgb(100, 150, 200)')).toEqual({ r: 100, g: 150, b: 200 })
      expect(parseHexOrRgb('rgba(10, 20, 30, 0.5)')).toEqual({ r: 10, g: 20, b: 30 })
    })

    it('toHex 正确生成 hex 字符串', () => {
      expect(toHex(255, 0, 128)).toBe('#ff0080')
      expect(toHex(0, 0, 0)).toBe('#000000')
    })

    it('lerpColor 正确在两个颜色间线性插值', () => {
      const mid = lerpColor('#000000', '#ffffff', 0.5)
      expect(mid).toBe('#808080')
    })

    it('getAutoPressedColor 针对深浅底色返回高对比色', () => {
      expect(getAutoPressedColor('#000000')).toBe('#38bdf8')
      expect(getAutoPressedColor('#ffffff')).toBe('#0284c7')
    })

    it('extractOriginalFill 能够从 attribute 或 style 属性中提取颜色', () => {
      const el1 = document.createElement('path')
      el1.setAttribute('fill', '#123456')
      expect(extractOriginalFill(el1).effectiveColor).toBe('#123456')

      const el2 = document.createElement('path')
      el2.setAttribute('style', 'display:inline;fill:#654321;opacity:1')
      expect(extractOriginalFill(el2).effectiveColor).toBe('#654321')
    })
  })

  describe('SVG DOM 直接样式驱动', () => {
    it('按键与肩键按下时修改 fill 与 style.fill，松开时恢复原样式', () => {
      const container = document.createElement('div')
      container.innerHTML = `
        <svg viewBox="0 0 1000 1000">
          <g inkscape:label="A Button">
            <ellipse inkscape:label="Color" fill="#111111" />
            <path inkscape:label="Outline" fill="#777777" />
          </g>
          <g inkscape:label="Left Bumper">
            <path inkscape:label="Color" style="fill:#222222" />
          </g>
          <g inkscape:label="Right Bumper">
            <path inkscape:label="Color" style="fill:#333333" />
          </g>
          <g inkscape:label="Left Stick">
            <ellipse inkscape:label="Color" fill="#444444" />
          </g>
          <g inkscape:label="Right Trigger">
            <path inkscape:label="Color" fill="#555555" />
          </g>
        </svg>
      `
      document.body.appendChild(container)

      const containerRef = ref<Element | null>(container)
      const pressedColor = ref<string | null>('#ff0055')
      const stickSensitivity = ref<number>(10)

      const { analyzeAndBindSvg, renderFrame } = useSvgGamepadRenderer({
        svgContainerRef: containerRef,
        pressedColor,
        stickSensitivity,
      })

      analyzeAndBindSvg()

      const gamepad = useGamepadStore()
      const allEls = Array.from(container.querySelectorAll('*'))
      const aColorEl = allEls.find(
        (el) =>
          el.getAttribute('inkscape:label') === 'Color' &&
          el.parentElement?.getAttribute('inkscape:label') === 'A Button',
      )!
      const lbColorEl = allEls.find(
        (el) =>
          el.getAttribute('inkscape:label') === 'Color' &&
          el.parentElement?.getAttribute('inkscape:label') === 'Left Bumper',
      )!
      const rbEl = allEls.find(
        (el) =>
          el.getAttribute('inkscape:label') === 'Color' &&
          el.parentElement?.getAttribute('inkscape:label') === 'Right Bumper',
      )!
      const stickEl = allEls.find((el) => el.getAttribute('inkscape:label') === 'Left Stick')!
      const triggerEl = allEls.find((el) => el.getAttribute('inkscape:label') === 'Right Trigger')!

      expect(aColorEl).toBeDefined()
      expect(lbColorEl).toBeDefined()
      expect(rbEl).toBeDefined()
      expect(stickEl).toBeDefined()
      expect(triggerEl).toBeDefined()

      // 初始未连接状态
      renderFrame()
      expect(aColorEl.getAttribute('fill')).toBe('#111111')

      // 模拟手柄连接
      gamepad.gamepads = [
        {
          connected: true,
          id: 'Mock Gamepad',
          index: 0,
          mapping: 'standard',
          axes: [0, 0, 0, 0],
          buttons: [],
        } as any,
      ]
      gamepad.activeGamepadIndex = 0

      // 1. 模拟按下 A 键
      gamepad.simulateButton('ACTION_DOWN', true, 1)
      renderFrame()
      expect(aColorEl.getAttribute('fill')).toBe('#ff0055')

      // 松开 A 键
      gamepad.simulateButton('ACTION_DOWN', false, 0)
      renderFrame()
      expect(aColorEl.getAttribute('fill')).toBe('#111111')

      // 2. 模拟按下肩键 LB (Left Bumper)
      gamepad.simulateButton('LEFT_SHOULDER_1', true, 1)
      renderFrame()
      expect((lbColorEl as HTMLElement).style.fill).toBe('rgb(255, 0, 85)')

      gamepad.simulateButton('LEFT_SHOULDER_1', false, 0)
      renderFrame()
      expect((lbColorEl as HTMLElement).style.fill).toBe('rgb(34, 34, 34)')

      // 3. 模拟按下肩键 RB
      gamepad.simulateButton('RIGHT_SHOULDER_1', true, 1)
      renderFrame()
      expect((rbEl as HTMLElement).style.fill).toBe('rgb(255, 0, 85)')

      gamepad.simulateButton('RIGHT_SHOULDER_1', false, 0)
      renderFrame()
      expect((rbEl as HTMLElement).style.fill).toBe('rgb(51, 51, 51)')

      // 4. 模拟摇杆推移（基准 1000 viewBox 下）
      gamepad.simulateStick('LEFT_STICK', 0.8, -0.5)
      renderFrame()
      expect(stickEl.getAttribute('transform')).toContain('translate(8.00, -5.00)')

      // 摇杆归零
      gamepad.simulateStick('LEFT_STICK', 0, 0)
      renderFrame()
      expect(stickEl.getAttribute('transform') ?? '').toBe('')

      // 5. 模拟线性扳机下压向下位移
      gamepad.simulateButton('RIGHT_SHOULDER_2', true, 0.5)
      renderFrame()
      expect(triggerEl.getAttribute('transform')).toContain('translate(0, 10.00)')

      container.remove()
    })

    it('十字键按键各方向独立高亮且底盘仅做倾斜不整盘涂色', () => {
      const container = document.createElement('div')
      container.innerHTML = `
        <svg viewBox="0 0 1000 1000">
          <g inkscape:label="D-PAD" id="dpad-root">
            <path inkscape:label="Color" fill="#111111" />
            <g inkscape:label="D-PAD Up">
              <path inkscape:label="Color" fill="#222222" />
            </g>
            <g inkscape:label="D-PAD Down">
              <path inkscape:label="Color" fill="#333333" />
            </g>
            <g inkscape:label="D-PAD Left">
              <path inkscape:label="Color" fill="#444444" />
            </g>
            <g inkscape:label="D-PAD Right">
              <path inkscape:label="Color" fill="#555555" />
            </g>
          </g>
        </svg>
      `
      document.body.appendChild(container)

      const containerRef = ref<Element | null>(container)
      const pressedColor = ref<string | null>('#00ffcc')

      const { analyzeAndBindSvg, renderFrame } = useSvgGamepadRenderer({
        svgContainerRef: containerRef,
        pressedColor,
      })

      analyzeAndBindSvg()

      const gamepad = useGamepadStore()
      gamepad.gamepads = [
        {
          connected: true,
          id: 'Mock Gamepad',
          index: 0,
          mapping: 'standard',
          axes: [0, 0, 0, 0],
          buttons: [],
        } as any,
      ]
      gamepad.activeGamepadIndex = 0

      const dpadRoot = docById(container, 'dpad-root')!
      const rootColorPath = dpadRoot.querySelector('path[inkscape\\:label="Color"], path[label="Color"]')!
      const upPath = container.querySelector('[inkscape\\:label="D-PAD Up"] path, [label="D-PAD Up"] path')!
      const downPath = container.querySelector('[inkscape\\:label="D-PAD Down"] path, [label="D-PAD Down"] path')!

      // 1. 按下 UP 键：UP 单独亮起，DOWN 保持原色，底盘整体不被涂色
      gamepad.simulateButton('DPAD_UP', true, 1)
      renderFrame()

      expect(upPath.getAttribute('fill')).toBe('#00ffcc')
      expect(downPath.getAttribute('fill')).toBe('#333333')
      expect(rootColorPath.getAttribute('fill')).toBe('#111111') // 确保整盘未被涂色
      expect(dpadRoot.getAttribute('transform')).toContain('translate(0.00, -5.00)') // 盘身向上微移

      // 2. 松开 UP 键，按下 DOWN 键：UP 还原，DOWN 单独亮起
      gamepad.simulateButton('DPAD_UP', false, 0)
      gamepad.simulateButton('DPAD_DOWN', true, 1)
      renderFrame()

      expect(upPath.getAttribute('fill')).toBe('#222222')
      expect(downPath.getAttribute('fill')).toBe('#00ffcc')
      expect(rootColorPath.getAttribute('fill')).toBe('#111111')
      expect(dpadRoot.getAttribute('transform')).toContain('translate(0.00, 5.00)') // 盘身向下微移

      container.remove()
    })

    it('根据不同 SVG 的 viewBox 自动归一化摇杆位移与扳机行程', () => {
      // 创建 500px 宽度的缩小版 SVG
      const containerSmall = document.createElement('div')
      containerSmall.innerHTML = `
        <svg viewBox="0 0 500 500">
          <g inkscape:label="Left Stick">
            <ellipse inkscape:label="Color" fill="#444444" />
          </g>
          <g inkscape:label="Right Trigger">
            <path inkscape:label="Color" fill="#555555" />
          </g>
        </svg>
      `
      document.body.appendChild(containerSmall)

      const containerRef = ref<Element | null>(containerSmall)
      const stickSensitivity = ref<number>(10)

      const { analyzeAndBindSvg, renderFrame } = useSvgGamepadRenderer({
        svgContainerRef: containerRef,
        stickSensitivity,
      })

      analyzeAndBindSvg()

      const gamepad = useGamepadStore()
      gamepad.gamepads = [
        {
          connected: true,
          id: 'Mock Gamepad',
          index: 0,
          mapping: 'standard',
          axes: [0, 0, 0, 0],
          buttons: [],
        } as any,
      ]
      gamepad.activeGamepadIndex = 0

      const stickEl = Array.from(containerSmall.querySelectorAll('*')).find((el) => el.getAttribute('inkscape:label') === 'Left Stick')!
      const triggerEl = Array.from(containerSmall.querySelectorAll('*')).find((el) => el.getAttribute('inkscape:label') === 'Right Trigger')!

      // 在 500px viewBox 下，scaleFactor 为 0.5
      // 摇杆位移 0.8 * 10 * 0.5 = 4.00
      gamepad.simulateStick('LEFT_STICK', 0.8, -0.5)
      renderFrame()
      expect(stickEl.getAttribute('transform')).toContain('translate(4.00, -2.50)')

      // 扳机下压 0.5 * 20 * 0.5 = 5.00
      gamepad.simulateButton('RIGHT_SHOULDER_2', true, 0.5)
      renderFrame()
      expect(triggerEl.getAttribute('transform')).toContain('translate(0, 5.00)')

      containerSmall.remove()
    })
  })
})

function docById(container: Element, id: string): Element | null {
  return Array.from(container.querySelectorAll('*')).find((el) => el.id === id) || null
}
