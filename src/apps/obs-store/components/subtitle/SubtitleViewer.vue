<script setup lang="ts">
import Checkmark24Regular from '@vicons/fluent/es/Checkmark24Regular'
import Copy24Regular from '@vicons/fluent/es/Copy24Regular'
import Delete24Regular from '@vicons/fluent/es/Delete24Regular'
import Open24Regular from '@vicons/fluent/es/Open24Regular'
import Send24Regular from '@vicons/fluent/es/Send24Regular'
import { useClipboard } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
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
import { Switch } from '@/shared/ui/switch'

import SubtitleDisplay from './SubtitleDisplay.vue'
import { DEFAULT_SUBTITLE_STATE } from './types'
import type { SubtitleAction, SubtitleAlign, SubtitleState } from './types'

const { copy, isSupported: isCopySupported } = useClipboard()
const route = useRoute()
const account = useAccount()

const channelId = ref(resolveObsSyncChannel(route.query.channel))
const channelDraft = ref(channelId.value)
const copied = ref(false)
const testSentence = ref('')

const { state, updateState, currentHash, isSyncing, lastSyncError, hasPendingChanges } = useObsBridge<
  SubtitleState,
  SubtitleAction
>({
  componentId: 'subtitle',
  channelId,
  defaultState: DEFAULT_SUBTITLE_STATE,
  role: 'controller',
})

const alignOptions: { label: string; value: SubtitleAlign }[] = [
  { label: '左对齐', value: 'left' },
  { label: '居中', value: 'center' },
  { label: '右对齐', value: 'right' },
]

const obsUrl = computed(() => {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return buildObsSourceUrl({
    path: '/obs-store/subtitle',
    host: origin,
    credential: 'public-id',
    userId: account.value.id,
    params: channelId.value !== 'default' ? { channel: channelId.value } : undefined,
  })
})

watch(
  () => route.query.channel,
  (val) => {
    const resolved = resolveObsSyncChannel(val)
    channelId.value = resolved
    channelDraft.value = resolved
  },
)

function applyChannel() {
  const parsed = parseObsSyncChannel(channelDraft.value)
  if (!parsed) {
    toast.error(OBS_SYNC_CHANNEL_HINT)
    return
  }
  channelId.value = parsed
}

async function copyObsUrl() {
  if (!isCopySupported.value) {
    toast.error('当前浏览器不支持自动复制，请手动复制地址')
    return
  }
  await copy(obsUrl.value)
  copied.value = true
  toast.success('已复制 OBS 字幕源链接')
  setTimeout(() => (copied.value = false), 2000)
}

function sendTestLine() {
  const text = testSentence.value.trim() || '这是一条实时语音转写 OBS 字幕测试文本'
  const nextLines = [...state.value.lines, { text, ts: Date.now() }].slice(-6)
  updateState({
    lines: nextLines,
    partialText: '',
    updatedAt: Date.now(),
  })
  testSentence.value = ''
}

function clearSubtitles() {
  updateState({
    lines: [],
    partialText: '',
    updatedAt: Date.now(),
  })
}
</script>

<template>
  <div class="space-y-4">
    <Card>
      <CardContent class="p-4 space-y-4">
        <div class="flex-between gap-3 flex-wrap">
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold">OBS 实时字幕条</span>
            <Badge variant="outline" :class="lastSyncError ? 'text-destructive border-destructive/40' : 'text-emerald-600 border-emerald-500/40'">
              {{ isSyncing ? '同步中…' : lastSyncError ? '同步异常' : hasPendingChanges ? '待保存' : currentHash ? '已实时连接' : '就绪' }}
            </Badge>
          </div>
          <div class="flex items-center gap-2">
            <Input
              v-model="channelDraft"
              placeholder="实例名 (default)"
              class="w-36"
              @keyup.enter="applyChannel"
            />
            <Button variant="outline" @click="applyChannel">切换实例</Button>
            <Button variant="outline" @click="copyObsUrl">
              <component :is="copied ? Checkmark24Regular : Copy24Regular" class="size-3.5 mr-1" />
              {{ copied ? '已复制' : '复制 OBS 链接' }}
            </Button>
            <Button
              as="a"
              :href="obsUrl"
              target="_blank"
              variant="outline"
            >
              <component :is="Open24Regular" class="size-3.5 mr-1" />
              新窗口预览
            </Button>
          </div>
        </div>

        <div class="rounded-lg border border-border bg-zinc-900/90 overflow-hidden">
          <SubtitleDisplay :channel-id="channelId" inline-mode />
        </div>

        <div class="flex items-center gap-2">
          <Input
            v-model="testSentence"
            placeholder="输入测试字幕文本，直接发送至 OBS 字幕源…"
            class="flex-1"
            @keyup.enter="sendTestLine"
          />
          <Button variant="brand" @click="sendTestLine">
            <component :is="Send24Regular" class="size-3.5 mr-1" />
            发送测试
          </Button>
          <Button variant="outline" @click="clearSubtitles">
            <component :is="Delete24Regular" class="size-3.5 mr-1" />
            清屏
          </Button>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardContent class="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
        <div class="space-y-1.5">
          <span class="text-muted-foreground block">对齐方向</span>
          <Select
            :model-value="state.align"
            @update:model-value="(v) => updateState({ align: v as SubtitleAlign })"
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="opt in alignOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="space-y-1.5">
          <span class="text-muted-foreground block">同时显示行数 (1-5)</span>
          <NumberField
            :model-value="state.maxLines"
            :min="1"
            :max="5"
            @update:model-value="(v) => updateState({ maxLines: Number(v) || 2 })"
          />
        </div>

        <div class="space-y-1.5">
          <span class="text-muted-foreground block">自动淡出隐藏秒数 (0 为常驻)</span>
          <NumberField
            :model-value="state.fadeSeconds"
            :min="0"
            :max="120"
            @update:model-value="(v) => updateState({ fadeSeconds: Math.max(0, Number(v) || 0) })"
          />
        </div>

        <div class="space-y-1.5">
          <span class="text-muted-foreground block">字体大小 (px)</span>
          <NumberField
            :model-value="state.fontSize"
            :min="14"
            :max="72"
            @update:model-value="(v) => updateState({ fontSize: Math.max(14, Number(v) || 32) })"
          />
        </div>

        <div class="space-y-1.5">
          <span class="text-muted-foreground block">文字颜色</span>
          <ColorPicker
            :value="state.textColor"
            :show-alpha="false"
            @update:value="(v) => updateState({ textColor: String(v || '#ffffff') })"
          />
        </div>

        <div class="space-y-1.5">
          <span class="text-muted-foreground block">显示识别中临时句子</span>
          <div class="flex items-center gap-2 pt-1">
            <Switch
              :checked="state.showPartial"
              @update:checked="(v) => updateState({ showPartial: Boolean(v) })"
            />
            <span>{{ state.showPartial ? '开启（更低延迟）' : '仅输出定稿句' }}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
