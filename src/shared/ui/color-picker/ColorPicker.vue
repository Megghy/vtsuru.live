<script setup lang="ts">
import {
  ColorAreaArea,
  ColorAreaRoot,
  ColorAreaThumb,
  ColorSliderRoot,
  ColorSliderThumb,
  ColorSliderTrack,
  ColorSwatchPickerItem,
  ColorSwatchPickerItemSwatch,
  ColorSwatchPickerRoot,
  convertToHsb,
  type Color,
} from 'reka-ui'
import { ChevronsUpDown, Pipette } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'

import {
  DEFAULT_SOLID_SWATCHES,
  getAreaBackgroundStyle,
  hexToRgb,
  hsbToHex,
  hsbToHsl,
  hsbToRgb,
  hslToHsb,
  normalizePickerColor,
  parseColorToHsb,
  parseUserColorInput,
  rgbToHex,
  rgbToHsb,
  TRANSPARENT_SWATCH,
  type ColorMode,
  type HSBColor,
  type HSLColor,
  type RGBColor,
} from './colorUtils'

const props = withDefaults(
  defineProps<{
    modelValue?: string | null
    value?: string | null
    disabled?: boolean
    showAlpha?: boolean
    modes?: ColorMode[]
    swatches?: string[]
    size?: 'small' | 'medium' | 'large' | 'xs'
  }>(),
  {
    modelValue: '#000000',
    value: null,
    disabled: false,
    showAlpha: true,
    modes: () => ['hex', 'rgb', 'hsl'],
    swatches: undefined,
    size: 'small',
  },
)

const emit = defineEmits<{
  'update:modelValue': [val: string]
  'update:value': [val: string]
  change: [val: string]
}>()

const open = ref(false)

// 当前内部色彩的核心真源 (HSB + Alpha)
const currentHsb = ref<HSBColor>({
  h: 0,
  s: 0,
  b: 0,
  a: 1,
})

// 当前输入模式 (HEX / RGB / HSL)
const activeMode = ref<ColorMode>('hex')

// 模式切换列表
const availableModes = computed<ColorMode[]>(() => {
  if (props.modes && props.modes.length > 0) return props.modes
  return ['hex', 'rgb', 'hsl']
})

function cycleMode() {
  const modes = availableModes.value
  const currentIndex = modes.indexOf(activeMode.value)
  const nextIndex = (currentIndex + 1) % modes.length
  activeMode.value = modes[nextIndex]
}

// 预设色板
const effectiveSwatches = computed(() => {
  if (props.swatches) return props.swatches
  return props.showAlpha
    ? [TRANSPARENT_SWATCH, ...DEFAULT_SOLID_SWATCHES.slice(0, 11)]
    : [...DEFAULT_SOLID_SWATCHES]
})

// 对外派发的十六进制字符串 (小写规范，兼容现有断言与全站使用)
const currentHex = computed(() => hsbToHex(currentHsb.value, props.showAlpha))

// 当前 RGB 对象
const currentRgb = computed(() => hsbToRgb(currentHsb.value))

// 当前 HSL 对象
const currentHsl = computed(() => hsbToHsl(currentHsb.value))

// 当前不带透明度的纯色 rgb(r, g, b)，用于透明度滑轨背景渐变
const currentSolidRgbString = computed(() => {
  const { r, g, b } = currentRgb.value
  return `rgb(${r}, ${g}, ${b})`
})

// 2D 颜色选取板的动态渐变底色 (受 Hue 色相实时驱动，色相变时色盘底色即刻变色)
const areaBackgroundStyle = computed(() => {
  return getAreaBackgroundStyle(currentHsb.value.h)
})

// 供 Reka UI 原语组件双向绑定的 Color 对象 (避免在黑白灰度时丢失色相 H)
const boundColorObject = computed<Color>(() => ({
  space: 'hsb',
  h: currentHsb.value.h,
  s: currentHsb.value.s,
  b: currentHsb.value.b,
  alpha: currentHsb.value.a,
}))

// 监听外部 props 变化，解析并同步内部状态
watch(
  () => props.value ?? props.modelValue,
  (val) => {
    if (!val) return
    const incomingHex = normalizePickerColor(val, props.showAlpha)
    if (incomingHex.toLowerCase() !== currentHex.value.toLowerCase()) {
      // 保持当前已有色相（防止黑白转回时色相丢失）
      const parsed = parseColorToHsb(incomingHex, props.showAlpha, currentHsb.value.h)
      currentHsb.value = parsed
    }
  },
  { immediate: true },
)

function commitChange() {
  const hex = currentHex.value
  emit('update:modelValue', hex)
  emit('update:value', hex)
  emit('change', hex)
}

// 2D 颜色区域更新 (饱和度与明度)
function onAreaColorUpdate(color: Color) {
  const hsb = convertToHsb(color)
  currentHsb.value = {
    h: currentHsb.value.h, // 保持色相不受 2D 色盘边缘归一化干扰
    s: Math.round(hsb.s),
    b: Math.round(hsb.b),
    a: currentHsb.value.a,
  }
  commitChange()
}

// Hue 滑块更新
function onHueSliderUpdate(val: string | number | Color) {
  let hue = 0
  if (typeof val === 'number') {
    hue = val
  } else if (typeof val === 'object' && val !== null) {
    const hsb = convertToHsb(val)
    hue = hsb.h
  } else if (typeof val === 'string') {
    const parsed = parseColorToHsb(val, props.showAlpha, currentHsb.value.h)
    hue = parsed.h
  }
  currentHsb.value = {
    ...currentHsb.value,
    h: Math.round(hue),
  }
  commitChange()
}

// Alpha 滑块更新
function onAlphaSliderUpdate(val: string | number | Color) {
  let alpha = 1
  if (typeof val === 'number') {
    alpha = val
  } else if (typeof val === 'object' && val !== null && 'alpha' in val) {
    alpha = val.alpha
  } else if (typeof val === 'string') {
    const rgb = hexToRgb(val)
    if (rgb) alpha = rgb.a
  }
  currentHsb.value = {
    ...currentHsb.value,
    a: Number(Math.max(0, Math.min(1, alpha)).toFixed(4)),
  }
  commitChange()
}

// --- 各模式文本输入同步 ---
const hexInput = ref('')
const rgbInputs = ref({ r: 0, g: 0, b: 0, a: 100 })
const hslInputs = ref({ h: 0, s: 0, l: 0, a: 100 })

// 内部色彩变化时，同步刷新输入框缓存
watch(
  currentHsb,
  () => {
    hexInput.value = currentHex.value.toUpperCase()

    const rgb = currentRgb.value
    rgbInputs.value = {
      r: rgb.r,
      g: rgb.g,
      b: rgb.b,
      a: Math.round(rgb.a * 100),
    }

    const hsl = currentHsl.value
    hslInputs.value = {
      h: hsl.h,
      s: hsl.s,
      l: hsl.l,
      a: Math.round(hsl.a * 100),
    }
  },
  { immediate: true, deep: true },
)

function onHexCommit() {
  const parsed = parseUserColorInput(hexInput.value, props.showAlpha)
  if (parsed) {
    currentHsb.value = parseColorToHsb(parsed, props.showAlpha, currentHsb.value.h)
    commitChange()
  } else {
    hexInput.value = currentHex.value.toUpperCase()
  }
}

function onRgbCommit() {
  const r = Math.max(0, Math.min(255, Number(rgbInputs.value.r) || 0))
  const g = Math.max(0, Math.min(255, Number(rgbInputs.value.g) || 0))
  const b = Math.max(0, Math.min(255, Number(rgbInputs.value.b) || 0))
  const a = props.showAlpha
    ? Math.max(0, Math.min(100, Number(rgbInputs.value.a) || 0)) / 100
    : 1

  const newHsb = rgbToHsb({ r, g, b, a }, currentHsb.value.h)
  currentHsb.value = newHsb
  commitChange()
}

function onHslCommit() {
  const h = Math.max(0, Math.min(360, Number(hslInputs.value.h) || 0))
  const s = Math.max(0, Math.min(100, Number(hslInputs.value.s) || 0))
  const l = Math.max(0, Math.min(100, Number(hslInputs.value.l) || 0))
  const a = props.showAlpha
    ? Math.max(0, Math.min(100, Number(hslInputs.value.a) || 0)) / 100
    : 1

  const newHsb = hslToHsb({ h, s, l, a }, currentHsb.value.h)
  currentHsb.value = newHsb
  commitChange()
}

function onAlphaPercentCommit(val: string | number) {
  const num = typeof val === 'string' ? parseFloat(val.replace('%', '')) : val
  if (!Number.isNaN(num)) {
    const clamped = Math.max(0, Math.min(100, num)) / 100
    currentHsb.value = {
      ...currentHsb.value,
      a: Number(clamped.toFixed(4)),
    }
    commitChange()
  }
}

// 吸管工具支持
const supportsEyeDropper = typeof window !== 'undefined' && 'EyeDropper' in window

async function openEyeDropper() {
  if (!supportsEyeDropper) return
  try {
    const eyeDropper = new (window as any).EyeDropper()
    const result = await eyeDropper.open()
    if (result?.sRGBHex) {
      const parsed = parseUserColorInput(result.sRGBHex, props.showAlpha)
      if (parsed) {
        currentHsb.value = parseColorToHsb(parsed, props.showAlpha, currentHsb.value.h)
        commitChange()
      }
    }
  } catch {
    // 用户取消吸取
  }
}

// 预设色块点选
function onSwatchSelect(val: string | string[]) {
  const target = Array.isArray(val) ? val[0] : val
  if (target) {
    const parsed = parseUserColorInput(target, props.showAlpha)
    if (parsed) {
      currentHsb.value = parseColorToHsb(parsed, props.showAlpha, currentHsb.value.h)
      commitChange()
    }
  }
}

// 判断某个预设是否与当前颜色一致
function isSwatchActive(swatch: string): boolean {
  const normCurrent = currentHex.value.toLowerCase()
  const normSwatch = normalizePickerColor(swatch, props.showAlpha).toLowerCase()
  return normCurrent === normSwatch
}
</script>

<template>
  <div class="inline-flex items-center">
    <Popover v-model:open="open">
      <PopoverTrigger as-child>
        <Button
          type="button"
          variant="outline"
          :size="size === 'xs' ? 'xs' : 'sm'"
          class="w-full justify-start gap-1.5 px-2 font-normal"
          :disabled="disabled"
        >
          <div
            class="size-4 shrink-0 rounded-xs border border-black/15 shadow-inner overflow-hidden [background-image:linear-gradient(var(--preview-color),var(--preview-color)),repeating-conic-gradient(#ccc_0%_25%,#fff_0%_50%)] [background-size:100%_100%,6px_6px]"
            :style="{ '--preview-color': currentHex }"
          />
          <span class="font-mono uppercase text-foreground min-w-[64px] text-left truncate text-xs">
            {{ currentHex }}
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        class="w-68 p-3 space-y-3"
        align="start"
      >
        <!-- 2D 色彩选取盘 (饱和度 & 明度，背景受色相实时驱动) -->
        <ColorAreaRoot
          :model-value="boundColorObject"
          color-space="hsb"
          x-channel="saturation"
          y-channel="brightness"
          :disabled="disabled"
          class="relative block h-36 w-full rounded-md border border-border overflow-hidden touch-none select-none cursor-crosshair"
          @update:color="onAreaColorUpdate"
        >
          <ColorAreaArea
            :style="areaBackgroundStyle"
            class="block size-full"
          >
            <ColorAreaThumb
              class="block size-4 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35),0_2px_4px_rgba(0,0,0,0.25)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
            />
          </ColorAreaArea>
        </ColorAreaRoot>

        <!-- 滑轨控制区与预览/吸管 -->
        <div class="flex items-center gap-2.5">
          <!-- 色彩预览大方块 (带棋盘背景，直观预览透明度) -->
          <div
            class="size-8 shrink-0 rounded-md border border-border shadow-inner overflow-hidden [background-image:linear-gradient(var(--preview-color),var(--preview-color)),repeating-conic-gradient(#ccc_0%_25%,#fff_0%_50%)] [background-size:100%_100%,8px_8px]"
            :style="{ '--preview-color': currentHex }"
          />

          <!-- 滑道组合 (Hue + Alpha) -->
          <div class="flex-1 min-w-0 space-y-2">
            <!-- 色相滑轨 -->
            <ColorSliderRoot
              :model-value="boundColorObject"
              channel="hue"
              color-space="hsb"
              :disabled="disabled"
              class="relative flex h-3 w-full touch-none select-none items-center"
              @update:model-value="onHueSliderUpdate"
            >
              <ColorSliderTrack
                class="relative h-2.5 w-full grow overflow-hidden rounded-full border border-black/10"
                :style="{ backgroundImage: 'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)' }"
              />
              <ColorSliderThumb
                class="block size-3.5 rounded-full border-2 border-white bg-transparent shadow-[0_0_0_1px_rgba(0,0,0,0.35),0_1px_3px_rgba(0,0,0,0.3)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
              />
            </ColorSliderRoot>

            <!-- 透明度滑轨 (开启 showAlpha 时显示) -->
            <ColorSliderRoot
              v-if="showAlpha"
              :model-value="boundColorObject"
              channel="alpha"
              color-space="hsb"
              :disabled="disabled"
              class="relative flex h-3 w-full touch-none select-none items-center"
              @update:model-value="onAlphaSliderUpdate"
            >
              <ColorSliderTrack
                class="relative h-2.5 w-full grow overflow-hidden rounded-full border border-black/10 [background-image:linear-gradient(to_right,transparent,var(--alpha-solid-color)),repeating-conic-gradient(#ccc_0%_25%,#fff_0%_50%)] [background-size:100%_100%,8px_8px]"
                :style="{ '--alpha-solid-color': currentSolidRgbString }"
              />
              <ColorSliderThumb
                class="block size-3.5 rounded-full border-2 border-white bg-transparent shadow-[0_0_0_1px_rgba(0,0,0,0.35),0_1px_3px_rgba(0,0,0,0.3)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
              />
            </ColorSliderRoot>
          </div>

          <!-- 屏幕吸管按钮 (浏览器支持 EyeDropper 时展示) -->
          <Button
            v-if="supportsEyeDropper"
            type="button"
            variant="ghost"
            size="icon-xs"
            title="屏幕拾色器"
            class="shrink-0 text-muted-foreground hover:text-foreground"
            :disabled="disabled"
            @click="openEyeDropper"
          >
            <Pipette class="size-3.5" />
          </Button>
        </div>

        <!-- 格式切换与多模式数值输入 (HEX / RGB / HSL) -->
        <div class="space-y-1.5">
          <div class="flex items-center gap-1.5">
            <!-- 模式切换触发器 -->
            <button
              type="button"
              class="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[11px] font-mono font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer select-none"
              title="切换色彩格式 (HEX / RGB / HSL)"
              :disabled="disabled"
              @click="cycleMode"
            >
              <span>{{ activeMode.toUpperCase() }}</span>
              <ChevronsUpDown class="size-3 opacity-60" />
            </button>

            <!-- HEX 模式输入框 -->
            <template v-if="activeMode === 'hex'">
              <div class="flex-1 min-w-0 flex items-center gap-1.5">
                <Input
                  v-model="hexInput"
                  class="flex-1 min-w-0 font-mono uppercase px-2 h-7 text-xs"
                  :placeholder="showAlpha ? '#000000FF' : '#000000'"
                  :disabled="disabled"
                  @blur="onHexCommit"
                  @keyup.enter="onHexCommit"
                />
                <div
                  v-if="showAlpha"
                  class="relative w-14 shrink-0"
                >
                  <Input
                    :model-value="`${Math.round(currentHsb.a * 100)}%`"
                    class="h-7 text-xs font-mono text-center px-1"
                    title="透明度 (0-100%)"
                    :disabled="disabled"
                    @change="onAlphaPercentCommit(($event.target as HTMLInputElement).value)"
                    @keyup.enter="onAlphaPercentCommit(($event.target as HTMLInputElement).value)"
                  />
                </div>
              </div>
            </template>

            <!-- RGB 模式分通道输入框 -->
            <template v-else-if="activeMode === 'rgb'">
              <div
                class="flex-1 min-w-0 grid gap-1"
                :class="showAlpha ? 'grid-cols-4' : 'grid-cols-3'"
              >
                <div class="space-y-0.5">
                  <Input
                    v-model.number="rgbInputs.r"
                    type="number"
                    min="0"
                    max="255"
                    class="h-7 text-xs font-mono text-center p-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    :disabled="disabled"
                    @blur="onRgbCommit"
                    @keyup.enter="onRgbCommit"
                  />
                  <div class="text-[10px] text-muted-foreground text-center font-mono">R</div>
                </div>
                <div class="space-y-0.5">
                  <Input
                    v-model.number="rgbInputs.g"
                    type="number"
                    min="0"
                    max="255"
                    class="h-7 text-xs font-mono text-center p-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    :disabled="disabled"
                    @blur="onRgbCommit"
                    @keyup.enter="onRgbCommit"
                  />
                  <div class="text-[10px] text-muted-foreground text-center font-mono">G</div>
                </div>
                <div class="space-y-0.5">
                  <Input
                    v-model.number="rgbInputs.b"
                    type="number"
                    min="0"
                    max="255"
                    class="h-7 text-xs font-mono text-center p-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    :disabled="disabled"
                    @blur="onRgbCommit"
                    @keyup.enter="onRgbCommit"
                  />
                  <div class="text-[10px] text-muted-foreground text-center font-mono">B</div>
                </div>
                <div
                  v-if="showAlpha"
                  class="space-y-0.5"
                >
                  <Input
                    v-model.number="rgbInputs.a"
                    type="number"
                    min="0"
                    max="100"
                    class="h-7 text-xs font-mono text-center p-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    :disabled="disabled"
                    @blur="onRgbCommit"
                    @keyup.enter="onRgbCommit"
                  />
                  <div class="text-[10px] text-muted-foreground text-center font-mono">A%</div>
                </div>
              </div>
            </template>

            <!-- HSL 模式分通道输入框 -->
            <template v-else-if="activeMode === 'hsl'">
              <div
                class="flex-1 min-w-0 grid gap-1"
                :class="showAlpha ? 'grid-cols-4' : 'grid-cols-3'"
              >
                <div class="space-y-0.5">
                  <Input
                    v-model.number="hslInputs.h"
                    type="number"
                    min="0"
                    max="360"
                    class="h-7 text-xs font-mono text-center p-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    :disabled="disabled"
                    @blur="onHslCommit"
                    @keyup.enter="onHslCommit"
                  />
                  <div class="text-[10px] text-muted-foreground text-center font-mono">H°</div>
                </div>
                <div class="space-y-0.5">
                  <Input
                    v-model.number="hslInputs.s"
                    type="number"
                    min="0"
                    max="100"
                    class="h-7 text-xs font-mono text-center p-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    :disabled="disabled"
                    @blur="onHslCommit"
                    @keyup.enter="onHslCommit"
                  />
                  <div class="text-[10px] text-muted-foreground text-center font-mono">S%</div>
                </div>
                <div class="space-y-0.5">
                  <Input
                    v-model.number="hslInputs.l"
                    type="number"
                    min="0"
                    max="100"
                    class="h-7 text-xs font-mono text-center p-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    :disabled="disabled"
                    @blur="onHslCommit"
                    @keyup.enter="onHslCommit"
                  />
                  <div class="text-[10px] text-muted-foreground text-center font-mono">L%</div>
                </div>
                <div
                  v-if="showAlpha"
                  class="space-y-0.5"
                >
                  <Input
                    v-model.number="hslInputs.a"
                    type="number"
                    min="0"
                    max="100"
                    class="h-7 text-xs font-mono text-center p-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    :disabled="disabled"
                    @blur="onHslCommit"
                    @keyup.enter="onHslCommit"
                  />
                  <div class="text-[10px] text-muted-foreground text-center font-mono">A%</div>
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- 预设色板 -->
        <div v-if="effectiveSwatches.length > 0">
          <ColorSwatchPickerRoot
            :model-value="currentHex"
            class="grid grid-cols-6 gap-1.5 pt-0.5"
            @update:model-value="onSwatchSelect"
          >
            <ColorSwatchPickerItem
              v-for="swatch in effectiveSwatches"
              :key="swatch"
              :value="swatch"
              :disabled="disabled"
              :class="[
                'relative size-6 rounded-xs border border-black/15 transition-all cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring overflow-hidden',
                isSwatchActive(swatch) ? 'ring-2 ring-primary ring-offset-1 ring-offset-background scale-105 z-1' : 'hover:scale-105',
              ]"
            >
              <ColorSwatchPickerItemSwatch
                class="block size-full [background-image:linear-gradient(var(--reka-color-swatch-color),var(--reka-color-swatch-color)),repeating-conic-gradient(#ccc_0%_25%,#fff_0%_50%)] [background-size:100%_100%,6px_6px]"
              />
              <!-- 透明色块红斜线指示 -->
              <div
                v-if="swatch === TRANSPARENT_SWATCH"
                class="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <div class="w-[140%] h-[1.5px] bg-red-500/80 rotate-45 transform origin-center shadow-xs" />
              </div>
            </ColorSwatchPickerItem>
          </ColorSwatchPickerRoot>
        </div>
      </PopoverContent>
    </Popover>
  </div>
</template>
