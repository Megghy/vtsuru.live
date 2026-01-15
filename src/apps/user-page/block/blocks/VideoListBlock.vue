<script setup lang="ts">
import type { ResponseUserIndexModel, UserInfo, VideoCollectVideo } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { USER_INDEX_API_URL } from '@/shared/config'
import { NAlert, NFlex, NSpin, NText, NIcon } from 'naive-ui'
import { computed, onMounted, ref, watch } from 'vue'
import { PlayCircleOutline } from '@vicons/ionicons5'
import SimpleVideoCard from '@/components/SimpleVideoCard.vue'
import BlockCard from '../BlockCard.vue'

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
}

const props = defineProps<{
  blockProps: unknown
  userInfo?: UserInfo | undefined
  biliInfo?: unknown
}>()

const cfg = computed<BlockConfig>(() => {
  const o = (props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps))
    ? (props.blockProps as any)
    : {}
  const source = (o.source === 'userIndex' || o.source === 'manual') ? o.source : 'manual'
  const layout = (o.layout === 'row' || o.layout === 'grid') ? o.layout : 'grid'
  const columns = Number.isInteger(o.columns) ? o.columns : 2
  const maxItems = Number.isInteger(o.maxItems) ? o.maxItems : 6
  return {
    source,
    layout,
    columns: Math.min(6, Math.max(1, columns)),
    maxItems: Math.min(50, Math.max(1, maxItems)),
    showTitle: typeof o.showTitle === 'boolean' ? o.showTitle : true,
    title: typeof o.title === 'string' ? o.title : '',
    items: Array.isArray(o.items) ? o.items : [],
  }
})

const isLoading = ref(false)
const error = ref<string | null>(null)
const userIndex = ref<ResponseUserIndexModel | null>(null)

async function loadUserIndex() {
  if (cfg.value.source !== 'userIndex') return
  if (!props.userInfo?.name) return
  isLoading.value = true
  error.value = null
  try {
    const resp = await QueryGetAPI<ResponseUserIndexModel>(`${USER_INDEX_API_URL}get`, { id: props.userInfo.name, _ts: Date.now() })
    if (resp.code !== 200) throw new Error(resp.message || `HTTP ${resp.code}`)
    userIndex.value = resp.data
  } catch (e) {
    error.value = (e as Error).message || String(e)
    userIndex.value = null
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  void loadUserIndex()
})
watch(() => cfg.value.source, () => void loadUserIndex())
watch(() => props.userInfo?.name, () => void loadUserIndex())

const videos = computed(() => {
  if (cfg.value.source !== 'userIndex') return [] as VideoCollectVideo[]
  const list = Array.isArray(userIndex.value?.videos) ? userIndex.value!.videos : []
  return list.slice(0, cfg.value.maxItems ?? 6)
})

const manualItems = computed(() => {
  const list = cfg.value.items ?? []
  const max = cfg.value.maxItems ?? 6
  return list
    .filter(it => it && typeof it.url === 'string' && it.url.trim().length)
    .slice(0, max)
})

const containerStyle = computed(() => {
  if (cfg.value.layout === 'row') {
    return {
      display: 'flex',
      gap: '12px',
      overflowX: 'auto',
      paddingBottom: '4px',
    } as any
  }
  const cols = cfg.value.columns ?? 2
  return {
    display: 'grid',
    gap: '12px',
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
  } as any
})
</script>

<template>
  <BlockCard>
    <template v-if="cfg.showTitle && (cfg.title || '视频')" #header>
      {{ cfg.title || '视频' }}
    </template>

    <NSpin :show="isLoading" size="small">
      <NAlert v-if="error" type="error" :show-icon="true" style="margin-bottom: 10px">
        {{ error }}
      </NAlert>

      <template v-if="cfg.source === 'userIndex'">
        <NAlert v-if="videos.length === 0 && !isLoading" type="info" :show-icon="false">
          暂无视频
        </NAlert>
        <div v-else :style="containerStyle">
          <SimpleVideoCard
            v-for="video in videos"
            :key="video.id"
            :video="video"
            :width="cfg.layout === 'row' ? 260 : undefined"
          />
        </div>
      </template>

      <template v-else>
        <NAlert v-if="manualItems.length === 0" type="info" :show-icon="false">
          未配置视频链接
        </NAlert>
        <NFlex v-else vertical style="gap: 8px">
          <a
            v-for="(it, idx) in manualItems"
            :key="idx"
            :href="it.url"
            target="_blank"
            rel="noopener noreferrer"
            class="manual-item"
          >
            <div class="manual-icon">
              <NIcon><PlayCircleOutline /></NIcon>
            </div>
            <div class="manual-content">
              <NText strong class="manual-title">
                {{ it.title || it.url }}
              </NText>
              <NText depth="3" class="manual-url">
                {{ it.url }}
              </NText>
            </div>
          </a>
        </NFlex>
      </template>
    </NSpin>
  </BlockCard>
</template>

  <style scoped>
  .manual-item {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 12px 14px;
    border: 1px solid var(--n-divider-color);
    border-radius: var(--vtsuru-page-radius);
    text-decoration: none;
    transition: all 0.2s;
    background: transparent;
  }
  .manual-item:hover {
    background: var(--n-fill-color);
    border-color: var(--n-border-color);
    transform: translateX(4px);
  }
  .manual-icon {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    background: rgba(0,0,0,0.05);
    color: var(--n-text-color-3);
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
    color: var(--n-text-color);
  }
  .manual-url {
    display: block;
    font-size: 12px;
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  </style>
