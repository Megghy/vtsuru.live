<script setup lang="ts">
import type { UserInfo } from '@/api/api-models'
import { NIcon } from 'naive-ui'
import { computed, onMounted, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { fetchPublicForumExists } from '@/apps/user-page/api'
import { getEnabledUserFunctions, isUserFeatureEnabled, USER_FEATURE_DEFINITION_MAP } from '@/apps/user-page/featureNavigation'
import type { UserFeatureKey } from '@/apps/user-page/featureNavigation'
import { useUserPageRuntimeQuery } from '@/apps/user-page/runtime/query'
import BlockCard from '../BlockCard.vue'

const props = defineProps<{
  blockProps: unknown
  userInfo?: UserInfo
}>()

const values = computed<Record<string, unknown>>(() => props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps)
  ? props.blockProps as Record<string, unknown>
  : {})
const configuredItems = computed(() => Array.isArray(values.value.items) ? values.value.items : [])
const enabledFunctions = computed(() => getEnabledUserFunctions(props.userInfo))
const forumQuery = useUserPageRuntimeQuery<boolean>({
  key: () => `forum-exists:${props.userInfo?.id ?? 0}`,
  ttlMs: 60_000,
  loader: signal => fetchPublicForumExists(props.userInfo!.id, { signal }),
})
const needsForum = computed(() => configuredItems.value.some((item) => {
  const value = item && typeof item === 'object' && !Array.isArray(item) ? item as Record<string, unknown> : {}
  return value.key === 'forum' && value.hidden !== true
}))

async function loadForumAvailability() {
  if (!props.userInfo?.id || !needsForum.value) {
    forumQuery.cancel()
    return
  }
  try {
    await forumQuery.execute()
  } catch (error) {
    console.error('用户页功能入口加载讨论区状态失败', error)
  }
}

onMounted(() => { void loadForumAvailability() })
watch(() => [props.userInfo?.id, needsForum.value] as const, () => { void loadForumAvailability() })

const availableFeatures = computed(() => configuredItems.value.flatMap((item) => {
  const value = item && typeof item === 'object' && !Array.isArray(item) ? item as Record<string, unknown> : {}
  if (value.hidden === true || typeof value.key !== 'string' || !(value.key in USER_FEATURE_DEFINITION_MAP)) return []
  const feature = USER_FEATURE_DEFINITION_MAP[value.key as UserFeatureKey]
  const enabled = feature.key === 'forum' ? forumQuery.data.value === true : isUserFeatureEnabled(feature, enabledFunctions.value)
  return enabled ? [feature] : []
}))
</script>

<template>
  <BlockCard v-if="availableFeatures.length" :framed="values.framed !== false" :backgrounded="values.backgrounded !== false">
    <nav class="feature-nav" aria-label="用户功能">
      <RouterLink
        v-for="feature in availableFeatures"
        :key="feature.key"
        :to="{ name: feature.routeName, params: { id: props.userInfo?.name } }"
        class="feature-link"
      >
        <NIcon size="22">
          <component :is="feature.icon" />
        </NIcon>
        <span>{{ feature.label }}</span>
      </RouterLink>
    </nav>
  </BlockCard>
</template>

<style scoped>
.feature-nav {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(180px, 100%), 1fr));
  gap: 8px;
}

.feature-link {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  min-height: 44px;
  padding: 9px 12px;
  border: var(--vtsuru-page-border-width) var(--vtsuru-page-border-style) var(--vtsuru-border);
  border-radius: var(--vtsuru-page-radius);
  color: var(--vtsuru-fg);
  background: var(--vtsuru-bg-muted);
  text-decoration: none;
  transition: border-color 140ms ease, background-color 140ms ease;
}

.feature-link:hover {
  border-color: var(--vtsuru-page-primary);
  background: var(--vtsuru-brand-tint);
}

.feature-link span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
