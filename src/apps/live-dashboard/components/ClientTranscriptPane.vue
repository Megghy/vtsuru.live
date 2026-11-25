<script setup lang="ts">
import { BookmarkPlus, ExternalLink, Mic, MicOff, Square } from 'lucide-vue-next'
import { nextTick, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useTranscription } from '@/apps/client/store/useTranscription'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { SimpleTooltip } from '@/shared/ui/tooltip'

import { useLiveDashboard } from '../store/useLiveDashboard'

const router = useRouter()
const dashboard = useLiveDashboard()
const transcription = useTranscription()
const listRef = ref<HTMLElement | null>(null)
const autoFollow = ref(true)

onMounted(() => {
  void transcription.init()
})

watch(
  () => [transcription.lines.length, transcription.partialText] as const,
  async () => {
    if (!autoFollow.value) return
    await nextTick()
    if (listRef.value) {
      listRef.value.scrollTop = listRef.value.scrollHeight
    }
  },
)

function formatOffset(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function markLine(text: string) {
  const clean = text.trim().slice(0, 60)
  if (!clean) return
  void dashboard.addMarker(clean, 'manual')
}

function openTranscriptionPage() {
  void router.push({ name: 'client-transcription' })
}
</script>

<template>
  <div class="flex flex-col h-full min-h-0 p-2 gap-2 text-xs">
    <div class="flex items-center gap-1.5 shrink-0">
      <Badge
        :variant="transcription.status.running ? 'success' : 'secondary'"
        size="xs"
        class="gap-1"
      >
        <span
          class="size-1.5 rounded-full"
          :class="transcription.status.running ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/50'"
        />
        {{ transcription.status.running ? '转写中' : '未启动' }}
      </Badge>
      <div class="ml-auto flex items-center gap-1">
        <Button
          v-if="!transcription.status.running"
          size="xs"
          variant="default"
          class="gap-1"
          @click="transcription.start()"
        >
          <Mic class="size-3" />
          开始转写
        </Button>
        <Button
          v-else
          size="xs"
          variant="outline"
          class="gap-1"
          @click="transcription.stop()"
        >
          <Square class="size-3" />
          停止
        </Button>
        <SimpleTooltip content="打开语音转写设置页">
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="打开语音转写设置页"
            @click="openTranscriptionPage"
          >
            <ExternalLink class="size-3.5 text-muted-foreground" />
          </Button>
        </SimpleTooltip>
      </div>
    </div>

    <div
      v-if="transcription.runtimeError"
      class="rounded-md bg-destructive/10 text-destructive px-2 py-1 text-[11px] shrink-0"
    >
      {{ transcription.runtimeError }}
    </div>

    <div
      ref="listRef"
      class="flex-1 min-h-0 overflow-y-auto scrollbar-thin space-y-1"
    >
      <SimpleTooltip
        v-for="(line, idx) in transcription.lines"
        :key="`${line.startMs}-${idx}`"
        content="点击将此句记录为高光打点"
      >
        <div
          class="group flex items-start gap-1.5 rounded-md border border-transparent hover:border-border hover:bg-muted/50 px-2 py-1 transition-colors cursor-pointer"
          @click="markLine(line.text)"
        >
          <span class="text-[10px] font-mono tabular-nums text-muted-foreground shrink-0 mt-0.5">
            {{ formatOffset(line.startMs) }}
          </span>
          <span class="flex-1 text-foreground leading-relaxed break-words">{{ line.text }}</span>
          <BookmarkPlus class="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0 mt-0.5 transition-opacity" />
        </div>
      </SimpleTooltip>

      <div
        v-if="transcription.partialText"
        class="flex items-start gap-1.5 rounded-md border border-dashed border-primary/40 bg-primary/5 px-2 py-1"
      >
        <span class="text-[10px] text-primary shrink-0 mt-0.5">识别中</span>
        <span class="flex-1 text-foreground/90 leading-relaxed break-words">{{ transcription.partialText }}</span>
      </div>

      <div
        v-if="!transcription.lines.length && !transcription.partialText"
        class="flex-col-center py-8 text-muted-foreground gap-1.5"
      >
        <MicOff class="size-5 opacity-40" />
        <span>暂无口播字幕，开启转写后点击任意一句可一键打高光点</span>
      </div>
    </div>
  </div>
</template>
