<script setup lang="ts">
import {
  Copy24Regular,
  DocumentArrowDown20Regular,
  DocumentText24Regular,
  Mic24Regular,
  Search24Filled,
} from '@vicons/fluent'
import { saveAs } from 'file-saver'
import { computed, ref } from 'vue'

import { getApiLiveGetTranscriptSegments, getApiLiveGetTranscriptSessions } from '@/api/generated/live/live'
import { unwrapOk } from '@/api/query'
import type { TranscriptSegment, TranscriptSegmentPage, TranscriptSession } from '@/shared/models/transcription'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Spin } from '@/shared/ui/spin'
import { Tag } from '@/shared/ui/tag'
import { useMessage } from '@/shared/utils'

const props = defineProps<{
  liveId: string
}>()

const message = useMessage()
const loading = ref(false)
const loaded = ref(false)
const error = ref<string>()
const sessions = ref<TranscriptSession[]>([])
const segments = ref<TranscriptSegment[]>([])
const selectedSessionId = ref<string>()

// 搜索与说话人过滤
const searchKeyword = ref('')
const selectedSpeaker = ref<string>('all')

const sessionOptions = computed(() =>
  sessions.value.map((session) => ({
    label: `${formatDateTime(session.startedAt)} · ${providerName(session.provider)} (${session.model})`,
    value: session.id,
  })),
)

const selectedSession = computed(() => sessions.value.find((session) => session.id === selectedSessionId.value))

// 说话人列表选项
const speakerOptions = computed(() => {
  const set = new Set<string>()
  for (const s of segments.value) {
    if (s.speaker && s.speaker.trim()) {
      set.add(s.speaker.trim())
    }
  }
  const opts = [{ label: '全部说话人', value: 'all' }]
  for (const spk of Array.from(set)) {
    opts.push({ label: spk, value: spk })
  }
  return opts
})

// 过滤后的分段
const filteredSegments = computed(() => {
  let list = segments.value

  if (selectedSpeaker.value !== 'all') {
    list = list.filter((s) => s.speaker === selectedSpeaker.value)
  }

  const kw = searchKeyword.value.trim().toLowerCase()
  if (kw) {
    list = list.filter(
      (s) => (s.text && s.text.toLowerCase().includes(kw)) || (s.speaker && s.speaker.toLowerCase().includes(kw)),
    )
  }

  return list
})

function copySegment(segment: TranscriptSegment) {
  const line = `[${formatClock(segment.startMs)}] ${segment.speaker ? `${segment.speaker}: ` : ''}${segment.text}`
  navigator.clipboard.writeText(line).then(() => {
    message.success('已复制单句字幕与时间戳')
  })
}

async function load() {
  if (loaded.value || loading.value) return
  loading.value = true
  error.value = undefined
  try {
    const response = (await getApiLiveGetTranscriptSessions({
      liveId: props.liveId,
    })) as unknown as {
      code: number
      message?: string
      data: TranscriptSession[]
    }
    sessions.value = unwrapOk(response, '无法获取直播转写会话').toReversed()
    selectedSessionId.value = sessions.value[0]?.id
    if (selectedSessionId.value) await loadSegments(selectedSessionId.value)
    loaded.value = true
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : String(loadError)
  } finally {
    loading.value = false
  }
}

async function loadSegments(id: string) {
  loading.value = true
  try {
    const result: TranscriptSegment[] = []
    let page = 1
    let more = true
    while (more) {
      const response = (await getApiLiveGetTranscriptSegments({
        liveId: props.liveId,
        sessionId: id,
        page,
        pageSize: 1000,
      })) as unknown as {
        code: number
        message?: string
        data: TranscriptSegmentPage
      }
      const data = unwrapOk(response, '无法获取转写字幕')
      result.push(...data.segments)
      more = data.more
      page++
    }
    segments.value = result
  } finally {
    loading.value = false
  }
}

function providerName(provider: TranscriptSession['provider']) {
  return provider === 'tencent' ? '腾讯云' : 'OpenAI'
}

function formatDateTime(startedAtMs: number) {
  return new Date(startedAtMs).toLocaleString()
}

function formatClock(milliseconds: number, srt = false) {
  const totalSeconds = Math.floor(milliseconds / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const ms = milliseconds % 1000
  const separator = srt ? ',' : '.'
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}${separator}${String(ms).padStart(3, '0')}`
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function saveText(content: string, extension: 'txt' | 'srt') {
  const session = selectedSession.value
  if (!session) return
  const filename = `live-${props.liveId}-${new Date(session.startedAt).toISOString().replaceAll(':', '-')}.${extension}`
  saveAs(new Blob([`\uFEFF${content}`], { type: 'text/plain;charset=utf-8' }), filename)
  message.success(`已成功导出 .${extension} 文件`)
}

function downloadTxt() {
  const session = selectedSession.value
  if (!session) return
  const source = filteredSegments.value.length ? filteredSegments.value : segments.value
  const header = [
    `Provider: ${providerName(session.provider)}`,
    `Model: ${session.model}`,
    `Language: ${session.language}`,
    `Exported: ${new Date().toLocaleString()}`,
    '',
  ]
  const lines = source.map(
    (segment) => `[${formatClock(segment.startMs)}] ${segment.speaker ? `${segment.speaker}: ` : ''}${segment.text}`,
  )
  saveText([...header, ...lines].join('\r\n'), 'txt')
}

function downloadSrt() {
  const session = selectedSession.value
  if (!session) return
  const source = filteredSegments.value.length ? filteredSegments.value : segments.value
  const content = source
    .map((segment, index) =>
      [
        index + 1,
        `${formatClock(segment.startMs, true)} --> ${formatClock(segment.endMs, true)}`,
        `${segment.speaker ? `${segment.speaker}: ` : ''}${segment.text}`,
        '',
      ].join('\r\n'),
    )
    .join('\r\n')
  saveText(content, 'srt')
}

defineExpose({ load })
</script>

<template>
  <div class="live-transcript-panel">
    <div
      v-if="loading"
      class="py-12 flex justify-center"
    >
      <Spin />
    </div>

    <div
      v-else-if="error"
      class="py-12 flex flex-col items-center justify-center gap-3"
    >
      <Empty :description="`转写获取失败: ${error}`" />
      <Button
        variant="outline"
        @click="load"
      >
        重试加载
      </Button>
    </div>

    <div
      v-else-if="!sessions.length && loaded"
      class="py-12 flex flex-col items-center justify-center gap-2"
    >
      <component
        :is="Mic24Regular"
        class="size-10 text-muted-foreground"
      />
      <Empty description="该场直播未开启语音转写或未采集到音频会话" />
    </div>

    <div
      v-else
      class="transcript-main flex flex-col gap-3"
    >
      <!-- 转写工具卡片 -->
      <Card class="p-3.5">
        <div class="flex flex-col gap-3">
          <!-- 第一行：会话选择与导出操作 -->
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-2 flex-1 min-w-[280px] max-w-[540px]">
              <span class="text-xs text-muted-foreground whitespace-nowrap">转写会话:</span>
              <div class="flex-1">
                <Select
                  :model-value="selectedSessionId ?? ''"
                  @update:model-value="
                    (val) => {
                      selectedSessionId = String(val)
                      val && loadSegments(String(val))
                    }
                  "
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="opt in sessionOptions"
                      :key="opt.value"
                      :value="opt.value"
                    >
                      {{ opt.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <Button
                variant="outline"
                :disabled="!segments.length"
                @click="downloadTxt"
              >
                <component
                  :is="DocumentText24Regular"
                  class="size-3.5 mr-1"
                />
                导出 TXT
              </Button>
              <Button
                :disabled="!segments.length"
                @click="downloadSrt"
              >
                <component
                  :is="DocumentArrowDown20Regular"
                  class="size-3.5 mr-1"
                />
                导出 SRT 字幕
              </Button>
            </div>
          </div>

          <!-- 第二行：会话元信息与实时搜索/说话人过滤 -->
          <div class="flex flex-wrap items-center justify-between gap-2.5">
            <div class="flex items-center gap-2">
              <div class="relative w-60">
                <component
                  :is="Search24Filled"
                  class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground"
                />
                <Input
                  v-model="searchKeyword"
                  placeholder="搜索字幕关键词..."
                  class="pl-8"
                />
              </div>

              <div
                v-if="speakerOptions.length > 2"
                class="w-32"
              >
                <Select v-model="selectedSpeaker">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="opt in speakerOptions"
                      :key="opt.value"
                      :value="opt.value"
                    >
                      {{ opt.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div
              v-if="selectedSession"
              class="flex items-center gap-2 text-xs"
            >
              <Tag
                variant="outline"
                class="text-[11px] h-5 px-1.5"
              >
                {{ providerName(selectedSession.provider) }}
              </Tag>
              <span class="text-muted-foreground">
                模型: {{ selectedSession.model }} · 语言: {{ selectedSession.language }}
              </span>
            </div>
          </div>
        </div>

        <div
          class="mt-2.5 pt-2 border-t border-border flex justify-between items-center text-xs text-muted-foreground font-mono"
        >
          <span>
            已加载 <strong class="text-foreground">{{ segments.length.toLocaleString() }}</strong> 条分段
            <template v-if="searchKeyword || selectedSpeaker !== 'all'">
              （匹配到 <strong class="text-foreground">{{ filteredSegments.length.toLocaleString() }}</strong> 条）
            </template>
          </span>
          <span class="text-[11px] text-muted-foreground">支持点击单句末尾图标快捷复制时间戳与字幕</span>
        </div>
      </Card>

      <!-- 数据表格 -->
      <Card class="p-0 overflow-hidden">
        <div
          v-if="filteredSegments.length"
          class="max-h-[580px] overflow-y-auto"
        >
          <table class="w-full text-xs text-left border-collapse">
            <thead class="bg-muted text-muted-foreground uppercase text-[11px] sticky top-0 z-10">
              <tr>
                <th class="p-2.5 w-32 font-medium">时间轴</th>
                <th class="p-2.5 w-28 font-medium">说话人</th>
                <th class="p-2.5 font-medium">转写字幕内容</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border">
              <tr
                v-for="row in filteredSegments"
                :key="row.sequence"
                class="hover:bg-muted/50 transition-colors"
              >
                <td class="p-2.5 font-mono text-muted-foreground whitespace-nowrap">
                  {{ formatClock(row.startMs) }}
                </td>
                <td class="p-2.5 whitespace-nowrap">
                  <Tag
                    v-if="row.speaker"
                    variant="secondary"
                    class="text-[10px] h-4.5 px-1"
                  >
                    {{ row.speaker }}
                  </Tag>
                  <span
                    v-else
                    class="text-muted-foreground"
                    >—</span
                  >
                </td>
                <td class="p-2.5">
                  <div class="flex items-center justify-between gap-2">
                    <span class="leading-relaxed">{{ row.text }}</span>
                    <button
                      type="button"
                      class="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
                      title="复制单句"
                      @click="copySegment(row)"
                    >
                      <component
                        :is="Copy24Regular"
                        class="size-3.5"
                      />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div
          v-else
          class="py-12 flex justify-center"
        >
          <Empty description="未找到匹配的转写分段" />
        </div>
      </Card>
    </div>
  </div>
</template>

<style scoped>
.live-transcript-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}
</style>
