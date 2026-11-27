<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import type { ResponseUserInfo } from '@/api/generated/model'
import {
  getEnabledUserFunctions,
  isUserFeatureEnabled,
  USER_FEATURE_DEFINITION_MAP,
} from '@/apps/user-page/featureNavigation'
import type { UserFeatureKey } from '@/apps/user-page/featureNavigation'

import BlockCard from '../BlockCard.vue'

const props = defineProps<{
  blockProps: unknown
  userInfo?: ResponseUserInfo
}>()

const values = computed<Record<string, unknown>>(() =>
  props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps)
    ? (props.blockProps as Record<string, unknown>)
    : {},
)
const configuredItems = computed(() => (Array.isArray(values.value.items) ? values.value.items : []))
const enabledFunctions = computed(() => getEnabledUserFunctions(props.userInfo))

const availableFeatures = computed(() =>
  configuredItems.value.flatMap((item) => {
    const value = item && typeof item === 'object' && !Array.isArray(item) ? (item as Record<string, unknown>) : {}
    if (value.hidden === true || typeof value.key !== 'string' || !(value.key in USER_FEATURE_DEFINITION_MAP)) return []
    const feature = USER_FEATURE_DEFINITION_MAP[value.key as UserFeatureKey]
    if (feature.key === 'forum') return []
    return isUserFeatureEnabled(feature, enabledFunctions.value) ? [feature] : []
  }),
)
</script>

<template>
  <BlockCard
    v-if="availableFeatures.length"
    :framed="values.framed !== false"
    :backgrounded="values.backgrounded !== false"
  >
    <nav
      class="grid grid-cols-[repeat(auto-fit,minmax(min(180px,100%),1fr))] gap-2"
      aria-label="用户功能"
    >
      <RouterLink
        v-for="feature in availableFeatures"
        :key="feature.key"
        :to="{ name: feature.routeName, params: { id: props.userInfo?.name } }"
        class="flex items-center gap-2.5 min-w-0 min-h-11 px-3 py-2.25 border border-border rounded-[var(--radius)] text-foreground bg-muted no-underline transition-colors duration-140 hover:border-primary hover:bg-primary/10"
      >
        <component
          :is="feature.icon"
          class="size-5.5 shrink-0"
        />
        <span class="min-w-0 truncate">{{ feature.label }}</span>
      </RouterLink>
    </nav>
  </BlockCard>
</template>
