<script setup lang="ts">
import { NTag } from 'naive-ui'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    songKey: string
    singingKeys: Set<string>
    queuedKeys: Set<string>
    /** tag: NTag；text: 纯文本 span */
    variant?: 'tag' | 'text'
    size?: 'tiny' | 'small'
  }>(),
  {
    variant: 'tag',
    size: 'tiny',
  },
)

const status = computed(() => {
  if (props.singingKeys.has(props.songKey)) return 'singing' as const
  if (props.queuedKeys.has(props.songKey)) return 'queued' as const
  return null
})
</script>

<template>
  <template v-if="status">
    <NTag
      v-if="variant === 'tag'"
      class="song-status-badge"
      :class="status"
      :size="size"
      :type="status === 'singing' ? 'warning' : 'success'"
      :bordered="false"
    >
      {{ status === 'singing' ? '演唱中' : '排队中' }}
    </NTag>
    <span
      v-else
      class="song-status-badge text"
      :class="status"
    >
      {{ status === 'singing' ? '演唱中' : '排队中' }}
    </span>
  </template>
</template>

<style scoped>
.song-status-badge.text {
  font-size: 12px;
  font-weight: 600;
}

.song-status-badge.text.singing {
  color: var(--song-warning, #f0a020);
}

.song-status-badge.text.queued {
  color: var(--song-success, #18a058);
}
</style>
