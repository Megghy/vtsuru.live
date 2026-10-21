<script setup lang="ts">
import {
  Checkmark12Regular,
  Dismiss16Filled,
  Mic24Filled,
  Play24Filled,
  PresenceBlocked16Regular,
} from '@vicons/fluent'
import { format, formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import type { CSSProperties } from 'vue'
import { computed, inject } from 'vue'

import type { SongRequestInfo } from '@/api/api-models'
import { SongRequestFrom, SongRequestStatus } from '@/api/api-models'
import UserBadges from '@/apps/open-live/components/UserBadges.vue'
import { useLiveRequest } from '@/composables/useLiveRequest'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

const props = defineProps<{
  song: SongRequestInfo
  index: number
  isLoading: boolean
  isLrcLoading: string
  updateKey: number
  hasOtherSingSong?: boolean
}>()

const songRequest = useLiveRequest()

const isSingingStatus = computed(() => props.song.status === SongRequestStatus.Singing)
const hasSong = computed(() => !!props.song.song?.url)

function onSelectSong() {
  if (hasSong.value) {
    songRequest.selectedSong = props.song.song!
  }
}

function onUpdateStatus(status: SongRequestStatus) {
  songRequest.updateSongStatus(props.song, status)
}

function onBlockUser() {
  songRequest.blockUser(props.song)
}

function getIndexStyle(status: SongRequestStatus): CSSProperties {
  const style: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    width: '24px',
    minWidth: '24px',
    height: '24px',
    borderRadius: '50%',
    color: '#fff',
    fontSize: '13px',
    marginRight: '8px',
    flexShrink: 0,
  }

  switch (status) {
    case SongRequestStatus.Singing:
      return { ...style, backgroundColor: 'var(--vtsuru-success, #10b981)' }
    case SongRequestStatus.Waiting:
      return { ...style, backgroundColor: 'var(--vtsuru-info, #0284c7)' }
    case SongRequestStatus.Finish:
      return {
        ...style,
        backgroundColor: 'var(--vtsuru-bg-muted, #f3f4f6)',
        color: 'var(--vtsuru-fg, #111827)',
        border: '1px solid var(--vtsuru-border, #e5e7eb)',
      }
    case SongRequestStatus.Cancel:
      return { ...style, backgroundColor: 'var(--vtsuru-error, #ef4444)' }
    default:
      return { ...style, backgroundColor: 'var(--vtsuru-info, #0284c7)' }
  }
}

const activeSongs = inject<SongRequestInfo[]>('activeSongs', [])

const hasOtherSingSong = computed(() => {
  return (
    activeSongs.findIndex((s: SongRequestInfo) => s.id != props.song.id && s.status == SongRequestStatus.Singing) > -1
  )
})

function formatTimeRelative(time: number | string | Date) {
  try {
    return formatDistanceToNow(new Date(time), { locale: zhCN, addSuffix: true })
  } catch {
    return ''
  }
}

function formatTimeAbsolute(time: number | string | Date) {
  try {
    return format(new Date(time), 'yyyy-MM-dd HH:mm:ss')
  } catch {
    return ''
  }
}
</script>

<template>
  <Card
    class="border bg-muted/30 transition-colors"
    :class="isSingingStatus ? 'border-l-4 border-l-emerald-500' : ''"
  >
    <CardContent class="p-2 sm:p-3 flex items-center justify-between gap-2 overflow-hidden">
      <!-- 左侧信息 -->
      <div class="flex items-center gap-2 min-w-0 flex-1 flex-wrap sm:flex-nowrap">
        <!-- 序号 -->
        <span :style="getIndexStyle(song.status)">
          {{ index }}
        </span>

        <!-- 歌曲名称 -->
        <span class="font-semibold text-sm sm:text-base text-foreground truncate">
          {{ song.songName }}
        </span>

        <!-- 用户信息 -->
        <template v-if="song.from === SongRequestFrom.Manual">
          <Badge
            variant="secondary"
            class="text-[10px] h-4.5 px-1.5"
          >
            手动添加
          </Badge>
        </template>
        <template v-else>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <Badge
                  variant="outline"
                  class="text-[10px] h-4.5 px-1.5 border-sky-500/40 text-sky-600 bg-sky-500/10 cursor-help"
                >
                  {{ song.user?.name || '未知用户' }}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                UID: {{ song.user?.uid || '未知' }}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </template>

        <!-- 用户粉丝牌 / 舰长 -->
        <UserBadges
          v-if="song.from === SongRequestFrom.Danmaku || song.from === SongRequestFrom.SC"
          :user="song.user"
          size="tiny"
        />

        <!-- SC/礼物 -->
        <Badge
          v-if="song.from === SongRequestFrom.SC"
          class="text-[10px] h-4.5 px-1.5 text-white"
          :style="{ backgroundColor: songRequest.getSCColor(song.price ?? 0) }"
        >
          SC{{ song.price ? ` | ${song.price}` : '' }}
        </Badge>
        <Badge
          v-if="song.from === SongRequestFrom.Gift"
          class="text-[10px] h-4.5 px-1.5 text-white"
          :style="{ backgroundColor: songRequest.getSCColor(song.price ?? 0) }"
        >
          礼物{{ song.price ? ` | ${song.price}` : '' }}
        </Badge>

        <!-- 时间 -->
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <span class="text-xs text-muted-foreground whitespace-nowrap cursor-help">
                {{ formatTimeRelative(song.createAt) }}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {{ formatTimeAbsolute(song.createAt) }}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <!-- 右侧操作按钮 -->
      <div class="flex items-center gap-1.5 shrink-0">
        <TooltipProvider>
          <Tooltip v-if="hasSong">
            <TooltipTrigger as-child>
              <Button
                size="xs"
                variant="outline"
                class="h-7 w-7 p-0 rounded-full border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10"
                :disabled="isLrcLoading === song?.song?.key"
                @click="onSelectSong"
              >
                <Play24Filled class="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>试听</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                size="xs"
                :variant="song.status === SongRequestStatus.Singing ? 'outline' : 'default'"
                class="h-7 w-7 p-0 rounded-full"
                :class="song.status === SongRequestStatus.Singing ? 'border-amber-500/40 text-amber-600 hover:bg-amber-500/10' : ''"
                :disabled="hasOtherSingSong || isLoading"
                @click="
                  onUpdateStatus(
                    song.status === SongRequestStatus.Singing ? SongRequestStatus.Waiting : SongRequestStatus.Singing,
                  )
                "
              >
                <Mic24Filled class="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {{ hasOtherSingSong ? '还有其他正在演唱' : song.status === SongRequestStatus.Waiting ? '开始演唱' : '暂停演唱' }}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                size="xs"
                class="h-7 w-7 p-0 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white"
                :disabled="isLoading"
                @click="onUpdateStatus(SongRequestStatus.Finish)"
              >
                <Checkmark12Regular class="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>完成</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <div>
                <Popconfirm
                  title="确认取消"
                  @positive-click="onUpdateStatus(SongRequestStatus.Cancel)"
                >
                  <template #trigger>
                    <Button
                      size="xs"
                      variant="outline"
                      class="h-7 w-7 p-0 rounded-full border-destructive/40 text-destructive hover:bg-destructive/10"
                      :disabled="isLoading"
                    >
                      <Dismiss16Filled class="size-3.5" />
                    </Button>
                  </template>
                  确定取消此点歌？
                </Popconfirm>
              </div>
            </TooltipTrigger>
            <TooltipContent>取消</TooltipContent>
          </Tooltip>

          <Tooltip v-if="song.from === SongRequestFrom.Danmaku && song.user?.uid">
            <TooltipTrigger as-child>
              <div>
                <Popconfirm
                  title="确认拉黑"
                  @positive-click="onBlockUser"
                >
                  <template #trigger>
                    <Button
                      size="xs"
                      variant="outline"
                      class="h-7 w-7 p-0 rounded-full border-destructive/40 text-destructive hover:bg-destructive/10"
                      :disabled="isLoading"
                    >
                      <PresenceBlocked16Regular class="size-3.5" />
                    </Button>
                  </template>
                  确定拉黑此用户?
                </Popconfirm>
              </div>
            </TooltipTrigger>
            <TooltipContent>拉黑</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </CardContent>
  </Card>
</template>
