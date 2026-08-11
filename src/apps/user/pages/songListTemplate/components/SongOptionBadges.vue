<script setup lang="ts">
import { NTag } from 'naive-ui'
import { computed } from 'vue'

import type { SongRequestOption } from '@/api/api-models'

import { getSongOptionBadges } from '../utils/songOptionBadges'

const props = withDefaults(
  defineProps<{
    options?: SongRequestOption | null
    /** semantic: NTag type；guard: 舰长色；compact: tiny 标签 */
    variant?: 'semantic' | 'guard'
    size?: 'tiny' | 'small'
    emptyText?: string
    bordered?: boolean
  }>(),
  {
    variant: 'semantic',
    size: 'small',
    emptyText: '',
    bordered: false,
  },
)

const badges = computed(() => getSongOptionBadges(props.options))
</script>

<template>
  <div
    v-if="badges.length || emptyText"
    class="song-option-badges"
  >
    <template v-if="badges.length">
      <NTag
        v-for="badge in badges"
        :key="badge.key"
        :size="size"
        :type="variant === 'semantic' ? badge.type : 'default'"
        :color="variant === 'guard' && badge.color ? { color: badge.color } : undefined"
        :bordered="bordered"
        round
      >
        {{ badge.label }}
      </NTag>
    </template>
    <span
      v-else
      class="song-option-badges__empty"
    >
      {{ emptyText }}
    </span>
  </div>
</template>

<style scoped>
.song-option-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.song-option-badges__empty {
  color: var(--vtsuru-fg-muted, var(--vtsuru-fg, inherit));
  opacity: 0.65;
  font-size: 12px;
}
</style>
