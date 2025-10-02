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
  <NCard size="small">
    <NSpace align="center">
      <NTag
        type="success"
        :bordered="false"
      >
        <template #icon>
          <NIcon :component="PeopleQueue24Filled" />
        </template>
        队列 | {{ waitingCount }}
      </NTag>
      <NTag
        type="success"
        :bordered="false"
      >
        <template #icon>
          <NIcon :component="Checkmark12Regular" />
        </template>
        今日已处理 | {{ todayFinishedCount }} 个
      </NTag>
      <NInputGroup>
        <NInput
          :value="songRequest.newSongName"
          placeholder="手动添加"
          @update:value="songRequest.newSongName = $event"
        />
        <NButton
          type="primary"
          @click="songRequest.addSongManual()"
        >
          添加
        </NButton>
      </NInputGroup>
      <NRadioGroup
        v-model:value="accountInfo.settings.songRequest.sortType"
        :disabled="!songRequest.configCanEdit"
        type="button"
        @update:value="value => {
          updateSettings()
        }"
      >
        <NRadioButton :value="QueueSortType.TimeFirst">
          加入时间优先
        </NRadioButton>
        <NRadioButton :value="QueueSortType.PaymentFist">
          付费价格优先
        </NRadioButton>
        <NRadioButton :value="QueueSortType.GuardFirst">
          舰长优先 (按等级)
        </NRadioButton>
        <NRadioButton :value="QueueSortType.FansMedalFirst">
          粉丝牌等级优先
        </NRadioButton>
      </NRadioGroup>
      <NCheckbox
        :checked="currentIsReverse"
        @update:checked="value => {
          if (songRequest.configCanEdit) {
            accountInfo.settings.songRequest.isReverse = value
            updateSettings()
          }
          else {
            songRequest.isReverse = value
          }
        }"
      >
        倒序
      </NCheckbox>
      <NPopconfirm @positive-click="songRequest.deactiveAllSongs()">
        <template #trigger>
          <NButton type="error">
            全部取消
          </NButton>
        </template>
        确定全部取消吗?
      </NPopconfirm>
    </NSpace>
  </NCard>
  <NDivider> 共 {{ songRequest.activeSongs.length }} 首 </NDivider>
  <NList
    v-if="songRequest.activeSongs.length > 0"
    :show-divider="false"
    hoverable
  >
    <NListItem
      v-for="song in songRequest.activeSongs"
      :key="song.id"
      style="padding: 5px"
    >
      <SongRequestItem
        :song="song"
        :is-loading="songRequest.isLoading"
        :is-lrc-loading="songRequest.isLrcLoading"
        :update-key="songRequest.updateKey"
      />
    </NListItem>
  </NList>
  <NEmpty
    v-else
    description="暂无曲目"
  />
</template>
