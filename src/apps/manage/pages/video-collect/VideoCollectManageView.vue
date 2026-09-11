<script setup lang="ts">
import {
  Add20Regular,
  ArrowRight24Regular,
  ArrowSync24Regular,
  Copy24Regular,
  Delete24Regular,
  Edit24Regular,
  Folder24Regular,
  Timer24Regular,
  MoreVertical24Regular,
  Open24Regular,
  Search24Regular,
  TableDismiss24Regular,
  Video24Regular,
} from '@vicons/fluent'
import {
  NButton,
  NDropdown,
  NEmpty,
  NIcon,
  NInput,
  NProgress,
  NSelect,
  NSpin,
  NTag,
  NTime,
  useDialog,
  useMessage,
} from 'naive-ui'
import { computed, h, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useAccount } from '@/api/account'
import type { VideoCollectCreateModel, VideoCollectTable } from '@/api/api-models'
import { FunctionTypes } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import { CURRENT_HOST, VIDEO_COLLECT_API_URL } from '@/shared/config'
import { copyToClipboard } from '@/shared/utils'

import VideoCollectFormModal from './VideoCollectFormModal.vue'

type StatusFilter = 'all' | 'active' | 'finished'

const message = useMessage()
const dialog = useDialog()
const router = useRouter()
const accountInfo = useAccount()

const videoTables = ref<VideoCollectTable[]>([])
const isLoading = ref(false)
const isCreating = ref(false)
const createModalVisible = ref(false)
const editModalVisible = ref(false)
const currentEditingTable = ref<VideoCollectTable>()
const keyword = ref('')
const statusFilter = ref<StatusFilter>('all')

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

const editInitialValue = computed<VideoCollectCreateModel | undefined>(() => {
  if (!currentEditingTable.value) return undefined
  const t = currentEditingTable.value
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    startAt: t.startAt,
    endAt: t.endAt,
    maxVideoCount: t.maxVideoCount,
    minVideoDuration: t.minVideoDuration,
    maxVideoDuration: t.maxVideoDuration,
    allowedPartitions: [...(t.allowedPartitions ?? [])],
    allowUnregisteredUser: t.allowUnregisteredUser,
    maxVideoPerUser: t.maxVideoPerUser,
    requireDescription: t.requireDescription,
    duplicatePolicy: t.duplicatePolicy,
  }
})

await loadTables()

function isActive(table: VideoCollectTable) {
  return !table.isFinish && table.endAt > Date.now()
}

function tableStatus(table: VideoCollectTable) {
  if (!isActive(table)) return '已结束'
  if (table.startAt > Date.now()) return '未开始'
  return '进行中'
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
    message.error('视频征集列表加载失败')
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
    message.success('征集已创建')
  } catch (error) {
    console.error(error)
    message.error(error instanceof Error ? error.message : '创建失败')
  } finally {
    isCreating.value = false
  }
}

async function updateTable(model: VideoCollectCreateModel) {
  if (!currentEditingTable.value) return
  isCreating.value = true
  try {
    const response = await QueryPostAPI<VideoCollectTable>(`${VIDEO_COLLECT_API_URL}update`, {
      ...model,
      id: currentEditingTable.value.id,
    })
    if (response.code !== 200) throw new Error(response.message)
    const idx = videoTables.value.findIndex((t) => t.id === currentEditingTable.value?.id)
    if (idx !== -1) videoTables.value[idx] = response.data
    editModalVisible.value = false
    message.success('征集规则已更新')
  } catch (error) {
    console.error(error)
    message.error(error instanceof Error ? error.message : '更新失败')
  } finally {
    isCreating.value = false
  }
}

function copyShareLink(table: VideoCollectTable) {
  const url = `${CURRENT_HOST}video-collect/${table.shortId}`
  copyToClipboard(url)
  message.success('已复制投稿页面链接')
}

function openResultPage(table: VideoCollectTable) {
  router.push({ name: 'video-collect-list', params: { id: table.id } })
}

function openEditModal(table: VideoCollectTable) {
  currentEditingTable.value = table
  editModalVisible.value = true
}

async function toggleFinish(table: VideoCollectTable) {
  const finish = !table.isFinish
  try {
    const response = await QueryGetAPI(`${VIDEO_COLLECT_API_URL}finish`, { id: table.id, finish })
    if (response.code !== 200) throw new Error(response.message)
    table.isFinish = finish
    message.success(finish ? '征集已结束' : '征集已重新开启')
  } catch (error) {
    console.error(error)
    message.error(error instanceof Error ? error.message : '操作失败')
  }
}

function confirmDelete(table: VideoCollectTable) {
  dialog.warning({
    title: '删除视频征集',
    content: `确定删除“${table.name}”吗？此操作无法撤销。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        const response = await QueryGetAPI(`${VIDEO_COLLECT_API_URL}del`, { id: table.id })
        if (response.code !== 200) throw new Error(response.message)
        videoTables.value = videoTables.value.filter((t) => t.id !== table.id)
        message.success('征集已删除')
      } catch (error) {
        console.error(error)
        message.error(error instanceof Error ? error.message : '删除失败')
      }
    },
  })
}

function getRowDropdownOptions(table: VideoCollectTable) {
  return [
    {
      label: '编辑规则',
      key: 'edit',
      icon: () => h(NIcon, null, { default: () => h(Edit24Regular) }),
    },
    {
      label: isActive(table) ? '结束征集' : '重新开启',
      key: 'toggle',
      icon: () => h(NIcon, null, { default: () => h(TableDismiss24Regular) }),
    },
    { type: 'divider', key: 'divider' },
    {
      label: '删除征集',
      key: 'delete',
      icon: () => h(NIcon, { color: 'var(--vtsuru-error)' }, { default: () => h(Delete24Regular) }),
    },
  ]
}

function handleRowDropdown(key: string, table: VideoCollectTable) {
  if (key === 'edit') openEditModal(table)
  else if (key === 'toggle') toggleFinish(table)
  else if (key === 'delete') confirmDelete(table)
}
</script>

<template>
  <div class="video-collect-manage">
    <ManagePageHeader
      title="视频征集"
      subtitle="征集活动管理与投稿审核"
      :function-type="FunctionTypes.VideoCollect"
      :loading="isLoading"
      :links="[{ label: '公开展示页', value: videoCollectUrl }]"
    >
      <template #action>
        <NButton
          secondary
          :loading="isLoading"
          @click="loadTables"
        >
          <template #icon><NIcon :component="ArrowSync24Regular" /></template>
          刷新
        </NButton>
        <NButton
          type="primary"
          @click="createModalVisible = true"
        >
          <template #icon><NIcon :component="Add20Regular" /></template>
          新建征集
        </NButton>
      </template>
    </ManagePageHeader>

    <!-- Bento 概览看板 -->
    <section
      class="summary-bento-grid"
      aria-label="视频征集概览"
    >
      <div
        class="summary-card"
        :class="{ 'is-active': statusFilter === 'all' }"
        @click="statusFilter = 'all'"
      >
        <div class="summary-card__top">
          <NIcon :component="Folder24Regular" />
          <span>全部征集</span>
        </div>
        <strong>{{ videoTables.length }}</strong>
      </div>

      <div
        class="summary-card is-active-card"
        :class="{ 'is-active': statusFilter === 'active' }"
        @click="statusFilter = 'active'"
      >
        <div class="summary-card__top">
          <NIcon :component="Timer24Regular" />
          <span>进行中/未结束</span>
        </div>
        <strong>{{ activeTables.length }}</strong>
      </div>

      <div class="summary-card is-total-card">
        <div class="summary-card__top">
          <NIcon :component="Video24Regular" />
          <span>累计征集视频</span>
        </div>
        <strong>{{ totalVideoCount }}</strong>
      </div>
    </section>

    <!-- 工具栏 -->
    <div class="collection-toolbar">
      <NInput
        v-model:value="keyword"
        clearable
        placeholder="搜索征集名称或说明..."
        class="collection-search"
      >
        <template #prefix>
          <NIcon :component="Search24Regular" />
        </template>
      </NInput>
      <NSelect
        v-model:value="statusFilter"
        class="status-filter"
        :options="[
          { label: '全部状态', value: 'all' },
          { label: '仅进行中/未结束', value: 'active' },
          { label: '仅已结束', value: 'finished' },
        ]"
      />
    </div>

    <!-- 列表区 -->
    <NSpin :show="isLoading">
      <NEmpty
        v-if="!isLoading && filteredTables.length === 0"
        :description="videoTables.length === 0 ? '暂无视频征集活动' : '没有符合条件的征集'"
        class="collection-empty"
      >
        <template
          v-if="videoTables.length === 0"
          #extra
        >
          <NButton
            type="primary"
            @click="createModalVisible = true"
          >
            立即创建第一个征集
          </NButton>
        </template>
      </NEmpty>

      <div
        v-else
        class="collection-list"
      >
        <div
          v-for="table in filteredTables"
          :key="table.id"
          class="collection-card"
          @click="router.push({ name: 'manage-videoCollect-Detail', params: { id: table.id } })"
        >
          <div class="collection-main">
            <div class="collection-title-row">
              <NTag
                size="small"
                :type="
                  tableStatus(table) === '进行中' ? 'success' : tableStatus(table) === '未开始' ? 'info' : 'default'
                "
                :bordered="false"
              >
                {{ tableStatus(table) }}
              </NTag>
              <strong
                class="collection-title"
                :title="table.name"
              >
                {{ table.name }}
              </strong>
            </div>
            <p class="collection-description">
              {{ table.description || '未填写征集说明' }}
            </p>
          </div>

          <div class="collection-deadline">
            <span class="collection-meta-label">
              {{ tableStatus(table) === '未开始' ? '开放时间' : '截止时间' }}
            </span>
            <NTime
              :time="tableStatus(table) === '未开始' ? table.startAt : table.endAt"
              format="yyyy-MM-dd HH:mm"
              class="deadline-time"
            />
          </div>

          <div class="collection-capacity">
            <div class="collection-capacity-label">
              <span>名额占用</span>
              <strong>{{ table.videoCount }} / {{ table.maxVideoCount }}</strong>
            </div>
            <NProgress
              type="line"
              :percentage="capacityPercentage(table)"
              :height="5"
              :border-radius="3"
              :show-indicator="false"
              :status="table.videoCount >= table.maxVideoCount ? 'success' : 'default'"
            />
          </div>

          <!-- 行内快捷操作区 -->
          <div
            class="collection-row-actions"
            @click.stop
          >
            <NButton
              size="small"
              secondary
              title="复制投稿页面链接"
              @click.stop="copyShareLink(table)"
            >
              <template #icon><NIcon :component="Copy24Regular" /></template>
              复制链接
            </NButton>
            <NButton
              size="small"
              secondary
              title="查看展示结果页"
              @click.stop="openResultPage(table)"
            >
              <template #icon><NIcon :component="Open24Regular" /></template>
              结果页
            </NButton>
            <NDropdown
              trigger="click"
              :options="getRowDropdownOptions(table)"
              @select="handleRowDropdown($event, table)"
            >
              <NButton
                size="small"
                secondary
                circle
                title="更多操作"
                @click.stop
              >
                <template #icon><NIcon :component="MoreVertical24Regular" /></template>
              </NButton>
            </NDropdown>
            <NIcon
              :component="ArrowRight24Regular"
              class="collection-arrow"
            />
          </div>
        </div>
      </div>
    </NSpin>

    <!-- 新建弹窗 -->
    <VideoCollectFormModal
      v-model:show="createModalVisible"
      title="新建视频征集"
      :loading="isCreating"
      @submit="createTable"
    />

    <!-- 编辑弹窗 -->
    <VideoCollectFormModal
      v-model:show="editModalVisible"
      title="编辑视频征集规则"
      :initial-value="editInitialValue"
      :loading="isCreating"
      @submit="updateTable"
    />
  </div>
</template>

<style scoped>
.video-collect-manage {
  display: flex;
  flex-direction: column;
  gap: 16px;
  color: var(--vtsuru-fg);
}

/* Bento 概览看板 */
.summary-bento-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.summary-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 18px;
  background: var(--vtsuru-bg-elevated);
  border: 1px solid var(--vtsuru-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.16s ease;
  color: var(--vtsuru-fg);
}

.summary-card:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--vtsuru-brand) 50%, var(--vtsuru-border));
}

.summary-card.is-active {
  border-color: var(--vtsuru-brand);
  background: color-mix(in srgb, var(--vtsuru-brand) 4%, var(--vtsuru-bg-elevated));
}

.summary-card__top {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
  font-weight: 500;
}

.summary-card strong {
  color: var(--vtsuru-fg);
  font-size: 22px;
  line-height: 1.15;
}

.summary-card.is-active-card .summary-card__top {
  color: #10b981;
}

.summary-card.is-total-card {
  cursor: default;
}

.summary-card.is-total-card:hover {
  transform: none;
  border-color: var(--vtsuru-border);
}

.collection-toolbar {
  display: flex;
  gap: 10px;
}

.collection-search {
  width: min(360px, 100%);
}

.status-filter {
  width: 160px;
}

.collection-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.collection-card {
  display: grid;
  grid-template-columns: minmax(220px, 1.6fr) minmax(140px, 0.7fr) minmax(150px, 0.8fr) auto;
  gap: 20px;
  align-items: center;
  width: 100%;
  padding: 14px 16px;
  background: var(--vtsuru-bg-elevated);
  border: 1px solid var(--vtsuru-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  box-sizing: border-box;
  color: var(--vtsuru-fg);
}

.collection-card:hover {
  border-color: color-mix(in srgb, var(--vtsuru-brand) 60%, var(--vtsuru-border));
  background: color-mix(in srgb, var(--vtsuru-brand) 2%, var(--vtsuru-bg-elevated));
}

.collection-main,
.collection-capacity {
  min-width: 0;
}

.collection-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.collection-title {
  overflow: hidden;
  font-size: 15px;
  color: var(--vtsuru-fg);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.collection-description {
  overflow: hidden;
  margin: 6px 0 0;
  color: var(--vtsuru-fg-muted);
  font-size: 13px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.collection-deadline {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 12px;
}

.collection-meta-label {
  color: var(--vtsuru-fg-muted);
  font-size: 11px;
}

.deadline-time {
  color: var(--vtsuru-fg);
  font-weight: 500;
}

.collection-capacity-label {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}

.collection-capacity-label strong {
  color: var(--vtsuru-fg);
  font-weight: 600;
}

.collection-row-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.collection-arrow {
  color: var(--vtsuru-fg-muted);
  font-size: 18px;
  margin-left: 4px;
}

.collection-empty {
  padding: 64px 0;
}

@media (max-width: 880px) {
  .collection-card {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }

  .collection-deadline {
    flex-direction: row;
    gap: 8px;
    align-items: center;
  }

  .collection-row-actions {
    justify-content: flex-end;
    border-top: 1px dashed var(--vtsuru-border);
    padding-top: 10px;
  }
}

@media (max-width: 540px) {
  .summary-bento-grid {
    grid-template-columns: minmax(0, 1fr);
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
