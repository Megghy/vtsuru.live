<script>
import { cloneDeep } from 'lodash-es'
import { defineComponent } from 'vue'
import { defaultDanmujiStyle } from '@/shared/danmujiStyle'

import * as constants from './constants'
import MembershipItem from './MembershipItem.vue'
import PaidMessage from './PaidMessage.vue'
import TextMessage from './TextMessage.vue'
import Ticker from './Ticker.vue'
import messageScroll from './messageScroll'
import messageMerge from './messageMerge'
import messageQueue from './messageQueue'

export default defineComponent({
  name: 'ChatRenderer',
  mixins: [messageScroll, messageMerge, messageQueue],
  components: {
    Ticker,
    TextMessage,
    MembershipItem,
    PaidMessage,
  },
  props: {
    appearance: { type: Object, default: () => ({ ...defaultDanmujiStyle }) },
    maxNumber: {
      type: Number,
      default: 60,
    },
    showGiftName: {
      type: Boolean,
      default: false,
    },
    customCss: {
      type: String,
      default: '',
    },
  },
  data() {
    return {
      MESSAGE_TYPE_TEXT: constants.MESSAGE_TYPE_TEXT,
      MESSAGE_TYPE_GIFT: constants.MESSAGE_TYPE_GIFT,
      MESSAGE_TYPE_MEMBER: constants.MESSAGE_TYPE_MEMBER,
      MESSAGE_TYPE_SUPER_CHAT: constants.MESSAGE_TYPE_SUPER_CHAT,

      messages: [], // 显示的消息
      paidMessages: [], // 固定在上方的消息

      smoothedMessageQueue: [], // 平滑消息队列，由外部调用addMessages等方法添加
      emitSmoothedMessageTimerId: null, // 消费平滑消息队列的定时器ID
      enqueueIntervals: [], // 最近进队列的时间间隔，用来估计下次进队列的时间
      lastEnqueueTime: null, // 上次进队列的时间
      estimatedEnqueueInterval: null, // 估计的下次进队列时间间隔

      messagesBuffer: [], // 暂时未显示的消息，当不能自动滚动时会积压在这
      preinsertHeight: 0, // 插入新消息之前items的高度
      isSmoothed: true, // 是否平滑滚动，当消息太快时不平滑滚动
      chatRateMs: 1000, // 用来计算消息速度
      scrollPixelsRemaining: 0, // 平滑滚动剩余像素
      scrollTimeRemainingMs: 0, // 平滑滚动剩余时间
      lastSmoothChatMessageAddMs: null, // 上次showNewMessages时间
      smoothScrollRafHandle: null, // 平滑滚动requestAnimationFrame句柄
      lastSmoothScrollUpdate: null, // 平滑滚动上一帧时间

      atBottom: true, // 滚动到底部，用来判断能否自动滚动
      cantScrollStartTime: null, // 开始不能自动滚动的时间，用来防止卡住

      customStyleElement: null,
      expiryTimer: null,

    }
  },
  computed: {
    displayMessages() {
      return this.appearance.reverse ? this.messages : this.messages.toReversed()
    },
    canScrollToBottom() {
      return this.atBottom /* || this.allowScroll */
    },
  },
  watch: {
    'appearance.reverse'() {
      this.resetSmoothScroll()
      this.$nextTick(this.scrollToBottom)
    },
    canScrollToBottom(val) {
      this.cantScrollStartTime = val ? null : new Date()
    },
    customCss: {
      immediate: true,
      handler(val) {
        this.setCss(val)
      },
    },
  },
  mounted() {
    this.expiryTimer = window.setInterval(() => {
      if (!this.appearance.autoHide) return
      const cutoff = Date.now() - this.appearance.autoHide * 1000
      const expired = new Set([...this.messages, ...this.paidMessages, ...this.messagesBuffer]
        .filter(message => message.addTime.getTime() <= cutoff).map(message => message.id))
      for (const id of expired) this.handleDelMessage({ id })
      if (expired.size) this.$nextTick(this.maybeResizeScrollContainer)
    }, 1000)
    this.scrollToBottom()
  },
  beforeUnmount() {
    window.clearInterval(this.expiryTimer)
    if (this.emitSmoothedMessageTimerId) {
      window.clearTimeout(this.emitSmoothedMessageTimerId)
      this.emitSmoothedMessageTimerId = null
    }
    this.resetSmoothScroll()
    this.messages = []
    this.paidMessages = []
    this.smoothedMessageQueue = []
    this.messagesBuffer = []
    this.customStyleElement?.remove()
  },
  methods: {
    getGiftShowContent(message) {
      return constants.getGiftShowContent(message, this.showGiftName)
    },
    getGiftShowNameAndNum: constants.getGiftShowNameAndNum,
    getShowContent: constants.getShowContent,
    getShowContentParts: constants.getShowContentParts,
    getShowAuthorName: constants.getShowAuthorName,

    addMessage(message) {
      this.addMessages([message])
    },
    addMessages(messages) {
      this.enqueueMessages(messages)
    },
    setCss(css) {
      if (!this.customStyleElement) {
        this.customStyleElement = document.createElement('style')
        document.head.appendChild(this.customStyleElement)
      }
      this.customStyleElement.textContent = css
    },
    // 从新到老迭代num条消息，注意会迭代smoothedMessageQueue，不会迭代paidMessages
    *iterRecentMessages(num, onlyCountAddMessages = true) {
      if (num <= 0) {
        return
      }
      for (const arr of this.iterMessageArrs()) {
        for (let i = arr.length - 1; i >= 0 && num > 0; i--) {
          const message = arr[i]
          yield message
          if (!onlyCountAddMessages || this.isAddMessage(message)) {
            num--
          }
        }
        if (num <= 0) {
          break
        }
      }
    },
    // 从新到老迭代消息的数组
    *iterMessageArrs() {
      for (let i = this.smoothedMessageQueue.length - 1; i >= 0; i--) {
        yield this.smoothedMessageQueue[i]
      }
      yield this.messagesBuffer
      yield this.messages
    },
    delMessage(id) {
      this.delMessages([id])
    },
    deleteMessage(id) {
      this.delMessages([id])
    },
    delMessages(ids) {
      this.enqueueMessages(
        ids.map((id) => ({
          type: constants.MESSAGE_TYPE_DEL,
          id,
        })),
      )
    },
    clearMessages() {
      this.resetSmoothScroll()
      if (this.emitSmoothedMessageTimerId) {
        window.clearTimeout(this.emitSmoothedMessageTimerId)
        this.emitSmoothedMessageTimerId = null
      }
      this.messages = []
      this.paidMessages = []
      this.smoothedMessageQueue = []
      this.messagesBuffer = []
      this.isSmoothed = true
      this.lastSmoothChatMessageAddMs = null
      this.chatRateMs = 1000
      this.lastSmoothScrollUpdate = null
      this.scrollTimeRemainingMs = this.scrollPixelsRemaining = 0
      this.smoothScrollRafHandle = null
      this.preinsertHeight = 0
      this.maybeResizeScrollContainer()
      if (!this.atBottom) {
        this.scrollToBottom()
      }
    },
    updateMessage(id, newValuesObj) {
      this.enqueueMessages([
        {
          type: constants.MESSAGE_TYPE_UPDATE,
          id,
          newValuesObj,
        },
      ])
    },

    handleMessageGroup(messageGroup) {
      if (messageGroup.length <= 0) {
        return
      }

      for (const message of messageGroup) {
        switch (message.type) {
          case constants.MESSAGE_TYPE_TEXT:
          case constants.MESSAGE_TYPE_GIFT:
          case constants.MESSAGE_TYPE_MEMBER:
          case constants.MESSAGE_TYPE_SUPER_CHAT:
            // 这里处理的类型要和 ADD_MESSAGE_TYPES 一致
            this.handleAddMessage(message)
            break
          case constants.MESSAGE_TYPE_DEL:
            this.handleDelMessage(message)
            break
          case constants.MESSAGE_TYPE_UPDATE:
            this.handleUpdateMessage(message)
            break
        }
      }

      this.maybeResizeScrollContainer()
      this.flushMessagesBuffer()
      this.$nextTick(this.maybeScrollToBottom)
    },
    handleAddMessage(message) {
      // 添加一个本地时间给Ticker用，防止本地时间和服务器时间相差很大的情况
      message.addTime = new Date()

      if (message.type === constants.MESSAGE_TYPE_SUPER_CHAT || message.type === constants.MESSAGE_TYPE_GIFT && message.price >= this.appearance.pinnedMinPrice) {
        this.paidMessages.unshift(cloneDeep(message))
        const MAX_PAID_MESSAGE_NUM = 100
        if (this.paidMessages.length > MAX_PAID_MESSAGE_NUM) {
          this.paidMessages.splice(MAX_PAID_MESSAGE_NUM, this.paidMessages.length - MAX_PAID_MESSAGE_NUM)
        }
      }

      // 不知道cloneDeep拷贝Vue的响应式对象会不会有问题，保险起见把这句放在后面
      this.messagesBuffer.push(message)
    },
    handleDelMessage({ id }) {
      const arrs = [this.messages, this.paidMessages, this.messagesBuffer]
      let needResetSmoothScroll = false
      for (const arr of arrs) {
        for (let i = 0; i < arr.length; i++) {
          if (arr[i].id !== id) {
            continue
          }
          arr.splice(i, 1)
          if (arr === this.messages) {
            needResetSmoothScroll = true
          }
          break
        }
      }
      if (needResetSmoothScroll) {
        this.resetSmoothScroll()
      }
    },
    handleUpdateMessage({ id, newValuesObj }) {
      const arrs = [this.messages, this.paidMessages, this.messagesBuffer]
      let needResetSmoothScroll = false
      for (const arr of arrs) {
        for (const message of arr) {
          if (message.id !== id) {
            continue
          }
          this.doUpdateMessage(message, newValuesObj)
          if (arr === this.messages) {
            needResetSmoothScroll = true
          }
          break
        }
      }
      if (needResetSmoothScroll) {
        this.resetSmoothScroll()
      }
    },
    doUpdateMessage(message, newValuesObj) {
      // +=
      const addValuesObj = newValuesObj.$add
      if (addValuesObj !== undefined) {
        for (const name in addValuesObj) {
          message[name] += addValuesObj[name]
        }
      }

      // =
      for (const name in newValuesObj) {
        if (!name.startsWith('$')) {
          message[name] = newValuesObj[name]
        }
      }
    },

    async flushMessagesBuffer() {
      if (this.messagesBuffer.length <= 0) {
        return
      }
      if (!this.canScrollToBottomOrTimedOut()) {
        if (this.messagesBuffer.length > this.maxNumber) {
          // 未显示消息数 > 最大可显示数，丢弃
          this.messagesBuffer.splice(0, this.messagesBuffer.length - this.maxNumber)
        }
        return
      }

      const removeNum = Math.max(this.messages.length + this.messagesBuffer.length - this.maxNumber, 0)
      if (removeNum > 0) {
        this.messages.splice(0, removeNum)
        // 防止同时添加和删除项目时所有的项目重新渲染 https://github.com/vuejs/vue/issues/6857
        await this.$nextTick()
      }

      const refs = this.scrollRefs()
      if (!refs) return
      this.preinsertHeight = refs.items.clientHeight
      for (const message of this.messagesBuffer) {
        this.messages.push(message)
      }
      this.messagesBuffer = []
      // 等items高度变化
      await this.$nextTick()
      this.showNewMessages()
    },

  },
})
</script>

<template>
  <yt-live-chat-renderer
    class="style-scope yt-live-chat-app"
    style="--scrollbar-width: 11px"
    hide-timestamps
    @mousemove="refreshCantScrollStartTime"
  >
    <Ticker
      v-model:messages="paidMessages"
      :min-gift-price="appearance.pinnedMinPrice"
      class="style-scope yt-live-chat-renderer"
      :show-gift-name="showGiftName || undefined"
    />
    <yt-live-chat-item-list-renderer
      class="style-scope yt-live-chat-renderer"
      allow-scroll
    >
      <div
        id="item-scroller"
        ref="scroller"
        class="style-scope yt-live-chat-item-list-renderer animated"
        @scroll="onScroll"
      >
        <div
          id="item-offset"
          ref="itemOffset"
          class="style-scope yt-live-chat-item-list-renderer"
        >
          <div
            id="items"
            ref="items"
            class="style-scope yt-live-chat-item-list-renderer"
            style="overflow: hidden"
            :style="{ top: appearance.reverse ? undefined : 0, bottom: appearance.reverse ? 0 : 'auto', transform: `translateY(${Math.floor(appearance.reverse ? scrollPixelsRemaining : -scrollPixelsRemaining)}px)` }"
          >
            <template
              v-for="message in displayMessages"
              :key="message.id"
            >
              <TextMessage
                v-if="message.type === MESSAGE_TYPE_TEXT"
                class="style-scope yt-live-chat-item-list-renderer"
                :time="message.time"
                :avatar-url="message.avatarUrl"
                :author-name="message.authorName"
                :author-type="message.authorType"
                :privilege-type="message.privilegeType"
                :content-parts="getShowContentParts(message)"
                :repeated="message.repeated"
              />
              <PaidMessage
                v-else-if="message.type === MESSAGE_TYPE_GIFT"
                class="style-scope yt-live-chat-item-list-renderer"
                :time="message.time"
                :avatar-url="message.avatarUrl"
                :author-name="getShowAuthorName(message)"
                :price="message.price"
                :price-text="message.price <= 0 ? getGiftShowNameAndNum(message) : ''"
                :content="message.price <= 0 ? '' : getGiftShowContent(message, showGiftName)"
              />
              <MembershipItem
                v-else-if="message.type === MESSAGE_TYPE_MEMBER"
                class="style-scope yt-live-chat-item-list-renderer"
                :time="message.time"
                :avatar-url="message.avatarUrl"
                :author-name="getShowAuthorName(message)"
                :privilege-type="message.privilegeType"
                :title="message.title"
              />
              <PaidMessage
                v-else-if="message.type === MESSAGE_TYPE_SUPER_CHAT"
                class="style-scope yt-live-chat-item-list-renderer"
                :time="message.time"
                :avatar-url="message.avatarUrl"
                :author-name="getShowAuthorName(message)"
                :price="message.price"
                :content="getShowContent(message)"
              />
            </template>
          </div>
        </div>
      </div>
    </yt-live-chat-item-list-renderer>
  </yt-live-chat-renderer>
</template>

<style src="@/assets/css/youtube/yt-html.css"></style>

<style src="@/assets/css/youtube/yt-live-chat-renderer.css"></style>

<style src="@/assets/css/youtube/yt-live-chat-item-list-renderer.css"></style>
