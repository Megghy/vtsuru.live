<template>
  <yt-live-chat-author-chip>
    <span
      id="author-name"
      dir="auto"
      class="style-scope yt-live-chat-author-chip"
      :class="{ member: isInMemberMessage }"
      :type="authorTypeText"
    >
      {{ authorName }}
      <!-- 这里是已验证勋章 -->
      <span
        id="chip-badges"
        class="style-scope yt-live-chat-author-chip"
      />
    </span>
    <span
      id="chat-badges"
      class="style-scope yt-live-chat-author-chip"
    >
      <author-badge
        v-if="isInMemberMessage"
        class="style-scope yt-live-chat-author-chip"
        :is-admin="false"
        :privilege-type="privilegeType"
      />
      <template v-else>
        <author-badge
          v-if="authorType === AUTHOR_TYPE_ADMIN"
          class="style-scope yt-live-chat-author-chip"
          is-admin
          :privilege-type="0"
        />
        <author-badge
          v-if="privilegeType > 0"
          class="style-scope yt-live-chat-author-chip"
          :is-admin="false"
          :privilege-type="privilegeType"
        />
      </template>
    </span>
  </yt-live-chat-author-chip>
</template>

<script setup>
import { computed } from 'vue'
import AuthorBadge from './AuthorBadge.vue'
import * as constants from './constants'

const props = defineProps({
  isInMemberMessage: Boolean,
  authorName: String,
  authorType: Number,
  privilegeType: Number
})

const AUTHOR_TYPE_ADMIN = constants.AUTHOR_TYPE_ADMIN

const authorTypeText = computed(() => {
  return constants.AUTHOR_TYPE_TO_TEXT[props.authorType]
})
</script>

<style src="@/assets/css/youtube/yt-live-chat-author-chip.css"></style>
