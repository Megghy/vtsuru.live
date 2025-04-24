<template>
  <yt-live-chat-text-message-renderer
    :author-type="authorTypeText"
    :blc-guard-level="privilegeType"
  >
    <img-shadow
      id="author-photo"
      height="24"
      width="24"
      class="style-scope yt-live-chat-text-message-renderer"
      :img-url="avatarUrl"
    />
    <div
      id="content"
      class="style-scope yt-live-chat-text-message-renderer"
    >
      <span
        id="timestamp"
        class="style-scope yt-live-chat-text-message-renderer"
      >{{ timeText }}</span>
      <author-chip
        class="style-scope yt-live-chat-text-message-renderer"
        :is-in-member-message="false"
        :author-name="authorName"
        :author-type="authorType"
        :privilege-type="privilegeType"
      />
      <span
        id="message"
        class="style-scope yt-live-chat-text-message-renderer"
      >
        <template v-for="(content, index) in richContent">
          <span
            v-if="content.type === CONTENT_TYPE_TEXT"
            :key="index"
          >{{ content.text }}</span>
          <!-- 如果CSS设置的尺寸比属性设置的尺寸还大，在图片加载完后布局会变化，可能导致滚动卡住，没什么好的解决方法 -->
          <img
            v-else-if="content.type === CONTENT_TYPE_IMAGE"
            :id="`emoji-${content.text}`"
            :key="'_' + index"
            class="emoji yt-formatted-string style-scope yt-live-chat-text-message-renderer"
            :src="content.url"
            :alt="content.text"
            :shared-tooltip-text="content.text"
            :width="content.width"
            :height="content.height"
            :class="{ 'blc-large-emoji': content.height >= 100 }"
            referrerpolicy="no-referrer"
          >
        </template>
        <NBadge
          v-if="repeated > 1"
          :value="repeated"
          :max="99"
          class="style-scope yt-live-chat-text-message-renderer"
          :style="{ '--repeated-mark-color': repeatedMarkColor }"
        />
      </span>
    </div>
  </yt-live-chat-text-message-renderer>
</template>

<script setup>
import { computed } from 'vue'
import ImgShadow from './ImgShadow.vue'
import AuthorChip from './AuthorChip.vue'
import * as constants from './constants'
import * as utils from './utils'
import { NBadge } from 'naive-ui'

// HSL
const REPEATED_MARK_COLOR_START = [210, 100.0, 62.5]
const REPEATED_MARK_COLOR_END = [360, 87.3, 69.2]

const CONTENT_TYPE_TEXT = constants.CONTENT_TYPE_TEXT
const CONTENT_TYPE_IMAGE = constants.CONTENT_TYPE_IMAGE

const props = defineProps({
  avatarUrl: String,
  time: Date,
  authorName: String,
  authorType: Number,
  richContent: Array,
  privilegeType: Number,
  repeated: Number
})

const timeText = computed(() => {
  return utils.getTimeTextHourMin(props.time)
})

const authorTypeText = computed(() => {
  return constants.AUTHOR_TYPE_TO_TEXT[props.authorType]
})

const repeatedMarkColor = computed(() => {
  let color
  if (props.repeated <= 2) {
    color = REPEATED_MARK_COLOR_START
  } else if (props.repeated >= 10) {
    color = REPEATED_MARK_COLOR_END
  } else {
    color = [0, 0, 0]
    let t = (props.repeated - 2) / (10 - 2)
    for (let i = 0; i < 3; i++) {
      color[i] = REPEATED_MARK_COLOR_START[i] + ((REPEATED_MARK_COLOR_END[i] - REPEATED_MARK_COLOR_START[i]) * t)
    }
  }
  return `hsl(${color[0]}, ${color[1]}%, ${color[2]}%)`
})
</script>

<style>
yt-live-chat-text-message-renderer>#content>#message>.el-badge {
  margin-left: 10px;
}

yt-live-chat-text-message-renderer>#content>#message>.el-badge .el-badge__content {
  font-size: 12px !important;
  line-height: 18px !important;
  text-shadow: none !important;
  font-family: sans-serif !important;
  color: #FFF !important;
  background-color: var(--repeated-mark-color) !important;
  border: none;
}
</style>

<style src="@/assets/css/youtube/yt-live-chat-text-message-renderer.css"></style>
