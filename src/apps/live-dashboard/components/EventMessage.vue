<script setup lang="ts">
import { computed } from 'vue'

import { useLiveEmoji } from '@/store/useLiveEmoji'

import { parseMessage } from '../core/message'

const props = defineProps<{ msg: string; emoji?: string }>()
const liveEmoji = useLiveEmoji()
const segments = computed(() => parseMessage(props.msg, liveEmoji.merged))
</script>

<template>
  <img
    v-if="emoji"
    class="dm-sticker"
    :src="emoji"
    :alt="msg"
    referrerpolicy="no-referrer"
    loading="lazy"
  >
  <template v-else>
    <template
      v-for="(seg, i) in segments"
      :key="i"
    >
      <img
        v-if="seg.kind === 'emoji'"
        class="dm-emoji"
        :src="seg.url"
        :alt="seg.name"
        referrerpolicy="no-referrer"
        loading="lazy"
      >
      <span
        v-else-if="seg.kind === 'spoiler'"
        class="spoiler"
        :title="seg.text"
      >{{ seg.text }}</span>
      <template v-else>{{ seg.text }}</template>
    </template>
  </template>
</template>

<style scoped>
.dm-sticker {
  display: block;
  max-height: 4.5em;
  max-width: 8em;
}

.dm-emoji {
  height: 1.4em;
  vertical-align: -0.35em;
  margin: 0 1px;
}

.spoiler {
  filter: blur(5px);
  transition: filter 0.15s ease;
  cursor: help;
}

.spoiler:hover {
  filter: none;
}
</style>
