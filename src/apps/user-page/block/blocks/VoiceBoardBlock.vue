<script setup lang="ts">
import { Square, Volume2 } from 'lucide-vue-next'
import { computed, onBeforeUnmount, ref } from 'vue'
import { toast } from 'vue-sonner'

import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Empty } from '@/shared/ui/empty'

import BlockCard from '../BlockCard.vue'

interface VoiceItem {
  label: string
  subtitle: string
  tag: string
  src: string
  color: string
}

const props = defineProps<{ blockProps: unknown; userInfo?: unknown; biliInfo?: unknown }>()

const values = computed<Record<string, unknown>>(() =>
  props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps)
    ? (props.blockProps as Record<string, unknown>)
    : {},
)

const title = computed(() => (typeof values.value.title === 'string' && values.value.title.trim() ? values.value.title.trim() : '语音按钮'))
const description = computed(() => (typeof values.value.description === 'string' ? values.value.description.trim() : ''))
const columns = computed(() => {
  const n = Number(values.value.columns)
  return Number.isInteger(n) ? Math.min(4, Math.max(1, n)) : 3
})
const allowOverlap = computed(() => values.value.allowOverlap === true)

const items = computed<VoiceItem[]>(() => {
  if (!Array.isArray(values.value.items)) return []
  return values.value.items.flatMap((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
    const o = raw as Record<string, any>
    const file = o.audioFile && typeof o.audioFile === 'object' ? o.audioFile : null
    const src =
      typeof file?.path === 'string' && file.path
        ? file.path
        : typeof o.audioUrl === 'string' && /^https:\/\//i.test(o.audioUrl.trim())
          ? o.audioUrl.trim()
          : ''
    const label = typeof o.label === 'string' && o.label.trim() ? o.label.trim() : '语音片段'
    return [
      {
        label,
        subtitle: typeof o.subtitle === 'string' ? o.subtitle.trim() : '',
        tag: typeof o.tag === 'string' ? o.tag.trim() : '',
        src,
        color: typeof o.color === 'string' && /^#[\da-f]{6}$/i.test(o.color.trim()) ? o.color.trim() : '',
      },
    ]
  })
})

const playingSet = ref(new Set<number>())
const activeAudios = new Set<HTMLAudioElement>()

function stopAll() {
  for (const audio of activeAudios) {
    audio.pause()
    audio.currentTime = 0
  }
  activeAudios.clear()
  playingSet.value = new Set()
}

function playItem(item: VoiceItem, index: number) {
  if (!item.src) {
    toast.info('该语音按钮暂未配置音频')
    return
  }
  if (!allowOverlap.value) {
    stopAll()
  }
  const audio = new Audio(item.src)
  activeAudios.add(audio)
  const next = new Set(playingSet.value)
  next.add(index)
  playingSet.value = next

  const cleanup = () => {
    activeAudios.delete(audio)
    const updated = new Set(playingSet.value)
    updated.delete(index)
    playingSet.value = updated
  }
  audio.addEventListener('ended', cleanup)
  audio.addEventListener('error', () => {
    cleanup()
    toast.error(`音频《${item.label}》加载或播放失败`)
  })
  void audio.play().catch(() => {
    cleanup()
    toast.error('浏览器拦截了音频播放，请重试')
  })
}

onBeforeUnmount(stopAll)
</script>

<template>
  <BlockCard
    :framed="values.framed !== false"
    :backgrounded="values.backgrounded !== false"
  >
    <template #header>
      <div class="flex-between gap-2 w-full">
        <div class="min-w-0">
          <span class="flex items-center gap-1.5 font-semibold text-sm">
            <Volume2 class="size-4 text-primary" />
            {{ title }}
          </span>
          <p
            v-if="description"
            class="m-0 mt-0.5 text-xs text-muted-foreground"
          >
            {{ description }}
          </p>
        </div>
        <Button
          v-if="playingSet.size > 0"
          variant="outline"
          size="xs"
          class="gap-1 shrink-0"
          @click="stopAll"
        >
          <Square class="size-3" />
          停止
        </Button>
      </div>
    </template>

    <Empty
      v-if="items.length === 0"
      description="暂未添加语音按钮"
      class="py-4 text-xs"
    />
    <div
      v-else
      class="@container grid gap-2"
      :class="'grid-cols-[repeat(var(--voice-cols),minmax(0,1fr))] @max-[520px]:grid-cols-2 @max-[320px]:grid-cols-1'"
      :style="{ '--voice-cols': String(columns) }"
    >
      <button
        v-for="(item, idx) in items"
        :key="idx"
        type="button"
        class="group relative flex flex-col items-start gap-1 rounded-[var(--radius)] border px-3 py-2.5 text-left transition-[transform,border-color,background-color] duration-150 active:scale-[0.98] cursor-pointer min-w-0"
        :class="
          playingSet.has(idx)
            ? 'border-primary bg-primary/15 shadow-xs'
            : 'border-border bg-muted/40 hover:border-primary/60 hover:bg-muted/70'
        "
        :style="
          item.color
            ? {
                borderColor: playingSet.has(idx) ? item.color : `color-mix(in srgb, ${item.color} 45%, var(--border))`,
                backgroundColor: playingSet.has(idx)
                  ? `color-mix(in srgb, ${item.color} 22%, transparent)`
                  : `color-mix(in srgb, ${item.color} 8%, transparent)`,
              }
            : undefined
        "
        @click="playItem(item, idx)"
      >
        <div class="flex items-center justify-between gap-1.5 w-full min-w-0">
          <span class="flex items-center gap-1.5 text-xs font-semibold truncate">
            <Volume2
              class="size-3.5 shrink-0"
              :class="playingSet.has(idx) ? 'text-primary animate-pulse' : 'text-muted-foreground group-hover:text-primary'"
              :style="item.color ? { color: item.color } : undefined"
            />
            <span class="truncate">{{ item.label }}</span>
          </span>
          <Badge
            v-if="item.tag"
            variant="secondary"
            size="xs"
            class="shrink-0"
          >
            {{ item.tag }}
          </Badge>
        </div>
        <span
          v-if="item.subtitle"
          class="text-[11px] text-muted-foreground truncate w-full"
        >
          {{ item.subtitle }}
        </span>
      </button>
    </div>
  </BlockCard>
</template>
