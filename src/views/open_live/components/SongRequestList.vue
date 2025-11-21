<script setup lang="ts">
import { Checkmark12Regular, PeopleQueue24Filled } from '@vicons/fluent'
import { isSameDay } from 'date-fns'
import { NButton, NCard, NCheckbox, NDivider, NEmpty, NIcon, NInput, NInputGroup, NList, NListItem, NPopconfirm, NRadioButton, NRadioGroup, NSpace, NTag } from 'naive-ui'
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
  return songRequest.songs.filter(s => s.status != SongRequestStatus.Cancel
    && isSameDay(s.finishAt ?? 0, Date.now())).length
})

const waitingCount = computed(() => {
  return songRequest.activeSongs.filter(s => s.status === SongRequestStatus.Waiting).length
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
          window.$message.success('已保存')
          return true
        } else {
          window.$message.error(`保存失败: ${msg}`)
        }
      })
      .finally(() => {
        songRequest.isLoading = false
      })
  } else {
    window.$message.success('完成')
  }
}
</script>

<template>
  <NSpace vertical :size="12">
    <NCard size="small" :bordered="false" content-style="padding: 0;">
      <NSpace justify="space-between" align="center">
        <!-- 左侧统计 -->
        <NSpace align="center" :size="16">
          <NTag type="success" round :bordered="false">
            <template #icon>
              <NIcon :component="PeopleQueue24Filled" />
            </template>
            队列: {{ waitingCount }}
          </NTag>
          <NTag type="info" round :bordered="false">
            <template #icon>
              <NIcon :component="Checkmark12Regular" />
            </template>
            今日已点: {{ todayFinishedCount }}
          </NTag>
          <NText depth="3" style="font-size: 12px">
            共 {{ songRequest.activeSongs.length }} 首
          </NText>
        </NSpace>

        <!-- 右侧操作 -->
        <NSpace align="center">
          <NInputGroup size="small">
            <NInput
              :value="songRequest.newSongName"
              placeholder="手动添加歌曲"
              @update:value="songRequest.newSongName = $event"
              style="width: 150px"
            />
            <NButton type="primary" ghost @click="songRequest.addSongManual()">
              添加
            </NButton>
          </NInputGroup>

          <NRadioGroup
            v-model:value="accountInfo.settings.songRequest.sortType"
            :disabled="!songRequest.configCanEdit"
            size="small"
            @update:value="updateSettings"
          >
            <NRadioButton :value="QueueSortType.TimeFirst">时间</NRadioButton>
            <NRadioButton :value="QueueSortType.PaymentFist">付费</NRadioButton>
            <NRadioButton :value="QueueSortType.GuardFirst">舰长</NRadioButton>
            <NRadioButton :value="QueueSortType.FansMedalFirst">粉丝牌</NRadioButton>
          </NRadioGroup>

          <NCheckbox
            :checked="currentIsReverse"
            size="small"
            @update:checked="value => {
              if (songRequest.configCanEdit) {
                accountInfo.settings.songRequest.isReverse = value
                updateSettings()
              } else {
                songRequest.isReverse = value
              }
            }"
          >
            倒序
          </NCheckbox>

          <NPopconfirm @positive-click="songRequest.deactiveAllSongs()">
            <template #trigger>
              <NButton type="error" size="small" ghost>
                全部取消
              </NButton>
            </template>
            确定全部取消吗?
          </NPopconfirm>
        </NSpace>
      </NSpace>
    </NCard>

    <div v-if="songRequest.activeSongs.length > 0" class="song-list-container">
      <TransitionGroup name="list">
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
        <NDivider style="margin: 0" />
        </div>
      </TransitionGroup>
    </div>
    <NEmpty
      v-else
      description="暂无点播内容"
      style="margin-top: 40px"
    />
  </NSpace>
</template>

<style scoped>
.song-list-container {
  margin-top: 10px;
  position: relative;
}

.song-item-wrapper {
  transition: all 0.3s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

.list-leave-active {
  position: absolute;
  width: 100%;
}
</style>
