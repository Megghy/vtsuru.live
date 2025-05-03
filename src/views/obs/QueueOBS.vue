<script setup lang="ts">
import {
  QueueFrom,
  QueueSortType,
  QueueStatus,
  ResponseQueueModel,
  Setting_Queue
} from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { QUEUE_API_URL } from '@/data/constants'
import { useWebRTC } from '@/store/useRTC'
import { useElementSize } from '@vueuse/core'
import { List } from 'linqts'
import { NDivider, NEmpty, useMessage } from 'naive-ui'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'

const props = defineProps<{
  id?: number,
  active?: boolean,
  visible?: boolean,
  speedMultiplier?: number,
}>()

const message = useMessage()
const route = useRoute()
const currentId = computed(() => {
  return props.id ?? route.query.id
})
const rtc = await useWebRTC().Init('slave')

const speedMultiplier = computed(() => {
  if (props.speedMultiplier !== undefined && props.speedMultiplier > 0) {
    return props.speedMultiplier
  }
  const speedParam = route.query.speed
  const speed = parseFloat(speedParam?.toString() ?? '1')
  return isNaN(speed) || speed <= 0 ? 1 : speed
})

const listContainerRef = ref()
const footerRef = ref()
const footerListRef = ref()
const { height, width } = useElementSize(listContainerRef)
const footerSize = useElementSize(footerRef)
const footerListSize = useElementSize(footerListRef)
const itemHeight = 40

const queueListInnerRef = ref<HTMLElement | null>(null)
const { height: innerListHeight } = useElementSize(queueListInnerRef)

const itemMarginBottom = 0
const totalContentHeightWithLastMargin = computed(() => {
  const count = activeItems.value.length
  if (count === 0 || innerListHeight.value <= 0) {
    return 0
  }
  return innerListHeight.value + itemMarginBottom
})

const queue = ref<ResponseQueueModel[]>([])
const settings = ref<Setting_Queue>({} as Setting_Queue)
const progressing = computed(() => {
  return queue.value.find((s) => s.status == QueueStatus.Progressing)
})
const activeItems = computed(() => {
  let list = new List(queue.value)
    .Where((q) => q?.status == QueueStatus.Waiting)
    .OrderByDescending((q) => q.from == QueueFrom.Manual)
  switch (settings.value.sortType) {
    case QueueSortType.TimeFirst: {
      list = list.OrderBy((q) => q.createAt)
      break
    }
    case QueueSortType.GuardFirst: {
      list = list
        .OrderBy((q) => (q.user?.guard_level == 0 || q.user?.guard_level == null ? 4 : q.user.guard_level))
        .ThenBy((q) => q.createAt)
      break
    }
    case QueueSortType.PaymentFist: {
      list = list.OrderByDescending((q) => q.giftPrice).ThenBy((q) => q.createAt)
      break
    }
    case QueueSortType.FansMedalFirst: {
      list = list
        .OrderByDescending((q) => (q.user?.fans_medal_wearing_status ? 1 : 0))
        .ThenByDescending((q) => q.user?.fans_medal_level ?? 0)
        .ThenBy((q) => q.createAt)
      break
    }
  }
  if (settings.value.isReverse) {
    list = list.Reverse()
  }
  list = list.OrderByDescending((q) => (q.status == QueueStatus.Progressing ? 1 : 0))
  return list.ToArray()
})
const itemNum = computed(() => {
  return queue.value.length
})

async function get() {
  try {
    const data = await QueryGetAPI<{ queue: ResponseQueueModel[]; setting: Setting_Queue }>(
      QUEUE_API_URL + 'get-active-and-settings',
      {
        id: currentId.value,
      },
    )
    if (data.code == 200) {
      return data.data
    }
  } catch (err) { }
  return {} as { queue: ResponseQueueModel[]; setting: Setting_Queue }
}

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
  const baseDuration = activeItems.value.length * 1
  const adjustedDuration = baseDuration / speedMultiplier.value
  return Math.max(adjustedDuration, 1)
})
const animationDurationCss = computed(() => `${animationDuration.value}s`)

const allowGuardTypes = computed(() => {
  const types = []
  if (settings.value.needTidu) {
    types.push('提督')
  }
  if (settings.value.needZongdu) {
    types.push('总督')
  }
  if (settings.value.needJianzhang) {
    types.push('舰长')
  }
  return types
})
async function update() {
  const r = await get()
  if (r) {
    queue.value = r.queue.sort((a, b) => {
      return b.createAt - a.createAt
    })
    settings.value = r.setting
  }
}

onMounted(() => {
  update()
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
    class="queue-background"
    v-bind="$attrs"
  >
    <p class="queue-header">
      排队
    </p>
    <NDivider class="queue-divider">
      <p class="queue-header-count">
        已有 {{ activeItems.length ?? 0 }} 人
      </p>
    </NDivider>
    <div
      class="queue-singing-container"
      :singing="queue.findIndex((s) => s.status == QueueStatus.Progressing) > -1"
      :from="progressing?.from as number"
      :status="progressing?.status as number"
    >
      <div class="queue-singing-prefix" />
      <template v-if="progressing">
        <img
          class="queue-singing-avatar"
          :src="progressing?.user?.face"
          referrerpolicy="no-referrer"
        >
        <p class="queue-singing-name">
          {{ progressing?.user?.name }}
        </p>
      </template>
      <div
        v-else
        class="queue-singing-empty"
      >
        等待中
      </div>
      <div class="queue-singing-suffix" />
    </div>
    <div
      ref="listContainerRef"
      class="queue-content"
    >
      <template v-if="activeItems.length > 0">
        <div
          ref="queueListInnerRef"
          class="queue-list"
          :class="{ animating: isMoreThanContainer }"
          :style="`width: ${width}px;`"
        >
          <span
            v-for="(item, index) in activeItems"
            :key="item.id"
            class="queue-list-item"
            :from="item.from as number"
            :status="item.status as number"
            :payment="item.giftPrice ?? 0"
            :style="`height: ${itemHeight}px`"
          >
            <div
              class="queue-list-item-index"
              :index="index + 1"
            >
              {{ index + 1 }}
            </div>
            <div
              v-if="settings.showFanMadelInfo && (item.user?.fans_medal_level ?? 0) > 0"
              class="queue-list-item-level"
              :has-level="(item.user?.fans_medal_level ?? 0) > 0"
            >
              {{ `${item.user?.fans_medal_name || ''} ${item.user?.fans_medal_level || ''}` }}
            </div>
            <div class="queue-list-item-user-name">
              {{ item.user?.name || '未知用户' }}
            </div>
            <div
              v-if="item.from == QueueFrom.Manual || ((item.giftPrice ?? 0) > 0 || settings.showPayment)"
              class="queue-list-item-payment"
            >
              {{ item.from == QueueFrom.Manual ? '主播添加' : item.giftPrice == undefined ? '无' : '¥ ' + item.giftPrice }}
            </div>
          </span>
        </div>
      </template>
      <div
        v-else
        style="position: relative; top: 20%"
      >
        <NEmpty
          class="queue-empty"
          description="暂无人排队"
        />
      </div>
    </div>
    <div
      v-if="settings.showRequireInfo"
      ref="footerRef"
      class="queue-footer"
    >
      <div class="queue-footer-info">
        <div class="queue-footer-tags">
          <div
            class="queue-footer-tag"
            type="keyword"
          >
            <span class="tag-label">关键词</span>
            <span class="tag-value">{{ settings.keyword }}</span>
          </div>
          <div
            class="queue-footer-tag"
            type="allow"
          >
            <span class="tag-label">允许</span>
            <span class="tag-value">{{ settings.allowAllDanmaku ? '所有弹幕' : allowGuardTypes.length > 0 ? allowGuardTypes.join('/') : '无' }}</span>
          </div>
          <div
            class="queue-footer-tag"
            type="gift"
          >
            <span class="tag-label">礼物</span>
            <span class="tag-value">{{ settings.allowGift ? '允许' : '不允许' }}</span>
          </div>
          <div
            class="queue-footer-tag"
            type="price"
          >
            <span class="tag-label">最低价格</span>
            <span class="tag-value">{{ settings.minGiftPrice ? '> ¥' + settings.minGiftPrice : '任意' }}</span>
          </div>
          <div
            class="queue-footer-tag"
            type="gift-names"
          >
            <span class="tag-label">礼物名</span>
            <span class="tag-value">{{ settings.giftNames ? settings.giftNames.join(', ') : '无' }}</span>
          </div>
          <div
            class="queue-footer-tag"
            type="medal"
          >
            <span class="tag-label">粉丝牌</span>
            <span class="tag-value">
              {{
                settings.fanMedalMinLevel != undefined && !settings.allowAllDanmaku
                  ? settings.fanMedalMinLevel > 0
                    ? '> ' + settings.fanMedalMinLevel
                    : '佩戴'
                  : '无需'
              }}
            </span>
          </div>
          <!-- 重复标签组，实现无缝滚动 -->
          <div
            class="queue-footer-tag"
            type="keyword"
          >
            <span class="tag-label">关键词</span>
            <span class="tag-value">{{ settings.keyword }}</span>
          </div>
          <div
            class="queue-footer-tag"
            type="allow"
          >
            <span class="tag-label">允许</span>
            <span class="tag-value">{{ settings.allowAllDanmaku ? '所有弹幕' : allowGuardTypes.length > 0 ? allowGuardTypes.join('/') : '无' }}</span>
          </div>
          <div
            class="queue-footer-tag"
            type="gift"
          >
            <span class="tag-label">礼物</span>
            <span class="tag-value">{{ settings.allowGift ? '允许' : '不允许' }}</span>
          </div>
          <div
            class="queue-footer-tag"
            type="price"
          >
            <span class="tag-label">最低价格</span>
            <span class="tag-value">{{ settings.minGiftPrice ? '> ¥' + settings.minGiftPrice : '任意' }}</span>
          </div>
          <div
            v-if="settings.giftNames && settings.giftNames.length > 0"
            class="queue-footer-tag"
            type="gift-names"
          >
            <span class="tag-label">礼物名</span>
            <span class="tag-value">{{ settings.giftNames ? settings.giftNames.join(', ') : '无' }}</span>
          </div>
          <div
            class="queue-footer-tag"
            type="medal"
          >
            <span class="tag-label">粉丝牌</span>
            <span class="tag-value">
              {{
                settings.fanMedalMinLevel != undefined && !settings.allowAllDanmaku
                  ? settings.fanMedalMinLevel > 0
                    ? '> ' + settings.fanMedalMinLevel
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
.queue-background {
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

.queue-header {
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

.queue-header-count {
  color: #ffffff;
  text-align: center;
  font-size: 14px;
}

.queue-divider {
  margin: 0 auto;
  margin-top: -15px;
  margin-bottom: -15px;
  width: 90%;
}

.queue-singing-container {
  height: 35px;
  margin: 0 10px 0 10px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.queue-singing-empty {
  font-weight: bold;
  font-style: italic;
  color: #ffffffbe;
}

.queue-singing-prefix {
  border: 2px solid rgb(231, 231, 231);
  height: 30px;
  width: 10px;
  border-radius: 10px;
}

.queue-singing-container[singing='true'] .queue-singing-prefix {
  background-color: #75c37f;
  animation: animated-border 3s linear infinite;
}

.queue-singing-container[singing='false'] .queue-singing-prefix {
  background-color: #c37575;
}

.queue-singing-avatar {
  height: 30px;
  border-radius: 50%;
  animation: rotate 20s linear infinite;
}

.queue-singing-container[from='3'] .queue-singing-avatar {
  display: none;
}

.queue-singing-name {
  font-size: large;
  font-weight: bold;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 80%;
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

.queue-content {
  background-color: #0f0f0f4f;
  margin: 10px;
  padding: 8px;
  height: 100%;
  border-radius: 10px;
  overflow: hidden;
}

.queue-list {
  width: 100%;
  overflow: hidden;
  position: relative;
}

@keyframes vertical-ping-pong {
  0% {
    transform: translateY(0);
  }
  100% {
    transform: translateY(v-bind(animationTranslateYCss));
  }
}

.queue-list.animating {
  animation-name: vertical-ping-pong;
  animation-duration: v-bind(animationDurationCss);
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  animation-direction: alternate;
  pointer-events: auto;
}

.queue-list.animating:hover {
  animation-play-state: paused;
}

.queue-list-item {
  display: flex;
  align-self: flex-start;
  position: relative;
  align-items: center;
  justify-content: left;
  gap: 5px;
  padding: 4px 6px;
  margin-bottom: 5px;
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  min-height: 36px;
}

.queue-list-item-user-name {
  font-size: 16px;
  font-weight: bold;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 50%;
  flex-grow: 1;
}

.queue-list-item-payment {
  font-style: italic;
  font-size: 12px;
  color: rgba(233, 165, 165, 0.993);
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-left: auto;
  background-color: rgba(0, 0, 0, 0.2);
  padding: 2px 6px;
  border-radius: 4px;
  min-width: 50px;
  text-align: center;
}

.queue-list-item-level {
  text-align: center;
  height: 18px;
  padding: 2px 6px;
  min-width: 15px;
  border-radius: 5px;
  background-color: rgba(0, 0, 0, 0.3);
  color: rgba(204, 204, 204, 0.993);
  font-size: 12px;
}

.queue-list-item-index {
  text-align: center;
  height: 18px;
  padding: 2px;
  min-width: 15px;
  border-radius: 5px;
  background-color: #0f0f0f48;
  color: rgba(204, 204, 204, 0.993);
  font-size: 12px;
}

.queue-list-item-index[index='1'] {
  background-color: #ebc34c;
  color: white;
  font-weight: bold;
  text-shadow: 0 0 6px #ebc34c;
}

.queue-list-item-index[index='2'] {
  background-color: #c0c0c0;
  color: white;
  font-weight: bold;
}

.queue-list-item-index[index='3'] {
  background-color: #b87333;
  color: white;
  font-weight: bold;
}

.queue-list-item-level {
  text-align: center;
  height: 18px;
  padding: 2px;
  min-width: 15px;
  border-radius: 5px;
  background-color: #0f0f0f48;
  color: rgba(204, 204, 204, 0.993);
  font-size: 12px;
}

.queue-list-item-level[has-level='false'] {
  display: none;
}

/* 底部信息区域样式优化 */
.queue-footer {
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

.queue-footer-info {
  width: 100%;
  overflow: hidden;
  position: relative;
}

.queue-footer-tags {
  display: inline-flex;
  flex-wrap: nowrap;
  gap: 8px;
  padding: 2px;
  white-space: nowrap;
  animation: scrollTags 25s linear infinite;
  padding-right: 16px; /* 确保最后一个标签有足够间距 */
}

@keyframes scrollTags {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(-50%); /* 移动一半距离，因为我们复制了标签 */
  }
}

.queue-footer-tags:hover {
  animation-play-state: paused;
}

.queue-footer-tag {
  display: inline-flex;
  flex-direction: column;
  padding: 5px 8px;
  border-radius: 6px;
  background-color: rgba(255, 255, 255, 0.12);
  min-width: max-content;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.queue-footer-tag[type="keyword"] {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(37, 99, 235, 0.18));
}

.queue-footer-tag[type="allow"] {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(5, 150, 105, 0.18));
}

.queue-footer-tag[type="gift"] {
  background: linear-gradient(135deg, rgba(244, 114, 182, 0.12), rgba(219, 39, 119, 0.18));
}

.queue-footer-tag[type="price"] {
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.12), rgba(245, 158, 11, 0.18));
}

.queue-footer-tag[type="gift-names"] {
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.12), rgba(124, 58, 237, 0.18));
}

.queue-footer-tag[type="medal"] {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(220, 38, 38, 0.18));
}

.queue-footer-tag:hover {
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
}

@keyframes animated-border {
  0% {
    box-shadow: 0 0 0px #589580;
  }

  100% {
    box-shadow: 0 0 0 6px rgba(255, 255, 255, 0);
  }
}

.queue-list-item[from='0'] .queue-list-item-payment {
  font-style: italic;
  font-weight: bold;
  color: #d2d8d6;
  font-size: 12px;
}

.queue-list-item[from='0'] .queue-list-item-avatar {
  display: none;
}

.queue-list-item[payment='0'] .queue-list-item-payment {
  display: none;
}
</style>
