<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
// Remove Vue3Marquee import if no longer needed elsewhere
// import { Vue3Marquee } from 'vue3-marquee'
import { NEmpty, NTag } from 'naive-ui'
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

// Read speed: prioritize prop, then query parameter, default to 1
const speedMultiplier = computed(() => {
  if (props.speedMultiplier !== undefined && props.speedMultiplier > 0) {
    return props.speedMultiplier
  }
  const speedParam = route.query.speed
  const speed = Number.parseFloat(speedParam?.toString() ?? '1')
  return Number.isNaN(speed) || speed <= 0 ? 1 : speed
})

const {
  settings,
  singing,
  activeSongs,
  allowGuardTypes,
  update,
  initRTC,
} = useLiveRequestData(currentId.value?.toString() ?? '')

const containerRef = ref()
const listContainerRef = ref()
const { height } = useElementSize(listContainerRef)
// const itemHeight = 55 // Remove hardcoded itemHeight
const itemMarginBottom = 8 // 项目底部外边距

// Ref for the inner list wrapper to measure its height
const songListInnerRef = ref<HTMLElement | null>(null)
const { height: innerListHeight } = useElementSize(songListInnerRef)

// Calculate total content height including the margin of the last item
const totalContentHeightWithLastMargin = computed(() => {
  const count = activeSongs.value.length
  if (count === 0 || innerListHeight.value <= 0) {
    return 0
  }
  // The measured innerListHeight includes all item heights and (count - 1) margins.
  // Add the last item's margin for the true total height.
  return innerListHeight.value + itemMarginBottom
})

const isMoreThanContainer = computed(() => {
  // Compare total content height with container height
  return totalContentHeightWithLastMargin.value > height.value
})

// Computed property for animation translateY value
const animationTranslateY = computed(() => {
  if (!isMoreThanContainer.value || height.value <= 0) {
    return 0
  }
  // Target Y = container height - total content height (including last margin)
  return height.value - totalContentHeightWithLastMargin.value
})
const animationTranslateYCss = computed(() => `${animationTranslateY.value}px`)

// Computed property for animation duration, adjusted by speedMultiplier
const animationDuration = computed(() => {
  // Calculate base duration (e.g., 1 second per song - reduced from 2)
  const baseDuration = activeSongs.value.length * 1
  // Adjust duration based on multiplier (faster speed = shorter duration)
  const adjustedDuration = baseDuration / speedMultiplier.value
  // Ensure minimum duration to prevent issues
  return Math.max(adjustedDuration, 1) // Minimum 1 second duration
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
    ref="containerRef"
    class="fresh-request-container"
    v-bind="$attrs"
  >
    <div class="fresh-request-header">
      <h2 class="fresh-request-title">
        {{ settings.obsTitle ?? '歌曲点播' }}
      </h2>
      <span class="fresh-request-count">队列中 {{ activeSongs.length ?? 0 }} 首</span>
    </div>

    <!-- 当前演唱区域 -->
    <div class="fresh-request-now-playing">
      <div
        class="fresh-request-now-playing-indicator"
        :class="{ 'is-playing': singing }"
      />
      <div class="fresh-request-now-playing-content">
        <template v-if="singing">
          <div class="fresh-request-now-playing-info">
            <div
              class="fresh-request-song-title"
              :title="singing.songName"
            >
              {{ singing.songName }}
            </div>
            <div class="fresh-request-song-user">
              <img
                v-if="singing.user?.face && singing.from !== SongRequestFrom.Manual"
                class="fresh-request-user-avatar"
                :src="singing.user.face"
                referrerpolicy="no-referrer"
              >
              <span class="fresh-request-user-name">{{ singing.from === SongRequestFrom.Manual ? '主播添加' : singing.user?.name }}</span>
            </div>
          </div>
        </template>
        <div
          v-else
          class="fresh-request-no-song"
        >
          当前暂无项目
        </div>
      </div>
    </div>

    <!-- 点播列表 -->
    <div
      ref="listContainerRef"
      class="fresh-request-list-container"
    >
      <template v-if="activeSongs.length > 0">
        <div
          ref="songListInnerRef"
          class="fresh-request-song-list-inner"
          :class="{ animating: isMoreThanContainer }"
        >
          <TransitionGroup
            name="fresh-request-transition"
            tag="div"
            class="fresh-request-transition-group"
          >
            <div
              v-for="(song, index) in activeSongs"
              :key="song.id"
              class="fresh-request-song-item"
            >
              <div
                class="fresh-request-song-rank"
                :class="[`rank-${index + 1}`, { 'rank-top-3': index < 3 }]"
              >
                {{ index + 1 }}
              </div>
              <div class="fresh-request-song-content">
                <div
                  class="fresh-request-song-name"
                  :title="song.songName"
                >
                  {{ song.songName }}
                </div>
                <div class="fresh-request-song-footer">
                  <span
                    v-if="settings.showUserName"
                    class="fresh-request-song-requester"
                  >
                    <span class="requester-label">点歌:</span> {{ song.from === SongRequestFrom.Manual ? '主播' : song.user?.name }}
                  </span>
                  <span
                    v-if="settings.showFanMadelInfo && (song.user?.fans_medal_level ?? 0) > 0"
                    class="fresh-request-song-medal"
                  >
                    {{ song.user?.fans_medal_name }} {{ song.user?.fans_medal_level }}
                  </span>
                </div>
              </div>
            </div>
          </TransitionGroup>
        </div>
        <!-- End animation wrapper -->
      </template>
      <NEmpty
        v-else
        description="队列空空如也~"
        class="fresh-request-empty"
      />
    </div>

    <!-- 点播要求信息 -->
    <div
      v-if="settings.showRequireInfo"
      class="fresh-request-info"
    >
      <div class="fresh-request-info-tags">
        <NTag
          class="fresh-request-info-tag"
          :bordered="false"
          type="primary"
          size="small"
        >
          前缀: {{ settings.orderPrefix }}
        </NTag>
        <NTag
          class="fresh-request-info-tag"
          :bordered="false"
          type="info"
          size="small"
        >
          允许: {{ settings.allowAllDanmaku ? '所有弹幕' : allowGuardTypes.length > 0 ? allowGuardTypes.join('/') : '无' }}
        </NTag>
        <NTag
          class="fresh-request-info-tag"
          :bordered="false"
          type="success"
          size="small"
        >
          SC点歌: {{ settings.allowSC ? `≥ ¥${settings.scMinPrice}` : '否' }}
        </NTag>
        <NTag
          class="fresh-request-info-tag"
          :bordered="false"
          type="warning"
          size="small"
        >
          粉丝牌: {{ settings.needWearFanMedal ? (settings.fanMedalMinLevel > 0 ? `≥ ${settings.fanMedalMinLevel}级` : '佩戴') : '无需' }}
        </NTag>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 基础样式与容器 */
.fresh-request-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  min-height: 150px; /* 增加最小高度 */
  min-width: 250px; /* 增加最小宽度 */
  max-height: 100vh; /* 确保在OBS中不超出视口高度 */
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.85) 0%, rgba(245, 245, 250, 0.85) 100%);
  border-radius: 16px; /* 更大的圆角 */
  color: #333;
  font-family: 'PingFang SC', 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif; /* 优先使用中文字体 */
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08); /* 更柔和的阴影 */
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.05); /* 添加细边框 */
}

/* 头部 */
.fresh-request-header {
  padding: 10px 16px; /* 调整内边距 */
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: rgba(255, 255, 255, 0.6); /* 更透明的背景 */
  border-bottom: 1px solid rgba(0, 0, 0, 0.06); /* 更细的边框 */
  flex-shrink: 0; /* 防止头部被压缩 */
}

.fresh-request-title {
  margin: 0;
  font-size: 16px; /* 调整字体大小 */
  font-weight: 600;
  color: #1e293b; /* 深蓝灰色 */
}

.fresh-request-count {
  font-size: 12px; /* 调整字体大小 */
  color: #475569; /* 蓝灰色 */
  background-color: rgba(226, 232, 240, 0.7); /* 半透明背景 */
  padding: 4px 10px; /* 调整内边距 */
  border-radius: 16px; /* 全圆角 */
  font-weight: 500;
}

/* 当前演唱区域 */
.fresh-request-now-playing {
  display: flex;
  align-items: center;
  padding: 12px 16px; /* 增加内边距 */
  background-color: rgba(255, 255, 255, 0.5); /* 更透明 */
  margin: 10px 12px; /* 调整外边距 */
  border-radius: 12px; /* 调整圆角 */
  gap: 10px; /* 调整间距 */
  border: 1px solid rgba(0, 0, 0, 0.04);
  flex-shrink: 0; /* 防止被压缩 */
  transition: all 0.3s ease; /* Add transition for smoother changes */
}

/* Make "Now Playing" more prominent when singing */
.fresh-request-now-playing:has(.is-playing) {
  background-color: rgba(236, 253, 245, 0.9); /* Lighter green background */
  border-color: rgba(16, 185, 129, 0.3);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.1);
}

.fresh-request-now-playing-indicator {
  width: 8px; /* 缩小尺寸 */
  height: 8px;
  border-radius: 50%;
  background-color: #cbd5e1; /* 默认灰色 */
  position: relative;
  flex-shrink: 0;
  transition: background-color 0.3s ease;
}

.fresh-request-now-playing-indicator.is-playing {
  background-color: #10b981; /* 绿色 */
  /* 替换为更柔和的呼吸动画 */
  animation: breathe 1.8s infinite ease-in-out;
}

/* Make title bolder/larger when playing */
.fresh-request-now-playing:has(.is-playing) .fresh-request-song-title {
  font-weight: 700;
  font-size: 16px; /* Slightly larger font */
  color: #065f46; /* Darker green */
}

/* Optional: slightly emphasize user name when playing */
.fresh-request-now-playing:has(.is-playing) .fresh-request-song-user {
  color: #047857;
}

@keyframes breathe {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 3px rgba(16, 185, 129, 0.2);
  }
  50% {
    transform: scale(1.2);
    box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
  }
}

.fresh-request-now-playing-content {
  flex: 1;
  min-width: 0; /* 防止内容溢出 */
}

.fresh-request-now-playing-info {
  display: flex;
  flex-direction: column;
  gap: 2px; /* 调整信息间距 */
}

.fresh-request-song-title {
  font-size: 15px; /* 调整字体大小 */
  font-weight: 600;
  color: #0f172a; /* 更深的颜色 */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fresh-request-song-user {
  display: flex;
  align-items: center;
  font-size: 12px;
  color: #64748b; /* 保持灰色 */
  gap: 5px; /* 调整头像和名字间距 */
}

.fresh-request-user-avatar {
  width: 18px; /* 稍大一点的头像 */
  height: 18px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid rgba(0, 0, 0, 0.05); /* 头像边框 */
}

.fresh-request-user-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fresh-request-no-song {
  font-size: 13px; /* 调整字体大小 */
  font-style: normal; /* 去掉斜体 */
  color: #94a3b8; /* 浅灰色 */
}

/* 歌曲列表 */
.fresh-request-list-container {
  flex: 1; /* 占据剩余空间 */
  overflow: hidden !important; /* 强制隐藏溢出 */
  padding: 0 12px; /* 调整左右内边距 */
  margin-bottom: 8px;
  position: relative; /* 为空状态居中 */
}

.fresh-request-song-item {
  display: flex;
  align-items: center;
  margin-bottom: 8px; /* 列表项间距 */
  background-color: rgba(255, 255, 255, 0.7); /* 半透明背景 */
  border-radius: 10px; /* 调整圆角 */
  padding: 8px 10px; /* 调整内边距 */
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.04); /* 更细微的阴影 */
  transition: background-color 0.2s ease, transform 0.2s ease;
  border: 1px solid rgba(0, 0, 0, 0.03);
}

.fresh-request-song-item:hover {
  background-color: rgba(248, 250, 252, 0.9); /* 悬停背景色 */
  transform: translateY(-1px); /* 轻微上移 */
}

/* 前三名条目特殊样式 */
.fresh-request-song-item:has(.rank-1) {
  border-left: 3px solid #fbbf24; /* 金色左边框 */
  background-color: rgba(252, 237, 174, 0.15); /* 淡淡的金色背景 */
}

.fresh-request-song-item:has(.rank-2) {
  border-left: 3px solid #cbd5e1; /* 银色左边框 */
  background-color: rgba(203, 213, 225, 0.25); /* 调整银色背景透明度，使其更明显 */
}

.fresh-request-song-item:has(.rank-3) {
  border-left: 3px solid #d97706; /* 铜色左边框 */
  background-color: rgba(251, 211, 141, 0.15); /* 淡淡的铜色背景 */
}

.fresh-request-song-rank {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px; /* 调整尺寸 */
  height: 22px;
  border-radius: 50%; /* 圆形排名 */
  background-color: #f1f5f9; /* 默认浅灰背景 */
  color: #64748b; /* 默认字体颜色 */
  font-weight: 600;
  font-size: 12px; /* 调整字体大小 */
  margin-right: 10px; /* 调整右边距 */
  flex-shrink: 0;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

/* 前三名特殊样式 */
.fresh-request-song-rank.rank-top-3 {
  color: #ffffff; /* 白色字体 */
  font-weight: 700;
  border: none;
}
.fresh-request-song-rank.rank-1 {
  background: linear-gradient(135deg, #fcd34d, #fbbf24); /* 金色渐变 */
  box-shadow: 0 1px 3px rgba(180, 83, 9, 0.3);
}
.fresh-request-song-rank.rank-2 {
  background: linear-gradient(135deg, #e2e8f0, #cbd5e1); /* 银色渐变 */
  color: #334155; /* 深色字体 */
  box-shadow: 0 1px 3px rgba(100, 116, 139, 0.2);
}
.fresh-request-song-rank.rank-3 {
  background: linear-gradient(135deg, #f9a825, #d97706); /* 铜色渐变 */
  box-shadow: 0 1px 3px rgba(146, 64, 14, 0.3);
}

.fresh-request-song-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center; /* 垂直居中 */
  overflow: hidden;
  gap: 3px; /* 内容上下间距 */
  min-width: 0; /* 确保内容区能正确收缩 */
}

.fresh-request-song-name {
  font-size: 14px; /* 调整字体大小 */
  font-weight: 500;
  color: #334155; /* 深蓝灰色 */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fresh-request-song-footer {
  display: flex;
  align-items: center; /* 垂直居中 */
  font-size: 11px; /* 缩小字体 */
  color: #64748b; /* 灰色 */
  gap: 6px; /* 调整元素间距 */
  flex-wrap: wrap; /* 允许换行 */
}

.fresh-request-song-requester {
  display: inline-flex; /* 使内部元素对齐 */
  align-items: center;
}
.requester-label {
  opacity: 0.7; /* 标签稍透明 */
  margin-right: 3px;
}

.fresh-request-song-medal {
  background-color: rgba(226, 232, 240, 0.6); /* 更淡的背景 */
  padding: 1px 5px; /* 调整内边距 */
  border-radius: 4px;
  font-size: 10px; /* 保持小字体 */
  font-weight: 500;
  color: #475569; /* 调整颜色 */
  border: 1px solid rgba(0, 0, 0, 0.05); /* 添加细边框 */
  white-space: nowrap; /* 防止换行 */
}

/* 空状态 */
.fresh-request-empty {
  display: flex;
  height: 100%;
  align-items: center;
  justify-content: center;
  color: #a1a1aa; /* 更柔和的灰色 */
  font-size: 13px;
  position: absolute; /* 覆盖在列表容器上 */
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none; /* 不阻挡下方元素 */
}

/* 点播要求信息 */
.fresh-request-info {
  padding: 6px 12px; /* 调整内边距 */
  background-color: rgba(248, 250, 252, 0.8); /* 半透明背景 */
  border-top: 1px solid rgba(0, 0, 0, 0.06); /* 更细的边框 */
  flex-shrink: 0; /* 防止被压缩 */
}

.fresh-request-info-tags {
  display: flex;
  gap: 6px; /* 调整标签间距 */
}

.fresh-request-info-tag {
  white-space: nowrap;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); /* 给标签加点阴影 */
}

/* 滚动条样式 (可选，美化) */
.fresh-request-list-container::-webkit-scrollbar {
  width: 4px;
}
.fresh-request-list-container::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.1);
  border-radius: 4px;
}
.fresh-request-list-container::-webkit-scrollbar-track {
  background-color: transparent;
}

/* New styles for CSS animation */
@keyframes vertical-ping-pong {
  0% {
    transform: translateY(0);
  }
  100% {
    /* Use the computed CSS variable for the target Y position */
    transform: translateY(v-bind(animationTranslateYCss));
  }
}

.fresh-request-song-list-inner {
  /* Prevent interaction during animation unless hovered */
  pointer-events: none;
}

.fresh-request-song-list-inner.animating {
  animation-name: vertical-ping-pong;
  animation-duration: v-bind(animationDurationCss);
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  animation-direction: alternate; /* This makes it go back and forth */
  pointer-events: auto; /* Allow hover effect */
}

/* Pause animation on hover */
.fresh-request-song-list-inner.animating:hover {
  animation-play-state: paused;
}
</style>
