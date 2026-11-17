<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'

import * as constants from '@/apps/obs/components/blivechat/constants'
import { formatCurrency } from '@/apps/obs/components/blivechat/utils'

import ImgShadow from './ImgShadow.vue'
import MembershipItem from './MembershipItem.vue'
import PaidMessage from './PaidMessage.vue'

export interface TickerMessage {
  id: string
  type: number
  addTime: Date
  time: Date
  avatarUrl?: string
  authorName: string
  authorNamePronunciation?: string
  price: number
  giftName?: string
  num?: number
  privilegeType?: number
  title?: string
  content?: string
  translation?: string
}

interface ShowTickerMessage {
  raw: TickerMessage
  bgColor: string
  color: string
  text: string
}

const props = withDefaults(
  defineProps<{
    messages?: TickerMessage[]
    minGiftPrice?: number
    showGiftName?: boolean
  }>(),
  {
    messages: () => [],
    minGiftPrice: 0,
    showGiftName: false,
  },
)

const emit = defineEmits<{
  'update:messages': [messages: TickerMessage[]]
}>()

const MESSAGE_TYPE_MEMBER = constants.MESSAGE_TYPE_MEMBER
const curTime = ref(new Date())
const pinnedMessageId = ref<string | null>(null)
const pinnedMessage = computed(
  () => props.messages.find((message) => message.id === pinnedMessageId.value && needToShow(message)) ?? null,
)

// 定时更新进度
const updateTimerId = window.setInterval(updateProgress, 1000)
onBeforeUnmount(() => {
  window.clearInterval(updateTimerId)
})

const showMessages = computed<ShowTickerMessage[]>(() => {
  const res: ShowTickerMessage[] = []
  for (const message of props.messages) {
    if (!needToShow(message)) {
      continue
    }
    res.push({
      raw: message,
      bgColor: getBgColor(message),
      color: getColor(message),
      text: getText(message),
    })
  }
  return res
})

const pinnedMessageShowContent = computed(() => {
  if (!pinnedMessage.value) {
    return ''
  }
  if (pinnedMessage.value.type === constants.MESSAGE_TYPE_GIFT) {
    return constants.getGiftShowContent(pinnedMessage.value, props.showGiftName)
  } else {
    return constants.getShowContent(pinnedMessage.value)
  }
})

async function onTickerItemEnter(el: Element, done: () => void) {
  const htmlEl = el as HTMLElement
  const width = htmlEl.clientWidth
  if (width === 0) {
    // CSS指定了不显示固定栏
    done()
    return
  }
  htmlEl.style.width = '0'
  await nextTick()
  htmlEl.style.width = `${width}px`
  window.setTimeout(done, 200)
}

function onTickerItemLeave(el: Element, done: () => void) {
  const htmlEl = el as HTMLElement
  htmlEl.classList.add('sliding-down')
  window.setTimeout(() => {
    htmlEl.classList.add('collapsing')
    htmlEl.style.width = '0'
    window.setTimeout(() => {
      htmlEl.classList.remove('sliding-down')
      htmlEl.classList.remove('collapsing')
      htmlEl.style.width = 'auto'
      done()
    }, 200)
  }, 200)
}

const getShowAuthorName = constants.getShowAuthorName

function needToShow(message: TickerMessage) {
  if (message.type === constants.MESSAGE_TYPE_GIFT && message.price < props.minGiftPrice) return false
  const pinTime = getPinTime(message)
  return (Date.now() - message.addTime.getTime()) / (60 * 1000) < pinTime
}

function getBgColor(message: TickerMessage) {
  let color1: string, color2: string
  if (message.type === constants.MESSAGE_TYPE_MEMBER) {
    color1 = 'rgba(15,157,88,1)'
    color2 = 'rgba(11,128,67,1)'
  } else {
    const config = constants.getPriceConfig(message.price)
    color1 = config.colors.contentBg
    color2 = config.colors.headerBg
  }
  const pinTime = getPinTime(message)
  let progress = (1 - (curTime.value.getTime() - message.addTime.getTime()) / (60 * 1000) / pinTime) * 100
  if (progress < 0) {
    progress = 0
  } else if (progress > 100) {
    progress = 100
  }
  return `linear-gradient(90deg, ${color1}, ${color1} ${progress}%, ${color2} ${progress}%, ${color2})`
}

function getColor(message: TickerMessage) {
  if (message.type === constants.MESSAGE_TYPE_MEMBER) {
    return 'rgb(255,255,255)'
  }
  return constants.getPriceConfig(message.price).colors.header
}

function getText(message: TickerMessage) {
  if (message.type === constants.MESSAGE_TYPE_MEMBER) {
    return '舰长'
  }
  return `CN¥${formatCurrency(message.price)}`
}

function getPinTime(message: TickerMessage) {
  if (message.type === constants.MESSAGE_TYPE_MEMBER) {
    return 2
  }
  return Math.max(2, constants.getPriceConfig(message.price).pinTime)
}

function updateProgress() {
  // 更新进度
  curTime.value = new Date()

  // 删除过期的消息
  const filteredMessages: TickerMessage[] = []
  let messagesChanged = false
  for (const message of props.messages) {
    const pinTime = getPinTime(message)
    if ((curTime.value.getTime() - message.addTime.getTime()) / (60 * 1000) >= pinTime) {
      messagesChanged = true
      continue
    }
    filteredMessages.push(message)
  }
  if (messagesChanged) {
    emit('update:messages', filteredMessages)
  }
}

function onItemClick(message: TickerMessage) {
  pinnedMessageId.value = pinnedMessageId.value === message.id ? null : message.id
}
</script>

<template>
  <yt-live-chat-ticker-renderer :hidden="showMessages.length === 0">
    <div
      id="container"
      dir="ltr"
      class="style-scope yt-live-chat-ticker-renderer"
    >
      <transition-group
        id="items"
        tag="div"
        :css="false"
        class="style-scope yt-live-chat-ticker-renderer"
        @enter="onTickerItemEnter"
        @leave="onTickerItemLeave"
      >
        <yt-live-chat-ticker-paid-message-item-renderer
          v-for="message in showMessages"
          :key="message.raw.id"
          tabindex="0"
          class="style-scope yt-live-chat-ticker-renderer"
          style="overflow: hidden"
          @click="onItemClick(message.raw)"
        >
          <div
            id="container"
            dir="ltr"
            class="style-scope yt-live-chat-ticker-paid-message-item-renderer"
            :style="{
              background: message.bgColor,
            }"
          >
            <div
              id="content"
              class="style-scope yt-live-chat-ticker-paid-message-item-renderer"
              :style="{
                color: message.color,
              }"
            >
              <ImgShadow
                id="author-photo"
                height="24"
                width="24"
                class="style-scope yt-live-chat-ticker-paid-message-item-renderer"
                :img-url="message.raw.avatarUrl"
              />
              <span
                id="text"
                dir="ltr"
                class="style-scope yt-live-chat-ticker-paid-message-item-renderer"
                >{{ message.text }}</span
              >
            </div>
          </div>
        </yt-live-chat-ticker-paid-message-item-renderer>
      </transition-group>
    </div>
    <template v-if="pinnedMessage">
      <MembershipItem
        v-if="pinnedMessage.type === MESSAGE_TYPE_MEMBER"
        :key="pinnedMessage.id"
        class="style-scope yt-live-chat-ticker-renderer"
        :avatar-url="pinnedMessage.avatarUrl"
        :author-name="getShowAuthorName(pinnedMessage)"
        :privilege-type="pinnedMessage.privilegeType"
        :title="pinnedMessage.title"
        :time="pinnedMessage.time"
      />
      <PaidMessage
        v-else
        :key="pinnedMessage.id"
        class="style-scope yt-live-chat-ticker-renderer"
        :price="pinnedMessage.price"
        :avatar-url="pinnedMessage.avatarUrl"
        :author-name="getShowAuthorName(pinnedMessage)"
        :time="pinnedMessage.time"
        :content="pinnedMessageShowContent"
      />
    </template>
  </yt-live-chat-ticker-renderer>
</template>

<style src="@/assets/css/youtube/yt-live-chat-ticker-renderer.css"></style>

<style src="@/assets/css/youtube/yt-live-chat-ticker-paid-message-item-renderer.css"></style>
