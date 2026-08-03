<script setup lang="ts">
import type { CSSProperties } from 'vue'
import { computed, inject } from 'vue'

import type { SongRequestInfo } from '@/api/api-models'
import { SongRequestFrom, SongRequestStatus } from '@/api/api-models'
import UserBadges from '@/apps/open-live/components/UserBadges.vue'
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
const cardThemeOverrides = { color: 'var(--vtsuru-bg-muted)' }

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
      return { ...style, backgroundColor: 'var(--vtsuru-success)' }
    case SongRequestStatus.Waiting:
      return { ...style, backgroundColor: 'var(--vtsuru-info)' }
    case SongRequestStatus.Finish:
      return {
        ...style,
        backgroundColor: 'var(--vtsuru-bg-inset)',
        color: 'var(--vtsuru-fg)',
        border: '1px solid var(--vtsuru-border)',
      }
    case SongRequestStatus.Cancel:
      return { ...style, backgroundColor: 'var(--vtsuru-error)' }
    default:
      return { ...style, backgroundColor: 'var(--vtsuru-info)' }
  }
}

// 获取父组件中的活跃歌曲
const activeSongs = inject<SongRequestInfo[]>('activeSongs', [])

// 判断是否有其他正在演唱的歌曲
const hasOtherSingSong = computed(() => {
  return (
    activeSongs.findIndex((s: SongRequestInfo) => s.id != props.song.id && s.status == SongRequestStatus.Singing) > -1
  )
})
</script>

<template>
  <UCard
    size="small"
    :theme-overrides="cardThemeOverrides"
    content-style="padding: 8px 12px;"
    bordered
    :style="isSingingStatus ? 'border-left: 4px solid var(--vtsuru-success);' : undefined"
  >
    <div
      justify="space-between"
      align="center"
      :wrap="false"
    >
      <!-- 左侧信息 -->
      <div
        align="center"
        :size="8"
        :wrap="false"
      >
        <!-- 序号 -->
        <span :style="getIndexStyle(song.status)">
          {{ index }}
        </span>

        <!-- 歌曲名称 -->
        <span
          strong
          style="font-size: 16px"
        >
          {{ song.songName }}
        </span>

        <!-- 用户信息 -->
        <template v-if="song.from === SongRequestFrom.Manual">
          <UBadge
            size="tiny"
            :bordered="false"
          >
            手动添加
          </UBadge>
        </template>
        <template v-else>
          <UTooltip>
            <UBadge
              size="tiny"
              :bordered="false"
              type="info"
              round
            >
              {{ song.user?.name || '未知用户' }}
            </UBadge>
            <template #content> UID: {{ song.user?.uid || '未知' }} </template>
          </UTooltip>
        </template>

        <!-- 用户粉丝牌 / 舰长 -->
        <UserBadges
          v-if="song.from === SongRequestFrom.Danmaku || song.from === SongRequestFrom.SC"
          :user="song.user"
          size="tiny"
        />

        <!-- SC/礼物 -->
        <UBadge
          v-if="song.from === SongRequestFrom.SC"
          size="tiny"
          color="neutral"
          :style="{ backgroundColor: songRequest.getSCColor(song.price ?? 0), color: 'white' }"
        >
          SC{{ song.price ? ` | ${song.price}` : '' }}
        </UBadge>
        <UBadge
          v-if="song.from === SongRequestFrom.Gift"
          size="tiny"
          color="neutral"
          :style="{ backgroundColor: songRequest.getSCColor(song.price ?? 0), color: 'white' }"
        >
          礼物{{ song.price ? ` | ${song.price}` : '' }}
        </UBadge>

        <!-- 时间 -->
        <UTooltip>
          <span
            depth="3"
            style="font-size: 12px"
          >
            <time
              :key="updateKey"
              :time="song.createAt"
              type="relative"
            />
          </span>
          <template #content>
            <time :time="song.createAt" />
          </template>
        </UTooltip>
      </div>

      <!-- 右侧操作按钮 -->
      <div
        justify="end"
        align="center"
        :size="6"
        :wrap="false"
      >
        <UTooltip v-if="hasSong">
          <UButton
            square
            size="small"
            color="success"
            ghost
            :loading="isLrcLoading === song?.song?.key"
            @click="onSelectSong"
          >
            <template #leading>
              <UIcon name="i-lucide-circle" />
            </template>
          </UButton>
          <template #content> 试听 </template>
        </UTooltip>

        <UTooltip>
          <UButton
            square
            size="small"
            :color="song.status === SongRequestStatus.Singing ? 'warning' : 'primary'"
            :ghost="song.status === SongRequestStatus.Singing"
            :disabled="hasOtherSingSong"
            :loading="isLoading"
            @click="
              onUpdateStatus(
                song.status === SongRequestStatus.Singing ? SongRequestStatus.Waiting : SongRequestStatus.Singing,
              )
            "
          >
            <template #leading>
              <UIcon name="i-lucide-circle" />
            </template>
          </UButton>
          <template #content>
            {{
              hasOtherSingSong
                ? '还有其他正在演唱'
                : song.status === SongRequestStatus.Waiting
                  ? '开始演唱'
                  : '暂停演唱'
            }}
          </template>
        </UTooltip>

        <UTooltip>
          <UButton
            square
            size="small"
            color="success"
            :loading="isLoading"
            @click="onUpdateStatus(SongRequestStatus.Finish)"
          >
            <template #leading>
              <UIcon name="i-lucide-circle" />
            </template>
          </UButton>
          <template #content> 完成 </template>
        </UTooltip>

        <UTooltip>
          <UPopover>
            <UButton
              circle
              size="sm"
              color="error"
              :loading="isLoading"
            >
              <template #leading>
                <UIcon name="i-lucide-circle" />
              </template>
            </UButton>
            <template #content="{ close }">
              <div class="space-y-3 p-3">
                <div>确定取消?</div>
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
                    @click="(close(), onUpdateStatus(SongRequestStatus.Cancel))"
                    >确认</UButton
                  >
                </div>
              </div>
            </template>
          </UPopover>
          <template #content> 取消 </template>
        </UTooltip>

        <UTooltip v-if="song.from === SongRequestFrom.Danmaku && song.user?.uid">
          <UPopover>
            <UButton
              circle
              size="sm"
              color="error"
              ghost
              :loading="isLoading"
            >
              <template #leading>
                <UIcon name="i-lucide-circle" />
              </template>
            </UButton>
            <template #content="{ close }">
              <div class="space-y-3 p-3">
                <div>确定拉黑此用户?</div>
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
                    @click="(close(), onBlockUser)"
                    >确认</UButton
                  >
                </div>
              </div>
            </template>
          </UPopover>
          <template #content> 拉黑 </template>
        </UTooltip>
      </div>
    </div>
  </UCard>
</template>
