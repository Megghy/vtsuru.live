<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { NDivider, NEmpty } from 'naive-ui';
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import {
  SongRequestFrom,
  SongRequestStatus,
} from '@/api/api-models'
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
  return Number.isNaN(speed) || speed <= 0 ? 1 : speed
})

const {
  songs,
  settings,
  singing,
  activeSongs,
  allowGuardTypes,
  update,
  initRTC,
} = useLiveRequestData(currentId.value?.toString() ?? '')

const cardRef = ref()
const listContainerRef = ref()
const { height, width } = useElementSize(listContainerRef)

const listInnerRef = ref<HTMLElement | null>(null)
const { height: innerListHeight } = useElementSize(listInnerRef)

const itemMarginBottom = 5
const totalContentHeightWithLastMargin = computed(() => {
  const count = activeSongs.value.length
  if (count === 0 || innerListHeight.value <= 0) {
    return 0
  }
  return innerListHeight.value + itemMarginBottom
})

const isMoreThanContainer = computed(() => {
  return totalContentHeightWithLastMargin.value > height.value
})

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
    ref="cardRef"
    class="live-request-background"
    v-bind="$attrs"
  >
    <p class="live-request-header">
      {{ settings.obsTitle ?? '点播' }}
    </p>
    <NDivider class="live-request-divider">
      <p class="live-request-header-count">
        已有 {{ activeSongs.length ?? 0 }} 条
      </p>
    </NDivider>
    <div
      class="live-request-processing-container"
      :singing="songs.findIndex((s) => s.status === SongRequestStatus.Singing) > -1"
      :from="singing?.from as number"
      :status="singing?.status as number"
    >
      <div class="live-request-processing-prefix" />
      <template v-if="singing">
        <img
          class="live-request-processing-avatar"
          :src="singing?.user?.face"
          referrerpolicy="no-referrer"
        >
        <p class="live-request-processing-song-name">
          {{ singing?.songName }}
        </p>
        <p class="live-request-processing-name">
          {{ singing?.user?.name }}
        </p>
      </template>
      <div
        v-else
        class="live-request-processing-empty"
      >
        暂无处理中项目
      </div>
      <div class="live-request-processing-suffix" />
    </div>
    <div
      ref="listContainerRef"
      class="live-request-content"
    >
      <template v-if="activeSongs.length > 0">
        <div
          ref="listInnerRef"
          class="live-request-list"
          :class="{ animating: isMoreThanContainer }"
          :style="`width: ${width}px; --item-parent-width: ${width}px`"
        >
          <TransitionGroup
            name="live-request-transition"
            tag="div"
            class="live-request-transition-group"
          >
            <div
              v-for="(song, index) in activeSongs"
              :key="song.id"
              class="live-request-list-item"
              :from="song.from as number"
              :status="song.status as number"
            >
              <div
                class="live-request-list-item-index"
                :index="index + 1"
              >
                {{ index + 1 }}
              </div>
              <div class="live-request-list-item-scroll-view">
                <div class="live-request-list-item-inner-scroll">
                  <div class="live-request-list-item-song-name">
                    {{ song.songName || '未知歌曲' }}
                  </div>
                  <div
                    v-if="settings.showUserName"
                    class="live-request-list-item-name"
                    :from="song.from as number"
                  >
                    {{ song.from === SongRequestFrom.Manual ? '主播添加' : song.user?.name || '未知用户' }}
                  </div>
                  <div
                    v-if="settings.showFanMadelInfo && (song.user?.fans_medal_level ?? 0) > 0"
                    class="live-request-list-item-level"
                    :has-level="(song.user?.fans_medal_level ?? 0) > 0"
                  >
                    {{ `${song.user?.fans_medal_name || ''} ${song.user?.fans_medal_level || ''}` }}
                  </div>
                </div>
              </div>
            </div>
          </TransitionGroup>
        </div>
      </template>
      <div
        v-else
        style="position: relative; top: 20%"
      >
        <NEmpty
          class="live-request-empty"
          description="暂无人点播"
        />
      </div>
    </div>
    <div
      v-if="settings.showRequireInfo"
      class="live-request-footer"
    >
      <div class="live-request-footer-info">
        <div class="live-request-footer-tags">
          <div
            class="live-request-footer-tag"
            type="prefix"
          >
            <span class="tag-label">前缀</span>
            <span class="tag-value">{{ settings.orderPrefix }}</span>
          </div>
          <div
            class="live-request-footer-tag"
            type="allow"
          >
            <span class="tag-label">允许</span>
            <span class="tag-value">{{ settings.allowAllDanmaku ? '所有弹幕' : allowGuardTypes.length > 0 ? allowGuardTypes.join('/') : '无' }}</span>
          </div>
          <div
            class="live-request-footer-tag"
            type="sc"
          >
            <span class="tag-label">SC点歌</span>
            <span class="tag-value">{{ settings.allowSC ? `> ¥${settings.scMinPrice}` : '不允许' }}</span>
          </div>
          <div
            class="live-request-footer-tag"
            type="medal"
          >
            <span class="tag-label">粉丝牌</span>
            <span class="tag-value">
              {{
                settings.needWearFanMedal
                  ? settings.fanMedalMinLevel > 0
                    ? `> ${settings.fanMedalMinLevel}`
                    : '佩戴'
                  : '无需'
              }}
            </span>
          </div>
          <div
            class="live-request-footer-tag"
            type="prefix"
          >
            <span class="tag-label">前缀</span>
            <span class="tag-value">{{ settings.orderPrefix }}</span>
          </div>
          <div
            class="live-request-footer-tag"
            type="allow"
          >
            <span class="tag-label">允许</span>
            <span class="tag-value">{{ settings.allowAllDanmaku ? '所有弹幕' : allowGuardTypes.length > 0 ? allowGuardTypes.join('/') : '无' }}</span>
          </div>
          <div
            class="live-request-footer-tag"
            type="sc"
          >
            <span class="tag-label">SC点歌</span>
            <span class="tag-value">{{ settings.allowSC ? `> ¥${settings.scMinPrice}` : '不允许' }}</span>
          </div>
          <div
            class="live-request-footer-tag"
            type="medal"
          >
            <span class="tag-label">粉丝牌</span>
            <span class="tag-value">
              {{
                settings.needWearFanMedal
                  ? settings.fanMedalMinLevel > 0
                    ? `> ${settings.fanMedalMinLevel}`
                    : '佩戴'
                  : '无需'
              }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.live-request-background {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  min-height: 100px;
  min-width: 100px;
  background-color: #0f0f0f48;
  border-radius: 10px;
  color: white;
}

.live-request-header {
  margin: 0;
  color: #fff;
  text-align: center;
  font-size: 20px;
  font-weight: bold;
  text-shadow:
    0 0 10px #ca7b7b6e,
    0 0 20px #ffffff8e,
    0 0 30px #61606086,
    0 0 40px rgba(64, 156, 179, 0.555);
}

.live-request-header-count {
  color: #ffffffbd;
  text-align: center;
  font-size: 14px;
}

.live-request-divider {
  margin: 0 auto;
  margin-top: -15px;
  margin-bottom: -15px;
  width: 90%;
}

.live-request-processing-container {
  height: 35px;
  margin: 0 10px 0 10px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.live-request-processing-empty {
  font-weight: bold;
  font-style: italic;
  color: #ffffffbe;
}

.live-request-processing-prefix {
  border: 2px solid rgb(231, 231, 231);
  height: 30px;
  width: 10px;
  border-radius: 10px;
}

.live-request-processing-container[singing='true'] .live-request-processing-prefix {
  background-color: #75c37f;
  animation: animated-border 3s linear infinite;
}

.live-request-processing-container[singing='false'] .live-request-processing-prefix {
  background-color: #c37575;
}

.live-request-processing-avatar {
  height: 30px;
  border-radius: 50%;
  animation: rotate 20s linear infinite;
}

/* 网页点歌 */
.live-request-processing-container[from='3'] .live-request-processing-avatar {
  display: none;
}

.live-request-processing-song-name {
  font-size: large;
  font-weight: bold;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 80%;
}

.live-request-processing-name {
  font-size: 12px;
  font-style: italic;
}

@keyframes rotate {
  0% {
    transform: rotate(0);
  }

  100% {
    transform: rotate(360deg);
  }
}

.n-divider__line {
  background-color: #ffffffd5;
}

.live-request-content {
  background-color: #0f0f0f4f;
  margin: 10px;
  padding: 8px;
  height: 100%;
  border-radius: 10px;
  overflow: hidden;
}

.live-request-list {
  width: 100%;
  overflow: hidden;
  position: relative;
}

.live-request-transition-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
  position: relative;
}

.live-request-transition-enter-active,
.live-request-transition-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.live-request-transition-enter-from,
.live-request-transition-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

.live-request-transition-leave-active {
  position: absolute;
  width: 100%;
}

.live-request-transition-move {
  transition: transform 0.3s ease;
}

@keyframes vertical-ping-pong {
  0% {
    transform: translateY(0);
  }
  100% {
    transform: translateY(v-bind(animationTranslateYCss));
  }
}

.live-request-list.animating {
  animation-name: vertical-ping-pong;
  animation-duration: v-bind(animationDurationCss);
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  animation-direction: alternate;
  pointer-events: auto;
}

.live-request-list.animating:hover {
  animation-play-state: paused;
}

.live-request-list-item {
  display: flex;
  align-self: flex-start;
  position: relative;
  align-items: center;
  padding: 4px 6px;
  margin-bottom: 0;
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  min-height: 36px;
  overflow: hidden;
  gap: 5px;
}

.live-request-list-item-scroll-view {
  flex-grow: 1;
  min-width: 0;
  overflow: hidden;
  position: relative;
}

.live-request-list-item-inner-scroll {
  display: flex;
  align-items: center;
  gap: 5px;
  width: max-content;
  animation: item-horizontal-scroll 5s infinite alternate ease-in-out;
}

.live-request-list-item:hover .live-request-list-item-inner-scroll {
  animation-play-state: paused;
}

@keyframes item-horizontal-scroll {
  from {
    transform: translateX(0px);
  }
  to {
    transform: translateX(min(0px, calc(var(--item-parent-width) - 100% - 5px)));
  }
}

.live-request-list-item-song-name {
  font-size: 16px;
  font-weight: bold;
  white-space: nowrap;
  margin-right: 5px;
}

.live-request-list-item-name {
  font-style: italic;
  font-size: 12px;
  color: rgba(204, 204, 204, 0.993);
  white-space: nowrap;
  margin-left: auto;
  background-color: rgba(0, 0, 0, 0.2);
  padding: 2px 6px;
  border-radius: 4px;
  min-width: 50px;
  text-align: center;
}

.live-request-list-item-index {
  text-align: center;
  height: 18px;
  padding: 2px;
  min-width: 15px;
  border-radius: 5px;
  background-color: #0f0f0f48;
  color: rgba(204, 204, 204, 0.993);
  font-size: 12px;
  flex-shrink: 0;
}

.live-request-list-item-level {
  text-align: center;
  height: 18px;
  padding: 2px 6px;
  min-width: 15px;
  border-radius: 5px;
  background-color: rgba(0, 0, 0, 0.3);
  color: rgba(204, 204, 204, 0.993);
  font-size: 12px;
  white-space: nowrap;
}

.live-request-list-item-level[has-level='false'] {
  display: none;
}

.live-request-footer {
  margin: 0 5px 5px 5px;
  background-color: rgba(0, 0, 0, 0.25);
  border-radius: 8px;
  padding: 8px 6px;
  overflow: hidden;
  height: auto;
  min-height: 40px;
  max-height: 60px;
  display: flex;
  align-items: center;
}

.live-request-footer-info {
  width: 100%;
  overflow: hidden;
  position: relative;
}

.live-request-footer-tags {
  display: inline-flex;
  flex-wrap: nowrap;
  gap: 8px;
  padding: 2px;
  white-space: nowrap;
  animation: scrollTags 25s linear infinite;
  padding-right: 16px;
}

@keyframes scrollTags {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(-50%);
  }
}

.live-request-footer-tags:hover {
  animation-play-state: paused;
}

.live-request-footer-tag {
  display: inline-flex;
  flex-direction: column;
  padding: 5px 8px;
  border-radius: 6px;
  background-color: rgba(255, 255, 255, 0.12);
  min-width: max-content;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.live-request-footer-tag[type="prefix"] {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(37, 99, 235, 0.18));
}

.live-request-footer-tag[type="allow"] {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(5, 150, 105, 0.18));
}

.live-request-footer-tag[type="sc"] {
  background: linear-gradient(135deg, rgba(244, 114, 182, 0.12), rgba(219, 39, 119, 0.18));
}

.live-request-footer-tag[type="medal"] {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(220, 38, 38, 0.18));
}

.live-request-footer-tag:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
}

.tag-label {
  font-size: 10px;
  opacity: 0.8;
  color: #e5e7eb;
  font-weight: normal;
  margin-bottom: 2px;
  line-height: 1;
}

.tag-value {
  font-size: 12px;
  font-weight: 600;
  color: white;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.live-request-list-item-index[index='1'] {
  background-color: #ebc34c;
  color: white;
  font-weight: bold;
  text-shadow: 0 0 6px #ebc34c;
}

.live-request-list-item-index[index='2'] {
  background-color: #c0c0c0;
  color: white;
  font-weight: bold;
}

.live-request-list-item-index[index='3'] {
  background-color: #b87333;
  color: white;
  font-weight: bold;
}

@keyframes animated-border {
  0% {
    box-shadow: 0 0 0px #589580;
  }

  100% {
    box-shadow: 0 0 0 6px rgba(255, 255, 255, 0);
  }
}
</style>
