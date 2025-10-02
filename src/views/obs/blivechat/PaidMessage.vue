<script setup>
import { computed } from 'vue'
import * as constants from './constants'
import ImgShadow from './ImgShadow.vue'
import * as utils from './utils'

const props = defineProps({
  avatarUrl: String,
  authorName: String,
  price: Number, // 价格，人民币
  priceText: String,
  time: Date,
  content: String,
})

const priceConfig = computed(() => {
  return constants.getPriceConfig(props.price)
})

const color = computed(() => {
  return priceConfig.value.colors
})

const showPriceText = computed(() => {
  return props.priceText || `CN¥${utils.formatCurrency(props.price)}`
})

const timeText = computed(() => {
  return utils.getTimeTextHourMin(props.time)
})
</script>

<template>
  <yt-live-chat-paid-message-renderer
    class="style-scope yt-live-chat-item-list-renderer"
    allow-animations
    :show-only-header="!content || undefined"
    :style="{
      '--yt-live-chat-paid-message-primary-color': color.contentBg,
      '--yt-live-chat-paid-message-secondary-color': color.headerBg,
      '--yt-live-chat-paid-message-header-color': color.header,
      '--yt-live-chat-paid-message-author-name-color': color.authorName,
      '--yt-live-chat-paid-message-timestamp-color': color.time,
      '--yt-live-chat-paid-message-color': color.content,
    }"
    :blc-price-level="priceConfig.priceLevel"
  >
    <div
      id="card"
      class="style-scope yt-live-chat-paid-message-renderer"
    >
      <div
        id="header"
        class="style-scope yt-live-chat-paid-message-renderer"
      >
        <ImgShadow
          id="author-photo"
          height="40"
          width="40"
          class="style-scope yt-live-chat-paid-message-renderer"
          :img-url="avatarUrl"
        />
        <div
          id="header-content"
          class="style-scope yt-live-chat-paid-message-renderer"
        >
          <div
            id="header-content-primary-column"
            class="style-scope yt-live-chat-paid-message-renderer"
          >
            <div
              id="author-name"
              class="style-scope yt-live-chat-paid-message-renderer"
            >
              {{ authorName }}
            </div>
            <div
              id="purchase-amount"
              class="style-scope yt-live-chat-paid-message-renderer"
            >
              {{ showPriceText }}
            </div>
          </div>
          <span
            id="timestamp"
            class="style-scope yt-live-chat-paid-message-renderer"
          >{{ timeText }}</span>
        </div>
      </div>
      <div
        id="content"
        class="style-scope yt-live-chat-paid-message-renderer"
      >
        <div
          id="message"
          dir="auto"
          class="style-scope yt-live-chat-paid-message-renderer"
        >
          {{ content }}
        </div>
      </div>
    </div>
  </yt-live-chat-paid-message-renderer>
</template>

<style src="@/assets/css/youtube/yt-live-chat-paid-message-renderer.css"></style>
