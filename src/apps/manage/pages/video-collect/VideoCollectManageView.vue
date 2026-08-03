<script setup lang="ts">
import { showSuccessToast, showErrorToast } from '@/shared/services/toast'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useAccount } from '@/api/account'
import type { VideoCollectCreateModel, VideoCollectTable } from '@/api/api-models'
import { FunctionTypes } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import { CURRENT_HOST, VIDEO_COLLECT_API_URL } from '@/shared/config'

import VideoCollectFormModal from './VideoCollectFormModal.vue'

type StatusFilter = 'all' | 'active' | 'finished'
const router = useRouter()
const accountInfo = useAccount()

const videoTables = ref<VideoCollectTable[]>([])
const isLoading = ref(false)
const isCreating = ref(false)
const createModalVisible = ref(false)
const keyword = ref('')
const statusFilter = ref<StatusFilter>('all')
const statusOptions = [{ label: '全部状态', value: 'all' }, { label: '进行中', value: 'active' }, { label: '已结束', value: 'finished' }]
const formatTime = (value: number) => new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(value)

const videoCollectUrl = computed(() =>
  accountInfo.value?.name ? `${CURRENT_HOST}@${accountInfo.value.name}/video-collect` : '',
)
const activeTables = computed(() => videoTables.value.filter(isActive))
const totalVideoCount = computed(() => videoTables.value.reduce((sum, table) => sum + table.videoCount, 0))
const filteredTables = computed(() => {
  const search = keyword.value.trim().toLocaleLowerCase()

  return videoTables.value
    .filter((table) => {
      if (statusFilter.value === 'active' && !isActive(table)) return false
      if (statusFilter.value === 'finished' && isActive(table)) return false
      if (!search) return true
      return `${table.name} ${table.description}`.toLocaleLowerCase().includes(search)
    })
    .toSorted((a, b) => Number(isActive(b)) - Number(isActive(a)) || b.createAt - a.createAt)
})

await loadTables()

function isActive(table: VideoCollectTable) {
  return !table.isFinish && table.endAt > Date.now()
}

function capacityPercentage(table: VideoCollectTable) {
  return Math.min(100, Math.round((table.videoCount / table.maxVideoCount) * 100))
}

async function loadTables() {
  isLoading.value = true
  try {
    const response = await QueryGetAPI<VideoCollectTable[]>(`${VIDEO_COLLECT_API_URL}get-all`)
    if (response.code !== 200) throw new Error(response.message)
    videoTables.value = response.data
  } catch (error) {
    console.error(error)
    showErrorToast('视频征集列表加载失败')
  } finally {
    isLoading.value = false
  }
}

async function createTable(model: VideoCollectCreateModel) {
  isCreating.value = true
  try {
    const response = await QueryPostAPI<VideoCollectTable>(`${VIDEO_COLLECT_API_URL}create`, model)
    if (response.code !== 200) throw new Error(response.message)
    videoTables.value.unshift(response.data)
    createModalVisible.value = false
    showSuccessToast('征集已创建')
  } catch (error) {
    console.error(error)
    showErrorToast(error instanceof Error ? error.message : '创建失败')
  } finally {
    isCreating.value = false
  }
}
</script>

<template>
  <div class="video-collect-manage">
    <ManagePageHeader
      title="视频征集"
      subtitle="征集活动与提交审核"
      :function-type="FunctionTypes.VideoCollect"
      :loading="isLoading"
      :links="[{ label: '公开展示页', value: videoCollectUrl }]"
    >
      <template #action>
        <UButton
          color="neutral"
          variant="soft"
          :loading="isLoading"
          @click="loadTables"
        >
          <template #leading><UIcon name="i-lucide-refresh-cw" /></template>
          刷新
        </UButton>
        <UButton
          @click="createModalVisible = true"
        >
          <template #leading><UIcon name="i-lucide-plus" /></template>
          新建征集
        </UButton>
      </template>
    </ManagePageHeader>

    <section
      class="summary-strip"
      aria-label="视频征集概览"
    >
      <div class="summary-item">
        <span class="summary-label">全部征集</span>
        <strong>{{ videoTables.length }}</strong>
      </div>
      <div class="summary-item">
        <span class="summary-label">进行中</span>
        <strong>{{ activeTables.length }}</strong>
      </div>
      <div class="summary-item">
        <span class="summary-label">累计视频</span>
        <strong>{{ totalVideoCount }}</strong>
      </div>
    </section>

    <div class="collection-toolbar">
      <UInput
        v-model="keyword"
        clearable
        placeholder="搜索名称或说明"
        class="collection-search"
      >
        <template #leading><UIcon name="i-lucide-search" /></template>
      </UInput>
      <USelect
        v-model="statusFilter"
        class="status-filter"
        :items="statusOptions"
      />
    </div>

    <div :aria-busy="isLoading">
      <UEmpty
        v-if="!isLoading && filteredTables.length === 0"
        :title="videoTables.length === 0 ? '暂无视频征集' : '没有符合条件的征集'"
        class="collection-empty"
      >
        <template
          v-if="videoTables.length === 0"
          #extra
        >
          <UButton
            @click="createModalVisible = true"
          >
            新建征集
          </UButton>
        </template>
      </UEmpty>

      <div
        v-else
        class="collection-list"
      >
        <button
          v-for="table in filteredTables"
          :key="table.id"
          type="button"
          class="collection-row"
          @click="router.push({ name: 'manage-videoCollect-Detail', params: { id: table.id } })"
        >
          <div class="collection-main">
            <div class="collection-title-row">
              <UBadge
                :color="isActive(table) ? 'success' : 'neutral'"
                variant="subtle"
              >
                {{ isActive(table) ? '进行中' : '已结束' }}
              </UBadge>
              <strong class="collection-title">{{ table.name }}</strong>
            </div>
            <p class="collection-description">
              {{ table.description || '未填写征集说明' }}
            </p>
          </div>

          <div class="collection-deadline">
            <span class="collection-meta-label">截止时间</span>
            <time>{{ formatTime(table.endAt) }}</time>
          </div>

          <div class="collection-capacity">
            <div class="collection-capacity-label">
              <span>提交进度</span>
              <strong>{{ table.videoCount }} / {{ table.maxVideoCount }}</strong>
            </div>
            <UProgress :model-value="capacityPercentage(table)" size="xs" />
          </div>

          <UIcon name="i-lucide-chevron-right" class="collection-arrow" />
        </button>
      </div>
    </div>

    <VideoCollectFormModal
      v-model:show="createModalVisible"
      title="新建视频征集"
      :loading="isCreating"
      @submit="createTable"
    />
  </div>
</template>

<style scoped>
.video-collect-manage {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.summary-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-block: 1px solid var(--vtsuru-border);
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 14px 18px;
}

.summary-item + .summary-item {
  border-left: 1px solid var(--vtsuru-border);
}

.summary-item strong {
  color: var(--vtsuru-fg);
  font-size: 22px;
  line-height: 1.2;
}

.summary-label,
.collection-meta-label {
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}

.collection-toolbar {
  display: flex;
  gap: 10px;
}

.collection-search {
  width: min(360px, 100%);
}

.status-filter {
  width: 140px;
}

.collection-list {
  border-top: 1px solid var(--vtsuru-border);
}

.collection-row {
  display: grid;
  grid-template-columns: minmax(220px, 1.6fr) minmax(150px, 0.7fr) minmax(170px, 0.8fr) 24px;
  gap: 24px;
  align-items: center;
  width: 100%;
  padding: 16px 12px;
  color: var(--vtsuru-fg);
  text-align: left;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--vtsuru-border);
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.collection-row:hover,
.collection-row:focus-visible {
  background: var(--vtsuru-bg-muted);
  outline: none;
}

.collection-main,
.collection-capacity {
  min-width: 0;
}

.collection-title-row {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.collection-title {
  overflow: hidden;
  font-size: 15px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.collection-description {
  overflow: hidden;
  margin: 7px 0 0;
  color: var(--vtsuru-fg-muted);
  font-size: 13px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.collection-deadline {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
}

.collection-capacity-label {
  display: flex;
  justify-content: space-between;
  margin-bottom: 7px;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}

.collection-capacity-label strong {
  color: var(--vtsuru-fg);
  font-weight: 600;
}

.collection-arrow {
  color: var(--vtsuru-fg-muted);
}

.collection-empty {
  padding: 64px 0;
}

@media (max-width: 760px) {
  .collection-row {
    grid-template-columns: minmax(0, 1fr) 20px;
    gap: 12px;
    padding: 15px 8px;
  }

  .collection-deadline,
  .collection-capacity {
    grid-column: 1;
  }

  .collection-deadline {
    flex-direction: row;
    gap: 8px;
  }

  .collection-arrow {
    grid-row: 1 / 4;
    grid-column: 2;
  }
}

@media (max-width: 520px) {
  .summary-item {
    padding: 12px;
  }

  .summary-item strong {
    font-size: 19px;
  }

  .collection-toolbar {
    flex-direction: column;
  }

  .collection-search,
  .status-filter {
    width: 100%;
  }
}
</style>
