<script setup lang="ts">
import { MusicalNotesOutline, OpenOutline, RefreshOutline } from '@vicons/ionicons5'
import { useIntervalFn } from '@vueuse/core'
import { computed, onMounted, watch } from 'vue'
import { RouterLink } from 'vue-router'

import type { UserInfo } from '@/api/api-models'
import { FunctionTypes, SongRequestStatus } from '@/api/api-models'
import { fetchPublicSongRequestState } from '@/apps/user-page/api'
import { getEnabledUserFunctions } from '@/apps/user-page/featureNavigation'
import { useUserPageRuntimeQuery } from '@/apps/user-page/runtime/query'

import BlockCard from '../BlockCard.vue'

const props = defineProps<{ blockProps: unknown; userInfo?: UserInfo }>()
const values = computed<Record<string, unknown>>(() =>
  props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps)
    ? (props.blockProps as Record<string, unknown>)
    : {},
)
const enabled = computed(() => getEnabledUserFunctions(props.userInfo).has(FunctionTypes.LiveRequest))
const query = useUserPageRuntimeQuery({
  key: () => `now-playing:${props.userInfo?.id ?? 0}`,
  ttlMs: 15_000,
  loader: (signal) => fetchPublicSongRequestState(props.userInfo!.id, { signal }),
})
const current = computed(() => query.data.value?.songs.find((song) => song.status === SongRequestStatus.Singing))
const waitingCount = computed(
  () => query.data.value?.songs.filter((song) => song.status === SongRequestStatus.Waiting).length ?? 0,
)
const showRequester = computed(
  () => values.value.showRequester !== false && query.data.value?.setting.showUserName !== false,
)

async function load(force = false) {
  if (!props.userInfo?.id || !enabled.value) {
    query.cancel()
    return
  }
  try {
    await query.execute(force)
  } catch (error) {
    console.error('用户页当前点歌区块加载失败', error)
  }
}

onMounted(() => {
  void load()
})
watch(
  () => [props.userInfo?.id, enabled.value] as const,
  () => {
    void load()
  },
)
useIntervalFn(() => {
  void load(true)
}, 30_000)
</script>

<template>
  <BlockCard
    :framed="values.framed !== false"
    :backgrounded="values.backgrounded !== false"
  >
    <template #header>
      <div class="playing-header">
        <span class="playing-heading"
          ><span><MusicalNotesOutline /></span>当前播放</span
        >
        <RouterLink
          v-if="props.userInfo?.name"
          v-slot="{ navigate }"
          :to="{ name: 'user-songList', params: { id: props.userInfo.name } }"
          custom
        >
          <UButton
            variant="link"
            color="primary"
            size="sm"
            @click="navigate"
          >
            完整点歌页<template #leading>
              <span><OpenOutline /></span>
            </template>
          </UButton>
        </RouterLink>
      </div>
    </template>

    <UAlert
      v-if="!enabled"
      color="info"
      ><template #description> 点歌功能未开放 </template></UAlert
    >
    <UAlert
      v-else-if="query.status.value === 'error'"
      color="error"
    >
      <template #description
        ><div class="error-row">
          <span>当前点歌状态加载失败</span
          ><UButton
            size="sm"
            variant="soft"
            @click="load(true)"
          >
            <template #leading>
              <span><RefreshOutline /></span> </template
            >重试
          </UButton>
        </div></template
      >
    </UAlert>
    <div
      v-else
      :aria-busy="query.status.value === 'loading' || query.status.value === 'idle'"
      size="small"
    >
      <div
        v-if="current"
        class="playing-content"
      >
        <div class="playing-icon">
          <span><MusicalNotesOutline /></span>
        </div>
        <div class="playing-copy">
          <span class="status">正在演唱</span>
          <strong>{{ current.songName }}</strong>
          <span
            v-if="showRequester && current.user?.name"
            class="requester"
            >由 {{ current.user.name }} 点播</span
          >
        </div>
        <div class="queue-count">
          <strong>{{ waitingCount }}</strong
          ><span>首等待</span>
        </div>
      </div>
      <div
        v-else-if="query.status.value === 'success'"
        class="playing-empty"
      >
        <UEmpty
          size="sm"
          description="当前没有正在演唱的歌曲"
          class="public-empty"
        />
        <span
          v-if="waitingCount"
          class="waiting-note"
          >队列中还有 {{ waitingCount }} 首歌曲</span
        >
      </div>
    </div>
  </BlockCard>
</template>

<style scoped>
.playing-header,
.playing-heading,
.error-row,
.playing-content {
  display: flex;
  align-items: center;
}
.playing-header,
.error-row {
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}
.playing-heading {
  gap: 7px;
  font-weight: 600;
}
.playing-content {
  container-type: inline-size;
  gap: 13px;
  min-width: 0;
  padding: 4px 2px;
}
.playing-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  color: var(--vtsuru-page-primary-readable, var(--vtsuru-page-primary));
  background: var(--vtsuru-brand-tint);
  font-size: 21px;
}
.playing-copy {
  display: grid;
  flex: 1;
  gap: 2px;
  min-width: 0;
}
.playing-copy strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 16px;
}
.status,
.requester,
.queue-count span,
.waiting-note {
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}
.queue-count {
  display: grid;
  flex: none;
  min-width: 54px;
  text-align: center;
}
.queue-count strong {
  color: var(--vtsuru-page-primary-readable, var(--vtsuru-page-primary));
  font-size: 20px;
}
.playing-empty {
  display: grid;
  justify-items: center;
  gap: 8px;
}
@container (max-width: 340px) {
  .playing-icon {
    width: 36px;
    height: 36px;
  }
  .queue-count {
    min-width: 42px;
  }
}
</style>
