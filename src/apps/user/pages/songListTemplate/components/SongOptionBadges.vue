<script setup lang="ts">
import { computed } from 'vue'

import type { SongRequestOption } from '@/api/generated/model'
import { Badge } from '@/shared/ui/badge'

import { getSongOptionBadges } from '../utils/songOptionBadges'

const props = withDefaults(
  defineProps<{
    options?: SongRequestOption | null
    /** semantic: Badge type；guard: 舰长色；compact: tiny 标签 */
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
    class="song-option-badges flex flex-wrap gap-1"
  >
    <template v-if="badges.length">
      <Badge
        v-for="badge in badges"
        :key="badge.key"
        variant="secondary"
        class="font-normal rounded-full"
        :class="size === 'tiny' ? 'text-[10px] h-4 px-1.5' : 'text-[11px] h-5 px-2'"
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
