<script setup lang="ts">
import { Checkmark12Regular, PeopleQueue24Filled } from '@vicons/fluent'
import { isSameDay } from 'date-fns'
import { computed, provide } from 'vue'
import { toast } from 'vue-sonner'

import { SaveSetting, useAccount } from '@/api/account'
import { QueueSortType, SongRequestStatus } from '@/api/generated/model'
import { useLiveRequest } from '@/composables/useLiveRequest'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Popconfirm } from '@/shared/ui/popconfirm'

import SongRequestItem from './SongRequestItem.vue'

const songRequest = useLiveRequest()
const accountInfo = useAccount()

provide('activeSongs', songRequest.activeSongs)

const todayFinishedCount = computed(() => {
  return songRequest.songs.filter((s) => s.status != SongRequestStatus.Cancel && isSameDay(s.finishAt ?? 0, Date.now()))
    .length
})

const waitingCount = computed(() => {
  return songRequest.activeSongs.filter((s) => s.status === SongRequestStatus.Waiting).length
})

const currentIsReverse = computed(() =>
  songRequest.configCanEdit ? accountInfo.value?.settings?.songRequest?.isReverse : songRequest.isReverse,
)
const sortType = computed({
  get: () => accountInfo.value?.settings?.songRequest?.sortType ?? QueueSortType.TimeFirst,
  set: (value) => {
    const songRequestSettings = accountInfo.value?.settings?.songRequest
    if (!songRequestSettings) return
    songRequestSettings.sortType = value
  },
})

const sortOptions = [
  { label: '时间', value: QueueSortType.TimeFirst },
  { label: '付费', value: QueueSortType.PaymentFist },
  { label: '舰长', value: QueueSortType.GuardFirst },
  { label: '粉丝牌', value: QueueSortType.FansMedalFirst },
]

async function updateSettings() {
  if (accountInfo.value?.id) {
    songRequest.isLoading = true
    try {
      const msg = await SaveSetting('SongRequest', accountInfo.value.settings.songRequest)
      if (msg) {
        toast.success('已保存')
      } else {
        toast.error(`保存失败: ${msg}`)
      }
    } finally {
      songRequest.isLoading = false
    }
  } else {
    toast.success('完成')
  }
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <Card class="border bg-card">
      <CardContent class="p-2.5 sm:p-3.5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <!-- 左侧统计指示 -->
          <div class="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              class="h-6 px-2 text-xs gap-1 border-sky-500/40 text-sky-600 bg-sky-500/10"
            >
              <PeopleQueue24Filled class="size-3.5" />
              待唱: {{ waitingCount }}
            </Badge>
            <Badge
              variant="outline"
              class="h-6 px-2 text-xs gap-1 border-emerald-500/40 text-emerald-600 bg-emerald-500/10"
            >
              <Checkmark12Regular class="size-3.5" />
              今日已点: {{ todayFinishedCount }}
            </Badge>
            <span class="text-xs text-muted-foreground ml-1"> 共 {{ songRequest.activeSongs.length }} 首 </span>
          </div>

          <!-- 右侧操作与过滤 -->
          <div class="flex items-center gap-2 flex-wrap">
            <div class="flex items-center gap-1.5 w-[220px]">
              <Input
                :value="songRequest.newSongName"
                placeholder="手动输入歌曲名"
                class="flex-1"
                @input="songRequest.newSongName = ($event.target as HTMLInputElement).value"
                @keyup.enter="songRequest.addSongManual()"
              />
              <Button
                class="shrink-0"
                @click="songRequest.addSongManual()"
              >
                添加
              </Button>
            </div>

            <!-- 排序单选条 -->
            <div class="inline-flex rounded-md border border-input p-0.5 bg-background text-muted-foreground">
              <button
                v-for="opt in sortOptions"
                :key="opt.value"
                type="button"
                :disabled="!songRequest.configCanEdit"
                class="px-2 py-1 text-xs font-medium rounded-sm transition-all"
                :class="
                  sortType === opt.value ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:text-foreground'
                "
                @click="
                  sortType = opt.value
                  updateSettings()
                "
              >
                {{ opt.label }}
              </button>
            </div>

            <label class="flex items-center gap-1.5 cursor-pointer text-xs select-none">
              <Checkbox
                :checked="currentIsReverse"
                @update:checked="
                  (value) => {
                    if (songRequest.configCanEdit) {
                      const songRequestSettings = accountInfo?.settings?.songRequest
                      if (!songRequestSettings) return
                      songRequestSettings.isReverse = value
                      updateSettings()
                    } else {
                      songRequest.isReverse = value
                    }
                  }
                "
              />
              <span>倒序</span>
            </label>

            <Popconfirm
              title="确认取消全部"
              @positive-click="songRequest.deactiveAllSongs()"
            >
              <template #trigger>
                <Button
                  variant="outline"
                  class="border-destructive/40 text-destructive hover:bg-destructive/10"
                >
                  全部取消
                </Button>
              </template>
              确定要取消全部待唱歌曲吗?
            </Popconfirm>
          </div>
        </div>
      </CardContent>
    </Card>

    <div
      v-if="songRequest.activeSongs.length > 0"
      class="mt-2.5 relative flex flex-col gap-2"
    >
      <div
        v-for="(song, index) in songRequest.activeSongs"
        :key="song.id"
        class="song-item-wrapper"
      >
        <SongRequestItem
          :song="song"
          :index="index + 1"
          :is-loading="songRequest.isLoading"
          :is-lrc-loading="songRequest.isLrcLoading"
          :update-key="songRequest.updateKey"
        />
      </div>
    </div>
    <Empty
      v-else
      description="暂无点播内容"
      class="mt-10"
    />
  </div>
</template>
