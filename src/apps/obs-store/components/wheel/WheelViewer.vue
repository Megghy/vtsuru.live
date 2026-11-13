<script setup lang="ts">
import Add24Regular from '@vicons/fluent/es/Add24Regular'
import ArrowClockwise24Regular from '@vicons/fluent/es/ArrowClockwise24Regular'
import Checkmark24Regular from '@vicons/fluent/es/Checkmark24Regular'
import Copy24Regular from '@vicons/fluent/es/Copy24Regular'
import Open24Regular from '@vicons/fluent/es/Open24Regular'
import Play24Regular from '@vicons/fluent/es/Play24Regular'
import Subtract24Regular from '@vicons/fluent/es/Subtract24Regular'
import { useClipboard } from '@vueuse/core'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import { OBS_SYNC_CHANNEL_HINT, parseObsSyncChannel, resolveObsSyncChannel, useObsBridge } from '@/apps/obs-store/sync'
import { buildObsSourceUrl } from '@/shared/obs/obsUrl'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { ColorPicker } from '@/shared/ui/color-picker'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { Switch } from '@/shared/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'

import { DEFAULT_WHEEL_STATE, WHEEL_PRESETS } from './types'
import type { WheelAction, WheelSegment, WheelSpinRecord, WheelState, WheelTheme } from './types'
import WheelDisplay from './WheelDisplay.vue'
import { computeSpinTargetAngle, pickWeightedIndex } from './wheelPhysics'

const SEGMENT_PALETTE = ['#f43f5e', '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#06b6d4', '#ec4899', '#6366f1']

const { copy, isSupported: isCopySupported } = useClipboard()
const route = useRoute()
const account = useAccount()

const channelId = ref(resolveObsSyncChannel(route.query.channel))
const channelDraft = ref(channelId.value)
const copied = ref(false)
const previewBg = ref<'checker' | 'dark' | 'transparent'>('checker')
const isSpinningLock = ref(false)
const spinHistory = ref<WheelSpinRecord[]>([])

const { state, updateState, sendAction, currentHash, isSyncing, lastSyncError, hasPendingChanges, retry } =
  useObsBridge<WheelState, WheelAction>({
    componentId: 'wheel',
    channelId,
    defaultState: DEFAULT_WHEEL_STATE,
    role: 'controller',
  })

const themeOptions: { label: string; value: WheelTheme }[] = [
  { label: '经典高亮 (Classic)', value: 'classic' },
  { label: '赛博霓虹 (Neon)', value: 'neon' },
  { label: '柔和糖果 (Pastel)', value: 'pastel' },
]

const obsAbsoluteUrl = computed(() =>
  buildObsSourceUrl({
    path: '/obs-store/wheel',
    host: window.location.origin,
    credential: 'public-id',
    userId: account.value.id,
    params: { channel: channelId.value },
  }),
)

function triggerSpin() {
  if (isSpinningLock.value) return
  if (state.value.segments.length === 0) {
    toast.warning('请至少保留一个转盘选项')
    return
  }

  const targetIndex = pickWeightedIndex(state.value.segments)
  const currentAngle = state.value.lastSpin?.targetAngleDeg ?? 0
  const targetAngleDeg = computeSpinTargetAngle(
    currentAngle,
    state.value.segments,
    targetIndex,
    state.value.proportionalAngles,
    6,
    0.2 + Math.random() * 0.6,
  )

  const spin: WheelSpinRecord = {
    spinId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    targetIndex,
    winnerLabel: state.value.segments[targetIndex]?.label ?? '',
    targetAngleDeg,
    durationMs: Math.max(1500, state.value.durationMs || 4500),
    startedAt: Date.now(),
  }

  isSpinningLock.value = true
  updateState({ lastSpin: spin })
  sendAction({ type: 'SPIN', spin })
  spinHistory.value.unshift(spin)
  if (spinHistory.value.length > 20) spinHistory.value.pop()

  setTimeout(() => {
    isSpinningLock.value = false
  }, spin.durationMs + 150)
}

function resetRotation() {
  isSpinningLock.value = false
  updateState({ lastSpin: null })
  sendAction({ type: 'RESET_ROTATION' })
}

function addSegment() {
  const nextIndex = state.value.segments.length
  const next: WheelSegment = {
    id: `${Date.now()}-${nextIndex}`,
    label: `选项 ${nextIndex + 1}`,
    color: SEGMENT_PALETTE[nextIndex % SEGMENT_PALETTE.length],
    weight: 1,
  }
  updateState({ segments: [...state.value.segments, next] })
}

function removeSegment(id: string) {
  if (state.value.segments.length <= 2) {
    toast.warning('转盘至少保留 2 个选项')
    return
  }
  updateState({ segments: state.value.segments.filter((s) => s.id !== id) })
}

function patchSegment(id: string, patch: Partial<WheelSegment>) {
  updateState({
    segments: state.value.segments.map((s) => (s.id === id ? { ...s, ...patch } : s)),
  })
}

function applyPreset(key: string) {
  const preset = WHEEL_PRESETS[key]
  if (!preset) return
  updateState({
    title: preset.title,
    segments: structuredClone(preset.segments),
  })
  toast.success(`已应用预设：${preset.name}`)
}

async function copyObsUrl() {
  if (!isCopySupported.value) {
    toast.warning('当前环境不支持剪贴板，请手动复制')
    return
  }
  await copy(obsAbsoluteUrl.value)
  copied.value = true
  toast.success('OBS 浏览器源链接已复制')
  setTimeout(() => {
    copied.value = false
  }, 2000)
}

function openPopoutWindow() {
  const url = `/manage/obs-store?component=wheel&channel=${encodeURIComponent(channelId.value)}`
  window.open(url, 'VtsuruWheelPopout', 'width=520,height=720,menubar=no,toolbar=no,location=no,status=no')
}

function changeChannel() {
  const next = parseObsSyncChannel(channelDraft.value)
  if (!next) {
    toast.error(OBS_SYNC_CHANNEL_HINT)
    return
  }
  channelId.value = next
  channelDraft.value = next
}
</script>

<template>
  <div class="space-y-4">
    <Card class="p-4">
      <CardContent class="p-0 space-y-3">
        <!-- 头部控制栏 -->
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div class="flex items-center gap-2">
              <span class="font-semibold text-sm">直播大转盘</span>
              <Badge
                variant="secondary"
                size="xs"
              >
                v1.0
              </Badge>
            </div>
            <div class="text-xs text-muted-foreground mt-0.5">
              <span v-if="lastSyncError">同步失败，请重试</span>
              <span v-else-if="isSyncing">正在同步状态...</span>
              <span v-else-if="hasPendingChanges">有修改尚未保存</span>
              <span v-else-if="currentHash">已同步 (Hash: {{ currentHash.slice(0, 8) }})</span>
              <span v-else>就绪</span>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-1.5">
            <Input
              v-model="channelDraft"
              class="w-[120px]"
              placeholder="频道"
              maxlength="64"
              @keyup.enter="changeChannel"
            />
            <Button
              variant="secondary"
              @click="changeChannel"
            >
              切换频道
            </Button>
            <Button
              v-if="lastSyncError"
              variant="secondary"
              :disabled="isSyncing"
              @click="retry"
            >
              重试
            </Button>
            <Button
              variant="secondary"
              class="gap-1.5"
              @click="openPopoutWindow"
            >
              <Open24Regular class="size-4" />
              独立小窗
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

        <Separator />

        <!-- 主控制台 + 预览 -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div class="space-y-3">
            <div class="rounded-lg border bg-muted/30 p-3.5 space-y-3">
              <div class="flex-between">
                <span class="text-xs font-medium text-muted-foreground">开奖控制</span>
                <div class="flex items-center gap-1.5">
                  <Button
                    v-for="(preset, key) in WHEEL_PRESETS"
                    :key="key"
                    size="xs"
                    variant="outline"
                    @click="applyPreset(String(key))"
                  >
                    {{ preset.name }}
                  </Button>
                </div>
              </div>

              <div class="flex items-center gap-2">
                <Button
                  variant="brand"
                  size="lg"
                  class="flex-1 gap-1.5 font-semibold"
                  :disabled="isSpinningLock"
                  @click="triggerSpin"
                >
                  <Play24Regular class="size-4.5" />
                  {{ isSpinningLock ? '转盘转动中...' : '立即抽取（同步 OBS）' }}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  @click="resetRotation"
                >
                  <ArrowClockwise24Regular class="size-4" />
                </Button>
              </div>

              <div
                v-if="spinHistory.length > 0"
                class="rounded-md border bg-background p-2.5 space-y-1 text-xs"
              >
                <div class="text-muted-foreground font-medium">最近抽中记录</div>
                <div class="flex flex-wrap gap-1.5">
                  <Badge
                    v-for="item in spinHistory.slice(0, 6)"
                    :key="item.spinId"
                    variant="secondary"
                  >
                    {{ item.winnerLabel }}
                  </Badge>
                </div>
              </div>
            </div>

            <!-- 选项列表编辑 -->
            <div class="rounded-lg border bg-muted/30 p-3.5 space-y-2.5">
              <div class="flex-between">
                <span class="text-xs font-medium text-muted-foreground">
                  转盘选项与权重 ({{ state.segments.length }})
                </span>
                <Button
                  size="xs"
                  variant="secondary"
                  class="gap-1"
                  @click="addSegment"
                >
                  <Add24Regular class="size-3.5" />
                  新增选项
                </Button>
              </div>

              <div class="max-h-[260px] overflow-y-auto scrollbar-thin space-y-1.5 pr-1">
                <div
                  v-for="seg in state.segments"
                  :key="seg.id"
                  class="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 text-xs"
                >
                  <ColorPicker
                    :model-value="seg.color"
                    class="shrink-0"
                    @update:model-value="(val) => patchSegment(seg.id, { color: val })"
                  />
                  <Input
                    :model-value="seg.label"
                    class="flex-1 min-w-0"
                    placeholder="奖项名称"
                    @update:model-value="(val) => patchSegment(seg.id, { label: String(val) })"
                  />
                  <span class="text-muted-foreground shrink-0">权重</span>
                  <NumberField
                    :model-value="seg.weight"
                    :min="1"
                    :max="100"
                    class="w-20 shrink-0"
                    @update:model-value="(val) => patchSegment(seg.id, { weight: val ?? 1 })"
                  />
                  <Button
                    size="xs"
                    variant="ghost"
                    class="shrink-0"
                    @click="removeSegment(seg.id)"
                  >
                    <Subtract24Regular class="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <!-- 右侧预览舞台 -->
          <div class="rounded-lg border bg-muted/30 p-3.5 flex flex-col">
            <div class="flex-between mb-2">
              <span class="text-xs font-medium text-muted-foreground">OBS 画面实时预览</span>
              <ToggleGroup
                type="single"
                size="xs"
                :model-value="previewBg"
                @update:model-value="(v) => v && (previewBg = v as any)"
              >
                <ToggleGroupItem value="checker">网格底</ToggleGroupItem>
                <ToggleGroupItem value="dark">暗黑底</ToggleGroupItem>
                <ToggleGroupItem value="transparent">透明底</ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div
              class="flex-1 min-h-[360px] rounded-md border flex-center overflow-hidden p-3"
              :class="{
                'bg-zinc-900': previewBg === 'dark',
                'bg-transparent': previewBg === 'transparent',
                'checker-bg': previewBg === 'checker',
              }"
            >
              <WheelDisplay
                :channel-id="channelId"
                inline-mode
              />
            </div>
          </div>
        </div>

        <Separator />

        <!-- 外观与行为配置 -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div class="space-y-1.5">
            <span class="text-muted-foreground">转盘标题</span>
            <Input
              :model-value="state.title"
              @update:model-value="(v) => updateState({ title: String(v) })"
            />
          </div>

          <div class="space-y-1.5">
            <span class="text-muted-foreground">视觉风格</span>
            <Select
              :model-value="state.theme"
              @update:model-value="(v) => updateState({ theme: v as WheelTheme })"
            >
              <SelectTrigger>
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
          </div>

          <div class="space-y-1.5">
            <span class="text-muted-foreground">指针颜色</span>
            <ColorPicker
              :model-value="state.pointerColor"
              @update:model-value="(v) => updateState({ pointerColor: v })"
            />
          </div>

          <div class="space-y-1.5">
            <span class="text-muted-foreground">转动时长 (毫秒)</span>
            <NumberField
              :model-value="state.durationMs"
              :min="1500"
              :max="12000"
              :step="500"
              @update:model-value="(v) => updateState({ durationMs: v ?? 4500 })"
            />
          </div>

          <div class="space-y-1.5">
            <span class="text-muted-foreground">转盘直径 (px)</span>
            <NumberField
              :model-value="state.sizePx"
              :min="240"
              :max="640"
              :step="20"
              @update:model-value="(v) => updateState({ sizePx: v ?? 420 })"
            />
          </div>

          <div class="flex flex-col justify-end gap-2 pb-1">
            <label class="flex-between cursor-pointer">
              <span>按权重比例绘制扇区大小</span>
              <Switch
                :model-value="state.proportionalAngles"
                @update:model-value="(v: boolean) => updateState({ proportionalAngles: v })"
              />
            </label>
            <label class="flex-between cursor-pointer">
              <span>开启拨片哒哒声与中奖音效</span>
              <Switch
                :model-value="state.soundEnabled"
                @update:model-value="(v: boolean) => updateState({ soundEnabled: v })"
              />
            </label>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<style scoped>
.checker-bg {
  background-color: #202026;
  background-image:
    linear-gradient(45deg, #2b2b33 25%, transparent 25%),
    linear-gradient(-45deg, #2b2b33 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #2b2b33 75%),
    linear-gradient(-45deg, transparent 75%, #2b2b33 75%);
  background-size: 16px 16px;
  background-position:
    0 0,
    0 8px,
    8px -8px,
    -8px 0;
}
</style>
