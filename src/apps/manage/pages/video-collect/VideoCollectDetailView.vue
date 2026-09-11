<script setup lang="ts">
import {
  ArrowDownload24Regular,
  ArrowLeft24Regular,
  ArrowSync24Regular,
  CheckmarkCircle24Regular,
  Clock24Regular,
  Copy24Regular,
  Delete24Regular,
  DismissCircle24Regular,
  Edit24Regular,
  Link24Regular,
  MoreVertical24Regular,
  Open24Regular,
  Search24Regular,
  Share24Regular,
  TableDismiss24Regular,
  Timer24Regular,
} from '@vicons/fluent'
import { saveAs } from 'file-saver'
import {
  NBadge,
  NButton,
  NDropdown,
  NEmpty,
  NIcon,
  NInput,
  NInputGroup,
  NModal,
  NProgress,
  NResult,
  NSelect,
  NSpin,
  NTabPane,
  NTabs,
  NTag,
  NTime,
  useDialog,
  useMessage,
} from 'naive-ui'
import Qrcode from 'qrcode.vue'
import { computed, h, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type { VideoCollectCreateModel, VideoCollectDetail, VideoCollectTable, VideoInfo } from '@/api/api-models'
import { DuplicateVideoPolicy, VideoStatus } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import VideoItemCard from '@/apps/manage/components/VideoItemCard.vue'
import { formatDuration } from '@/apps/manage/composables/formatters'
import { CURRENT_HOST, VIDEO_COLLECT_API_URL } from '@/shared/config'
import { copyToClipboard, objectsToCSV } from '@/shared/utils'

import VideoCollectFormModal from './VideoCollectFormModal.vue'

type SortOption = 'submitted-desc' | 'duration-desc' | 'duration-asc' | 'title'

const route = useRoute()
const router = useRouter()
const message = useMessage()
const dialog = useDialog()

const videoDetail = ref<VideoCollectDetail>()
const isLoading = ref(false)
const tableOperation = ref<string>()
const videoOperation = ref<string>()
const shareModalVisible = ref(false)
const editModalVisible = ref(false)
const activeStatus = ref(VideoStatus.Pending)
const keyword = ref('')
const sortOption = ref<SortOption>('submitted-desc')
const qrCodeWrapper = ref<HTMLElement>()
const selectedBvids = ref<string[]>([])
const isBatchUpdating = ref(false)

const table = computed(() => videoDetail.value?.table)
const videos = computed(() => videoDetail.value?.videos ?? [])
const shareUrl = computed(() => (table.value ? `${CURRENT_HOST}video-collect/${table.value.shortId}` : ''))
const isActive = computed(() => Boolean(table.value && !table.value.isFinish && table.value.endAt > Date.now()))
const collectionStatus = computed(() => {
  if (!isActive.value) return '已结束'
  if (table.value && table.value.startAt > Date.now()) return '未开始'
  return '进行中'
})
const pendingVideos = computed(() => videos.value.filter((item) => item.info.status === VideoStatus.Pending))
const acceptedVideos = computed(() => videos.value.filter((item) => item.info.status === VideoStatus.Accepted))
const rejectedVideos = computed(() => videos.value.filter((item) => item.info.status === VideoStatus.Rejected))
const acceptedDuration = computed(() => acceptedVideos.value.reduce((sum, item) => sum + item.video.length, 0))

const editValue = computed<VideoCollectCreateModel | undefined>(() => {
  if (!table.value) return undefined
  return {
    id: table.value.id,
    name: table.value.name,
    description: table.value.description,
    startAt: table.value.startAt,
    endAt: table.value.endAt,
    maxVideoCount: table.value.maxVideoCount,
    minVideoDuration: table.value.minVideoDuration,
    maxVideoDuration: table.value.maxVideoDuration,
    allowedPartitions: [...(table.value.allowedPartitions ?? [])],
    allowUnregisteredUser: table.value.allowUnregisteredUser,
    maxVideoPerUser: table.value.maxVideoPerUser,
    requireDescription: table.value.requireDescription,
    duplicatePolicy: table.value.duplicatePolicy,
  }
})

const visibleVideos = computed(() => {
  const search = keyword.value.trim().toLocaleLowerCase()
  const result = videos.value.filter((item) => {
    if (item.info.status !== activeStatus.value) return false
    if (!search) return true
    const senders = item.info.senders
      .map((sender) => `${sender.sender ?? ''} ${sender.senderId ?? ''} ${sender.description ?? ''}`)
      .join(' ')
    return `${item.info.bvid} ${item.video.title} ${item.video.ownerName} ${senders}`
      .toLocaleLowerCase()
      .includes(search)
  })

  return result.toSorted((a, b) => {
    if (sortOption.value === 'duration-desc') return b.video.length - a.video.length
    if (sortOption.value === 'duration-asc') return a.video.length - b.video.length
    if (sortOption.value === 'title') return a.video.title.localeCompare(b.video.title, 'zh-CN')
    return latestSubmitTime(b.info) - latestSubmitTime(a.info)
  })
})

const moreOptions = computed(() => [
  {
    label: '复制所有通过 BV 号',
    key: 'copy-bvids',
    disabled: acceptedVideos.value.length === 0,
    icon: () => h(NIcon, null, { default: () => h(Copy24Regular) }),
  },
  {
    label: '复制所有通过视频链接',
    key: 'copy-links',
    disabled: acceptedVideos.value.length === 0,
    icon: () => h(NIcon, null, { default: () => h(Link24Regular) }),
  },
  {
    label: '导出通过结果 (CSV)',
    key: 'export',
    disabled: acceptedVideos.value.length === 0,
    icon: () => h(NIcon, null, { default: () => h(ArrowDownload24Regular) }),
  },
  { type: 'divider', key: 'divider' },
  {
    label: '删除征集',
    key: 'delete',
    icon: () => h(NIcon, { color: 'var(--vtsuru-error)' }, { default: () => h(Delete24Regular) }),
  },
])

await loadData()
watch(() => route.params.id, loadData)
watch([activeStatus, keyword], () => {
  selectedBvids.value = []
})

function currentId() {
  const id = Array.isArray(route.params.id) ? route.params.id[0] : route.params.id
  if (!id) throw new Error('缺少征集 ID')
  return id
}

function latestSubmitTime(info: VideoInfo) {
  return Math.max(...info.senders.map((sender) => sender.sendAt), 0)
}

async function loadData() {
  isLoading.value = true
  try {
    const response = await QueryGetAPI<VideoCollectDetail>(`${VIDEO_COLLECT_API_URL}get`, { id: currentId() })
    if (response.code !== 200) throw new Error(response.message)
    videoDetail.value = response.data
  } catch (error) {
    console.error(error)
    videoDetail.value = undefined
    message.error(error instanceof Error ? error.message : '征集详情加载失败')
  } finally {
    isLoading.value = false
  }
}

async function setStatus(status: VideoStatus, video: VideoInfo) {
  videoOperation.value = video.bvid
  try {
    const response = await QueryGetAPI(`${VIDEO_COLLECT_API_URL}set-status`, {
      id: currentId(),
      bvid: video.bvid,
      status,
    })
    if (response.code !== 200) throw new Error(response.message)
    updateLocalStatus(video, status)
    selectedBvids.value = selectedBvids.value.filter((id) => id !== video.bvid)
    message.success('审核状态已更新')
  } catch (error) {
    console.error(error)
    message.error(error instanceof Error ? error.message : '审核操作失败')
  } finally {
    videoOperation.value = undefined
  }
}

function updateLocalStatus(video: VideoInfo, status: VideoStatus) {
  if (table.value) {
    const occupiedBefore = video.status !== VideoStatus.Rejected
    const occupiedAfter = status !== VideoStatus.Rejected
    table.value.videoCount += Number(occupiedAfter) - Number(occupiedBefore)
  }
  video.status = status
}

function toggleSelect(bvid: string) {
  const idx = selectedBvids.value.indexOf(bvid)
  if (idx === -1) selectedBvids.value = [...selectedBvids.value, bvid]
  else selectedBvids.value = selectedBvids.value.filter((id) => id !== bvid)
}

function selectAllVisible() {
  selectedBvids.value = visibleVideos.value.map((item) => item.info.bvid)
}

function clearSelection() {
  selectedBvids.value = []
}

/** 并发限流批量审核，避免纯串行卡死 */
async function batchSetStatus(status: VideoStatus) {
  const targets = visibleVideos.value.filter((item) => selectedBvids.value.includes(item.info.bvid))
  if (!targets.length) {
    message.warning('请先选择视频')
    return
  }
  isBatchUpdating.value = true
  let success = 0
  let failed = 0
  const concurrency = 4
  let queueIndex = 0

  async function worker() {
    while (queueIndex < targets.length) {
      const current = targets[queueIndex++]
      try {
        const response = await QueryGetAPI(`${VIDEO_COLLECT_API_URL}set-status`, {
          id: currentId(),
          bvid: current.info.bvid,
          status,
        })
        if (response.code !== 200) throw new Error(response.message)
        updateLocalStatus(current.info, status)
        success++
      } catch {
        failed++
      }
    }
  }

  try {
    const workerCount = Math.min(concurrency, targets.length)
    await Promise.all(Array.from({ length: workerCount }, worker))
    selectedBvids.value = []
    if (failed === 0) message.success(`已批量更新 ${success} 条`)
    else message.warning(`成功 ${success} 条，失败 ${failed} 条`)
  } finally {
    isBatchUpdating.value = false
  }
}

async function updateTable(model: VideoCollectCreateModel) {
  tableOperation.value = 'edit'
  try {
    const response = await QueryPostAPI<VideoCollectTable>(`${VIDEO_COLLECT_API_URL}update`, {
      ...model,
      id: currentId(),
    })
    if (response.code !== 200) throw new Error(response.message)
    if (videoDetail.value) videoDetail.value.table = response.data
    editModalVisible.value = false
    message.success('征集信息已更新')
  } catch (error) {
    console.error(error)
    message.error(error instanceof Error ? error.message : '更新失败')
  } finally {
    tableOperation.value = undefined
  }
}

async function toggleCollection() {
  if (!table.value) return
  tableOperation.value = 'toggle'
  const finish = !table.value.isFinish
  try {
    const response = await QueryGetAPI(`${VIDEO_COLLECT_API_URL}finish`, { id: table.value.id, finish })
    if (response.code !== 200) throw new Error(response.message)
    table.value.isFinish = finish
    message.success(finish ? '征集已结束' : '征集已重新开启')
  } catch (error) {
    console.error(error)
    message.error(error instanceof Error ? error.message : '状态更新失败')
  } finally {
    tableOperation.value = undefined
  }
}

function confirmDelete() {
  dialog.warning({
    title: '删除视频征集',
    content: `确定删除“${table.value?.name}”吗？此操作无法撤销。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: deleteTable,
  })
}

async function deleteTable() {
  if (!table.value) return
  tableOperation.value = 'delete'
  try {
    const response = await QueryGetAPI(`${VIDEO_COLLECT_API_URL}del`, { id: table.value.id })
    if (response.code !== 200) throw new Error(response.message)
    message.success('征集已删除')
    await router.replace({ name: 'manage-videoCollect' })
  } catch (error) {
    console.error(error)
    message.error(error instanceof Error ? error.message : '删除失败')
  } finally {
    tableOperation.value = undefined
  }
}

function handleMoreAction(key: string) {
  if (key === 'copy-bvids') {
    copyAcceptedBvids()
  } else if (key === 'copy-links') {
    copyAcceptedLinks()
  } else if (key === 'export') {
    exportResults()
  } else if (key === 'delete') {
    confirmDelete()
  }
}

function copyAcceptedBvids() {
  if (acceptedVideos.value.length === 0) return
  const text = acceptedVideos.value.map((item) => item.info.bvid).join('\n')
  copyToClipboard(text)
  message.success(`已复制 ${acceptedVideos.value.length} 个通过的 BV 号`)
}

function copyAcceptedLinks() {
  if (acceptedVideos.value.length === 0) return
  const text = acceptedVideos.value.map((item) => `https://www.bilibili.com/video/${item.info.bvid}`).join('\n')
  copyToClipboard(text)
  message.success(`已复制 ${acceptedVideos.value.length} 个通过的视频链接`)
}

function exportResults() {
  if (!table.value || acceptedVideos.value.length === 0) return
  const rows = acceptedVideos.value.map(({ info, video }) => ({
    BV号: info.bvid,
    标题: video.title,
    UP主: video.ownerName,
    时长秒: video.length,
    推荐人: info.senders.map((sender) => sender.sender || '匿名用户').join('、'),
    推荐理由: info.senders
      .map((sender) => sender.description)
      .filter(Boolean)
      .join(' | '),
  }))
  const content = `\uFEFF${objectsToCSV(rows)}`
  saveAs(new Blob([content], { type: 'text/csv;charset=utf-8' }), `${table.value.name}-通过结果-${Date.now()}.csv`)
}

function saveQrCode() {
  const canvas = qrCodeWrapper.value?.querySelector('canvas')
  canvas?.toBlob((blob) => {
    if (!blob || !table.value) return
    saveAs(blob, `${table.value.name}-二维码.png`)
  })
}
</script>

<template>
  <div class="video-collect-detail">
    <NSpin :show="isLoading">
      <template v-if="videoDetail && table">
        <ManagePageHeader
          :title="table.name"
          subtitle="视频征集审核"
          :loading="Boolean(tableOperation)"
        >
          <template #action>
            <NButton
              secondary
              @click="router.push({ name: 'manage-videoCollect' })"
            >
              <template #icon><NIcon :component="ArrowLeft24Regular" /></template>
              返回列表
            </NButton>
            <NButton
              type="primary"
              @click="router.push({ name: 'video-collect-list', params: { id: table.id }, query: route.query })"
            >
              <template #icon><NIcon :component="Open24Regular" /></template>
              查看结果页
            </NButton>
            <NButton
              secondary
              @click="shareModalVisible = true"
            >
              <template #icon><NIcon :component="Share24Regular" /></template>
              分享征集
            </NButton>
            <NButton
              secondary
              @click="editModalVisible = true"
            >
              <template #icon><NIcon :component="Edit24Regular" /></template>
              编辑规则
            </NButton>
            <NButton
              secondary
              :type="isActive ? 'warning' : 'success'"
              :loading="tableOperation === 'toggle'"
              @click="toggleCollection"
            >
              <template #icon><NIcon :component="TableDismiss24Regular" /></template>
              {{ isActive ? '结束征集' : '重新开启' }}
            </NButton>
            <NDropdown
              trigger="click"
              :options="moreOptions"
              @select="handleMoreAction"
            >
              <NButton
                secondary
                circle
                title="更多操作"
              >
                <template #icon><NIcon :component="MoreVertical24Regular" /></template>
              </NButton>
            </NDropdown>
          </template>
        </ManagePageHeader>

        <!-- Bento 风格概览指标卡片组 -->
        <section
          class="overview-dashboard"
          aria-label="征集审核概览"
        >
          <div class="overview-main-card">
            <div class="overview-header-row">
              <div class="overview-status-group">
                <NTag
                  size="small"
                  :type="collectionStatus === '进行中' ? 'success' : collectionStatus === '未开始' ? 'info' : 'default'"
                  :bordered="false"
                >
                  {{ collectionStatus }}
                </NTag>
                <span class="overview-time-hint">
                  开放于
                  <NTime
                    :time="table.startAt"
                    format="MM-dd HH:mm"
                  />
                  至
                  <NTime
                    :time="table.endAt"
                    format="MM-dd HH:mm"
                  />
                </span>
              </div>
              <span class="overview-created">
                创建于
                <NTime
                  :time="table.createAt"
                  type="relative"
                />
              </span>
            </div>

            <p class="overview-desc">
              {{ table.description || '未填写征集说明' }}
            </p>

            <div class="overview-capacity">
              <div class="capacity-labels">
                <span class="capacity-title">征集名额进度</span>
                <span class="capacity-val">
                  <strong>{{ table.videoCount }}</strong> / {{ table.maxVideoCount }}
                  <span class="capacity-remain">(剩余 {{ Math.max(0, table.maxVideoCount - table.videoCount) }})</span>
                </span>
              </div>
              <NProgress
                type="line"
                :percentage="Math.min(100, Math.round((table.videoCount / table.maxVideoCount) * 100))"
                :height="6"
                :show-indicator="false"
                :status="table.videoCount >= table.maxVideoCount ? 'success' : 'default'"
              />
            </div>

            <div class="overview-rules-row">
              <span class="rule-chip">
                {{ table.allowUnregisteredUser ? '允许游客投稿' : '仅限绑定账号' }}
              </span>
              <span class="rule-chip">
                {{ table.duplicatePolicy === DuplicateVideoPolicy.Reject ? '拒绝重复' : '重复合并' }}
              </span>
              <span
                v-if="table.requireDescription"
                class="rule-chip"
              >
                推荐理由必填
              </span>
              <span
                v-if="table.minVideoDuration || table.maxVideoDuration"
                class="rule-chip"
              >
                时长 {{ table.minVideoDuration ? formatDuration(table.minVideoDuration) : '不限' }} ~
                {{ table.maxVideoDuration ? formatDuration(table.maxVideoDuration) : '不限' }}
              </span>
              <span
                v-if="table.maxVideoPerUser"
                class="rule-chip"
              >
                每人限 {{ table.maxVideoPerUser }} 个
              </span>
              <span
                v-for="part in table.allowedPartitions"
                :key="part"
                class="rule-chip is-partition"
              >
                {{ part }}
              </span>
            </div>
          </div>

          <!-- 4 宫格统计指标 -->
          <div class="overview-metrics-grid">
            <div
              class="metric-box is-pending"
              :class="{ 'is-active': activeStatus === VideoStatus.Pending }"
              @click="activeStatus = VideoStatus.Pending"
            >
              <div class="metric-top">
                <NIcon :component="Timer24Regular" />
                <span>待审核</span>
              </div>
              <strong class="metric-num">{{ pendingVideos.length }}</strong>
            </div>

            <div
              class="metric-box is-accepted"
              :class="{ 'is-active': activeStatus === VideoStatus.Accepted }"
              @click="activeStatus = VideoStatus.Accepted"
            >
              <div class="metric-top">
                <NIcon :component="CheckmarkCircle24Regular" />
                <span>已通过</span>
              </div>
              <strong class="metric-num">{{ acceptedVideos.length }}</strong>
            </div>

            <div
              class="metric-box is-rejected"
              :class="{ 'is-active': activeStatus === VideoStatus.Rejected }"
              @click="activeStatus = VideoStatus.Rejected"
            >
              <div class="metric-top">
                <NIcon :component="DismissCircle24Regular" />
                <span>已拒绝</span>
              </div>
              <strong class="metric-num">{{ rejectedVideos.length }}</strong>
            </div>

            <div class="metric-box is-duration">
              <div class="metric-top">
                <NIcon :component="Clock24Regular" />
                <span>通过总时长</span>
              </div>
              <strong class="metric-num is-time">{{ formatDuration(acceptedDuration) }}</strong>
            </div>
          </div>
        </section>

        <!-- 审核工作台 -->
        <section class="review-workspace">
          <NTabs
            v-model:value="activeStatus"
            type="segment"
            animated
            class="status-tabs"
          >
            <NTabPane :name="VideoStatus.Pending">
              <template #tab>
                <span class="status-tab">
                  待审核
                  <NBadge
                    :value="pendingVideos.length"
                    :max="99"
                    type="warning"
                  />
                </span>
              </template>
            </NTabPane>
            <NTabPane :name="VideoStatus.Accepted">
              <template #tab>
                <span class="status-tab">
                  已通过
                  <NBadge
                    :value="acceptedVideos.length"
                    :max="99"
                    type="success"
                  />
                </span>
              </template>
            </NTabPane>
            <NTabPane :name="VideoStatus.Rejected">
              <template #tab>
                <span class="status-tab">
                  已拒绝
                  <NBadge
                    :value="rejectedVideos.length"
                    :max="99"
                    type="error"
                  />
                </span>
              </template>
            </NTabPane>
          </NTabs>

          <div class="review-toolbar">
            <NInput
              v-model:value="keyword"
              clearable
              placeholder="搜索标题、BV 号、UP 主或推荐人..."
              class="review-search"
            >
              <template #prefix><NIcon :component="Search24Regular" /></template>
            </NInput>
            <NSelect
              v-model:value="sortOption"
              class="review-sort"
              :options="[
                { label: '最近提交', value: 'submitted-desc' },
                { label: '时长从长到短', value: 'duration-desc' },
                { label: '时长从短到长', value: 'duration-asc' },
                { label: '按标题排序', value: 'title' },
              ]"
            />
            <NButton
              secondary
              :loading="isLoading"
              @click="loadData"
            >
              <template #icon><NIcon :component="ArrowSync24Regular" /></template>
              刷新
            </NButton>
          </div>

          <!-- 批量操作控制条 -->
          <div
            v-if="visibleVideos.length > 0"
            class="batch-bar"
          >
            <NButton
              size="small"
              secondary
              @click="selectAllVisible"
            >
              全选当前列表
            </NButton>
            <NButton
              size="small"
              secondary
              :disabled="selectedBvids.length === 0"
              @click="clearSelection"
            >
              清空选择
            </NButton>
            <span class="batch-count">已选 {{ selectedBvids.length }} / {{ visibleVideos.length }}</span>
            <NButton
              v-if="activeStatus !== VideoStatus.Accepted"
              size="small"
              type="success"
              secondary
              :loading="isBatchUpdating"
              :disabled="selectedBvids.length === 0"
              @click="batchSetStatus(VideoStatus.Accepted)"
            >
              批量通过
            </NButton>
            <NButton
              v-if="activeStatus !== VideoStatus.Rejected"
              size="small"
              type="error"
              secondary
              :loading="isBatchUpdating"
              :disabled="selectedBvids.length === 0"
              @click="batchSetStatus(VideoStatus.Rejected)"
            >
              批量拒绝
            </NButton>
            <NButton
              v-if="activeStatus !== VideoStatus.Pending"
              size="small"
              secondary
              :loading="isBatchUpdating"
              :disabled="selectedBvids.length === 0"
              @click="batchSetStatus(VideoStatus.Pending)"
            >
              批量退回待审
            </NButton>
          </div>

          <!-- 视频卡片列表 -->
          <NEmpty
            v-if="visibleVideos.length === 0"
            :description="keyword ? '没有符合搜索条件的视频' : '此状态下暂无投稿视频'"
            class="review-empty"
          />
          <div
            v-else
            class="video-grid"
          >
            <VideoItemCard
              v-for="item in visibleVideos"
              :key="item.info.bvid"
              :video-info="item.info"
              :video-data="item.video"
              :loading="videoOperation === item.info.bvid || isBatchUpdating"
              selectable
              :selected="selectedBvids.includes(item.info.bvid)"
              @update-status="setStatus"
              @toggle-select="toggleSelect"
            />
          </div>
        </section>
      </template>

      <NResult
        v-else-if="!isLoading"
        status="404"
        title="无法加载视频征集"
        description="征集不存在，或当前账号无权访问。"
      >
        <template #footer>
          <NButton @click="router.push({ name: 'manage-videoCollect' })">返回列表</NButton>
        </template>
      </NResult>
    </NSpin>

    <!-- 分享征集二维码与链接弹窗 -->
    <NModal
      v-model:show="shareModalVisible"
      preset="card"
      title="分享视频征集"
      class="share-modal"
      style="width: 440px; max-width: calc(100vw - 32px)"
    >
      <div class="share-content">
        <div
          ref="qrCodeWrapper"
          class="qr-code-box"
        >
          <Qrcode
            :value="shareUrl"
            level="Q"
            :size="180"
            background="#ffffff"
            foreground="#000000"
            :margin="2"
          />
        </div>
        <p class="share-tip">微信 / B 站等扫码直接投稿</p>
        <NInputGroup>
          <NInput
            :value="shareUrl"
            readonly
          />
          <NButton
            type="primary"
            @click="copyToClipboard(shareUrl)"
          >
            复制链接
          </NButton>
        </NInputGroup>
        <NButton
          secondary
          block
          @click="saveQrCode"
        >
          <template #icon><NIcon :component="ArrowDownload24Regular" /></template>
          保存二维码图片
        </NButton>
      </div>
    </NModal>

    <!-- 编辑表单弹窗 -->
    <VideoCollectFormModal
      v-model:show="editModalVisible"
      title="编辑视频征集规则"
      :initial-value="editValue"
      :loading="tableOperation === 'edit'"
      @submit="updateTable"
    />
  </div>
</template>

<style scoped>
.video-collect-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
  color: var(--vtsuru-fg);
}

/* Bento 风格概览指标 */
.overview-dashboard {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  gap: 14px;
}

.overview-main-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 20px;
  background: var(--vtsuru-bg-elevated);
  border: 1px solid var(--vtsuru-border);
  border-radius: 8px;
  color: var(--vtsuru-fg);
}

.overview-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.overview-status-group {
  display: inline-flex;
  gap: 8px;
  align-items: center;
}

.overview-time-hint,
.overview-created {
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}

.overview-desc {
  margin: 0;
  color: var(--vtsuru-fg-muted);
  font-size: 13px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.overview-capacity {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.capacity-labels {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: var(--vtsuru-fg-muted);
}

.capacity-title {
  color: var(--vtsuru-fg-muted);
}

.capacity-val {
  color: var(--vtsuru-fg-muted);
}

.capacity-val strong {
  color: var(--vtsuru-fg);
  font-weight: 700;
}

.capacity-remain {
  color: var(--vtsuru-fg-muted);
  font-size: 11px;
}

.overview-rules-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: auto;
}

.rule-chip {
  padding: 2px 8px;
  color: var(--vtsuru-fg-muted);
  font-size: 11px;
  background: var(--vtsuru-bg-muted);
  border: 1px solid var(--vtsuru-border);
  border-radius: 4px;
}

.rule-chip.is-partition {
  color: var(--vtsuru-brand);
  background: color-mix(in srgb, var(--vtsuru-brand) 8%, transparent);
}

.overview-metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.metric-box {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 14px 16px;
  background: var(--vtsuru-bg-elevated);
  border: 1px solid var(--vtsuru-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.16s ease;
}

.metric-box:hover {
  transform: translateY(-1px);
}

.metric-box.is-pending.is-active,
.metric-box.is-pending:hover {
  border-color: #f59e0b;
}

.metric-box.is-accepted.is-active,
.metric-box.is-accepted:hover {
  border-color: #10b981;
}

.metric-box.is-rejected.is-active,
.metric-box.is-rejected:hover {
  border-color: #ef4444;
}

.metric-top {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
  font-weight: 500;
}

.metric-box.is-pending .metric-top {
  color: #f59e0b;
}

.metric-box.is-accepted .metric-top {
  color: #10b981;
}

.metric-box.is-rejected .metric-top {
  color: #ef4444;
}

.metric-num {
  font-size: 24px;
  font-weight: 700;
  color: var(--vtsuru-fg);
  line-height: 1.1;
  margin-top: 6px;
}

.metric-num.is-time {
  font-size: 18px;
}

/* 审核工作台 */
.review-workspace {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.status-tabs :deep(.n-tabs-tab) {
  padding: 8px 16px;
}

.status-tab {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  font-weight: 600;
}

.review-toolbar {
  display: flex;
  gap: 10px;
  align-items: center;
}

.review-search {
  flex: 1;
  max-width: 420px;
}

.review-sort {
  width: 150px;
}

.batch-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding: 10px 14px;
  background: var(--vtsuru-bg-elevated);
  border: 1px solid var(--vtsuru-border);
  border-radius: 6px;
}

.batch-count {
  font-size: 12px;
  font-weight: 600;
  color: var(--vtsuru-fg);
  margin-right: 6px;
}

.review-empty {
  padding: 64px 0;
}

.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}

/* 分享弹窗 */
.share-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.qr-code-box {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.share-tip {
  margin: 0;
  font-size: 12px;
  color: var(--vtsuru-fg-muted);
}

@media (max-width: 860px) {
  .overview-dashboard {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 560px) {
  .overview-metrics-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .review-toolbar {
    flex-wrap: wrap;
  }

  .review-search {
    max-width: 100%;
    width: 100%;
  }

  .review-sort {
    flex: 1;
  }
}
</style>
