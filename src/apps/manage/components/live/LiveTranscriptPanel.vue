<script setup lang="ts">
import { saveAs } from 'file-saver'
import { computed, ref } from 'vue'

import { QueryGetAPI, unwrapOk } from '@/api/query'
import { LIVE_API_URL } from '@/shared/config'
import type { TranscriptSegment, TranscriptSegmentPage, TranscriptSession } from '@/shared/models/transcription'

const props = defineProps<{ liveId: string }>()
const loading = ref(false)
const loaded = ref(false)
const error = ref<string>()
const sessions = ref<TranscriptSession[]>([])
const segments = ref<TranscriptSegment[]>([])
const selectedSessionId = ref<string>()
const sessionOptions = computed(() => sessions.value.map((session) => ({ label: `${formatDateTime(session.startedAt)} · ${providerName(session.provider)}`, value: session.id })))
const selectedSession = computed(() => sessions.value.find((session) => session.id === selectedSessionId.value))

async function load() {
  if (loaded.value || loading.value) return
  loading.value = true; error.value = undefined
  try { const response = await QueryGetAPI<TranscriptSession[]>(`${LIVE_API_URL}get-transcript-sessions`, { liveId: props.liveId }); sessions.value = unwrapOk(response, '无法获取直播转写会话').toReversed(); selectedSessionId.value = sessions.value[0]?.id; if (selectedSessionId.value) await loadSegments(selectedSessionId.value); loaded.value = true } catch (reason) { error.value = reason instanceof Error ? reason.message : String(reason) } finally { loading.value = false }
}
async function loadSegments(id: string) {
  loading.value = true
  try { const result: TranscriptSegment[] = []; for (let page = 1, more = true; more; page++) { const response = await QueryGetAPI<TranscriptSegmentPage>(`${LIVE_API_URL}get-transcript-segments`, { liveId: props.liveId, sessionId: id, page, pageSize: 1000 }); const data = unwrapOk(response, '无法获取转写字幕'); result.push(...data.segments); more = data.more }; segments.value = result } finally { loading.value = false }
}
function providerName(provider: TranscriptSession['provider']) { return provider === 'tencent' ? '腾讯云' : 'OpenAI' }
function formatDateTime(timestamp: number) { return new Date(timestamp * 1000).toLocaleString() }
function formatClock(milliseconds: number, srt = false) { const seconds = Math.floor(milliseconds / 1000); const separator = srt ? ',' : '.'; return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}${separator}${String(milliseconds % 1000).padStart(3, '0')}` }
function pad(value: number) { return String(value).padStart(2, '0') }
function saveText(content: string, extension: 'txt' | 'srt') { const session = selectedSession.value; if (!session) return; saveAs(new Blob([`\uFEFF${content}`], { type: 'text/plain;charset=utf-8' }), `live-${props.liveId}-${new Date(session.startedAt * 1000).toISOString().replaceAll(':', '-')}.${extension}`) }
function downloadTxt() { const session = selectedSession.value; if (!session) return; const header = [`Provider: ${providerName(session.provider)}`, `Model: ${session.model}`, `Language: ${session.language}`, '']; saveText([...header, ...segments.value.map((segment) => `[${formatClock(segment.startMs)}] ${segment.speaker ? `${segment.speaker}: ` : ''}${segment.text}`)].join('\r\n'), 'txt') }
function downloadSrt() { saveText(segments.value.map((segment, index) => [index + 1, `${formatClock(segment.startMs, true)} --> ${formatClock(segment.endMs, true)}`, `${segment.speaker ? `${segment.speaker}: ` : ''}${segment.text}`, ''].join('\r\n')).join('\r\n'), 'srt') }
defineExpose({ load })
</script>

<template>
  <div class="transcript-panel" :aria-busy="loading">
    <div v-if="sessions.length" class="transcript-toolbar"><USelect v-model="selectedSessionId" :items="sessionOptions" class="session-select" @update:model-value="loadSegments" /><div><UButton size="sm" color="neutral" variant="soft" label="下载 TXT" :disabled="!segments.length" @click="downloadTxt" /><UButton size="sm" color="neutral" variant="soft" label="下载 SRT" :disabled="!segments.length" @click="downloadSrt" /></div></div>
    <div v-if="selectedSession" class="session-meta"><UBadge variant="subtle">{{ providerName(selectedSession.provider) }}</UBadge><span>{{ selectedSession.model }} · {{ selectedSession.language }}</span></div>
    <div v-if="segments.length" class="transcript-table"><table><thead><tr><th>时间</th><th>字幕</th><th>说话人</th></tr></thead><tbody><tr v-for="segment in segments" :key="segment.sequence"><td>{{ formatClock(segment.startMs) }}</td><td>{{ segment.text }}</td><td>{{ segment.speaker || '—' }}</td></tr></tbody></table></div>
    <UEmpty v-else :title="error || (loaded ? '这场直播暂无转写归档' : '尚未加载转写归档')"><template #actions><UButton v-if="!loaded || error" size="sm" :label="error ? '重试' : '加载'" @click="load" /></template></UEmpty>
  </div>
</template>

<style scoped>
.transcript-panel { display:flex; flex-direction:column; gap:12px; }.transcript-toolbar,.transcript-toolbar>div,.session-meta { display:flex; align-items:center; flex-wrap:wrap; gap:8px; }.transcript-toolbar { justify-content:space-between; }.session-select { flex:1; min-width:220px; max-width:560px; }.session-meta { color:var(--vtsuru-fg-muted); font-size:13px; }.transcript-table { max-height:650px; overflow:auto; border:1px solid var(--vtsuru-border); border-radius:6px; }.transcript-table table { width:100%; border-collapse:collapse; font-size:13px; }.transcript-table th,.transcript-table td { padding:8px 10px; text-align:left; border-bottom:1px solid var(--vtsuru-border); }.transcript-table th { position:sticky; top:0; background:var(--vtsuru-bg-elevated); }.transcript-table td:first-child,.transcript-table td:last-child { color:var(--vtsuru-fg-muted); white-space:nowrap; }
</style>
