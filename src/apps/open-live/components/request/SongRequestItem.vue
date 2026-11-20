<script setup lang="ts">
import ArrowDown24Regular from '@vicons/fluent/es/ArrowDown24Regular'
import ArrowUp24Regular from '@vicons/fluent/es/ArrowUp24Regular'
import Checkmark12Regular from '@vicons/fluent/es/Checkmark12Regular'
import Dismiss16Filled from '@vicons/fluent/es/Dismiss16Filled'
import Mic24Filled from '@vicons/fluent/es/Mic24Filled'
import Pin24Regular from '@vicons/fluent/es/Pin24Regular'
import Play24Filled from '@vicons/fluent/es/Play24Filled'
import PresenceBlocked16Regular from '@vicons/fluent/es/PresenceBlocked16Regular'
import { format, formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { computed, ref } from 'vue'

import type { SongRequestInfo } from '@/api/client-types'
import { SongRequestFrom, SongRequestStatus } from '@/api/generated/model'
import LiveQueueRowShell from '@/apps/open-live/components/shared/LiveQueueRowShell.vue'
import UserBadges from '@/apps/open-live/components/UserBadges.vue'
import { useLiveRequest } from '@/composables/useLiveRequest'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { normalizeTimestampMs } from '@/shared/utils/queue'

const props = defineProps<{
  song: SongRequestInfo
  index: number
  isLoading: boolean
  isLrcLoading: string
  canMoveUp?: boolean
  canMoveDown?: boolean
  selectionMode?: boolean
  selected?: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-select', checked: boolean): void
}>()

const songRequest = useLiveRequest()

const showCancelDialog = ref(false)
const showBlockDialog = ref(false)
const refundPointOnCancel = ref(false)

const isSingingStatus = computed(() => props.song.status === SongRequestStatus.Singing)
const isWaitingStatus = computed(() => props.song.status === SongRequestStatus.Waiting)
const hasSong = computed(() => !!props.song.song?.url)
const isItemBusy = computed(() => props.isLoading || songRequest.isSongOperating(props.song.id))

const canRefundPoint = computed(() =>
  Boolean(props.song.pointCost && props.song.pointCost > 0 && !props.song.pointRefunded),
)

const canBlock = computed(
  () =>
    songRequest.configCanEdit &&
    (props.song.from === SongRequestFrom.Danmaku ||
      props.song.from === SongRequestFrom.SC ||
      props.song.from === SongRequestFrom.Gift) &&
    Boolean(props.song.user?.uid || props.song.user?.oid),
)

const hasOtherSingSong = computed(() => {
  return songRequest.unfilteredActiveSongs.some((s) => s.id !== props.song.id && s.status === SongRequestStatus.Singing)
})

const indexBadgeClass = computed(() => {
  switch (props.song.status) {
    case SongRequestStatus.Singing:
      return 'bg-emerald-600 text-white'
    case SongRequestStatus.Finish:
      return 'bg-muted text-foreground border border-border'
    case SongRequestStatus.Cancel:
      return 'bg-destructive text-destructive-foreground'
    case SongRequestStatus.Waiting:
    default:
      return 'bg-sky-600 text-white'
  }
})

function onSelectSong() {
  if (hasSong.value && props.song.song) {
    songRequest.selectedSong = props.song.song
  }
}

function openCancelDialog() {
  refundPointOnCancel.value = canRefundPoint.value
  showCancelDialog.value = true
}

async function confirmCancel() {
  await songRequest.updateSongStatus(
    props.song,
    SongRequestStatus.Cancel,
    canRefundPoint.value && refundPointOnCancel.value,
  )
  showCancelDialog.value = false
}

async function confirmBlock() {
  await songRequest.blockUser(props.song)
  showBlockDialog.value = false
}

function formatTimeRelative(time: number | string | Date) {
  try {
    const resolved = typeof time === 'number' ? normalizeTimestampMs(time) : time
    return formatDistanceToNow(new Date(resolved), { locale: zhCN, addSuffix: true })
  } catch {
    return ''
  }
}

function formatTimeAbsolute(time: number | string | Date) {
  try {
    const resolved = typeof time === 'number' ? normalizeTimestampMs(time) : time
    return format(new Date(resolved), 'yyyy-MM-dd HH:mm:ss')
  } catch {
    return ''
  }
}
</script>

<template>
  <LiveQueueRowShell
    :index="index"
    :index-class="indexBadgeClass"
    :highlighted="isSingingStatus"
    :selection-mode="selectionMode"
    :selected="selected"
    select-label="选择此点播"
    @toggle-select="(val) => emit('toggle-select', val)"
  >
    <template #primary>
      <span
        class="font-semibold text-sm text-foreground truncate min-w-0"
        :title="song.songName"
      >
        {{ song.songName }}
      </span>
    </template>

    <template #context>
      <Badge
        v-if="song.from === SongRequestFrom.Manual"
        variant="secondary"
        size="xs"
      >
        手动添加
      </Badge>
      <TooltipProvider v-else>
        <Tooltip>
          <TooltipTrigger as-child>
            <Badge
              variant="outline"
              size="xs"
              class="border-sky-500/40 text-sky-600 bg-sky-500/10 cursor-help max-w-[140px]"
            >
              <span class="truncate">{{ song.user?.name || '未知用户' }}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            {{ song.user?.uid ? `UID: ${song.user.uid}` : `OpenID: ${song.user?.oid || '未知'}` }}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <UserBadges
        v-if="
          song.from === SongRequestFrom.Danmaku ||
          song.from === SongRequestFrom.SC ||
          song.from === SongRequestFrom.Gift
        "
        :user="song.user"
        size="tiny"
      />

      <Badge
        v-if="song.from === SongRequestFrom.SC"
        size="xs"
        class="text-white"
        :style="{ backgroundColor: songRequest.getSCColor(song.price ?? 0) }"
      >
        SC{{ song.price ? ` ¥${song.price}` : '' }}
      </Badge>
      <Badge
        v-if="song.from === SongRequestFrom.Gift"
        size="xs"
        class="text-white"
        :style="{ backgroundColor: songRequest.getSCColor(song.price ?? 0) }"
      >
        礼物{{ song.price ? ` ¥${song.price}` : '' }}
      </Badge>

      <Badge
        v-if="song.priorityLevel > 0"
        variant="default"
        size="xs"
      >
        插队{{ song.priorityLevel > 1 ? ` ×${song.priorityLevel}` : '' }}
      </Badge>

      <Badge
        v-if="song.pointCost && song.pointCost > 0"
        variant="secondary"
        size="xs"
      >
        {{ song.pointCost }} 积分
      </Badge>

      <Badge
        v-if="song.pointRefunded"
        variant="outline"
        size="xs"
        class="border-emerald-500/40 text-emerald-600 bg-emerald-500/10"
      >
        已退积分
      </Badge>
    </template>

    <template #meta>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger as-child>
            <span class="text-xs text-muted-foreground font-mono tabular-nums whitespace-nowrap cursor-help">
              {{ formatTimeRelative(song.createAt) }}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {{ formatTimeAbsolute(song.createAt) }}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </template>

    <template #actions>
      <TooltipProvider>
        <template v-if="isWaitingStatus">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                size="icon-xs"
                variant="ghost"
                :disabled="!canMoveUp || isItemBusy"
                aria-label="置顶"
                @click="songRequest.pinSong(song)"
              >
                <Pin24Regular class="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>置顶到待唱第一位</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                size="icon-xs"
                variant="ghost"
                :disabled="!canMoveUp || isItemBusy"
                aria-label="上移"
                @click="songRequest.moveSong(song, 'up')"
              >
                <ArrowUp24Regular class="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>上移一位</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                size="icon-xs"
                variant="ghost"
                :disabled="!canMoveDown || isItemBusy"
                aria-label="下移"
                @click="songRequest.moveSong(song, 'down')"
              >
                <ArrowDown24Regular class="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>下移一位</TooltipContent>
          </Tooltip>
        </template>

        <Tooltip v-if="hasSong">
          <TooltipTrigger as-child>
            <Button
              size="icon-xs"
              variant="outline"
              class="rounded-full border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10"
              :disabled="isLrcLoading === song?.song?.key"
              aria-label="试听"
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
              size="icon-xs"
              :variant="isSingingStatus ? 'outline' : 'default'"
              class="rounded-full"
              :class="isSingingStatus ? 'border-amber-500/40 text-amber-600 hover:bg-amber-500/10' : ''"
              :disabled="hasOtherSingSong || isItemBusy"
              aria-label="演唱切换"
              @click="
                songRequest.updateSongStatus(
                  song,
                  isSingingStatus ? SongRequestStatus.Waiting : SongRequestStatus.Singing,
                )
              "
            >
              <Mic24Filled class="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {{ hasOtherSingSong ? '还有其他正在演唱' : isWaitingStatus ? '开始演唱' : '暂停演唱' }}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              size="icon-xs"
              class="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white"
              :disabled="isItemBusy"
              aria-label="完成"
              @click="songRequest.updateSongStatus(song, SongRequestStatus.Finish)"
            >
              <Checkmark12Regular class="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>标记已完成</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              size="icon-xs"
              variant="outline"
              class="rounded-full border-destructive/40 text-destructive hover:bg-destructive/10"
              :disabled="isItemBusy"
              aria-label="取消点播"
              @click="openCancelDialog"
            >
              <Dismiss16Filled class="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>取消点播</TooltipContent>
        </Tooltip>

        <Tooltip v-if="canBlock">
          <TooltipTrigger as-child>
            <Button
              size="icon-xs"
              variant="outline"
              class="rounded-full border-destructive/40 text-destructive hover:bg-destructive/10"
              :disabled="isItemBusy"
              aria-label="拉黑用户"
              @click="showBlockDialog = true"
            >
              <PresenceBlocked16Regular class="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>拉黑观众</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </template>
  </LiveQueueRowShell>

  <!-- 取消点播确认弹窗（支持退分勾选） -->
  <AlertDialog v-model:open="showCancelDialog">
    <AlertDialogContent class="sm:max-w-md">
      <AlertDialogHeader>
        <AlertDialogTitle>取消此点播？</AlertDialogTitle>
        <AlertDialogDescription class="text-xs"> 确定要取消《{{ song.songName }}》吗？ </AlertDialogDescription>
      </AlertDialogHeader>

      <label
        v-if="canRefundPoint"
        class="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2.5 text-xs cursor-pointer select-none"
      >
        <Checkbox v-model:checked="refundPointOnCancel" />
        <span>同时退回观众消耗的 {{ song.pointCost }} 积分</span>
      </label>

      <AlertDialogFooter>
        <AlertDialogCancel>保留</AlertDialogCancel>
        <AlertDialogAction
          class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          @click="confirmCancel"
        >
          确认取消
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <!-- 拉黑确认弹窗 -->
  <AlertDialog v-model:open="showBlockDialog">
    <AlertDialogContent class="sm:max-w-md">
      <AlertDialogHeader>
        <AlertDialogTitle>拉黑观众？</AlertDialogTitle>
        <AlertDialogDescription class="text-xs">
          确定将「{{ song.user?.name }}」加入黑名单并取消当前点播吗？
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>取消</AlertDialogCancel>
        <AlertDialogAction
          class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          @click="confirmBlock"
        >
          确认拉黑
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
