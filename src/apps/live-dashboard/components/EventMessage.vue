<script setup lang="ts">
import { computed } from 'vue'

import { SimpleTooltip } from '@/shared/ui/tooltip'
import { useLiveEmoji } from '@/store/useLiveEmoji'

import { parseMessage } from '../core/message'

const props = defineProps<{ msg: string; emoji?: string }>()
const liveEmoji = useLiveEmoji()
const segments = computed(() => parseMessage(props.msg, liveEmoji.merged))
</script>

<template>
  <img
    v-if="emoji"
    class="block max-h-[4.5em] max-w-[8em]"
    :src="emoji"
    :alt="msg"
    referrerpolicy="no-referrer"
    loading="lazy"
  />
  <template v-else>
    <template
      v-for="(seg, i) in segments"
      :key="i"
    >
      <img
        v-if="seg.kind === 'emoji'"
        class="h-[1.4em] align-[-0.35em] mx-px"
        :src="seg.url"
        :alt="seg.name"
        referrerpolicy="no-referrer"
        loading="lazy"
      />
      <SimpleTooltip
        v-else-if="seg.kind === 'spoiler'"
        :content="seg.text"
      >
        <span class="blur-[5px] hover:blur-none transition-[filter] duration-150 cursor-help">{{ seg.text }}</span>
      </SimpleTooltip>
      <template v-else>{{ seg.text }}</template>
    </template>
  </template>
</template>
