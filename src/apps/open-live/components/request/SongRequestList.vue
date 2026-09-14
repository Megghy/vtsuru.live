<script setup lang="ts">
import { Checkmark12Regular, PeopleQueue24Filled } from '@vicons/fluent'
import { isSameDay } from 'date-fns'
import {
  NButton,
  NCard,
  NCheckbox,
  NEmpty,
  NIcon,
  NInput,
  NInputGroup,
  NPopconfirm,
  NRadioButton,
  NRadioGroup,
  NFlex,
  NTag,
} from 'naive-ui'
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
  <NFlex
    vertical
    :size="12"
  >
    <NCard
      size="small"
      bordered
      content-style="padding: 10px 14px;"
    >
      <NFlex
        justify="space-between"
        align="center"
        wrap
        :size="[12, 10]"
      >
        <!-- 左侧统计指示 -->
        <NFlex
          align="center"
          :size="10"
        >
          <NTag
            type="info"
            round
            :bordered="false"
            size="small"
          >
            <template #icon>
              <NIcon :component="PeopleQueue24Filled" />
            </template>
            待唱: {{ waitingCount }}
          </NTag>
          <NTag
            type="success"
            round
            :bordered="false"
            size="small"
          >
            <template #icon>
              <NIcon :component="Checkmark12Regular" />
            </template>
            今日已点: {{ todayFinishedCount }}
          </NTag>
          <NText
            depth="3"
            style="font-size: 12px; margin-left: 4px;"
          >
            共 {{ songRequest.activeSongs.length }} 首
          </NText>
        </NFlex>

        <!-- 右侧操作与过滤 -->
        <NFlex
          align="center"
          wrap
          :size="8"
        >
          <NInputGroup style="width: 220px">
            <NInput
              :value="songRequest.newSongName"
              placeholder="手动输入歌曲名"
              size="small"
              clearable
              @update:value="songRequest.newSongName = $event"
              @keyup.enter="songRequest.addSongManual()"
            />
            <NButton
              type="primary"
              size="small"
              @click="songRequest.addSongManual()"
            >
              添加
            </NButton>
          </NInputGroup>

          <NRadioGroup
            v-model:value="accountInfo.settings.songRequest.sortType"
            :disabled="!songRequest.configCanEdit"
            size="small"
            @update:value="updateSettings"
          >
            <NRadioButton :value="QueueSortType.TimeFirst"> 时间 </NRadioButton>
            <NRadioButton :value="QueueSortType.PaymentFist"> 付费 </NRadioButton>
            <NRadioButton :value="QueueSortType.GuardFirst"> 舰长 </NRadioButton>
            <NRadioButton :value="QueueSortType.FansMedalFirst"> 粉丝牌 </NRadioButton>
          </NRadioGroup>

          <NCheckbox
            :checked="currentIsReverse"
            size="small"
            @update:checked="
              (value) => {
                if (songRequest.configCanEdit) {
                  accountInfo.settings.songRequest.isReverse = value
                  updateSettings()
                } else {
                  songRequest.isReverse = value
                }
              }
            "
          >
            倒序
          </NCheckbox>

          <NPopconfirm @positive-click="songRequest.deactiveAllSongs()">
            <template #trigger>
              <NButton
                type="error"
                size="small"
                secondary
              >
                全部取消
              </NButton>
            </template>
            确定要取消全部待唱歌曲吗?
          </NPopconfirm>
        </NFlex>
      </NFlex>
    </NCard>

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
    <NEmpty
      v-else
      description="暂无点播内容"
      style="margin-top: 40px"
    />
  </NFlex>
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
