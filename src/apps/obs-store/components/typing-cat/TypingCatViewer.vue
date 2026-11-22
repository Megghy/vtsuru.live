<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import {
  Cat,
  Check,
  Copy,
  Download,
  Gift,
  Hand,
  Heart,
  Keyboard,
  MessageSquare,
  Moon,
  Palette,
  PawPrint,
  Radio,
  RotateCcw,
  RotateCw,
  Shield,
  SlidersHorizontal,
  Smile,
  Sparkles,
  Sun,
  Upload,
  Zap,
} from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import type { EventModel } from '@/api/client-types'
import { EventDataTypes } from '@/api/generated/model'
import ObsChannelSwitcher from '@/apps/obs-store/components/store/ObsChannelSwitcher.vue'
import { OBS_SYNC_CHANNEL_HINT, parseObsSyncChannel, resolveObsSyncChannel, useObsBridge } from '@/apps/obs-store/sync'
import { buildObsSourceUrl } from '@/shared/obs/obsUrl'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { FormField } from '@/shared/ui/form-field'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { SettingRow } from '@/shared/ui/setting-row'
import { Slider } from '@/shared/ui/slider'
import { Switch } from '@/shared/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { useDanmakuClient } from '@/store/useDanmakuClient'

import TypingCatAppearanceTab from './TypingCatAppearanceTab.vue'
import TypingCatDisplay from './TypingCatDisplay.vue'
import {
  createTypingCatConfigExport,
  DEFAULT_TYPING_CAT_LIVE_REACTIONS,
  DEFAULT_TYPING_CAT_SHAPE,
  DEFAULT_TYPING_CAT_STATE,
  getCoatDefaultColors,
  normalizeHexColor,
  parseTypingCatConfigImport,
  TYPING_CAT_COATS,
  TYPING_CAT_COLOR_SPECS,
  TYPING_CAT_SHAPE_SPECS,
} from './types'
import type {
  TypingCatAction,
  TypingCatAutoMode,
  TypingCatIdleActivity,
  TypingCatLiveReactions,
  TypingCatShapeParams,
  TypingCatState,
  TypingCatTurboSensitivity,
} from './types'

const { copy, isSupported: isCopySupported } = useClipboard()
const route = useRoute()
const account = useAccount()
const danmakuClient = useDanmakuClient()

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
const activeTab = ref<'appearance' | 'behavior' | 'shape'>('appearance')
const previewBg = ref<'checker' | 'dark' | 'transparent'>('checker')
const previewDisplayRef = ref<InstanceType<typeof TypingCatDisplay> | null>(null)
const importFileInputRef = ref<HTMLInputElement | null>(null)

const { state, updateState, sendAction, currentHash, isSyncing, lastSyncError, hasPendingChanges, retry } =
  useObsBridge<TypingCatState, TypingCatAction>({
    componentId: 'typing-cat',
    channelId,
    defaultState: DEFAULT_TYPING_CAT_STATE,
    role: 'controller',
  })

function emitAction(action: TypingCatAction) {
  previewDisplayRef.value?.applyAction(action)
  sendAction(action)
}

const autoTypingOptions: { label: string; value: TypingCatAutoMode }[] = [
  { label: '关闭（仅响应真实输入）', value: 'off' },
  { label: '悠闲敲字', value: 'chill' },
  { label: '正常打字', value: 'normal' },
  { label: '高速狂敲', value: 'fast' },
]

const idleActivityOptions: { label: string; value: TypingCatIdleActivity }[] = [
  { label: '关闭（安静待机）', value: 'off' },
  { label: '安静（偶尔小动作）', value: 'quiet' },
  { label: '标准（自然节奏）', value: 'normal' },
  { label: '活泼（频繁互动）', value: 'lively' },
]

const turboSensitivityOptions: { label: string; value: TypingCatTurboSensitivity }[] = [
  { label: '轻松触发（轻快打字即眯眼甩尾）', value: 'easy' },
  { label: '标准（推荐）', value: 'normal' },
  { label: '极速（高连击手速才触发）', value: 'hard' },
]

const sampleKeys: { label: string; code: string }[] = [
  { label: 'M', code: 'KeyM' },
  { label: 'E', code: 'KeyE' },
  { label: 'O', code: 'KeyO' },
  { label: 'W', code: 'KeyW' },
  { label: 'Space', code: 'Space' },
  { label: 'Enter', code: 'Enter' },
]

const currentCoatPreset = computed(
  () => TYPING_CAT_COATS.find((c) => c.id === state.value.coat) ?? TYPING_CAT_COATS[0],
)

const visibleColorSpecs = computed(() =>
  TYPING_CAT_COLOR_SPECS.filter((spec) => !spec.patternOnly || spec.patternOnly === currentCoatPreset.value.pattern),
)

const defaultCoatColors = computed(() => getCoatDefaultColors(state.value.coat))

const modifiedColorCount = computed(() => {
  const custom = state.value.colors ?? {}
  return visibleColorSpecs.value.filter((spec) => {
    const hex = normalizeHexColor(custom[spec.key])
    return Boolean(hex && hex !== defaultCoatColors.value[spec.key].toLowerCase())
  }).length
})

const liveReactions = computed<TypingCatLiveReactions>(() => ({
  ...DEFAULT_TYPING_CAT_LIVE_REACTIONS,
  ...state.value.liveReactions,
}))

function updateLiveReactions(patch: Partial<TypingCatLiveReactions>) {
  void updateState({
    liveReactions: {
      ...liveReactions.value,
      ...patch,
    },
  })
}

const seenLiveEventIds = new Set<string>()
let recentDanmakuTimes: number[] = []
let lastDanmakuReactAt = 0

function triggerLiveReaction(kind: 'danmaku' | 'gift' | 'guard', priceYuan = 0) {
  const now = Date.now()
  if (kind === 'danmaku') {
    if (now - lastDanmakuReactAt < 500) return
    lastDanmakuReactAt = now
    recentDanmakuTimes = recentDanmakuTimes.filter((ts) => now - ts < 3200)
    recentDanmakuTimes.push(now)
    if (recentDanmakuTimes.length >= 3) {
      emitAction({ type: 'BURST' })
    } else {
      const code = sampleKeys[Math.floor(Math.random() * sampleKeys.length)].code
      emitAction({ type: 'KEY_TAP', code })
    }
    return
  }
  if (kind === 'gift') {
    emitAction({ type: 'PET' })
    if (priceYuan >= 10) emitAction({ type: 'SPIN' })
    return
  }
  emitAction({ type: 'SPIN' })
  emitAction({ type: 'POUNCE' })
}

function handleIncomingLiveEvent(event: EventModel) {
  const cfg = liveReactions.value
  if (!cfg.enabled) return
  if (
    event.type !== EventDataTypes.Message &&
    event.type !== EventDataTypes.Gift &&
    event.type !== EventDataTypes.Guard &&
    event.type !== EventDataTypes.SC
  ) {
    return
  }
  const key = event.eventId || `${event.type}:${event.uid}:${event.time}:${event.price}`
  if (seenLiveEventIds.has(key)) return
  seenLiveEventIds.add(key)
  if (seenLiveEventIds.size > 500) {
    const first = seenLiveEventIds.values().next().value
    if (first) seenLiveEventIds.delete(first)
  }

  if (event.type === EventDataTypes.Message && cfg.onDanmaku) {
    triggerLiveReaction('danmaku')
  } else if (event.type === EventDataTypes.Gift && cfg.onGift) {
    triggerLiveReaction('gift', event.price ?? 0)
  } else if ((event.type === EventDataTypes.Guard || event.type === EventDataTypes.SC) && cfg.onGuardOrSc) {
    triggerLiveReaction('guard', event.price ?? 0)
  }
}

watch(
  () => liveReactions.value.enabled,
  async (enabled, prev) => {
    if (enabled) {
      danmakuClient.onEvent('all', handleIncomingLiveEvent)
      try {
        await danmakuClient.ensureOpenlive()
        if (prev === false) toast.success('已开启小猫直播间事件联动')
      } catch {
        if (prev === false) toast.warning('直播事件监听已挂起（请先在弹幕姬或中控台连接直播间）')
      }
    } else {
      danmakuClient.offEvent('all', handleIncomingLiveEvent)
    }
  },
  { immediate: true },
)

const modifiedShapeCount = computed(() => {
  const shape = state.value.shape ?? {}
  return TYPING_CAT_SHAPE_SPECS.filter((spec) => {
    const val = shape[spec.key]
    return typeof val === 'number' && Math.abs(val - spec.defaultValue) > 0.001
  }).length
})

const obsAbsoluteUrl = computed(() =>
  buildObsSourceUrl({
    path: '/obs-store/typing-cat',
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

async function copyObsUrl() {
  if (!isCopySupported.value) {
    toast.warning('当前环境不支持直接写入剪贴板，请手动复制')
    return
  }
  try {
    await copy(obsAbsoluteUrl.value)
    copied.value = true
    toast.success('OBS 浏览器源链接已复制到剪贴板')
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    toast.error('复制失败，请手动复制')
  }
}

function exportConfigFile() {
  const payload = createTypingCatConfigExport(state.value)
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const dateTag = new Date().toISOString().slice(0, 10).replaceAll('-', '')
  const link = document.createElement('a')
  link.href = url
  link.download = `typing-cat-${state.value.coat}-${dateTag}.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
  toast.success('已导出小猫打字配置文件')
}

function triggerImportConfig() {
  importFileInputRef.value?.click()
}

async function handleImportFile(event: Event) {
  const input = event.target as HTMLInputElement | null
  const file = input?.files?.[0]
  if (!file) return
  try {
    const raw = await file.text()
    const imported = parseTypingCatConfigImport(raw)
    await updateState(imported)
    toast.success('已导入小猫打字配置文件')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '配置文件导入失败')
  } finally {
    if (input) input.value = ''
  }
}

function getShapeValue(key: keyof TypingCatShapeParams): number {
  const val = state.value.shape?.[key]
  return typeof val === 'number' && Number.isFinite(val) ? val : DEFAULT_TYPING_CAT_SHAPE[key]
}

function updateShapeParam(key: keyof TypingCatShapeParams, val: number) {
  const nextShape = { ...state.value.shape }
  if (Math.abs(val - DEFAULT_TYPING_CAT_SHAPE[key]) < 0.001) {
    delete nextShape[key]
  } else {
    nextShape[key] = Number(val.toFixed(2))
  }
  void updateState({ shape: nextShape })
}

function resetShape() {
  void updateState({ shape: {} })
  toast.success('已恢复默认猫咪体型')
}

function triggerMouseTap(button: string) {
  emitAction({ type: 'MOUSE_DOWN', button })
  setTimeout(() => {
    emitAction({ type: 'MOUSE_UP', button })
  }, 150)
}

// 预览区键盘与鼠标实时捕获
const activePreviewCodes = new Set<string>()
const activePreviewButtons = new Set<string>()

function isEditableTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return Boolean(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable))
}

function mapMouseButton(button: number): string {
  if (button === 0) return 'left'
  if (button === 1) return 'middle'
  if (button === 2) return 'right'
  return `btn${button}`
}

function onWindowKeydown(event: KeyboardEvent) {
  if (!captureFocused.value || event.repeat || isEditableTarget(event.target)) return
  if (event.metaKey || event.ctrlKey) return
  if (!event.code) return
  activePreviewCodes.add(event.code)
  emitAction({ type: 'KEY_DOWN', code: event.code })
}

function onWindowKeyup(event: KeyboardEvent) {
  if (!event.code || !activePreviewCodes.delete(event.code)) return
  emitAction({ type: 'KEY_UP', code: event.code })
}

function onMonitorMousemove(event: MouseEvent) {
  if (!captureFocused.value) return
  if (event.movementX !== 0 || event.movementY !== 0) {
    emitAction({ type: 'MOUSE_MOVE', dx: event.movementX, dy: event.movementY })
  }
}

function onMonitorMousedown(event: MouseEvent) {
  if (!captureFocused.value) return
  const target = event.target as HTMLElement | null
  if (target?.closest('button, input, a')) return
  const btn = mapMouseButton(event.button)
  activePreviewButtons.add(btn)
  emitAction({ type: 'MOUSE_DOWN', button: btn })
}

function onWindowMouseup(event: MouseEvent) {
  const btn = mapMouseButton(event.button)
  if (!activePreviewButtons.delete(btn)) return
  emitAction({ type: 'MOUSE_UP', button: btn })
}

function releaseAllCaptured() {
  for (const code of activePreviewCodes) emitAction({ type: 'KEY_UP', code })
  for (const btn of activePreviewButtons) emitAction({ type: 'MOUSE_UP', button: btn })
  activePreviewCodes.clear()
  activePreviewButtons.clear()
}

onMounted(() => {
  window.addEventListener('keydown', onWindowKeydown)
  window.addEventListener('keyup', onWindowKeyup)
  window.addEventListener('mouseup', onWindowMouseup)
  window.addEventListener('blur', releaseAllCaptured)
})

onBeforeUnmount(() => {
  danmakuClient.offEvent('all', handleIncomingLiveEvent)
  releaseAllCaptured()
  window.removeEventListener('keydown', onWindowKeydown)
  window.removeEventListener('keyup', onWindowKeyup)
  window.removeEventListener('mouseup', onWindowMouseup)
  window.removeEventListener('blur', releaseAllCaptured)
})
</script>

<template>
  <div class="typing-cat-viewer">
    <Card class="p-4">
      <CardContent class="p-0 space-y-4">
        <!-- 头部栏 -->
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-base font-bold text-foreground">小猫打字 (Typing Cat)</span>
              <Badge
                variant="secondary"
                size="xs"
              >
                Three.js 3D
              </Badge>
            </div>
            <div class="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span
                class="size-2 rounded-full"
                :class="lastSyncError ? 'bg-destructive' : isSyncing ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'"
              />
              <span v-if="lastSyncError">同步失败，请重试</span>
              <span v-else-if="isSyncing">正在同步配置...</span>
              <span v-else-if="hasPendingChanges">有修改尚未保存</span>
              <span v-else-if="currentHash">已同步 (Hash: {{ currentHash.slice(0, 8) }})</span>
              <span v-else>就绪</span>
            </div>
          </div>

          <ObsChannelSwitcher
            v-model="channelDraft"
            @submit="changeChannel"
          />

          <div class="flex flex-wrap items-center gap-2">
            <input
              ref="importFileInputRef"
              type="file"
              accept=".json,application/json"
              class="hidden"
              @change="handleImportFile"
            >
            <Button
              variant="outline"
              class="gap-1.5"
              @click="triggerImportConfig"
            >
              <Upload class="size-3.5" />
              导入配置
            </Button>
            <Button
              variant="outline"
              class="gap-1.5"
              @click="exportConfigFile"
            >
              <Download class="size-3.5" />
              导出配置
            </Button>
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
              <Check
                v-if="copied"
                class="size-3.5"
              />
              <Copy
                v-else
                class="size-3.5"
              />
              复制 OBS 源链接
            </Button>
          </div>
        </div>

        <Separator />

        <!-- 主体分栏：左侧吸顶实时预览 + 快捷测试，右侧分组配置 -->
        <div class="grid grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)] xl:grid-cols-[430px_minmax(0,1fr)] gap-4 items-start">
          <!-- 左侧：吸顶实时预览与互动动作 -->
          <div class="lg:sticky lg:top-4 self-start space-y-3 min-w-0">
            <div class="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Cat class="size-3.5 text-brand" />
                  OBS 透明画布预览
                </span>
                <ToggleGroup
                  type="single"
                  size="xs"
                  :model-value="previewBg"
                  @update:model-value="(val) => val && (previewBg = val as 'checker' | 'dark' | 'transparent')"
                >
                  <ToggleGroupItem value="checker">网格底</ToggleGroupItem>
                  <ToggleGroupItem value="dark">暗黑底</ToggleGroupItem>
                  <ToggleGroupItem value="transparent">透明底</ToggleGroupItem>
                </ToggleGroup>
              </div>

              <div
                class="h-[310px] rounded-md border border-border flex-center overflow-hidden relative"
                :class="{
                  'bg-zinc-900': previewBg === 'dark',
                  'bg-transparent': previewBg === 'transparent',
                  'bg-[linear-gradient(45deg,rgba(128,128,128,0.12)_25%,transparent_25%,transparent_75%,rgba(128,128,128,0.12)_75%),linear-gradient(45deg,rgba(128,128,128,0.12)_25%,transparent_25%,transparent_75%,rgba(128,128,128,0.12)_75%)] bg-[length:16px_16px] bg-[position:0_0,8px_8px]':
                    previewBg === 'checker',
                }"
                @mousemove="onMonitorMousemove"
                @mousedown="onMonitorMousedown"
                @contextmenu.prevent
              >
                <div class="w-full max-w-[400px] h-full">
                  <TypingCatDisplay
                    ref="previewDisplayRef"
                    :channel-id="channelId"
                    :inline-mode="true"
                    :interactive="true"
                    :preview-state="state"
                  />
                </div>
              </div>

              <div class="flex flex-wrap items-center justify-between gap-1.5 text-[11px] text-muted-foreground">
                <span>
                  推荐分辨率：<b class="text-foreground tabular-nums">420 × 360 px</b>
                </span>
                <span>敲键盘拍键，按住小猫头部可抚摸</span>
              </div>
            </div>

            <!-- 快捷测试与动作控制 -->
            <div class="rounded-lg border border-border bg-muted/20 p-3 space-y-2.5">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Keyboard class="size-3.5 text-brand" />
                  测试动作
                </span>
                <label class="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none">
                  <Switch v-model:checked="captureFocused" />
                  <span>捕获页面键鼠</span>
                </label>
              </div>

              <div class="flex flex-wrap items-center gap-1.5">
                <Button
                  variant="secondary"
                  size="xs"
                  class="gap-1"
                  @click="emitAction({ type: 'BURST' })"
                >
                  <Zap class="size-3.5" />
                  高速连敲
                </Button>
                <Button
                  variant="secondary"
                  size="xs"
                  class="gap-1"
                  @click="emitAction({ type: 'PET' })"
                >
                  <Hand class="size-3.5" />
                  摸头
                </Button>
                <Button
                  variant="secondary"
                  size="xs"
                  class="gap-1"
                  @click="emitAction({ type: 'STRETCH' })"
                >
                  <Sparkles class="size-3.5" />
                  伸懒腰
                </Button>
                <Button
                  variant="secondary"
                  size="xs"
                  class="gap-1"
                  @click="emitAction({ type: 'YAWN' })"
                >
                  <Smile class="size-3.5" />
                  打哈欠
                </Button>
                <Button
                  variant="secondary"
                  size="xs"
                  class="gap-1"
                  @click="emitAction({ type: 'LICK' })"
                >
                  <Heart class="size-3.5" />
                  舔爪
                </Button>
                <Button
                  variant="secondary"
                  size="xs"
                  class="gap-1"
                  @click="emitAction({ type: 'POUNCE' })"
                >
                  <PawPrint class="size-3.5" />
                  扑击
                </Button>
                <Button
                  variant="secondary"
                  size="xs"
                  class="gap-1"
                  @click="emitAction({ type: 'LOAF' })"
                >
                  <Cat class="size-3.5" />
                  猫面包
                </Button>
                <Button
                  variant="secondary"
                  size="xs"
                  class="gap-1"
                  @click="emitAction({ type: 'SPIN' })"
                >
                  <RotateCw class="size-3.5" />
                  转圈
                </Button>
                <Button
                  variant="secondary"
                  size="xs"
                  class="gap-1"
                  @click="emitAction({ type: 'SLEEP' })"
                >
                  <Moon class="size-3.5" />
                  打盹
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  class="gap-1 text-muted-foreground"
                  @click="emitAction({ type: 'WAKE' })"
                >
                  <Sun class="size-3.5" />
                  唤醒
                </Button>
              </div>

              <div class="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/60">
                <Button
                  v-for="sample in sampleKeys"
                  :key="sample.code"
                  variant="outline"
                  size="xs"
                  class="font-mono"
                  @click="emitAction({ type: 'KEY_TAP', code: sample.code })"
                >
                  {{ sample.label }}
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  @click="triggerMouseTap('left')"
                >
                  点鼠标
                </Button>
              </div>
            </div>
          </div>

          <!-- 右侧：分标签页配置区（与左侧实时预览并排） -->
          <div class="min-w-0">
            <Tabs
              v-model="activeTab"
              class="w-full"
            >
              <TabsList class="w-full grid grid-cols-3 mb-3">
                <TabsTrigger
                  value="appearance"
                  class="gap-1.5"
                >
                  <Palette class="size-3.5" />
                  <span>外观配色</span>
                  <Badge
                    v-if="modifiedColorCount > 0"
                    variant="secondary"
                    size="xs"
                  >
                    {{ modifiedColorCount }}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger
                  value="behavior"
                  class="gap-1.5"
                >
                  <SlidersHorizontal class="size-3.5" />
                  <span>显示与互动</span>
                </TabsTrigger>
                <TabsTrigger
                  value="shape"
                  class="gap-1.5"
                >
                  <Cat class="size-3.5" />
                  <span>体型微调</span>
                  <Badge
                    v-if="modifiedShapeCount > 0"
                    variant="secondary"
                    size="xs"
                  >
                    {{ modifiedShapeCount }}
                  </Badge>
                </TabsTrigger>
              </TabsList>

              <!-- Tab 1: 外观配色（花色预设 + 3D 配饰 + 键鼠主题 + 身体部位自定义配色） -->
              <TabsContent
                value="appearance"
                class="mt-0"
              >
                <TypingCatAppearanceTab
                  :state="state"
                  @update="(patch) => updateState(patch)"
                />
              </TabsContent>

              <!-- Tab 2: 显示与互动配置 -->
              <TabsContent
                value="behavior"
                class="mt-0 space-y-4"
              >
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField
                    label="自主打字模式"
                    class="min-w-0"
                  >
                    <Select
                      :model-value="state.autoTyping"
                      @update:model-value="(val) => updateState({ autoTyping: val as TypingCatAutoMode })"
                    >
                      <SelectTrigger class="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          v-for="opt in autoTypingOptions"
                          :key="opt.value"
                          :value="opt.value"
                        >
                          {{ opt.label }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>

                  <FormField
                    label="待机小动作频率"
                    class="min-w-0"
                  >
                    <Select
                      :model-value="state.idleActivity ?? 'normal'"
                      @update:model-value="(val) => updateState({ idleActivity: val as TypingCatIdleActivity })"
                    >
                      <SelectTrigger class="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          v-for="opt in idleActivityOptions"
                          :key="opt.value"
                          :value="opt.value"
                        >
                          {{ opt.label }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>

                  <FormField
                    label="狂暴甩尾触发灵敏度"
                    class="min-w-0"
                  >
                    <Select
                      :model-value="state.turboSensitivity ?? 'normal'"
                      :disabled="!state.turboTailTyping"
                      @update:model-value="(val) => updateState({ turboSensitivity: val as TypingCatTurboSensitivity })"
                    >
                      <SelectTrigger class="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          v-for="opt in turboSensitivityOptions"
                          :key="opt.value"
                          :value="opt.value"
                        >
                          {{ opt.label }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>

                  <FormField
                    label="自动打盹时间 (分钟)"
                    description="设为 0 表示永不自动入睡"
                    class="min-w-0"
                  >
                    <NumberField
                      :model-value="state.sleepMinutes"
                      :min="0"
                      :max="60"
                      @update:model-value="(val) => updateState({ sleepMinutes: Math.max(0, Number(val ?? 5)) })"
                    />
                  </FormField>

                  <FormField
                    label="镜头水平视角"
                    class="min-w-0 sm:col-span-2"
                  >
                    <template #extra>
                      <div class="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground tabular-nums">
                        <span>{{ (state.cameraYaw ?? 0) > 0 ? `+${state.cameraYaw}°` : `${state.cameraYaw ?? 0}°` }}</span>
                        <button
                          v-if="(state.cameraYaw ?? 0) !== 0"
                          type="button"
                          class="inline-flex items-center gap-0.5 hover:text-foreground transition-colors cursor-pointer"
                          @click="updateState({ cameraYaw: 0 })"
                        >
                          <RotateCcw class="size-3" />
                          正中
                        </button>
                      </div>
                    </template>
                    <Slider
                      :model-value="[state.cameraYaw ?? 0]"
                      :min="-30"
                      :max="30"
                      :step="2"
                      class="pt-2"
                      @update:model-value="(vals) => vals && updateState({ cameraYaw: vals[0] })"
                    />
                  </FormField>

                  <FormField
                    label="画面缩放"
                    :extra="`${state.scale ?? 100}%`"
                    class="min-w-0"
                  >
                    <Slider
                      :model-value="[state.scale ?? 100]"
                      :min="60"
                      :max="140"
                      :step="5"
                      class="pt-2"
                      @update:model-value="(vals) => vals && updateState({ scale: vals[0] })"
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
                </div>

                <div class="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
                  <SettingRow
                    variant="card"
                    title="显示键盘"
                    description="展示小猫面前的 5 行机械键盘与按键高亮"
                  >
                    <Switch
                      :checked="state.showKeyboard"
                      @update:checked="(val) => updateState({ showKeyboard: val })"
                    />
                  </SettingRow>

                  <SettingRow
                    variant="card"
                    title="显示鼠标"
                    description="在键盘旁展示联动鼠标，移动或点击时自动伸爪"
                  >
                    <Switch
                      :checked="state.showMouse"
                      @update:checked="(val) => updateState({ showMouse: val })"
                    />
                  </SettingRow>

                  <SettingRow
                    variant="card"
                    title="左手鼠标布局"
                    description="交换键盘与鼠标左右位置，适配左手握鼠习惯"
                  >
                    <Switch
                      :checked="state.leftMouse"
                      @update:checked="(val) => updateState({ leftMouse: val })"
                    />
                  </SettingRow>

                  <SettingRow
                    variant="card"
                    title="隐私盲打模式"
                    description="仅区分左右手随机拍键，不点亮具体键帽也不弹出键名"
                  >
                    <Switch
                      :checked="!state.followKeys"
                      @update:checked="(val) => updateState({ followKeys: !val })"
                    />
                  </SettingRow>

                  <SettingRow
                    variant="card"
                    title="显示按键浮标"
                    description="敲击键帽时在按键上方短暂弹出对应字符标签"
                  >
                    <Switch
                      :checked="state.showKeyChips"
                      :disabled="!state.followKeys"
                      @update:checked="(val) => updateState({ showKeyChips: val })"
                    />
                  </SettingRow>

                  <SettingRow
                    variant="card"
                    title="实时手速与敲击计数"
                    description="在画布左下角显示轻量 KPM 手速与累计敲击数徽章"
                  >
                    <Switch
                      :checked="state.showSpeedBadge"
                      @update:checked="(val) => updateState({ showSpeedBadge: val })"
                    />
                  </SettingRow>

                  <SettingRow
                    variant="card"
                    title="贴纸轮廓描边"
                    description="为小猫添加一圈浅色外描边，在深色直播画面中更清晰"
                  >
                    <Switch
                      :checked="state.showOutline"
                      @update:checked="(val) => updateState({ showOutline: val })"
                    />
                  </SettingRow>

                  <SettingRow
                    variant="card"
                    title="水平镜像翻转"
                    description="左右翻转小猫朝向，方便摆放在直播画面任意一侧"
                  >
                    <Switch
                      :checked="state.mirror"
                      @update:checked="(val) => updateState({ mirror: val })"
                    />
                  </SettingRow>

                  <SettingRow
                    variant="card"
                    title="允许摸头互动"
                    description="在预览或 OBS 交互模式下按住小猫头部可触发眯眼脸红"
                  >
                    <Switch
                      :checked="state.allowPetting"
                      @update:checked="(val) => updateState({ allowPetting: val })"
                    />
                  </SettingRow>

                  <SettingRow
                    variant="card"
                    title="闲置猫面包揣手"
                    description="无操作 15 秒后先缩成猫面包揣手待机，满时间后再打盹"
                  >
                    <Switch
                      :checked="state.loafOnIdle ?? true"
                      @update:checked="(val) => updateState({ loafOnIdle: val })"
                    />
                  </SettingRow>

                  <SettingRow
                    variant="card"
                    title="高速打字尾巴助阵"
                    description="打字速度较快时进入狂暴模式：眯起眼睛、压低耳朵并挥尾巴加入拍打键盘"
                  >
                    <Switch
                      :checked="state.turboTailTyping"
                      @update:checked="(val) => updateState({ turboTailTyping: val })"
                    />
                  </SettingRow>
                </div>

                <!-- 直播间事件联动 -->
                <div class="rounded-lg border border-border bg-card p-3.5 space-y-3">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <div class="space-y-0.5">
                      <div class="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Radio class="size-3.5 text-brand" />
                        <span>直播间事件联动</span>
                      </div>
                      <p class="text-[11px] text-muted-foreground">
                        连接直播间后，收到弹幕/礼物/舰长/SC 自动让小猫做出对应互动反应并同步到 OBS
                      </p>
                    </div>
                    <Switch
                      :checked="liveReactions.enabled"
                      @update:checked="(val) => updateLiveReactions({ enabled: val })"
                    />
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <SettingRow
                      variant="card"
                      title="弹幕跟敲"
                      description="弹幕刷屏触发敲键/连敲"
                    >
                      <Switch
                        :checked="liveReactions.onDanmaku"
                        :disabled="!liveReactions.enabled"
                        @update:checked="(val) => updateLiveReactions({ onDanmaku: val })"
                      />
                    </SettingRow>
                    <SettingRow
                      variant="card"
                      title="礼物开心"
                      description="收到礼物摸头脸红/转圈"
                    >
                      <Switch
                        :checked="liveReactions.onGift"
                        :disabled="!liveReactions.enabled"
                        @update:checked="(val) => updateLiveReactions({ onGift: val })"
                      />
                    </SettingRow>
                    <SettingRow
                      variant="card"
                      title="上舰 / SC 庆祝"
                      description="触发转圈与扑击庆祝"
                    >
                      <Switch
                        :checked="liveReactions.onGuardOrSc"
                        :disabled="!liveReactions.enabled"
                        @update:checked="(val) => updateLiveReactions({ onGuardOrSc: val })"
                      />
                    </SettingRow>
                  </div>

                  <div class="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/60">
                    <span class="text-[11px] text-muted-foreground mr-1">快捷模拟联动：</span>
                    <Button
                      variant="outline"
                      size="xs"
                      class="gap-1"
                      @click="triggerLiveReaction('danmaku')"
                    >
                      <MessageSquare class="size-3.5" />
                      模拟弹幕
                    </Button>
                    <Button
                      variant="outline"
                      size="xs"
                      class="gap-1"
                      @click="triggerLiveReaction('gift', 15)"
                    >
                      <Gift class="size-3.5" />
                      模拟礼物
                    </Button>
                    <Button
                      variant="outline"
                      size="xs"
                      class="gap-1"
                      @click="triggerLiveReaction('guard', 198)"
                    >
                      <Shield class="size-3.5" />
                      模拟上舰 / SC
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <!-- Tab 3: 体型比例微调 -->
              <TabsContent
                value="shape"
                class="mt-0"
              >
                <div class="rounded-lg border border-border bg-card p-3.5 space-y-3">
                  <div class="flex-between gap-2">
                    <span class="text-[11px] text-muted-foreground">
                      实时微调头部、耳朵、眼睛、身材与尾巴比例，改动直接呈现在左侧预览中
                    </span>
                    <Button
                      variant="outline"
                      size="xs"
                      class="gap-1 shrink-0"
                      :disabled="modifiedShapeCount === 0"
                      @click="resetShape"
                    >
                      <RotateCcw class="size-3.5" />
                      恢复默认体型
                    </Button>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    <FormField
                      v-for="spec in TYPING_CAT_SHAPE_SPECS"
                      :key="spec.key"
                      :label="spec.label"
                      :extra="getShapeValue(spec.key).toFixed(2)"
                      class="min-w-0"
                    >
                      <Slider
                        :model-value="[getShapeValue(spec.key)]"
                        :min="spec.min"
                        :max="spec.max"
                        :step="0.01"
                        class="pt-1.5"
                        @update:model-value="(vals) => vals && updateShapeParam(spec.key, vals[0])"
                      />
                    </FormField>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
