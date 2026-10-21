<script setup lang="ts">
import { PlayCircleOutline, RefreshOutline } from '@vicons/ionicons5'
import { computed, onMounted, watch } from 'vue'

import type { ResponseUserIndexModel, UserInfo, VideoCollectVideo } from '@/api/api-models'
import { getApiUserIndexGet } from '@/api/generated/user-index/user-index'
import { useUserPageRuntimeQuery } from '@/apps/user-page/runtime/query'
import SimpleVideoCard from '@/components/SimpleVideoCard.vue'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Spin } from '@/shared/ui/spin'

import BlockCard from '../BlockCard.vue'
import { isBlockPropertyAvailable } from '../propertyCapabilities'

interface ManualVideoItem {
  url: string
  title?: string
}

interface BlockConfig {
  source?: 'manual' | 'userIndex'
  layout?: 'grid' | 'row'
  columns?: number
  maxItems?: number
  showTitle?: boolean
  title?: string
  items?: ManualVideoItem[]
  framed?: boolean
  backgrounded?: boolean
}

const props = defineProps<{
  blockProps: unknown
  userInfo?: UserInfo | undefined
  biliInfo?: unknown
}>()

const cfg = computed<BlockConfig>(() => {
  const o =
    props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps)
      ? (props.blockProps as any)
      : {}
  const source = o.source === 'userIndex' || o.source === 'manual' ? o.source : 'manual'
  const layout = o.layout === 'row' || o.layout === 'grid' ? o.layout : 'grid'
  const columns = Number.isInteger(o.columns) ? o.columns : 2
  const maxItems = Number.isInteger(o.maxItems) ? o.maxItems : 6
  return {
    source,
    layout,
    columns: isBlockPropertyAvailable('videoList', o, 'columns') ? Math.min(6, Math.max(1, columns)) : 1,
    maxItems: Math.min(50, Math.max(1, maxItems)),
    showTitle: typeof o.showTitle === 'boolean' ? o.showTitle : true,
    title: isBlockPropertyAvailable('videoList', o, 'title') && typeof o.title === 'string' ? o.title : '',
    items: isBlockPropertyAvailable('videoList', o, 'items') && Array.isArray(o.items) ? o.items : [],
    framed: typeof o.framed === 'boolean' ? o.framed : true,
    backgrounded: typeof o.backgrounded === 'boolean' ? o.backgrounded : true,
  }
})

const userIndexQuery = useUserPageRuntimeQuery<ResponseUserIndexModel>({
  key: () => `user-index:${props.userInfo?.name ?? ''}`,
  ttlMs: 60_000,
  loader: async (signal) => {
    const userName = props.userInfo?.name
    if (!userName) throw new Error('missing user name')
    const response = (await getApiUserIndexGet(
      { id: userName },
      { signal },
    )) as unknown as {
      code: number
      message?: string
      data: ResponseUserIndexModel
    }
    if (response.code !== 200) throw new Error(response.message || `HTTP ${response.code}`)
    return response.data
  },
})

const isLoading = computed(() => userIndexQuery.status.value === 'loading')
const error = computed(() => (userIndexQuery.status.value === 'error' ? '视频加载失败，请稍后重试' : ''))
const userIndex = computed(() => userIndexQuery.data.value ?? null)

async function loadUserIndex(force = false) {
  if (cfg.value.source !== 'userIndex' || !props.userInfo?.name) {
    userIndexQuery.cancel()
    return
  }
  try {
    await userIndexQuery.execute(force)
  } catch (e) {
    console.error('加载视频列表失败', e)
  }
}

onMounted(() => {
  void loadUserIndex()
})
watch(
  () => cfg.value.source,
  () => {
    void loadUserIndex()
  },
)
watch(
  () => props.userInfo?.name,
  () => {
    void loadUserIndex()
  },
)

const videos = computed(() => {
  if (cfg.value.source !== 'userIndex' || !props.userInfo?.name) return [] as VideoCollectVideo[]
  const list = Array.isArray(userIndex.value?.videos) ? userIndex.value!.videos : []
  return list.slice(0, cfg.value.maxItems ?? 6)
})

const manualItems = computed(() => {
  const list = cfg.value.items ?? []
  const max = cfg.value.maxItems ?? 6
  return list.filter((it) => it && typeof it.url === 'string' && it.url.trim().length).slice(0, max)
})

const containerStyle = computed(() => {
  if (cfg.value.layout === 'row') {
    return {
      '--video-cols': '1',
    } as any
  }
  const cols = cfg.value.columns ?? 2
  return {
    '--video-cols': String(cols),
  } as any
})
</script>

<template>
  <BlockCard
    :framed="cfg.framed"
    :backgrounded="cfg.backgrounded"
  >
    <template
      v-if="cfg.showTitle && (cfg.title || '视频')"
      #header
    >
      {{ cfg.title || '视频' }}
    </template>

    <div class="video-content">
      <div
        v-if="isLoading"
        class="py-6 flex justify-center"
      >
        <Spin />
      </div>

      <Alert
        v-else-if="error"
        variant="destructive"
        class="text-xs py-2 mb-2.5"
      >
        <AlertDescription class="flex items-center justify-between w-full">
          <span>{{ error }}</span>
          <Button
            size="sm"
            variant="outline"
            class="h-6 px-2 text-xs"
            @click="loadUserIndex(true)"
          >
            <component :is="RefreshOutline" class="size-3 mr-1" />
            重试
          </Button>
        </AlertDescription>
      </Alert>

      <template v-else-if="cfg.source === 'userIndex'">
        <Alert
          v-if="videos.length === 0"
          class="text-xs py-2"
        >
          <AlertDescription>
            暂无视频
          </AlertDescription>
        </Alert>
        <div
          v-else
          class="video-list"
          :class="cfg.layout"
          :style="containerStyle"
        >
          <SimpleVideoCard
            v-for="video in videos"
            :key="video.id"
            :video="video"
            :width="cfg.layout === 'row' ? 260 : undefined"
          />
        </div>
      </template>

      <template v-else>
        <Alert
          v-if="manualItems.length === 0"
          class="text-xs py-2"
        >
          <AlertDescription>
            未配置视频链接
          </AlertDescription>
        </Alert>
        <div
          v-else
          class="flex flex-col gap-2"
        >
          <a
            v-for="(it, idx) in manualItems"
            :key="idx"
            :href="it.url"
            target="_blank"
            rel="noopener noreferrer"
            class="manual-item"
            :aria-label="`${it.title || '打开视频'}（新窗口打开）`"
          >
            <div class="manual-icon">
              <component :is="PlayCircleOutline" class="size-5" />
            </div>
            <div class="manual-content">
              <strong class="manual-title">
                {{ it.title || it.url }}
              </strong>
              <span class="manual-url">
                {{ it.url }}
              </span>
            </div>
          </a>
        </div>
      </template>
    </div>
  </BlockCard>
</template>

<style scoped>
.video-content {
  container-type: inline-size;
}
.video-list {
  gap: 12px;
}
.video-list.grid {
  display: grid;
  grid-template-columns: repeat(var(--video-cols), minmax(0, 1fr));
}
.video-list.row {
  display: flex;
  padding-bottom: 4px;
  overflow-x: auto;
}
.manual-item {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 12px 14px;
  border: var(--vtsuru-page-border-width) var(--vtsuru-page-border-style) var(--vtsuru-border);
  border-radius: var(--vtsuru-page-radius);
  text-decoration: none;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    transform 0.2s ease;
  background: transparent;
}
.manual-item:hover {
  background: var(--vtsuru-bg-muted);
  border-color: var(--vtsuru-border);
  transform: translateX(4px);
}
.manual-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--vtsuru-page-radius);
  background: var(--vtsuru-bg-muted);
  color: var(--vtsuru-fg-muted);
  font-size: 20px;
  flex-shrink: 0;
}
.manual-content {
  flex: 1;
  min-width: 0;
}
.manual-title {
  display: block;
  font-size: 14px;
  line-height: 1.4;
  color: var(--vtsuru-fg);
}
.manual-url {
  display: block;
  font-size: 12px;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--vtsuru-fg-muted);
}
.manual-item:focus-visible {
  outline: 2px solid var(--vtsuru-page-primary, var(--vtsuru-brand));
  outline-offset: 2px;
}
@container (max-width: 520px) {
  .video-list.grid {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
  }
}
@media (prefers-reduced-motion: reduce) {
  .manual-item {
    transition: none;
  }
  .manual-item:hover {
    transform: none;
  }
}
</style>
