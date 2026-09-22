<script setup lang="ts">
import {
  ArrowClockwise24Regular,
  Copy24Regular,
  DocumentArrowDown20Regular,
  DocumentText24Regular,
  Mic24Regular,
  Search24Filled,
} from '@vicons/fluent'
import { saveAs } from 'file-saver'
import type { DataTableColumns } from 'naive-ui'
import {
  NButton,
  NCard,
  NDataTable,
  NDivider,
  NEmpty,
  NFlex,
  NIcon,
  NInput,
  NSelect,
  NSpin,
  NTag,
  NText,
  NTooltip,
  useMessage,
} from 'naive-ui'
import { computed, h, ref } from 'vue'

import { QueryGetAPI, unwrapOk } from '@/api/query'
import { LIVE_API_URL } from '@/shared/config'
import type { TranscriptSegment, TranscriptSegmentPage, TranscriptSession } from '@/shared/models/transcription'

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
    list = list.filter((s) => (s.text && s.text.toLowerCase().includes(kw)) || (s.speaker && s.speaker.toLowerCase().includes(kw)))
  }

  return list
})

function highlightText(text: string, kw: string) {
  if (!kw.trim()) return [text]
  const parts: any[] = []
  const lower = text.toLowerCase()
  const kwLower = kw.toLowerCase()
  let lastIndex = 0
  let idx = lower.indexOf(kwLower, lastIndex)

  while (idx !== -1) {
    if (idx > lastIndex) {
      parts.push(text.slice(lastIndex, idx))
    }
    parts.push(
      h(
        'mark',
        {
          style: 'background-color: rgba(245, 158, 11, 0.35); color: inherit; padding: 1px 2px; border-radius: 2px;',
        },
        text.slice(idx, idx + kw.length),
      ),
    )
    lastIndex = idx + kw.length
    idx = lower.indexOf(kwLower, lastIndex)
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }
  return parts
}

function copySegment(segment: TranscriptSegment) {
  const line = `[${formatClock(segment.startMs)}] ${segment.speaker ? `${segment.speaker}: ` : ''}${segment.text}`
  navigator.clipboard.writeText(line).then(() => {
    message.success('已复制单句字幕与时间戳')
  })
}

const columns: DataTableColumns<TranscriptSegment> = [
  {
    title: '时间轴',
    key: 'startMs',
    width: 130,
    render: (row) =>
      h(
        'span',
        {
          style: 'font-variant-numeric: tabular-nums; font-size: 12px; color: var(--vtsuru-fg-muted);',
        },
        formatClock(row.startMs),
      ),
  },
  {
    title: '说话人',
    key: 'speaker',
    width: 110,
    render: (row) =>
      row.speaker
        ? h(
            NTag,
            { size: 'small', bordered: false, style: 'font-size: 11px' },
            () => row.speaker,
          )
        : h('span', { style: 'color: var(--vtsuru-fg-muted); font-size: 11px;' }, '—'),
  },
  {
    title: '转写字幕内容',
    key: 'text',
    render: (row) => {
      const kw = searchKeyword.value.trim()
      const content = kw ? highlightText(row.text || '', kw) : row.text
      return h('div', { class: 'segment-content-cell' }, [
        h('span', { class: 'segment-text' }, content),
        h(
          NButton,
          {
            size: 'tiny',
            quaternary: true,
            class: 'copy-btn',
            title: '复制单句',
            onClick: () => copySegment(row),
          },
          {
            icon: () => h(NIcon, { component: Copy24Regular, size: 13 }),
          },
        ),
      ])
    },
  },
]

async function load() {
  if (loaded.value || loading.value) return
  loading.value = true
  error.value = undefined
  try {
    const response = await QueryGetAPI<TranscriptSession[]>(`${LIVE_API_URL}get-transcript-sessions`, {
      liveId: props.liveId,
    })
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
      const response = await QueryGetAPI<TranscriptSegmentPage>(`${LIVE_API_URL}get-transcript-segments`, {
        liveId: props.liveId,
        sessionId: id,
        page,
        pageSize: 1000,
      })
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
    <NSpin :show="loading">
      <div
        v-if="error"
        class="transcript-error-box"
      >
        <NEmpty :description="`转写获取失败: ${error}`">
          <template #extra>
            <NButton
              size="small"
              type="primary"
              secondary
              @click="load"
            >
              重试加载
            </NButton>
          </template>
        </NEmpty>
      </div>

      <div
        v-else-if="!sessions.length && loaded"
        class="transcript-empty-box"
      >
        <NEmpty description="该场直播未开启语音转写或未采集到音频会话">
          <template #icon>
            <NIcon :component="Mic24Regular" />
          </template>
        </NEmpty>
      </div>

      <div
        v-else
        class="transcript-main"
      >
        <!-- 转写工具卡片 -->
        <NCard
          size="small"
          class="transcript-toolbar-card"
          :bordered="true"
        >
          <NFlex
            vertical
            :size="12"
          >
            <!-- 第一行：会话选择与导出操作 -->
            <NFlex
              justify="space-between"
              align="center"
              wrap
              :size="12"
            >
              <NFlex
                align="center"
                :size="10"
                style="flex: 1; min-width: 280px; max-width: 540px"
              >
                <span class="control-label">转写会话:</span>
                <NSelect
                  v-model:value="selectedSessionId"
                  :options="sessionOptions"
                  size="small"
                  @update:value="loadSegments"
                />
              </NFlex>

              <NFlex
                align="center"
                :size="8"
              >
                <NButton
                  size="small"
                  secondary
                  :disabled="!segments.length"
                  @click="downloadTxt"
                >
                  <template #icon>
                    <NIcon :component="DocumentText24Regular" />
                  </template>
                  导出 TXT
                </NButton>
                <NButton
                  size="small"
                  type="primary"
                  secondary
                  :disabled="!segments.length"
                  @click="downloadSrt"
                >
                  <template #icon>
                    <NIcon :component="DocumentArrowDown20Regular" />
                  </template>
                  导出 SRT 字幕
                </NButton>
              </NFlex>
            </NFlex>

            <!-- 第二行：会话元信息与实时搜索/说话人过滤 -->
            <NFlex
              justify="space-between"
              align="center"
              wrap
              :size="10"
            >
              <NFlex
                align="center"
                :size="8"
              >
                <NInput
                  v-model:value="searchKeyword"
                  placeholder="搜索字幕关键词..."
                  clearable
                  size="small"
                  class="transcript-search-input"
                >
                  <template #prefix>
                    <NIcon :component="Search24Filled" />
                  </template>
                </NInput>

                <NSelect
                  v-if="speakerOptions.length > 2"
                  v-model:value="selectedSpeaker"
                  :options="speakerOptions"
                  size="small"
                  style="width: 140px"
                />
              </NFlex>

              <NFlex
                v-if="selectedSession"
                align="center"
                :size="8"
              >
                <NTag
                  size="small"
                  :bordered="false"
                  type="info"
                >
                  {{ providerName(selectedSession.provider) }}
                </NTag>
                <NText depth="3" class="meta-desc">
                  模型: {{ selectedSession.model }} · 语言: {{ selectedSession.language }}
                </NText>
              </NFlex>
            </NFlex>
          </NFlex>

          <div class="transcript-statusbar">
            <span>
              已加载 <strong>{{ segments.length.toLocaleString() }}</strong> 条分段
              <template v-if="searchKeyword || selectedSpeaker !== 'all'">
                （匹配到 <strong>{{ filteredSegments.length.toLocaleString() }}</strong> 条）
              </template>
            </span>
            <span class="tip-hint">支持点击单句末尾图标快捷复制时间戳与字幕</span>
          </div>
        </NCard>

        <!-- 数据表格 -->
        <NCard
          size="small"
          class="table-card"
          :bordered="true"
        >
          <NDataTable
            v-if="filteredSegments.length"
            :columns="columns"
            :data="filteredSegments"
            :row-key="(row) => row.sequence"
            :max-height="580"
            size="small"
            :bordered="false"
          />
          <div
            v-else
            class="empty-filter-box"
          >
            <NEmpty description="未找到匹配的转写分段" />
          </div>
        </NCard>
      </div>
    </NSpin>
  </div>
</template>

<style scoped>
.live-transcript-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.transcript-main {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.transcript-toolbar-card {
  border-radius: var(--vtsuru-radius);
  background-color: var(--vtsuru-card);
}

.control-label {
  font-size: 12px;
  color: var(--vtsuru-fg-muted);
  white-space: nowrap;
}

.transcript-search-input {
  width: 240px;
}

.meta-desc {
  font-size: 12px;
}

.transcript-statusbar {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--vtsuru-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--vtsuru-fg-muted);
  font-variant-numeric: tabular-nums;
}

.transcript-statusbar strong {
  color: var(--vtsuru-fg);
}

.tip-hint {
  font-size: 11px;
  color: var(--vtsuru-fg-muted);
}

.table-card {
  border-radius: var(--vtsuru-radius);
  background-color: var(--vtsuru-card);
  overflow: hidden;
}

:deep(.segment-content-cell) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-right: 8px;
}

:deep(.segment-text) {
  line-height: 1.5;
  color: var(--vtsuru-fg);
}

:deep(.copy-btn) {
  opacity: 0;
  transition: opacity 0.15s ease;
  flex-shrink: 0;
}

:deep(tr:hover .copy-btn) {
  opacity: 1;
}

.transcript-error-box,
.transcript-empty-box,
.empty-filter-box {
  padding: 48px 0;
  display: flex;
  justify-content: center;
}
</style>
