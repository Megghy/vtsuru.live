<script setup lang="ts">
import { ChevronDown, ChevronUp, MusicalNote, Pause, Play, PlayBack, PlayForward, TrashBin, VolumeHigh } from '@vicons/ionicons5'
import { useElementSize, useStorage } from '@vueuse/core'
import {
  NButton, NCard, NFlex, NIcon, NLayoutFooter, NSlider, NTag, NText, NTooltip, useMessage, useThemeVars } from 'naive-ui';
import { computed, ref, watch } from 'vue'
// @ts-ignore
import APlayer from 'vue3-aplayer'
import { useMusicRequestProvider } from '@/store/useMusicRequest'

const emit = defineEmits<{
  (e: 'heightChange', height: number): void
}>()

const message = useMessage()
const themeVars = useThemeVars()
const musicRquestStore = useMusicRequestProvider()

const musicPlayerCardRef = ref<HTMLElement | null>(null)
const { height: musicPlayerCardHeight } = useElementSize(musicPlayerCardRef)

const isPlayerVisible = computed(
  () => musicRquestStore.originMusics.length > 0 || musicRquestStore.waitingMusics.length > 0,
)

const isPlayerMinimized = useStorage('Settings.MusicPlayer.Minimized', false)

const playerVolume = computed({
  get: () => musicRquestStore.settings.volume,
  set: value => musicRquestStore.settings.volume = value,
})

const aplayer = ref<any>()
watch(aplayer, () => {
  musicRquestStore.aplayerRef = aplayer.value
})

const currentPlayingInfo = computed(() => {
  if (musicRquestStore.currentOriginMusic && musicRquestStore.isPlayingOrderMusic) {
    return {
      type: 'request',
      info: `正在播放 ${musicRquestStore.currentOriginMusic.from.name} 点的歌`,
    } as const
  } else if (musicRquestStore.currentMusic && musicRquestStore.currentMusic.title) {
    return {
      type: 'normal',
      info: '正在播放背景音乐',
    } as const
  }
  return null
})

const footerHeight = computed(() => {
  if (!isPlayerVisible.value) return 0
  return musicPlayerCardHeight.value + 16
})

watch(
  footerHeight,
  (val) => emit('heightChange', val),
  { immediate: true },
)

function onNextMusic() {
  musicRquestStore.nextMusic()
}

function togglePlay() {
  if (!aplayer.value) return
  const audio = aplayer.value.audio
  if (audio.paused) aplayer.value.play()
  else aplayer.value.pause()
}

function onPreviousMusic() {
  if (!aplayer.value) return
  if (aplayer.value.audio.currentTime > 3) {
    aplayer.value.audio.currentTime = 0
    return
  }
  const currentIndex = musicRquestStore.aplayerMusics.findIndex(
    music => music.id === musicRquestStore.currentMusic.id,
  )
  if (currentIndex > 0) {
    musicRquestStore.currentMusic = musicRquestStore.aplayerMusics[currentIndex - 1]
    aplayer.value.thenPlay()
  }
}

function clearWaitingQueue() {
  musicRquestStore.waitingMusics.splice(0)
  message.success('已清空等待队列')
}

function togglePlayerMinimize() {
  isPlayerMinimized.value = !isPlayerMinimized.value
}
</script>

<template>
  <NLayoutFooter
    v-if="isPlayerVisible"
    :style="`height: ${footerHeight}px; overflow: hidden; transition: height 0.3s cubic-bezier(0.4, 0, 0.2, 1);`"
    class="music-player-footer"
  >
    <NCard
      ref="musicPlayerCardRef"
      :bordered="false"
      embedded
      :content-style="isPlayerMinimized ? 'padding: 0' : undefined"
      size="small"
      class="music-player-card"
      style="
        margin: 8px;
      "
    >
      <template #header>
        <NFlex justify="space-between" align="center" style="padding: 0;">
          <NFlex align="center" size="small">
            <NIcon :component="MusicalNote" size="16" :style="{ color: themeVars.primaryColor }" />
            <NText :depth="2" style="font-size: 13px; font-weight: 500;">
              音乐播放器
            </NText>
            <NTag
              v-if="currentPlayingInfo && !isPlayerMinimized"
              :type="currentPlayingInfo.type === 'request' ? 'success' : 'info'"
              size="small"
              round
              :bordered="false"
              style="font-size: 11px; padding: 2px 8px;"
            >
              {{ currentPlayingInfo.info }}
            </NTag>

            <template v-if="isPlayerMinimized">
              <NText
                v-if="musicRquestStore.currentMusic.title"
                style="font-size: 13px; max-width: 250px; margin-left: 12px"
                :ellipsis="{ tooltip: true }"
              >
                {{ musicRquestStore.currentMusic.title }} - {{ musicRquestStore.currentMusic.artist }}
              </NText>
              <NText v-else depth="3" style="font-size: 13px; margin-left: 12px">
                暂无播放
              </NText>
            </template>
          </NFlex>

          <NFlex align="center" size="small">
            <template v-if="isPlayerMinimized">
              <NTag
                v-if="musicRquestStore.waitingMusics.length > 0"
                type="warning"
                size="small"
                round
                :bordered="false"
              >
                {{ musicRquestStore.waitingMusics.length }}
              </NTag>

              <NButton
                circle
                size="tiny"
                tertiary
                :disabled="musicRquestStore.aplayerMusics.length === 0"
                @click.stop="togglePlay"
              >
                <template #icon>
                  <NIcon :component="aplayer?.audio?.paused !== false ? Play : Pause" size="14" />
                </template>
              </NButton>

              <NButton
                circle
                size="tiny"
                tertiary
                :disabled="musicRquestStore.waitingMusics.length === 0 && musicRquestStore.aplayerMusics.length <= 1"
                @click.stop="onNextMusic"
              >
                <template #icon>
                  <NIcon :component="PlayForward" size="14" />
                </template>
              </NButton>
            </template>

            <NTooltip>
              <template #trigger>
                <NButton
                  :type="isPlayerMinimized ? 'primary' : 'default'"
                  tertiary
                  size="small"
                  circle
                  @click="togglePlayerMinimize"
                >
                  <template #icon>
                    <NIcon :component="isPlayerMinimized ? ChevronUp : ChevronDown" />
                  </template>
                </NButton>
              </template>
              {{ isPlayerMinimized ? '展开播放器' : '收起播放器' }}
            </NTooltip>
          </NFlex>
        </NFlex>
      </template>

      <div v-show="!isPlayerMinimized">
        <NFlex align="center" :wrap="false" style="gap: 12px;">
          <div style="flex: 1; min-width: 280px;">
            <APlayer
              ref="aplayer"
              v-model:music="musicRquestStore.currentMusic"
              v-model:volume="playerVolume"
              v-model:shuffle="musicRquestStore.settings.shuffle"
              v-model:repeat="musicRquestStore.settings.repeat"
              :list="musicRquestStore.aplayerMusics"
              list-max-height="200"
              mutex
              list-folded
              :style="{ borderRadius: themeVars.borderRadius }"
              @ended="musicRquestStore.onMusicEnd"
              @play="musicRquestStore.onMusicPlay"
            />
          </div>

          <div class="music-control-panel">
            <NFlex vertical size="small" align="center" style="min-width: 100px;">
              <NText depth="3" style="font-size: 12px; margin-bottom: 4px;">
                播放控制
              </NText>
              <NFlex size="small" justify="center">
                <NTooltip>
                  <template #trigger>
                    <NButton
                      circle
                      secondary
                      size="small"
                      :disabled="musicRquestStore.aplayerMusics.length === 0"
                      @click="onPreviousMusic"
                    >
                      <template #icon>
                        <NIcon :component="PlayBack" />
                      </template>
                    </NButton>
                  </template>
                  上一首 / 重播
                </NTooltip>

                <NTooltip>
                  <template #trigger>
                    <NButton
                      circle
                      type="primary"
                      size="small"
                      :disabled="musicRquestStore.aplayerMusics.length === 0"
                      @click="togglePlay"
                    >
                      <template #icon>
                        <NIcon :component="aplayer?.audio?.paused !== false ? Play : Pause" />
                      </template>
                    </NButton>
                  </template>
                  {{ aplayer?.audio?.paused !== false ? '播放' : '暂停' }}
                </NTooltip>

                <NTooltip>
                  <template #trigger>
                    <NButton
                      circle
                      secondary
                      size="small"
                      :disabled="musicRquestStore.waitingMusics.length === 0 && musicRquestStore.aplayerMusics.length <= 1"
                      @click="onNextMusic"
                    >
                      <template #icon>
                        <NIcon :component="PlayForward" />
                      </template>
                    </NButton>
                  </template>
                  下一首
                </NTooltip>
              </NFlex>
            </NFlex>

            <NFlex vertical size="small" align="center" style="min-width: 100px;">
              <NText depth="3" style="font-size: 12px; margin-bottom: 4px;">
                队列管理
              </NText>
              <NFlex vertical size="small" align="center">
                <NTag
                  :bordered="false"
                  :type="musicRquestStore.waitingMusics.length > 0 ? 'warning' : 'info'"
                  size="small"
                  round
                  style="min-width: 80px; text-align: center;"
                >
                  等待: {{ musicRquestStore.waitingMusics.length }}
                </NTag>

                <NTag
                  :bordered="false"
                  type="success"
                  size="small"
                  round
                  style="min-width: 80px; text-align: center;"
                >
                  歌单: {{ musicRquestStore.originMusics.length }}
                </NTag>

                <NTooltip v-if="musicRquestStore.waitingMusics.length > 0">
                  <template #trigger>
                    <NButton size="tiny" type="error" secondary @click="clearWaitingQueue">
                      <template #icon>
                        <NIcon :component="TrashBin" size="12" />
                      </template>
                      清空队列
                    </NButton>
                  </template>
                  清空所有等待中的点歌
                </NTooltip>
              </NFlex>
            </NFlex>

            <NFlex vertical size="small" align="center" style="min-width: 100px;">
              <NFlex align="center" size="small">
                <NIcon :component="VolumeHigh" size="14" :depth="3" />
                <NText depth="3" style="font-size: 12px;">
                  音量
                </NText>
              </NFlex>
              <NSlider
                v-model:value="playerVolume"
                :min="0"
                :max="1"
                :step="0.01"
                style="width: 80px;"
                :tooltip="false"
                size="small"
              />
              <NText depth="3" style="font-size: 11px;">
                {{ Math.round(playerVolume * 100) }}%
              </NText>
            </NFlex>
          </div>
        </NFlex>
      </div>
    </NCard>
  </NLayoutFooter>
</template>

<style scoped>
.music-control-panel {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  flex-wrap: wrap;
  min-width: 300px;
}

@media (max-width: 768px) {
  .music-control-panel {
    min-width: auto;
    flex-direction: row;
    justify-content: space-around;
    align-items: center;
    gap: 8px;
    width: 100%;
  }

  .music-control-panel>div {
    min-width: auto !important;
    flex: 1;
  }
}

@media (max-width: 480px) {
  .music-player-card {
    margin: 4px !important;
  }

  .music-control-panel {
    flex-direction: column;
    align-items: center;
    gap: 6px;
    width: 100%;
  }

  .music-control-panel>div {
    width: 100% !important;
    min-width: auto !important;
  }
}
</style>
