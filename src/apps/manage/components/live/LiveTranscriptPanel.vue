<script setup lang="ts">
import { saveAs } from 'file-saver'
import type { DataTableColumns } from 'naive-ui'
import { NButton, NDataTable, NEmpty, NFlex, NSelect, NSpin, NTag, NText } from 'naive-ui'
import { computed, h, ref } from 'vue'

import { QueryGetAPI, unwrapOk } from '@/api/query'
import { LIVE_API_URL } from '@/shared/config'
import type { TranscriptSegment, TranscriptSegmentPage, TranscriptSession } from '@/shared/models/transcription'

const props = defineProps<{
  liveId: string
}>()

const loading = ref(false)
const loaded = ref(false)
const error = ref<string>()
const sessions = ref<TranscriptSession[]>([])
const segments = ref<TranscriptSegment[]>([])
const selectedSessionId = ref<string>()

const sessionOptions = computed(() =>
  sessions.value.map((session) => ({
    label: `${formatDateTime(session.startedAt)} · ${providerName(session.provider)}`,
    value: session.id,
  })),
)

const selectedSession = computed(() => sessions.value.find((session) => session.id === selectedSessionId.value))

const columns: DataTableColumns<TranscriptSegment> = [
  {
    title: '时间',
    key: 'startMs',
    width: 110,
    render: (row) => h(NText, { depth: 3 }, () => formatClock(row.startMs)),
  },
  {
    title: '字幕',
    key: 'text',
  },
  {
    title: '说话人',
    key: 'speaker',
    width: 120,
    render: (row) => row.speaker || '—',
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

function formatDateTime(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleString()
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
  const filename = `live-${props.liveId}-${new Date(session.startedAt * 1000).toISOString().replaceAll(':', '-')}.${extension}`
  saveAs(new Blob([`\uFEFF${content}`], { type: 'text/plain;charset=utf-8' }), filename)
}

function downloadTxt() {
  const session = selectedSession.value
  if (!session) return
  const header = [
    `Provider: ${providerName(session.provider)}`,
    `Model: ${session.model}`,
    `Language: ${session.language}`,
    '',
  ]
  const lines = segments.value.map(
    (segment) => `[${formatClock(segment.startMs)}] ${segment.speaker ? `${segment.speaker}: ` : ''}${segment.text}`,
  )
  saveText([...header, ...lines].join('\r\n'), 'txt')
}

function downloadSrt() {
  const session = selectedSession.value
  if (!session) return
  const content = segments.value
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
  <NSpin :show="loading">
    <NFlex
      vertical
      :size="12"
    >
      <NFlex
        v-if="sessions.length"
        align="center"
        justify="space-between"
      >
        <NSelect
          v-model:value="selectedSessionId"
          :options="sessionOptions"
          style="max-width: 560px; flex: 1"
          @update:value="loadSegments"
        />
        <NFlex>
          <NButton
            size="small"
            :disabled="!segments.length"
            @click="downloadTxt"
          >
            下载 TXT
          </NButton>
          <NButton
            size="small"
            :disabled="!segments.length"
            @click="downloadSrt"
          >
            下载 SRT
          </NButton>
        </NFlex>
      </NFlex>

      <NFlex
        v-if="selectedSession"
        align="center"
        :size="8"
      >
        <NTag
          size="small"
          :bordered="false"
        >
          {{ providerName(selectedSession.provider) }}
        </NTag>
        <NText depth="3"> {{ selectedSession.model }} · {{ selectedSession.language }} </NText>
      </NFlex>

      <NDataTable
        v-if="segments.length"
        :columns="columns"
        :data="segments"
        :row-key="(row) => row.sequence"
        :max-height="650"
        virtual-scroll
        size="small"
        striped
      />

      <NEmpty
        v-else
        :description="error || (loaded ? '这场直播暂无转写归档' : '尚未加载转写归档')"
      >
        <template #extra>
          <NButton
            v-if="!loaded || error"
            size="small"
            @click="load"
          >
            {{ error ? '重试' : '加载' }}
          </NButton>
        </template>
      </NEmpty>
    </NFlex>
  </NSpin>
</template>
