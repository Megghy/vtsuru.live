<script setup lang="ts">
import { computed } from 'vue'

import type { SongRequestOption } from '@/api/generated/model'
import { Badge } from '@/shared/ui/badge'

import { getSongOptionBadges } from '../utils/songOptionBadges'

const props = withDefaults(
  defineProps<{
    options?: SongRequestOption | null
    /** semantic: Badge type；guard: 舰长色 */
    variant?: 'semantic' | 'guard'
    size?: 'tiny' | 'small'
    emptyText?: string
  }>(),
  {
    variant: 'semantic',
    size: 'small',
    emptyText: '',
  },
)

const badges = computed(() => getSongOptionBadges(props.options))
</script>

<template>
  <div
    v-if="badges.length || emptyText"
    class="song-option-badges flex flex-wrap gap-1"
  >
    <template v-if="badges.length">
      <Badge
        v-for="badge in badges"
        :key="badge.key"
        variant="secondary"
        :size="size === 'tiny' ? 'xs' : 'sm'"
        :style="
          variant === 'guard' && badge.color
            ? { backgroundColor: `${badge.color}20`, color: badge.color, borderColor: `${badge.color}40` }
            : undefined
        "
      >
        {{ badge.label }}
      </Badge>
    </template>
    <span
      v-else
      class="song-option-badges__empty text-xs text-muted-foreground"
    >
      {{ emptyText }}
    </span>
  </div>
</template>
