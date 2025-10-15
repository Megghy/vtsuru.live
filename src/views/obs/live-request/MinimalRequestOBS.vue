<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { NEmpty } from 'naive-ui'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { SongRequestFrom } from '@/api/api-models'
import { useLiveRequestData } from './useLiveRequestData'

const props = defineProps<{
  id?: number
  active?: boolean
  visible?: boolean
  speedMultiplier?: number
}>()

const route = useRoute()
const currentId = computed(() => {
  return props.id ?? route.query.id
})

const speedMultiplier = computed(() => {
  if (props.speedMultiplier !== undefined && props.speedMultiplier > 0) {
    return props.speedMultiplier
  }
  const speedParam = route.query.speed
  const speed = Number.parseFloat(speedParam?.toString() ?? '1')
  return isNaN(speed) || speed <= 0 ? 1 : speed
})

const {
  songs,
  settings,
  singing,
  activeSongs,
  allowGuardTypes,
  key,
  update,
  initRTC,
} = useLiveRequestData(currentId.value?.toString() ?? '')

const listContainerRef = ref()
const listInnerRef = ref<HTMLElement | null>(null)
const { height, width } = useElementSize(listContainerRef)
const { height: innerListHeight } = useElementSize(listInnerRef)
const itemMarginBottom = 6

const totalContentHeightWithLastMargin = computed(() => {
  const count = activeSongs.value.length
  if (count === 0 || innerListHeight.value <= 0) {
    return 0
  }
  return innerListHeight.value + itemMarginBottom
})

const isMoreThanContainer = computed(() => totalContentHeightWithLastMargin.value > height.value)

const animationTranslateY = computed(() => {
  if (!isMoreThanContainer.value || height.value <= 0) {
    return 0
  }
  return height.value - totalContentHeightWithLastMargin.value
})
const animationTranslateYCss = computed(() => `${animationTranslateY.value}px`)

const animationDuration = computed(() => {
  const baseDuration = activeSongs.value.length * 1
  const adjustedDuration = baseDuration / speedMultiplier.value
  return Math.max(adjustedDuration, 1)
})
const animationDurationCss = computed(() => `${animationDuration.value}s`)

onMounted(() => {
  update()
  initRTC()
  window.$mitt.on('onOBSComponentUpdate', () => {
    update()
  })
})

onUnmounted(() => {
  window.$mitt.off('onOBSComponentUpdate')
})
</script>

<template>
  <div
    class="minimal-container"
    v-bind="$attrs"
  >
    <div
      class="minimal-now"
      :class="{ playing: singing }"
    >
      <span
        class="minimal-indicator"
        :class="{ 'is-playing': !!singing }"
        aria-label="now-playing-indicator"
      />
      <div class="minimal-now-title">
        {{ singing ? singing.songName : '空闲' }}
      </div>
      <div
        v-if="singing && settings.showUserName"
        class="minimal-now-user"
      >
        <img
          v-if="singing.user?.face && singing.from !== SongRequestFrom.Manual"
          class="minimal-avatar"
          :src="singing.user.face"
          referrerpolicy="no-referrer"
        >
        <span class="minimal-user-name">{{ singing.from === SongRequestFrom.Manual ? '主播' : singing.user?.name }}</span>
      </div>
    </div>

    <div
      ref="listContainerRef"
      class="minimal-list-container"
    >
      <template v-if="activeSongs.length > 0">
        <div
          ref="listInnerRef"
          class="minimal-list-inner"
          :class="{ animating: isMoreThanContainer }"
          :style="`width: ${width}px; --item-parent-width: ${width}px`"
        >
          <TransitionGroup
            name="minimal-transition"
            tag="div"
            class="minimal-list"
          >
            <div
              v-for="(song, index) in activeSongs"
              :key="song.id"
              class="minimal-item"
            >
              <div
                class="minimal-index"
                :class="[`rank-${index + 1}`, { 'rank-top-3': index < 3 }]"
              >
                {{ index + 1 }}
              </div>
              <div class="minimal-content">
                <div
                  class="minimal-name"
                  :title="song.songName"
                >
                  {{ song.songName || '未知歌曲' }}
                </div>
                <div class="minimal-meta">
                  <span
                    v-if="settings.showUserName"
                    class="minimal-requester"
                  >
                    {{ song.from === SongRequestFrom.Manual ? '主播' : song.user?.name }}
                  </span>
                  <span
                    v-if="settings.showFanMadelInfo && (song.user?.fans_medal_level ?? 0) > 0"
                    class="minimal-medal"
                  >
                    {{ song.user?.fans_medal_name }} {{ song.user?.fans_medal_level }}
                  </span>
                </div>
              </div>
            </div>
          </TransitionGroup>
        </div>
      </template>
      <NEmpty
        v-else
        class="minimal-empty"
        description="暂无人点歌"
      />
    </div>
  </div>
</template>

<style scoped>
.minimal-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  color: #fff;
  background: transparent;
}

.minimal-now {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 4px 6px 4px;
}

.minimal-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(148, 163, 184, 0.9); /* idle gray */
  box-shadow: 0 0 6px rgba(0, 0, 0, 0.6);
  flex-shrink: 0;
}

.minimal-indicator.is-playing {
  background: #22c55e; /* green */
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.9);
  animation: minimal-breathe 1.6s ease-in-out infinite;
}

@keyframes minimal-breathe {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.35); opacity: 0.85; }
}

.minimal-now-title {
  font-size: 14px;
  font-weight: 700;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 75%;
}

.minimal-badge {
  margin-left: 4px;
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 11px;
  color: #eafff2;
  border: 1px solid rgba(34, 197, 94, 0.8);
  background: rgba(34, 197, 94, 0.15);
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.6);
  box-shadow: 0 0 10px rgba(34, 197, 94, 0.35);
}

.minimal-now.playing .minimal-now-title {
  color: #fff;
}

.minimal-now-user {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  opacity: 0.9;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.8);
}

.minimal-avatar {
  width: 16px;
  height: 16px;
  border-radius: 50%;
}

.minimal-list-container {
  flex: 1;
  overflow: hidden;
}

.minimal-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.minimal-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.minimal-index {
  min-width: 18px;
  text-align: center;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.9);
}

/* Top 3 rank highlight (minimal, no background panel) */
.minimal-index.rank-top-3 {
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.9));
}
.minimal-index.rank-1 {
  color: #fcd34d; /* gold */
  text-shadow:
    0 0 6px rgba(252, 211, 77, 0.9),
    0 0 14px rgba(252, 211, 77, 0.6),
    0 2px 6px rgba(0, 0, 0, 0.9);
}
.minimal-index.rank-2 {
  color: #cbd5e1; /* silver */
  text-shadow:
    0 0 6px rgba(203, 213, 225, 0.9),
    0 0 14px rgba(203, 213, 225, 0.5),
    0 2px 6px rgba(0, 0, 0, 0.9);
}
.minimal-index.rank-3 {
  color: #d97706; /* bronze */
  text-shadow:
    0 0 6px rgba(217, 119, 6, 0.9),
    0 0 14px rgba(217, 119, 6, 0.5),
    0 2px 6px rgba(0, 0, 0, 0.9);
}

.minimal-content {
  flex: 1;
  min-width: 0;
}

.minimal-name {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.9);
}

.minimal-meta {
  display: flex;
  gap: 6px;
  font-size: 11px;
  opacity: 0.95;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.85);
}

.minimal-requester,
.minimal-medal {
  background: rgba(0, 0, 0, 0.35);
  padding: 1px 6px;
  border-radius: 999px;
  backdrop-filter: blur(2px);
}

.minimal-empty {
  color: #fff;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.7);
}

.minimal-transition-enter-active,
.minimal-transition-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.minimal-transition-enter-from,
.minimal-transition-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@keyframes vertical-ping-pong {
  0% { transform: translateY(0); }
  100% { transform: translateY(v-bind(animationTranslateYCss)); }
}

.minimal-list-inner {
  pointer-events: none;
}

.minimal-list-inner.animating {
  animation-name: vertical-ping-pong;
  animation-duration: v-bind(animationDurationCss);
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  animation-direction: alternate;
  pointer-events: auto;
}

.minimal-list-inner.animating:hover {
  animation-play-state: paused;
}
</style>
