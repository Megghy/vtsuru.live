<script setup lang="ts">
import { isSameDay } from 'date-fns'
import { computed, provide } from 'vue'

import { SaveSetting, useAccount } from '@/api/account'
import { QueueSortType, SongRequestStatus } from '@/api/api-models'
import { useLiveRequest } from '@/composables/useLiveRequest'

import SongRequestItem from './SongRequestItem.vue'

// 使用useLiveRequest
const songRequest = useLiveRequest()
const accountInfo = useAccount()

// 提供activeSongs给子组件
provide('activeSongs', songRequest.activeSongs)

const todayFinishedCount = computed(() => {
  return songRequest.songs.filter((s) => s.status != SongRequestStatus.Cancel && isSameDay(s.finishAt ?? 0, Date.now()))
    .length
})

const waitingCount = computed(() => {
  return songRequest.activeSongs.filter((s) => s.status === SongRequestStatus.Waiting).length
})

// 当前的排序顺序
const currentIsReverse = computed(() =>
  songRequest.configCanEdit ? accountInfo.value?.settings?.songRequest?.isReverse : songRequest.isReverse,
)

// 保存排序设置
async function updateSettings() {
  if (accountInfo.value?.id) {
    songRequest.isLoading = true
    await SaveSetting('SongRequest', accountInfo.value.settings.songRequest)
      .then((msg) => {
        if (msg) {
          useToast().add({ title: '已保存', color: 'success' })
          return true
        } else {
          useToast().add({ title: `保存失败: ${msg}`, color: 'error' })
        }
      })
      .finally(() => {
        songRequest.isLoading = false
      })
  } else {
    useToast().add({ title: '完成', color: 'success' })
  }
}
</script>

<template>
  <div
    vertical
    :size="12"
  >
    <UCard
      size="small"
      :bordered="false"
      content-style="padding: 0;"
    >
      <div
        justify="space-between"
        align="center"
      >
        <!-- 左侧统计 -->
        <div
          align="center"
          :size="16"
        >
          <UBadge
            type="success"
            round
            :bordered="false"
          >
            <template #leading>
              <UIcon name="i-lucide-circle" />
            </template>
            队列: {{ waitingCount }}
          </UBadge>
          <UBadge
            type="info"
            round
            :bordered="false"
          >
            <template #leading>
              <UIcon name="i-lucide-circle" />
            </template>
            今日已点: {{ todayFinishedCount }}
          </UBadge>
          <span
            depth="3"
            style="font-size: 12px"
          >
            共 {{ songRequest.activeSongs.length }} 首
          </span>
        </div>

        <!-- 右侧操作 -->
        <div align="center">
          <div size="small">
            <UInput
              :value="songRequest.newSongName"
              placeholder="手动添加歌曲"
              style="width: 150px"
              @update:value="songRequest.newSongName = $event"
            />
            <UButton
              color="primary"
              ghost
              @click="songRequest.addSongManual()"
            >
              添加
            </UButton>
          </div>

          <URadioGroup
            v-model="accountInfo.settings.songRequest.sortType"
            :disabled="!songRequest.configCanEdit"
            :items="[
              { label: '时间', value: QueueSortType.TimeFirst },
              { label: '付费', value: QueueSortType.PaymentFist },
              { label: '舰长', value: QueueSortType.GuardFirst },
              { label: '粉丝牌', value: QueueSortType.FansMedalFirst },
            ]"
            orientation="horizontal"
            @update:model-value="updateSettings"
          />

          <UCheckbox
            :model-value="currentIsReverse"
            size="small"
            @update:model-value="
              (value) => {
                if (songRequest.configCanEdit) {
                  accountInfo.settings.songRequest.isReverse = value === true
                  updateSettings()
                } else {
                  songRequest.isReverse = value === true
                }
              }
            "
          >
            倒序
          </UCheckbox>

          <UPopover>
            <UButton
              color="error"
              size="sm"
              ghost
            >
              全部取消
            </UButton>
            <template #content="{ close }">
              <div class="space-y-3 p-3">
                <div>确定全部取消吗?</div>
                <div class="flex justify-end gap-2">
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    @click="close"
                    >取消</UButton
                  >
                  <UButton
                    size="xs"
                    color="error"
                    @click="(close(), songRequest.deactiveAllSongs())"
                    >确认</UButton
                  >
                </div>
              </div>
            </template>
          </UPopover>
        </div>
      </div>
    </UCard>

    <div
      v-if="songRequest.activeSongs.length > 0"
      class="song-list-container"
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
    <UEmpty
      v-else
      description="暂无点播内容"
      style="margin-top: 40px"
    />
  </div>
</template>

<style scoped>
.song-list-container {
  margin-top: 10px;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.song-item-wrapper {
  min-width: 0;
}
</style>
