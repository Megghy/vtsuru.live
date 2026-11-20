<script setup lang="ts">
import ArrowCounterclockwise24Regular from '@vicons/fluent/es/ArrowCounterclockwise24Regular'
import Checkmark24Regular from '@vicons/fluent/es/Checkmark24Regular'
import Copy24Regular from '@vicons/fluent/es/Copy24Regular'
import Keyboard24Regular from '@vicons/fluent/es/Keyboard24Regular'
import Play24Regular from '@vicons/fluent/es/Play24Regular'
import Stop24Regular from '@vicons/fluent/es/Stop24Regular'
import { useClipboard } from '@vueuse/core'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import ObsChannelSwitcher from '@/apps/obs-store/components/store/ObsChannelSwitcher.vue'
import { OBS_SYNC_CHANNEL_HINT, parseObsSyncChannel, resolveObsSyncChannel, useObsBridge } from '@/apps/obs-store/sync'
import GoogleFontPicker from '@/shared/components/GoogleFontPicker.vue'
import { buildObsSourceUrl } from '@/shared/obs/obsUrl'
import { SYSTEM_CHINESE_FONT_OPTIONS } from '@/shared/questionDisplayPresets'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { ColorPicker } from '@/shared/ui/color-picker'
import { FormField } from '@/shared/ui/form-field'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { SettingRow } from '@/shared/ui/setting-row'
import { Slider } from '@/shared/ui/slider'
import { Switch } from '@/shared/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'

import { KEYBOARD_LAYOUTS } from './keyboardLayouts'
import type { KeyboardLayoutPreset } from './keyboardLayouts'
import KeycastDisplay from './KeycastDisplay.vue'
import {
  DEFAULT_KEYCAST_STATE,
  formatKeyboardEvent,
  mapMouseButton,
  resolveAfterglowMs,
  resolvePressEffect,
} from './types'
import type {
  KeycastAction,
  KeycastColorMode,
  KeycastDirection,
  KeycastDisplayMode,
  KeycastPressEffect,
  KeycastState,
  KeycastTheme,
  KeyPressPayload,
  MouseButtonName,
} from './types'

const { copy, isSupported: isCopySupported } = useClipboard()
const route = useRoute()
const account = useAccount()

const props = defineProps<{ channelId?: string }>()
const channelId = ref(resolveObsSyncChannel(props.channelId ?? route.query.channel))
const channelDraft = ref(channelId.value)
watch(
  () => props.channelId,
  (val) => {
    if (!val) return
    const resolved = resolveObsSyncChannel(val)
    channelId.value = resolved
    channelDraft.value = resolved
  },
)
const copied = ref(false)
const captureFocused = ref(true)
const isSimulating = ref(false)
const previewBg = ref<'checker' | 'dark' | 'transparent'>('checker')

const { state, updateState, sendAction, currentHash, isSyncing, lastSyncError, hasPendingChanges, retry } =
  useObsBridge<KeycastState, KeycastAction>({
    componentId: 'keycast',
    channelId,
    defaultState: DEFAULT_KEYCAST_STATE,
    role: 'controller',
  })

const displayModeOptions: { label: string; value: KeycastDisplayMode }[] = [
  { label: '键鼠可视化画布 (Canvas)', value: 'overlay' },
  { label: '按键弹幕流 (Stream)', value: 'stream' },
]

const layoutOptions = Object.values(KEYBOARD_LAYOUTS).map((l) => ({
  label: l.name,
  value: l.id,
  description: l.description,
}))

const themeOptions: { label: string; value: KeycastTheme }[] = [
  { label: '机械键帽 (Mechanical)', value: 'mechanical' },
  { label: '游戏沉浸无框 (Immersive)', value: 'immersive' },
  { label: '赛博霓虹 (Neon)', value: 'neon' },
  { label: '极简暗夜 (Minimal)', value: 'minimal' },
  { label: '玻璃拟态 (Glass)', value: 'glass' },
]

const directionOptions: { label: string; value: KeycastDirection }[] = [
  { label: '横向排列', value: 'row' },
  { label: '纵向堆叠', value: 'column' },
]

const pressEffectOptions: { label: string; value: KeycastPressEffect }[] = [
  { label: '圆环扩散波纹', value: 'ripple' },
  { label: '矩形脉冲边框', value: 'shockwave' },
  { label: '粒子火花四溅', value: 'spark' },
  { label: '上飘音游光柱', value: 'beam' },
  { label: '纯净点亮 (无额外特效)', value: 'none' },
]

const colorModeOptions: { label: string; value: KeycastColorMode }[] = [
  { label: '单色强调 (跟随强调色)', value: 'solid' },
  { label: '流动 RGB 彩虹', value: 'rainbow' },
  { label: '电竞功能分区着色', value: 'zone' },
]

const afterglowOptions: { label: string; value: string }[] = [
  { label: '即时熄灭 (无余晖)', value: '0' },
  { label: '利落短余晖 (180ms)', value: '180' },
  { label: '柔和渐消 (340ms)', value: '340' },
  { label: '拖尾余韵 (750ms)', value: '750' },
  { label: '长效留痕 (1200ms)', value: '1200' },
]

const sampleCombos: { label: string; payload: KeyPressPayload }[] = [
  { label: 'W', payload: { label: 'W', modifiers: [], code: 'KeyW', ts: 0 } },
  { label: 'Space', payload: { label: 'Space', modifiers: [], code: 'Space', ts: 0 } },
  { label: 'Shift', payload: { label: 'Shift', modifiers: [], code: 'ShiftLeft', ts: 0 } },
  { label: 'Ctrl+C', payload: { label: 'C', modifiers: ['Ctrl'], code: 'KeyC', ts: 0 } },
]

const recommendedResolutionText = computed(() => {
  if (state.value.displayMode === 'stream') {
    return state.value.direction === 'column' ? '320 × 320 px' : '500 × 200 px'
  }
  const hasMouse = state.value.showMouse
  switch (state.value.keyboardLayout) {
    case 'wasd':
    case 'moba':
      return hasMouse ? '460 × 280 px' : '320 × 280 px'
    case '60':
      return hasMouse ? '780 × 280 px' : '640 × 280 px'
    case 'tkl':
      return hasMouse ? '940 × 320 px' : '800 × 320 px'
    default:
      return '500 × 260 px'
  }
})

const obsAbsoluteUrl = computed(() =>
  buildObsSourceUrl({
    path: '/obs-store/keycast',
    host: window.location.origin,
    credential: 'public-id',
    userId: account.value.id,
    params: { channel: channelId.value },
  }),
)

function changeChannel() {
  const normalized = parseObsSyncChannel(channelDraft.value)
  if (!normalized) {
    toast.warning(OBS_SYNC_CHANNEL_HINT)
    return
  }
  channelId.value = normalized
  channelDraft.value = normalized
}

function triggerSample(payload: KeyPressPayload) {
  sendAction({ type: 'KEY_PRESS', payload: { ...payload, ts: Date.now() } })
}

function triggerMouseTap(button: MouseButtonName) {
  sendAction({ type: 'MOUSE_DOWN', button })
  setTimeout(() => {
    sendAction({ type: 'MOUSE_UP', button })
  }, 140)
}

function handleClear() {
  stopSimulation()
  sendAction({ type: 'CLEAR' })
}

async function copyObsUrl() {
  if (!isCopySupported.value) {
    toast.warning('当前环境不支持直接写入剪贴板，请手动复制')
    return
  }
  try {
    await copy(obsAbsoluteUrl.value)
    copied.value = true
    toast.success('OBS 浏览器源链接已复制到剪贴板！')
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    toast.error('复制失败，请手动复制')
  }
}

// 预览区键盘与鼠标实时捕获
const activePreviewCodes = new Set<string>()
const activePreviewMouse = new Set<MouseButtonName>()

function isEditableTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return Boolean(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable))
}

function onPreviewKeydown(event: KeyboardEvent) {
  if (!captureFocused.value || isEditableTarget(event.target)) return
  const payload = formatKeyboardEvent(event)
  if (!payload) return
  activePreviewCodes.add(payload.code)
  sendAction({ type: 'KEY_DOWN', code: payload.code, payload })
}

function onPreviewKeyup(event: KeyboardEvent) {
  if (!captureFocused.value) return
  const code = event.code || event.key
  if (!code || !activePreviewCodes.delete(code)) return
  sendAction({ type: 'KEY_UP', code })
}

function onMonitorMousedown(event: MouseEvent) {
  if (!captureFocused.value) return
  const btn = mapMouseButton(event.button)
  if (!btn) return
  activePreviewMouse.add(btn)
  sendAction({ type: 'MOUSE_DOWN', button: btn })
}

function onMonitorMouseup(event: MouseEvent) {
  const btn = mapMouseButton(event.button)
  if (!btn || !activePreviewMouse.delete(btn)) return
  sendAction({ type: 'MOUSE_UP', button: btn })
}

function onMonitorWheel(event: WheelEvent) {
  if (!captureFocused.value || event.deltaY === 0) return
  sendAction({ type: 'MOUSE_WHEEL', direction: event.deltaY < 0 ? 'up' : 'down' })
}

function onMonitorMousemove(event: MouseEvent) {
  if (!captureFocused.value) return
  if (event.movementX !== 0 || event.movementY !== 0) {
    sendAction({ type: 'MOUSE_MOVE', dx: event.movementX, dy: event.movementY })
  }
}

function releaseAllCaptured() {
  for (const code of activePreviewCodes) sendAction({ type: 'KEY_UP', code })
  for (const btn of activePreviewMouse) sendAction({ type: 'MOUSE_UP', button: btn })
  activePreviewCodes.clear()
  activePreviewMouse.clear()
}

// 游戏操作仿真循环
let simTimer: ReturnType<typeof setInterval> | null = null
let simStep = 0

function stopSimulation() {
  isSimulating.value = false
  if (simTimer) {
    clearInterval(simTimer)
    simTimer = null
  }
  sendAction({ type: 'KEY_UP', code: 'KeyW' })
  sendAction({ type: 'KEY_UP', code: 'KeyA' })
  sendAction({ type: 'KEY_UP', code: 'KeyD' })
  sendAction({ type: 'KEY_UP', code: 'ShiftLeft' })
  sendAction({ type: 'MOUSE_UP', button: 'left' })
  sendAction({ type: 'MOUSE_UP', button: 'right' })
}

function toggleSimulation() {
  if (isSimulating.value) {
    stopSimulation()
    return
  }
  isSimulating.value = true
  simStep = 0
  const sequence = [
    () => {
      sendAction({
        type: 'KEY_DOWN',
        code: 'KeyW',
        payload: { label: 'W', modifiers: [], code: 'KeyW', ts: Date.now() },
      })
      sendAction({ type: 'KEY_DOWN', code: 'ShiftLeft' })
      sendAction({ type: 'MOUSE_MOVE', dx: 18, dy: -6 })
    },
    () => {
      sendAction({
        type: 'KEY_DOWN',
        code: 'KeyD',
        payload: { label: 'D', modifiers: [], code: 'KeyD', ts: Date.now() },
      })
      sendAction({ type: 'MOUSE_DOWN', button: 'right' })
      sendAction({ type: 'MOUSE_MOVE', dx: 22, dy: 8 })
    },
    () => {
      sendAction({ type: 'KEY_UP', code: 'KeyD' })
      sendAction({
        type: 'KEY_DOWN',
        code: 'KeyA',
        payload: { label: 'A', modifiers: [], code: 'KeyA', ts: Date.now() },
      })
      sendAction({ type: 'MOUSE_DOWN', button: 'left' })
      sendAction({ type: 'MOUSE_MOVE', dx: -24, dy: 4 })
    },
    () => {
      sendAction({ type: 'MOUSE_UP', button: 'left' })
      sendAction({ type: 'KEY_PRESS', payload: { label: 'Space', modifiers: [], code: 'Space', ts: Date.now() } })
      sendAction({ type: 'MOUSE_WHEEL', direction: 'up' })
      sendAction({ type: 'MOUSE_MOVE', dx: -16, dy: -10 })
    },
    () => {
      sendAction({ type: 'KEY_UP', code: 'KeyA' })
      sendAction({ type: 'KEY_UP', code: 'ShiftLeft' })
      sendAction({ type: 'MOUSE_UP', button: 'right' })
      sendAction({ type: 'KEY_PRESS', payload: { label: 'R', modifiers: [], code: 'KeyR', ts: Date.now() } })
    },
    () => {
      sendAction({ type: 'KEY_UP', code: 'KeyW' })
      sendAction({ type: 'MOUSE_WHEEL', direction: 'down' })
      sendAction({ type: 'KEY_PRESS', payload: { label: 'Q', modifiers: [], code: 'KeyQ', ts: Date.now() } })
    },
  ]

  sequence[0]()
  simTimer = setInterval(() => {
    simStep = (simStep + 1) % sequence.length
    sequence[simStep]()
  }, 360)
}

onMounted(() => {
  window.addEventListener('keydown', onPreviewKeydown)
  window.addEventListener('keyup', onPreviewKeyup)
  window.addEventListener('mouseup', onMonitorMouseup)
  window.addEventListener('blur', releaseAllCaptured)
})

onBeforeUnmount(() => {
  stopSimulation()
  releaseAllCaptured()
  window.removeEventListener('keydown', onPreviewKeydown)
  window.removeEventListener('keyup', onPreviewKeyup)
  window.removeEventListener('mouseup', onMonitorMouseup)
  window.removeEventListener('blur', releaseAllCaptured)
})
</script>

<template>
  <div class="keycast-viewer-page">
    <Card class="p-4">
      <CardContent class="p-0 space-y-3">
        <!-- 头部栏 -->
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-base font-bold text-foreground">键鼠映射与按键投屏 (Keycast)</span>
              <span class="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">Canvas 2D</span>
            </div>
            <div class="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span
                class="size-2 rounded-full"
                :class="lastSyncError ? 'bg-destructive' : isSyncing ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'"
              />
              <span v-if="lastSyncError">同步失败，请重试</span>
              <span v-else-if="isSyncing">正在同步状态...</span>
              <span v-else-if="hasPendingChanges">有修改尚未保存</span>
              <span v-else-if="currentHash">已同步 (Hash: {{ currentHash.slice(0, 8) }})</span>
              <span v-else>就绪</span>
            </div>
          </div>

          <ObsChannelSwitcher
            v-model="channelDraft"
            @submit="changeChannel"
          />

          <div class="flex items-center gap-2">
            <Button
              v-if="lastSyncError"
              variant="secondary"
              :disabled="isSyncing"
              @click="retry"
            >
              重试同步
            </Button>

            <Button
              class="gap-1.5"
              @click="copyObsUrl"
            >
              <Checkmark24Regular
                v-if="copied"
                class="size-4"
              />
              <Copy24Regular
                v-else
                class="size-4"
              />
              复制 OBS 源链接
            </Button>
          </div>
        </div>

        <Separator class="my-2.5" />

        <!-- 实时预览监视器 -->
        <div class="rounded-lg border border-border bg-muted/20 p-3.5 space-y-2.5">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="text-xs font-semibold text-foreground">
              OBS 透明画布实时监视器（可直接点击画布键鼠或移动测试）
            </span>
            <ToggleGroup
              type="single"
              size="xs"
              :model-value="previewBg"
              @update:model-value="(val) => val && (previewBg = val as any)"
            >
              <ToggleGroupItem value="checker">网格底</ToggleGroupItem>
              <ToggleGroupItem value="dark">暗黑底</ToggleGroupItem>
              <ToggleGroupItem value="transparent">透明底</ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div
            class="min-h-[210px] rounded-md border border-border flex items-center justify-center p-4 overflow-x-auto scrollbar-thin"
            :class="{
              'bg-zinc-900': previewBg === 'dark',
              'bg-transparent': previewBg === 'transparent',
              'bg-[linear-gradient(45deg,rgba(128,128,128,0.12)_25%,transparent_25%,transparent_75%,rgba(128,128,128,0.12)_75%),linear-gradient(45deg,rgba(128,128,128,0.12)_25%,transparent_25%,transparent_75%,rgba(128,128,128,0.12)_75%)] bg-[length:16px_16px] bg-[position:0_0,8px_8px]':
                previewBg === 'checker',
            }"
            @mousedown="onMonitorMousedown"
            @wheel.prevent="onMonitorWheel"
            @mousemove="onMonitorMousemove"
            @contextmenu.prevent
          >
            <KeycastDisplay
              :channel-id="channelId"
              :inline-mode="true"
              :interactive="true"
              @virtual-key-down="(code) => sendAction({ type: 'KEY_DOWN', code })"
              @virtual-key-up="(code) => sendAction({ type: 'KEY_UP', code })"
              @virtual-mouse-down="(button) => sendAction({ type: 'MOUSE_DOWN', button })"
              @virtual-mouse-up="(button) => sendAction({ type: 'MOUSE_UP', button })"
            />
          </div>

          <div class="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span>
              当前布局推荐 OBS 分辨率: <b class="text-foreground">{{ recommendedResolutionText }}</b
              >（浏览器源已原生透明）
            </span>
            <span>点击预览画布内任意键帽/鼠标区域可直接测试亮起与波纹效果</span>
          </div>
        </div>

        <!-- 测试台与仿真控制 -->
        <div class="rounded-lg border border-border bg-muted/20 p-3.5 space-y-2.5">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <span class="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Keyboard24Regular class="size-4 text-primary" />
              按键捕获与仿真控制台
            </span>
            <div class="flex flex-wrap items-center gap-4">
              <label class="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                <Switch v-model:checked="captureFocused" />
                <span>捕获页面键鼠操作</span>
              </label>
              <Button
                size="xs"
                :variant="isSimulating ? 'destructive' : 'secondary'"
                class="gap-1"
                @click="toggleSimulation"
              >
                <Stop24Regular
                  v-if="isSimulating"
                  class="size-3.5"
                />
                <Play24Regular
                  v-else
                  class="size-3.5"
                />
                {{ isSimulating ? '停止操作仿真' : '开启游戏操作仿真' }}
              </Button>
            </div>
          </div>

          <div class="flex flex-wrap gap-1.5">
            <Button
              v-for="sample in sampleCombos"
              :key="sample.label"
              variant="outline"
              size="xs"
              class="font-mono"
              @click="triggerSample(sample.payload)"
            >
              {{ sample.label }}
            </Button>
            <Button
              variant="outline"
              size="xs"
              class="font-mono"
              @click="triggerMouseTap('left')"
            >
              鼠标左键
            </Button>
            <Button
              variant="outline"
              size="xs"
              class="font-mono"
              @click="triggerMouseTap('right')"
            >
              鼠标右键
            </Button>
            <Button
              variant="outline"
              size="xs"
              class="font-mono"
              @click="sendAction({ type: 'MOUSE_WHEEL', direction: 'up' })"
            >
              滚轮 ↑
            </Button>
            <Button
              variant="ghost"
              size="xs"
              class="gap-1 text-muted-foreground"
              @click="handleClear"
            >
              <ArrowCounterclockwise24Regular class="size-3.5" />
              重置计数与画面
            </Button>
          </div>
        </div>

        <Separator class="my-3" />

        <!-- 基础样式配置 -->
        <div class="text-xs font-semibold text-foreground">展示模式与外观配置</div>

        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
          <FormField
            label="展示形式"
            class="min-w-0"
          >
            <Select
              :model-value="state.displayMode"
              @update:model-value="(val) => updateState({ displayMode: val as KeycastDisplayMode })"
            >
              <SelectTrigger class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="opt in displayModeOptions"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            v-if="state.displayMode === 'overlay'"
            label="键盘布局预设"
            class="min-w-0"
          >
            <Select
              :model-value="state.keyboardLayout"
              @update:model-value="(val) => updateState({ keyboardLayout: val as KeyboardLayoutPreset })"
            >
              <SelectTrigger class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="opt in layoutOptions"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            v-else
            label="排列方向"
            class="min-w-0"
          >
            <Select
              :model-value="state.direction"
              @update:model-value="(val) => updateState({ direction: val as KeycastDirection })"
            >
              <SelectTrigger class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="opt in directionOptions"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            label="视觉主题"
            class="min-w-0"
          >
            <Select
              :model-value="state.theme"
              @update:model-value="(val) => updateState({ theme: val as KeycastTheme })"
            >
              <SelectTrigger class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="opt in themeOptions"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            label="高亮强调色"
            class="min-w-0"
          >
            <ColorPicker
              :model-value="state.accentColor"
              @update:model-value="(val) => updateState({ accentColor: val })"
            />
          </FormField>

          <FormField
            :label="state.displayMode === 'overlay' ? '画布缩放基准' : '键帽字号 (px)'"
            class="min-w-0"
          >
            <NumberField
              :model-value="state.fontSize"
              :min="11"
              :max="26"
              @update:model-value="(val) => updateState({ fontSize: Number(val ?? 15) })"
            />
          </FormField>

          <FormField
            label="字体"
            class="min-w-0"
          >
            <GoogleFontPicker
              :model-value="state.fontFamily || null"
              :extra-options="SYSTEM_CHINESE_FONT_OPTIONS"
              :show-preview="false"
              @update:model-value="updateState({ fontFamily: $event || '' })"
            />
          </FormField>

          <FormField
            label="整体不透明度"
            :extra="`${state.opacity ?? 100}%`"
            class="min-w-0"
          >
            <Slider
              :model-value="[state.opacity ?? 100]"
              :min="35"
              :max="100"
              :step="5"
              class="pt-2"
              @update:model-value="(vals) => vals && updateState({ opacity: vals[0] })"
            />
          </FormField>

          <template v-if="state.displayMode === 'overlay'">
            <FormField
              label="配色方案"
              class="min-w-0"
            >
              <Select
                :model-value="state.colorMode || 'solid'"
                @update:model-value="(val) => updateState({ colorMode: val as KeycastColorMode })"
              >
                <SelectTrigger class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="opt in colorModeOptions"
                    :key="opt.value"
                    :value="opt.value"
                  >
                    {{ opt.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            <FormField
              label="敲击特效样式"
              class="min-w-0"
            >
              <Select
                :model-value="resolvePressEffect(state)"
                @update:model-value="
                  (val) => {
                    const eff = val as KeycastPressEffect
                    updateState({ pressEffect: eff, enableRipple: eff !== 'none' })
                  }
                "
              >
                <SelectTrigger class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="opt in pressEffectOptions"
                    :key="opt.value"
                    :value="opt.value"
                  >
                    {{ opt.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            <FormField
              label="余晖拖尾时长"
              class="min-w-0"
            >
              <Select
                :model-value="String(resolveAfterglowMs(state))"
                @update:model-value="
                  (val) => {
                    const ms = Number(val ?? 340)
                    updateState({ afterglowMs: ms, enableAfterglow: ms > 0 })
                  }
                "
              >
                <SelectTrigger class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="opt in afterglowOptions"
                    :key="opt.value"
                    :value="opt.value"
                  >
                    {{ opt.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </template>

          <template v-else>
            <FormField
              label="最大同屏按键数"
              class="min-w-0"
            >
              <NumberField
                :model-value="state.maxKeys"
                :min="1"
                :max="12"
                @update:model-value="(val) => updateState({ maxKeys: Number(val ?? 6) })"
              />
            </FormField>

            <FormField
              label="淡出停留时长 (ms)"
              class="min-w-0"
            >
              <NumberField
                :model-value="state.fadeDelayMs"
                :min="400"
                :max="10000"
                :step="200"
                @update:model-value="(val) => updateState({ fadeDelayMs: Number(val ?? 2200) })"
              />
            </FormField>
          </template>
        </div>

        <!-- 可视化增强特性开关 -->
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
          <SettingRow
            title="显示实时 KPS / APM 状态条"
            variant="compact"
          >
            <Switch
              :checked="state.showApm"
              @update:checked="(val: boolean) => updateState({ showApm: val })"
            />
          </SettingRow>

          <template v-if="state.displayMode === 'overlay'">
            <SettingRow
              title="联动显示右侧鼠标与侧键"
              variant="compact"
            >
              <Switch
                :checked="state.showMouse"
                @update:checked="(val: boolean) => updateState({ showMouse: val })"
              />
            </SettingRow>

            <SettingRow
              title="鼠标掌托移动光轨"
              variant="compact"
            >
              <Switch
                :checked="state.enableMouseTrail"
                @update:checked="(val: boolean) => updateState({ enableMouseTrail: val })"
              />
            </SettingRow>

            <SettingRow
              title="高频按键热力染色"
              variant="compact"
            >
              <Switch
                :checked="state.enableHeatmap"
                @update:checked="(val: boolean) => updateState({ enableHeatmap: val })"
              />
            </SettingRow>

            <SettingRow
              title="键帽累计敲击次数角标"
              variant="compact"
            >
              <Switch
                :checked="state.showKeyCount"
                @update:checked="(val: boolean) => updateState({ showKeyCount: val })"
              />
            </SettingRow>
          </template>

          <SettingRow
            v-else
            title="合并显示组合修饰键 (Ctrl / Shift / Alt)"
            variant="compact"
          >
            <Switch
              :checked="state.showCombos"
              @update:checked="(val: boolean) => updateState({ showCombos: val })"
            />
          </SettingRow>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
