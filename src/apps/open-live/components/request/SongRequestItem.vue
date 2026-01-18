<script setup lang="ts">
import type { CSSProperties } from 'vue'
import type { SongRequestInfo } from '@/api/api-models'
import { Checkmark12Regular, Dismiss16Filled, Mic24Filled, Play24Filled, PresenceBlocked16Regular, } from '@vicons/fluent'
import {
  NButton, NCard, NIcon, NPopconfirm, NFlex, NTag, NText, NTime, NTooltip } from 'naive-ui';
import { computed, inject } from 'vue'
import { SongRequestFrom, SongRequestStatus } from '@/api/api-models'
import { useLiveRequest } from '@/composables/useLiveRequest'

const props = defineProps<{
  song: SongRequestInfo
  index: number
  isLoading: boolean
  isLrcLoading: string
  updateKey: number
  hasOtherSingSong?: boolean
}>()

// 使用useLiveRequest
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
    minWidth: '24px', // 防止压缩
    height: '24px',
    borderRadius: '50%',
    color: '#fff',
    fontSize: '13px',
    marginRight: '8px',
    flexShrink: 0, // 防止压缩
  }

  switch (status) {
    case SongRequestStatus.Singing:
      return { ...style, backgroundColor: 'var(--n-success-color)' }
    case SongRequestStatus.Waiting:
      return { ...style, backgroundColor: 'var(--n-info-color)' }
    case SongRequestStatus.Finish:
      return {
        ...style,
        backgroundColor: 'var(--n-color-embedded)',
        color: 'var(--n-text-color)',
        border: '1px solid var(--n-border-color)',
      }
    case SongRequestStatus.Cancel:
      return { ...style, backgroundColor: 'var(--n-error-color)' }
    default:
      return { ...style, backgroundColor: 'var(--n-info-color)' }
  }
}

// 获取父组件中的活跃歌曲
const activeSongs = inject<SongRequestInfo[]>('activeSongs', [])

// 判断是否有其他正在演唱的歌曲
const hasOtherSingSong = computed(() => {
  return activeSongs.findIndex((s: SongRequestInfo) => s.id != props.song.id && s.status == SongRequestStatus.Singing) > -1
})
</script>

<template>
  <NCard
    embedded
    size="small"
    content-style="padding: 8px 12px;"
    :bordered="isSingingStatus"
    :style="isSingingStatus ? 'border-left: 4px solid var(--n-success-color);' : 'border-left: 4px solid transparent;'"
  >
    <NFlex justify="space-between" align="center" :wrap="false">
      <!-- 左侧信息 -->
      <NFlex align="center" :size="8" :wrap="false">
        <!-- 序号 -->
        <span :style="getIndexStyle(song.status)">
          {{ index }}
        </span>

        <!-- 歌曲名称 -->
        <NText strong style="font-size: 16px">
          {{ song.songName }}
        </NText>

        <!-- 用户信息 -->
        <template v-if="song.from === SongRequestFrom.Manual">
          <NTag size="tiny" :bordered="false">
            手动添加
          </NTag>
        </template>
        <template v-else>
          <NTooltip>
            <template #trigger>
              <NTag size="tiny" :bordered="false" type="info" round>
                {{ song.user?.name || '未知用户' }}
              </NTag>
            </template>
            UID: {{ song.user?.uid || '未知' }}
          </NTooltip>
        </template>

        <!-- 粉丝牌 -->
        <NTag
          v-if="(song.from === SongRequestFrom.Danmaku || song.from === SongRequestFrom.SC) && song.user?.fans_medal_wearing_status"
          size="tiny"
          round
          :bordered="false"
          style="padding: 0 6px 0 0;"
        >
          <NTag size="tiny" round :bordered="false" type="info" style="margin-right: 4px;">
            {{ song.user?.fans_medal_level }}
          </NTag>
          <span style="color: var(--n-info-color)">{{ song.user?.fans_medal_name }}</span>
        </NTag>

        <!-- 舰长 -->
        <NTag
          v-if="(song.user?.guard_level ?? 0) > 0"
          size="tiny"
          :bordered="false"
          :color="{ textColor: 'white', color: songRequest.getGuardColor(song.user?.guard_level) }"
        >
          {{ song.user?.guard_level === 1 ? '总督' : song.user?.guard_level === 2 ? '提督' : '舰长' }}
        </NTag>

        <!-- SC/礼物 -->
        <NTag
          v-if="song.from === SongRequestFrom.SC"
          size="tiny"
          :color="{ textColor: 'white', color: songRequest.getSCColor(song.price ?? 0) }"
        >
          SC{{ song.price ? ` | ${song.price}` : '' }}
        </NTag>
        <NTag
          v-if="song.from === SongRequestFrom.Gift"
          size="tiny"
          :color="{ textColor: 'white', color: songRequest.getSCColor(song.price ?? 0) }"
        >
          礼物{{ song.price ? ` | ${song.price}` : '' }}
        </NTag>

        <!-- 时间 -->
        <NTooltip>
          <template #trigger>
            <NText depth="3" style="font-size: 12px">
              <NTime :key="updateKey" :time="song.createAt" type="relative" />
            </NText>
          </template>
          <NTime :time="song.createAt" />
        </NTooltip>
      </NFlex>

      <!-- 右侧操作按钮 -->
      <NFlex justify="end" align="center" :size="6" :wrap="false">
        <NTooltip v-if="hasSong">
          <template #trigger>
            <NButton
              circle
              size="small"
              type="success"
              ghost
              :loading="isLrcLoading === song?.song?.key"
              @click="onSelectSong"
            >
              <template #icon>
                <NIcon :component="Play24Filled" />
              </template>
            </NButton>
          </template>
          试听
        </NTooltip>

        <NTooltip>
          <template #trigger>
            <NButton
              circle
              size="small"
              :type="song.status === SongRequestStatus.Singing ? 'warning' : 'primary'"
              :ghost="song.status === SongRequestStatus.Singing"
              :disabled="hasOtherSingSong"
              :loading="isLoading"
              @click="onUpdateStatus(song.status === SongRequestStatus.Singing ? SongRequestStatus.Waiting : SongRequestStatus.Singing)"
            >
              <template #icon>
                <NIcon :component="Mic24Filled" />
              </template>
            </NButton>
          </template>
          {{ hasOtherSingSong ? '还有其他正在演唱' : (song.status === SongRequestStatus.Waiting ? '开始演唱' : '暂停演唱') }}
        </NTooltip>

        <NTooltip>
          <template #trigger>
            <NButton
              circle
              size="small"
              type="success"
              :loading="isLoading"
              @click="onUpdateStatus(SongRequestStatus.Finish)"
            >
              <template #icon>
                <NIcon :component="Checkmark12Regular" />
              </template>
            </NButton>
          </template>
          完成
        </NTooltip>

        <NTooltip>
          <template #trigger>
            <NPopconfirm @positive-click="onUpdateStatus(SongRequestStatus.Cancel)">
              <template #trigger>
                <NButton circle size="small" type="error" :loading="isLoading">
                  <template #icon>
                    <NIcon :component="Dismiss16Filled" />
                  </template>
                </NButton>
              </template>
              确定取消?
            </NPopconfirm>
          </template>
          取消
        </NTooltip>

        <NTooltip v-if="song.from === SongRequestFrom.Danmaku && song.user?.uid">
          <template #trigger>
            <NPopconfirm @positive-click="onBlockUser">
              <template #trigger>
                <NButton circle size="small" type="error" ghost :loading="isLoading">
                  <template #icon>
                    <NIcon :component="PresenceBlocked16Regular" />
                  </template>
                </NButton>
              </template>
              确定拉黑此用户?
            </NPopconfirm>
          </template>
          拉黑
        </NTooltip>
      </NFlex>
    </NFlex>
  </NCard>
</template>
