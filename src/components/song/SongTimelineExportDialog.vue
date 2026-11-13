<script setup lang="ts">
import Copy24Regular from '@vicons/fluent/es/Copy24Regular'
import { format } from 'date-fns'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { getApiLiveGetAll } from '@/api/generated/live/live'
import type { ResponseLiveInfoModel } from '@/api/generated/model'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SettingRow } from '@/shared/ui/setting-row'
import { Textarea } from '@/shared/ui/textarea'
import { copyToClipboard } from '@/shared/utils'
import type { SongTimelineEntry } from '@/shared/utils/songTimeline'
import { buildSongTimelineLines, buildSongTimelineText } from '@/shared/utils/songTimeline'

const props = defineProps<{
  open: boolean
  entries: SongTimelineEntry[]
  title?: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const lives = ref<ResponseLiveInfoModel[]>([])
const loadingLives = ref(false)
const selectedLiveId = ref<string>('custom')
const customStartAtStr = ref('')
const offsetAdjustSec = ref(0)
const includeRequester = ref(true)
const includeArtist = ref(false)
const wrapBrackets = ref(true)

const selectedLive = computed(() => lives.value.find((item) => item.liveId === selectedLiveId.value))

const liveStartAtMs = computed(() => {
  if (selectedLive.value) return selectedLive.value.startAt
  const parsed = Date.parse(customStartAtStr.value)
  if (Number.isFinite(parsed)) return parsed
  const earliest = props.entries.reduce((min, item) => Math.min(min, item.timeMs), Infinity)
  return Number.isFinite(earliest) ? earliest : Date.now()
})

const liveStopAtMs = computed(() => {
  if (selectedLive.value?.stopAt && selectedLive.value.stopAt > selectedLive.value.startAt) {
    return selectedLive.value.stopAt
  }
  return null
})

const timelineLines = computed(() =>
  buildSongTimelineLines(props.entries, liveStartAtMs.value, {
    liveStopAtMs: liveStopAtMs.value,
    offsetAdjustSec: offsetAdjustSec.value,
    includeRequester: includeRequester.value,
    includeArtist: includeArtist.value,
    wrapBrackets: wrapBrackets.value,
  }),
)

const timelineText = computed(() =>
  buildSongTimelineText(props.entries, liveStartAtMs.value, {
    liveStopAtMs: liveStopAtMs.value,
    offsetAdjustSec: offsetAdjustSec.value,
    includeRequester: includeRequester.value,
    includeArtist: includeArtist.value,
    wrapBrackets: wrapBrackets.value,
  }),
)

async function fetchLiveSessions() {
  loadingLives.value = true
  try {
    const res = await getApiLiveGetAll()
    if (res.code === 200 && res.data) {
      lives.value = [...res.data].sort((a, b) => b.startAt - a.startAt).slice(0, 30)
      if (lives.value.length > 0 && selectedLiveId.value === 'custom') {
        const ongoing = lives.value.find((item) => !item.isFinish)
        selectedLiveId.value = ongoing?.liveId ?? lives.value[0].liveId
      }
    }
  } catch {
    // 游客/离线模式下退回自定义时间即可
  } finally {
    loadingLives.value = false
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    if (!customStartAtStr.value) {
      const earliest = props.entries.reduce((min, item) => Math.min(min, item.timeMs), Infinity)
      const fallback = Number.isFinite(earliest) ? earliest : Date.now()
      customStartAtStr.value = format(new Date(fallback), "yyyy-MM-dd'T'HH:mm:ss")
    }
    if (lives.value.length === 0) {
      void fetchLiveSessions()
    }
  },
)

function formatLiveOption(item: ResponseLiveInfoModel) {
  const time = format(new Date(item.startAt), 'MM-dd HH:mm')
  const state = item.isFinish ? '' : ' [直播中]'
  return `${time}${state} · ${item.title || '无标题'}`
}

async function copyResult() {
  if (!timelineText.value) {
    toast.warning('当前时间段内没有可导出的歌曲记录')
    return
  }
  await copyToClipboard(timelineText.value)
  toast.success(`已复制 ${timelineLines.value.length} 首曲目时间轴`)
}
</script>

<template>
  <Dialog
    :open="open"
    @update:open="(v) => emit('update:open', v)"
  >
    <DialogContent class="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>{{ title || '导出歌回曲目时间轴' }}</DialogTitle>
        <DialogDescription>
          按直播场次开播时间自动换算 MM:SS 相对偏移，可直接粘贴至 B 站录播评论区生成章节跳转。
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-3">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="基准直播场次">
            <Select v-model="selectedLiveId">
              <SelectTrigger>
                <SelectValue :placeholder="loadingLives ? '加载场次中...' : '选择直播场次'" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">自定义起始时间</SelectItem>
                <SelectItem
                  v-for="item in lives"
                  :key="item.liveId"
                  :value="item.liveId"
                >
                  {{ formatLiveOption(item) }}
                </SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            v-if="selectedLiveId === 'custom'"
            label="开播基准时间"
          >
            <Input
              v-model="customStartAtStr"
              type="datetime-local"
              step="1"
            />
          </FormField>

          <FormField
            v-else
            label="时间微调 (秒)"
            hint="正数向后推迟，负数向前提前"
          >
            <NumberField
              v-model="offsetAdjustSec"
              :step="1"
            />
          </FormField>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <SettingRow
            type="switch"
            variant="compact"
            title="书名号《》"
            v-model="wrapBrackets"
          />
          <SettingRow
            type="switch"
            variant="compact"
            title="附带点歌人"
            v-model="includeRequester"
          />
          <SettingRow
            type="switch"
            variant="compact"
            title="附带歌手"
            v-model="includeArtist"
          />
        </div>

        <FormField :label="`预览结果（共 ${timelineLines.length} 首）`">
          <Textarea
            :model-value="timelineText"
            readonly
            :rows="10"
            placeholder="所选时间范围内暂无演唱曲目记录"
            class="font-mono text-xs"
          />
        </FormField>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          @click="emit('update:open', false)"
        >
          关闭
        </Button>
        <Button
          :disabled="timelineLines.length === 0"
          class="gap-1.5"
          @click="copyResult"
        >
          <Copy24Regular class="size-4" />
          一键复制时间轴
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
