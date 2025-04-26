<script setup lang="ts">
import { computed, inject } from 'vue'
import {
  Checkmark12Regular,
  Dismiss16Filled,
  Mic24Filled,
  Play24Filled,
  PresenceBlocked16Regular,
} from '@vicons/fluent'
import {
  NSpace,
  NText,
  NTag,
  NTime,
  NTooltip,
  NButton,
  NIcon,
  NCard,
  NPopconfirm
} from 'naive-ui'
import { SongRequestInfo, SongRequestStatus, SongsInfo, SongRequestFrom } from '@/api/api-models'
import { useLiveRequest } from '@/composables/useLiveRequest'

const props = defineProps<{
  song: SongRequestInfo
  isLoading: boolean
  isLrcLoading: string
  updateKey: number
  hasOtherSingSong?: boolean
}>()

// 使用useLiveRequest
const songRequest = useLiveRequest()

const isActiveSong = computed(() => props.song.status <= SongRequestStatus.Singing)
const isSingingStatus = computed(() => props.song.status === SongRequestStatus.Singing)
const hasSong = computed(() => !!props.song.song?.url)

const canStartSinging = computed(() => {
  return props.song.status === SongRequestStatus.Waiting
})

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

function getSCColor(price: number): string {
  if (price === 0) return `#2a60b2`
  if (price > 0 && price < 30) return `#2a60b2`
  if (price >= 30 && price < 50) return `#2a60b2`
  if (price >= 50 && price < 100) return `#427d9e`
  if (price >= 100 && price < 500) return `#c99801`
  if (price >= 500 && price < 1000) return `#e09443`
  if (price >= 1000 && price < 2000) return `#e54d4d`
  if (price >= 2000) return `#ab1a32`
  return ''
}

function getGuardColor(level: number | null | undefined): string {
  if (level) {
    switch (level) {
      case 1: return 'rgb(122, 4, 35)'
      case 2: return 'rgb(157, 155, 255)'
      case 3: return 'rgb(104, 136, 241)'
    }
  }
  return ''
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
    content-style="padding: 5px;"
    :style="`${isSingingStatus ? 'animation: animated-border 2.5s infinite;' : ''};height: 100%;`"
  >
    <NSpace
      justify="space-between"
      align="center"
      style="height: 100%; margin: 0 5px 0 5px"
    >
      <NSpace align="center">
        <div
          :style="`border-radius: 4px; background-color: ${isSingingStatus ? '#75c37f' : '#577fb8'}; width: 10px; height: 20px`"
        />
        <NText
          strong
          style="font-size: 18px"
        >
          {{ song.songName }}
        </NText>
        <template v-if="song.from == SongRequestFrom.Manual">
          <!-- Manual -->
          <NTag
            size="small"
            :bordered="false"
          >
            手动添加
          </NTag>
        </template>
        <template v-else>
          <NTooltip>
            <template #trigger>
              <NTag
                size="small"
                :bordered="false"
                type="info"
              >
                <NText
                  italic
                  depth="3"
                >
                  {{ song.user?.name || '未知用户' }}
                </NText>
              </NTag>
            </template>
            {{ song.user?.uid || '未知ID' }}
          </NTooltip>
        </template>
        <NSpace
          v-if="
            (song.from == SongRequestFrom.Danmaku || song.from == SongRequestFrom.SC) &&
              song.user?.fans_medal_wearing_status
          "
        >
          <NTag
            size="tiny"
            round
          >
            <NTag
              size="tiny"
              round
              :bordered="false"
            >
              <NText depth="3">
                {{ song.user?.fans_medal_level }}
              </NText>
            </NTag>
            <span style="color: #577fb8">
              {{ song.user?.fans_medal_name }}
            </span>
          </NTag>
        </NSpace>
        <NTag
          v-if="(song.user?.guard_level ?? 0) > 0"
          size="small"
          :bordered="false"
          :color="{ textColor: 'white', color: songRequest.getGuardColor(song.user?.guard_level) }"
        >
          {{ song.user?.guard_level == 1 ? '总督' : song.user?.guard_level == 2 ? '提督' : '舰长' }}
        </NTag>
        <NTag
          v-if="song.from == SongRequestFrom.SC"
          size="small"
          :color="{ textColor: 'white', color: songRequest.getSCColor(song.price ?? 0) }"
        >
          SC{{ song.price ? ` | ${song.price}` : '' }}
        </NTag>
        <NTag
          v-if="song.from == SongRequestFrom.Gift"
          size="small"
          :color="{ textColor: 'white', color: songRequest.getSCColor(song.price ?? 0) }"
        >
          礼物{{ song.price ? ` | ${song.price}` : '' }}
        </NTag>
        <NTooltip>
          <template #trigger>
            <NText style="font-size: small">
              <NTime
                :key="updateKey"
                :time="song.createAt"
                type="relative"
              />
            </NText>
          </template>
          <NTime :time="song.createAt" />
        </NTooltip>
      </NSpace>
      <NSpace
        justify="end"
        align="center"
      >
        <NTooltip v-if="hasSong">
          <template #trigger>
            <NButton
              circle
              type="success"
              style="height: 30px; width: 30px"
              :loading="isLrcLoading == song?.song?.key"
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
              type="primary"
              style="height: 30px; width: 30px"
              :disabled="hasOtherSingSong"
              :style="`animation: ${song.status == SongRequestStatus.Waiting ? '' : 'loading 5s linear infinite'}`"
              :secondary="song.status == SongRequestStatus.Singing"
              :loading="isLoading"
              @click="
                onUpdateStatus(
                  song.status == SongRequestStatus.Singing
                    ? SongRequestStatus.Waiting
                    : SongRequestStatus.Singing,
                )
              "
            >
              <template #icon>
                <NIcon :component="Mic24Filled" />
              </template>
            </NButton>
          </template>
          {{
            hasOtherSingSong
              ? '还有其他正在演唱的歌曲'
              : song.status == SongRequestStatus.Waiting && song.id
                ? '开始演唱'
                : '停止演唱'
          }}
        </NTooltip>
        <NTooltip>
          <template #trigger>
            <NButton
              circle
              type="primary"
              style="height: 30px; width: 30px"
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
        <NPopconfirm
          @positive-click="onUpdateStatus(SongRequestStatus.Cancel)"
        >
          <template #trigger>
            <NButton
              circle
              type="error"
              style="height: 30px; width: 30px"
              :loading="isLoading"
            >
              <template #icon>
                <NIcon :component="Dismiss16Filled" />
              </template>
            </NButton>
          </template>
          是否取消处理?
        </NPopconfirm>
        <NPopconfirm
          v-if="
            song.from == SongRequestFrom.Danmaku &&
              song.user?.uid &&
              song.status !== SongRequestStatus.Cancel
          "
          @positive-click="onBlockUser"
        >
          <template #trigger>
            <NButton
              circle
              type="error"
              style="height: 30px; width: 30px"
              :loading="isLoading"
            >
              <template #icon>
                <NIcon :component="PresenceBlocked16Regular" />
              </template>
            </NButton>
          </template>
          是否拉黑此用户?
        </NPopconfirm>
      </NSpace>
    </NSpace>
  </NCard>
</template>