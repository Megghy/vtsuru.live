<script setup lang="ts">
import {
  ArrowUpToLine,
  Check,
  Copy,
  ExternalLink,
  FileText,
  Music2,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  SkipForward,
  X,
} from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import { postApiLiveRequestAdd } from '@/api/generated/live-request/live-request'
import { SongRequestFrom, SongRequestStatus } from '@/api/generated/model'
import {
  resolveNowPlayingFilePath,
  syncNowPlayingFile,
  useNowPlayingSettings,
} from '@/apps/client/utils/nowPlayingWriter'
import { useObsRealtimeSync } from '@/apps/obs/composables/useObsRealtimeSync'
import { useLiveRequest } from '@/composables/useLiveRequest'
import { CURRENT_HOST, isTauri } from '@/shared/config'
import { Badge } from '@/shared/ui/badge'
import { SimpleTooltip } from '@/shared/ui/tooltip'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { SettingRow } from '@/shared/ui/setting-row'
import { Switch } from '@/shared/ui/switch'

import IconAction from './IconAction.vue'
import PanelShell from './PanelShell.vue'

defineProps<{ blurred?: boolean }>()

const account = useAccount()
const liveRequest = useLiveRequest()
const nowPlayingSettings = useNowPlayingSettings()
const isDesktop = isTauri()
const resolvedNowPlayingPath = ref('')
const quickSongName = ref('')
const isAdding = ref(false)
const isSwitching = ref(false)

const singing = computed(() =>
  liveRequest.unfilteredActiveSongs.find((s) => s.status === SongRequestStatus.Singing),
)
const waiting = computed(() =>
  liveRequest.unfilteredActiveSongs.filter((s) => s.status === SongRequestStatus.Waiting),
)

const { on: onRealtime } = useObsRealtimeSync({
  topic: () => (account.value?.id ? `obs:display:live-request:${account.value.id}` : ''),
  active: () => Boolean(account.value?.id),
  onSync: () => {
    void liveRequest.updateActive()
  },
})
onRealtime('Changed', () => {
  void liveRequest.updateActive()
})

watch(
  () => [singing.value?.id, singing.value?.songName, waiting.value.length, nowPlayingSettings.value.enabled] as const,
  async () => {
    if (!isDesktop || !nowPlayingSettings.value.enabled) return
    const result = await syncNowPlayingFile(singing.value, waiting.value.length, nowPlayingSettings.value)
    if (result.path) resolvedNowPlayingPath.value = result.path
  },
  { immediate: true },
)

async function handleFinishAndNext() {
  if (isSwitching.value) return
  isSwitching.value = true
  try {
    await liveRequest.finishAndStartNext()
  } finally {
    isSwitching.value = false
  }
}

async function handleQuickAdd() {
  const name = quickSongName.value.trim()
  if (!name || isAdding.value) return
  isAdding.value = true
  try {
    const res = await postApiLiveRequestAdd({ name })
    if (res.code === 200) {
      quickSongName.value = ''
      toast.success(`已添加「${name}」到待唱队列`)
      await liveRequest.updateActive()
    } else {
      toast.error(res.message || '添加失败')
    }
  } finally {
    isAdding.value = false
  }
}

async function copyNowPlayingPath() {
  const path = resolvedNowPlayingPath.value || (await resolveNowPlayingFilePath(nowPlayingSettings.value.customPath))
  resolvedNowPlayingPath.value = path
  await navigator.clipboard.writeText(path)
  toast.success('已复制 now_playing.txt 路径')
}

async function openManage() {
  const url = `${CURRENT_HOST}manage/live-request`
  if (isTauri()) {
    const { openUrl } = await import('@tauri-apps/plugin-opener')
    await openUrl(url)
  } else {
    window.open(url, '_blank')
  }
}

function getSourceTag(from: SongRequestFrom | number | undefined): string | null {
  if (from === SongRequestFrom.SC) return 'SC'
  if (from === SongRequestFrom.Gift) return '礼物'
  if (from === SongRequestFrom.Web) return '网页'
  return null
}

interface SongRuntimeMeta {
  keyShift?: string | null
  proficiency?: string | null
  instrumentalUrl?: string | null
  description?: string | null
}

function songMetaOf(song: unknown): SongRuntimeMeta {
  if (!song || typeof song !== 'object') return {}
  const record = song as Record<string, unknown>
  return {
    keyShift: typeof record.keyShift === 'string' && record.keyShift.trim() ? record.keyShift.trim() : null,
    proficiency: typeof record.proficiency === 'string' && record.proficiency.trim() ? record.proficiency.trim() : null,
    instrumentalUrl:
      typeof record.instrumentalUrl === 'string' && record.instrumentalUrl.trim() ? record.instrumentalUrl.trim() : null,
    description: typeof record.description === 'string' && record.description.trim() ? record.description.trim() : null,
  }
}

async function openExternalUrl(url: string) {
  if (isTauri()) {
    const { openUrl } = await import('@tauri-apps/plugin-opener')
    await openUrl(url)
  } else {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

async function copyUrl(url: string) {
  await navigator.clipboard.writeText(url)
  toast.success('已复制伴奏链接')
}

onMounted(async () => {
  void liveRequest.updateActive()
  if (isDesktop) {
    resolvedNowPlayingPath.value = await resolveNowPlayingFilePath(nowPlayingSettings.value.customPath)
  }
})

onUnmounted(() => {
  // 不调用 dispose()，避免中断其他同时挂载页面的轮询；RealtimeSync 会自动随组件卸载解绑
})
</script>

<template>
  <PanelShell
    title="点歌"
    panel-id="song_request"
    :blurred="blurred"
  >
    <template #actions>
      <Badge
        variant="secondary"
        size="xs"
        class="tabular-nums"
      >
        {{ waiting.length }} 待唱
      </Badge>
      <IconAction
        :icon="RefreshCw"
        tip="刷新点歌队列"
        @click="liveRequest.updateActive()"
      />
      <IconAction
        :icon="ExternalLink"
        tip="打开完整点播管理页"
        @click="openManage"
      />
    </template>

    <div class="flex flex-col gap-2.5 box-border h-full p-2.5 overflow-y-auto scrollbar-thin text-[13px]">
      <!-- 正在演唱卡片 -->
      <section class="rounded-md border border-border bg-card p-2.5 space-y-2">
        <div class="flex items-center justify-between gap-2">
          <span class="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Music2 class="size-3.5 text-primary" />
            正在演唱
          </span>
          <div class="flex items-center gap-1">
            <Badge
              v-if="songMetaOf(singing?.song).proficiency"
              variant="secondary"
              size="xs"
            >
              {{ songMetaOf(singing?.song).proficiency }}
            </Badge>
            <Badge
              v-if="songMetaOf(singing?.song).keyShift"
              variant="outline"
              size="xs"
            >
              调性 {{ songMetaOf(singing?.song).keyShift }}
            </Badge>
          </div>
        </div>

        <template v-if="singing">
          <div class="min-w-0">
            <div class="font-semibold text-foreground truncate">{{ singing.songName }}</div>
            <div class="text-xs text-muted-foreground truncate mt-0.5">
              {{ singing.user?.name || '主播添加' }}
              <template v-if="singing.song?.author?.length">
                · {{ singing.song.author.join(' / ') }}
              </template>
            </div>
            <div
              v-if="songMetaOf(singing.song).description"
              class="mt-1 rounded bg-muted/50 px-1.5 py-0.5 text-[11px] text-muted-foreground break-words"
            >
              备注：{{ songMetaOf(singing.song).description }}
            </div>
          </div>

          <div class="flex items-center gap-1.5 flex-wrap">
            <Button
              size="xs"
              class="flex-1 gap-1"
              :loading="isSwitching"
              @click="handleFinishAndNext"
            >
              <SkipForward class="size-3.5" />
              {{ waiting.length > 0 ? '完成并唱下一首' : '标记已唱完' }}
            </Button>
            <SimpleTooltip content="仅标记已唱完">
              <Button
                size="icon-xs"
                variant="outline"
                aria-label="仅标记已唱完"
                @click="liveRequest.updateSongStatus(singing, SongRequestStatus.Finish)"
              >
                <Check class="size-3.5" />
              </Button>
            </SimpleTooltip>
            <SimpleTooltip content="退回待唱">
              <Button
                size="icon-xs"
                variant="outline"
                aria-label="退回待唱"
                @click="liveRequest.updateSongStatus(singing, SongRequestStatus.Waiting)"
              >
                <RotateCcw class="size-3.5" />
              </Button>
            </SimpleTooltip>
            <template v-if="songMetaOf(singing.song).instrumentalUrl">
              <SimpleTooltip content="打开伴奏 / 乐谱">
                <Button
                  size="icon-xs"
                  variant="outline"
                  aria-label="打开伴奏 / 乐谱"
                  @click="openExternalUrl(songMetaOf(singing.song).instrumentalUrl!)"
                >
                  <ExternalLink class="size-3.5" />
                </Button>
              </SimpleTooltip>
              <SimpleTooltip content="复制伴奏链接">
                <Button
                  size="icon-xs"
                  variant="outline"
                  aria-label="复制伴奏链接"
                  @click="copyUrl(songMetaOf(singing.song).instrumentalUrl!)"
                >
                  <Copy class="size-3.5" />
                </Button>
              </SimpleTooltip>
            </template>
          </div>
        </template>

        <div
          v-else
          class="flex-between gap-2 py-1 text-xs text-muted-foreground"
        >
          <span>当前未在演唱</span>
          <Button
            v-if="waiting.length > 0"
            size="xs"
            variant="secondary"
            class="gap-1"
            @click="liveRequest.updateSongStatus(waiting[0], SongRequestStatus.Singing)"
          >
            <Play class="size-3" />
            开唱队首
          </Button>
        </div>
      </section>

      <!-- 快速添加 -->
      <div class="flex items-center gap-1.5">
        <Input
          v-model="quickSongName"
          placeholder="输入歌名快速加入待唱队列…"
          class="flex-1 min-w-0"
          @keydown.enter="handleQuickAdd"
        />
        <SimpleTooltip content="加入待唱队列">
          <Button
            size="icon"
            variant="outline"
            class="shrink-0"
            :loading="isAdding"
            :disabled="!quickSongName.trim()"
            aria-label="加入待唱队列"
            @click="handleQuickAdd"
          >
            <Plus class="size-3.5" />
          </Button>
        </SimpleTooltip>
      </div>

      <!-- 等待队列 -->
      <section class="space-y-1.5 flex-1 min-h-0">
        <div class="text-xs font-medium text-muted-foreground">等待演唱（{{ waiting.length }}）</div>

        <div
          v-if="waiting.length > 0"
          class="space-y-1"
        >
          <div
            v-for="(item, idx) in waiting"
            :key="item.id"
            class="flex items-center gap-1.5 rounded-md border border-border/70 bg-card/60 px-2 py-1.5"
          >
            <span class="text-[11px] font-mono tabular-nums text-muted-foreground w-4 shrink-0">
              {{ idx + 1 }}
            </span>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1 min-w-0">
                <span class="font-medium text-foreground truncate text-xs">{{ item.songName }}</span>
                <Badge
                  v-if="(item.priorityLevel ?? 0) > 0"
                  variant="warning"
                  size="xs"
                >
                  插队
                </Badge>
                <Badge
                  v-else-if="getSourceTag(item.from)"
                  variant="secondary"
                  size="xs"
                >
                  {{ getSourceTag(item.from) }}
                </Badge>
              </div>
              <div class="text-[11px] text-muted-foreground truncate">
                {{ item.user?.name || '主播添加' }}
                <template v-if="songMetaOf(item.song).keyShift"> · {{ songMetaOf(item.song).keyShift }}</template>
                <template v-if="songMetaOf(item.song).proficiency"> · {{ songMetaOf(item.song).proficiency }}</template>
              </div>
              <SimpleTooltip
                v-if="songMetaOf(item.song).description"
                :content="songMetaOf(item.song).description!"
              >
                <div class="text-[10px] text-muted-foreground/85 truncate">
                  备注：{{ songMetaOf(item.song).description }}
                </div>
              </SimpleTooltip>
            </div>

            <div class="flex items-center gap-0.5 shrink-0">
              <SimpleTooltip
                v-if="songMetaOf(item.song).instrumentalUrl"
                content="打开伴奏链接"
              >
                <Button
                  size="icon-xs"
                  variant="ghost"
                  class="text-muted-foreground hover:text-primary"
                  aria-label="打开伴奏链接"
                  @click="openExternalUrl(songMetaOf(item.song).instrumentalUrl!)"
                >
                  <ExternalLink class="size-3" />
                </Button>
              </SimpleTooltip>
              <SimpleTooltip content="开始演唱">
                <Button
                  size="icon-xs"
                  variant="ghost"
                  class="text-primary hover:bg-primary/10"
                  aria-label="开始演唱"
                  @click="liveRequest.updateSongStatus(item, SongRequestStatus.Singing)"
                >
                  <Play class="size-3" />
                </Button>
              </SimpleTooltip>
              <SimpleTooltip
                v-if="idx > 0"
                content="置顶至队首"
              >
                <Button
                  size="icon-xs"
                  variant="ghost"
                  class="text-muted-foreground"
                  aria-label="置顶至队首"
                  @click="liveRequest.pinSong(item)"
                >
                  <ArrowUpToLine class="size-3" />
                </Button>
              </SimpleTooltip>
              <SimpleTooltip content="取消点播">
                <Button
                  size="icon-xs"
                  variant="ghost"
                  class="text-muted-foreground hover:text-destructive"
                  aria-label="取消点播"
                  @click="liveRequest.updateSongStatus(item, SongRequestStatus.Cancel)"
                >
                  <X class="size-3" />
                </Button>
              </SimpleTooltip>
            </div>
          </div>
        </div>

        <div
          v-else
          class="py-6 text-center text-xs text-muted-foreground"
        >
          待唱队列为空
        </div>
      </section>

      <!-- 桌面端本地 now_playing.txt 输出 -->
      <section
        v-if="isDesktop"
        class="rounded-md border border-border/70 bg-muted/30 p-2 space-y-1.5"
      >
        <SettingRow
          variant="none"
          title="同步写入 now_playing.txt"
          description="供第三方 OBS 文本源读取当前演唱曲目"
        >
          <Switch v-model="nowPlayingSettings.enabled" />
        </SettingRow>
        <div
          v-if="nowPlayingSettings.enabled"
          class="flex items-center gap-1.5 text-[11px] text-muted-foreground"
        >
          <FileText class="size-3 shrink-0" />
          <span class="truncate flex-1 font-mono">{{ resolvedNowPlayingPath || 'obs-text/now_playing.txt' }}</span>
          <SimpleTooltip content="复制文件路径">
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label="复制文件路径"
              @click="copyNowPlayingPath"
            >
              <Copy class="size-3" />
            </Button>
          </SimpleTooltip>
        </div>
      </section>
    </div>
  </PanelShell>
</template>
