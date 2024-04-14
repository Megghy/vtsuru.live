<script setup lang="ts">
import {
  QueueFrom,
  QueueSortType,
  ResponseQueueModel,
  Setting_Queue,
  Setting_LiveRequest,
  SongRequestFrom,
  SongRequestInfo,
  QueueStatus,
} from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { AVATAR_URL, QUEUE_API_URL, SONG_REQUEST_API_URL } from '@/data/constants'
import { useElementSize } from '@vueuse/core'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Vue3Marquee } from 'vue3-marquee'
import { NCard, NDivider, NEmpty, NSpace, NText, useMessage } from 'naive-ui'
import { List } from 'linqts'

const props = defineProps<{
  id?: number
}>()

const message = useMessage()
const route = useRoute()
const currentId = computed(() => {
  return props.id ?? route.query.id
})

const listContainerRef = ref()
const footerRef = ref()
const footerListRef = ref()
const { height, width } = useElementSize(listContainerRef)
const footerSize = useElementSize(footerRef)
const footerListSize = useElementSize(footerListRef)
const itemHeight = 40

const key = ref(Date.now())

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
      list = list.ThenBy((q) => q.createAt)
      break
    }
    case QueueSortType.GuardFirst: {
      list = list.OrderBy((q) => q.user?.guard_level).ThenBy((q) => q.createAt)
      break
    }
    case QueueSortType.PaymentFist: {
      list = list.OrderByDescending((q) => q.giftPrice ?? 0).ThenBy((q) => q.createAt)
    }
  }
  if (settings.value.isReverse) {
    list = list.Reverse()
  }
  return list.ToArray()
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
  } catch (err) {}
  return {} as { queue: ResponseQueueModel[]; setting: Setting_Queue }
}
const isMoreThanContainer = computed(() => {
  return queue.value.length * itemHeight > height.value
})
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
  if (!visiable.value || !active.value) return
  const r = await get()
  if (r) {
    queue.value = r.queue.sort((a, b) => {
      return b.createAt - a.createAt
    })
    settings.value = r.setting
  }
}

const visiable = ref(true)
const active = ref(true)
let timer: any
onMounted(() => {
  update()
  timer = setInterval(update, 2000)

  //@ts-expect-error 这里获取不了
  if (window.obsstudio) {
    //@ts-expect-error 这里获取不了
    window.obsstudio.onVisibilityChange = function (visibility: boolean) {
      visiable.value = visibility
    }
    //@ts-expect-error 这里获取不了
    window.obsstudio.onActiveChange = function (a: boolean) {
      active.value = a
    }
  }
})
onUnmounted(() => {
  clearInterval(timer)
})
</script>

<template>
  <div class="queue-background" v-bind="$attrs">
    <p class="queue-header">排队</p>
    <NDivider class="queue-divider">
      <p class="queue-header-count">已有 {{ activeItems.length ?? 0 }} 人</p>
    </NDivider>
    <div
      class="queue-singing-container"
      :singing="queue.findIndex((s) => s.status == QueueStatus.Progressing) > -1"
      :from="progressing?.from as number"
      :status="progressing?.status as number"
    >
      <div class="queue-singing-prefix"></div>
      <template v-if="progressing">
        <img class="queue-singing-avatar" :src="AVATAR_URL + progressing?.user?.uid" referrerpolicy="no-referrer" />
        <p class="queue-singing-name">{{ progressing?.user?.name }}</p>
      </template>
      <div v-else class="queue-singing-empty">等待中</div>
      <div class="queue-singing-suffix"></div>
    </div>
    <div class="queue-content" ref="listContainerRef">
      <template v-if="activeItems.length > 0">
        <Vue3Marquee
          class="queue-list"
          :key="key"
          vertical
          :pause="!isMoreThanContainer"
          :duration="20"
          :style="`height: ${height}px;width: ${width}px;`"
        >
          <span
            class="queue-list-item"
            :from="item.from as number"
            :status="item.status as number"
            :payment="item.giftPrice ?? 0"
            v-for="(item, index) in activeItems"
            :key="item.id"
            :style="`height: ${itemHeight}px`"
          >
            <div class="queue-list-item-index" :index="index + 1">
              {{ index + 1 }}
            </div>
            <div
              v-if="settings.showFanMadelInfo"
              class="queue-list-item-level"
              :has-level="(item.user?.fans_medal_level ?? 0) > 0"
            >
              {{ `${item.user?.fans_medal_name} ${item.user?.fans_medal_level}` }}
            </div>
            <div class="queue-list-item-user-name">
              {{ item.user?.name }}
            </div>
            <p v-if="settings.showPayment" class="queue-list-item-payment">
              {{
                item.from == QueueFrom.Manual ? '主播添加' : item.giftPrice == undefined ? '无' : '¥ ' + item.giftPrice
              }}
            </p>
          </span>

        <NDivider v-if="isMoreThanContainer" class="queue-footer-divider" style="margin: 10px 0 10px 0" />
        </Vue3Marquee>
      </template>
      <div v-else style="position: relative; top: 20%">
        <NEmpty class="queue-empty" description="暂无人排队" />
      </div>
    </div>
    <div class="queue-footer" ref="footerRef" v-if="settings.showRequireInfo">
      <Vue3Marquee
        :key="key"
        ref="footerListRef"
        class="queue-footer-marquee"
        :pause="footerSize.width < footerListSize.width"
        :duration="20"
      >
        <span class="queue-tag" type="prefix">
          <div class="queue-tag-key">关键词</div>
          <div class="queue-tag-value">
            {{ settings.keyword }}
          </div>
        </span>
        <span class="queue-tag" type="prefix">
          <div class="queue-tag-key">允许</div>
          <div class="queue-tag-value">
            {{ settings.allowAllDanmaku ? '所有弹幕' : allowGuardTypes.length > 0 ? allowGuardTypes.join(',') : '无' }}
          </div>
        </span>
        <span class="queue-tag" type="gift">
          <div class="queue-tag-key">通过礼物</div>
          <div class="queue-tag-value">
            {{ settings.allowGift ? '允许' : '不允许' }}
          </div>
        </span>
        <span class="queue-tag" type="gift-price">
          <div class="queue-tag-key">最低价格</div>
          <div class="queue-tag-value">
            {{ settings.minGiftPrice ? '> ¥' + settings.minGiftPrice : '任意' }}
          </div>
        </span>
        <span class="queue-tag" type="gift-type">
          <div class="queue-tag-key">礼物名</div>
          <div class="queue-tag-value">
            {{ settings.giftNames ? settings.giftNames.join(', ') : '无' }}
          </div>
        </span>
        <span class="queue-tag" type="fan-madel">
          <div class="queue-tag-key">粉丝牌</div>
          <div class="queue-tag-value">
            {{
              settings.fanMedalMinLevel != undefined && !settings.allowAllDanmaku
                ? settings.fanMedalMinLevel > 0
                  ? '> ' + settings.fanMedalMinLevel
                  : '佩戴'
                : '无需'
            }}
          </div>
        </span>
      </Vue3Marquee>
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
  /* 添加无限旋转动画 */
  animation: rotate 20s linear infinite;
}
/* 网页点歌 */
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
  padding: 10px;
  height: 100%;
  border-radius: 10px;
  overflow-x: hidden;
}
.marquee {
  justify-items: left;
}
.queue-list-item {
  display: flex;
  width: 100%;
  align-self: flex-start;
  position: relative;
  align-items: center;
  justify-content: left;
  gap: 10px;
}
.queue-list-item-user-name {
  font-size: 18px;
  font-weight: bold;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 80%;
}

/* 手动添加 */
.queue-list-item[from='0'] .queue-list-item-payment {
  font-style: italic;
  font-weight: bold;
  color: #d2d8d6;
  font-size: 12px;
}
.queue-list-item[from='0'] .queue-list-item-avatar {
  display: none;
}

/* 弹幕点歌 */
.queue-list-item[payment='0'] .queue-list-item-payment {
  display: none;
}

.queue-list-item-payment {
  font-style: italic;
  font-size: 12px;
  color: rgba(233, 165, 165, 0.993);
  text-overflow: ellipsis;
  white-space: nowrap;

  margin-left: auto;
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
.queue-footer {
  margin: 0 5px 5px 5px;
  height: 60px;
  border-radius: 5px;
  background-color: #0f0f0f4f;
  display: flex;
  align-items: center;
}
.queue-tag {
  display: flex;
  margin: 5px 0 5px 5px;
  height: 40px;
  border-radius: 3px;
  background-color: #0f0f0f4f;
  padding: 4px;
  padding-right: 6px;
  display: flex;
  flex-direction: column;
  justify-content: left;
}
.queue-tag-key {
  font-style: italic;
  color: rgb(211, 211, 211);
  font-size: 12px;
}
.queue-tag-value {
  font-size: 14px;
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
