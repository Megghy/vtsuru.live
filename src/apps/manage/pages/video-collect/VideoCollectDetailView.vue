<script setup lang="ts">
import {
  ArrowDownload24Regular,
  ArrowLeft24Regular,
  ArrowSync24Regular,
  Delete24Regular,
  Edit24Regular,
  MoreVertical24Regular,
  Open24Regular,
  Search24Regular,
  Share24Regular,
  TableDismiss24Regular,
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
    label: '导出通过结果',
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

async function batchSetStatus(status: VideoStatus) {
  const targets = visibleVideos.value.filter((item) => selectedBvids.value.includes(item.info.bvid))
  if (!targets.length) {
    message.warning('请先选择视频')
    return
  }
  isBatchUpdating.value = true
  let success = 0
  let failed = 0
  try {
    for (const item of targets) {
      try {
        const response = await QueryGetAPI(`${VIDEO_COLLECT_API_URL}set-status`, {
          id: currentId(),
          bvid: item.info.bvid,
          status,
        })
        if (response.code !== 200) throw new Error(response.message)
        updateLocalStatus(item.info, status)
        success++
      } catch {
        failed++
      }
    }
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
  if (key === 'export') {
    exportResults()
  } else if (key === 'delete') {
    confirmDelete()
  }
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
          subtitle="投稿审核"
          :loading="Boolean(tableOperation)"
        >
          <template #action>
            <NButton
              secondary
              @click="router.push({ name: 'manage-videoCollect' })"
            >
              <template #icon
                ><NIcon><ArrowLeft24Regular /></NIcon
              ></template>
              返回
            </NButton>
            <NButton
              type="primary"
              @click="router.push({ name: 'video-collect-list', params: { id: table.id }, query: route.query })"
            >
              <template #icon>
                <NIcon :component="Open24Regular" />
              </template>
              查看结果页
            </NButton>
            <NButton
              secondary
              @click="shareModalVisible = true"
            >
              <template #icon
                ><NIcon><Share24Regular /></NIcon
              ></template>
              分享
            </NButton>
            <NButton
              secondary
              @click="editModalVisible = true"
            >
              <template #icon
                ><NIcon><Edit24Regular /></NIcon
              ></template>
              编辑
            </NButton>
            <NButton
              secondary
              :type="isActive ? 'warning' : 'success'"
              :loading="tableOperation === 'toggle'"
              @click="toggleCollection"
            >
              <template #icon
                ><NIcon><TableDismiss24Regular /></NIcon
              ></template>
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
                <template #icon
                  ><NIcon><MoreVertical24Regular /></NIcon
                ></template>
              </NButton>
            </NDropdown>
          </template>
        </ManagePageHeader>

        <section class="collection-overview">
          <div class="collection-copy">
            <div class="collection-state">
              <NTag
                :type="collectionStatus === '进行中' ? 'success' : collectionStatus === '未开始' ? 'info' : 'default'"
                :bordered="false"
              >
                {{ collectionStatus }}
              </NTag>
              <span>
                创建于
                <NTime
                  :time="table.createAt"
                  format="yyyy-MM-dd HH:mm"
                />
              </span>
            </div>
            <p>{{ table.description || '未填写征集说明' }}</p>
            <div class="collection-facts">
              <div>
                <span>开放时间</span>
                <strong>
                  <NTime
                    :time="table.startAt"
                    format="yyyy-MM-dd HH:mm"
                  />
                </strong>
              </div>
              <div>
                <span>截止时间</span>
                <strong>
                  <NTime
                    :time="table.endAt"
                    format="yyyy-MM-dd HH:mm"
                  />
                </strong>
              </div>
              <div>
                <span>剩余名额</span>
                <strong>{{ Math.max(0, table.maxVideoCount - table.videoCount) }}</strong>
              </div>
            </div>
            <div class="capacity-progress">
              <div class="capacity-heading">
                <span>占用名额</span>
                <strong>{{ table.videoCount }} / {{ table.maxVideoCount }}</strong>
              </div>
              <NProgress
                type="line"
                :percentage="Math.min(100, Math.round((table.videoCount / table.maxVideoCount) * 100))"
                :height="6"
                :show-indicator="false"
              />
            </div>
            <div class="rule-tags">
              <NTag
                size="small"
                :bordered="false"
              >
                待审核 + 已通过占名额，拒绝后释放
              </NTag>
              <NTag
                size="small"
                :bordered="false"
              >
                {{ table.allowUnregisteredUser ? '允许游客投稿' : '仅限已绑定账号' }}
              </NTag>
              <NTag
                v-if="table.minVideoDuration || table.maxVideoDuration"
                size="small"
                :bordered="false"
              >
                时长 {{ table.minVideoDuration ? formatDuration(table.minVideoDuration) : '不限' }} -
                {{ table.maxVideoDuration ? formatDuration(table.maxVideoDuration) : '不限' }}
              </NTag>
              <NTag
                v-if="table.maxVideoPerUser"
                size="small"
                :bordered="false"
              >
                每人最多 {{ table.maxVideoPerUser }} 个
              </NTag>
              <NTag
                v-if="table.requireDescription"
                size="small"
                :bordered="false"
              >
                推荐理由必填
              </NTag>
              <NTag
                size="small"
                :bordered="false"
              >
                {{ table.duplicatePolicy === DuplicateVideoPolicy.Reject ? '拒绝重复视频' : '重复视频合并推荐人' }}
              </NTag>
              <NTag
                v-for="partition in table.allowedPartitions"
                :key="partition"
                size="small"
                :bordered="false"
              >
                {{ partition }}
              </NTag>
            </div>
          </div>
          <div class="review-stats">
            <div>
              <span>待审核</span><strong>{{ pendingVideos.length }}</strong>
            </div>
            <div>
              <span>已通过</span><strong>{{ acceptedVideos.length }}</strong>
            </div>
            <div>
              <span>已拒绝</span><strong>{{ rejectedVideos.length }}</strong>
            </div>
            <div>
              <span>通过总时长</span><strong class="duration-value">{{ formatDuration(acceptedDuration) }}</strong>
            </div>
          </div>
        </section>

        <section class="review-workspace">
          <NTabs
            v-model:value="activeStatus"
            type="segment"
            animated
            class="status-tabs"
          >
            <NTabPane :name="VideoStatus.Pending">
              <template #tab>
                <span class="status-tab"
                  >待审核
                  <NBadge
                    :value="pendingVideos.length"
                    :max="99"
                    type="warning"
                /></span>
              </template>
            </NTabPane>
            <NTabPane :name="VideoStatus.Accepted">
              <template #tab>
                <span class="status-tab"
                  >已通过
                  <NBadge
                    :value="acceptedVideos.length"
                    :max="99"
                    type="success"
                /></span>
              </template>
            </NTabPane>
            <NTabPane :name="VideoStatus.Rejected">
              <template #tab>
                <span class="status-tab"
                  >已拒绝
                  <NBadge
                    :value="rejectedVideos.length"
                    :max="99"
                    type="error"
                /></span>
              </template>
            </NTabPane>
          </NTabs>

          <div class="review-toolbar">
            <NInput
              v-model:value="keyword"
              clearable
              placeholder="搜索标题、BV 号、UP 主或推荐人"
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
              <template #icon
                ><NIcon><ArrowSync24Regular /></NIcon
              ></template>
              刷新
            </NButton>
          </div>

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
            <span class="batch-count">已选 {{ selectedBvids.length }}</span>
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

          <NEmpty
            v-if="visibleVideos.length === 0"
            :description="keyword ? '没有符合条件的视频' : '此状态下暂无视频'"
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

    <NModal
      v-model:show="shareModalVisible"
      preset="card"
      title="分享视频征集"
      class="share-modal"
    >
      <div class="share-content">
        <div
          ref="qrCodeWrapper"
          class="qr-code"
        >
          <Qrcode
            :value="shareUrl"
            level="Q"
            :size="196"
            background="#fff"
            :margin="1"
          />
        </div>
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
          @click="saveQrCode"
        >
          <template #icon
            ><NIcon><ArrowDownload24Regular /></NIcon
          ></template>
          保存二维码
        </NButton>
      </div>
    </NModal>

    <VideoCollectFormModal
      v-model:show="editModalVisible"
      title="编辑视频征集"
      :initial-value="editValue"
      :loading="tableOperation === 'edit'"
      @submit="updateTable"
    />
  </div>
</template>

<style scoped>
.video-collect-detail,
.review-workspace {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.collection-overview {
  display: grid;
  grid-template-columns: minmax(280px, 1.3fr) minmax(420px, 1fr);
  margin-top: 16px;
  border-block: 1px solid var(--vtsuru-border);
}

.collection-copy {
  min-width: 0;
  padding: 18px 20px 18px 4px;
}

.collection-state {
  display: flex;
  gap: 10px;
  align-items: center;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}

.collection-copy p {
  margin: 12px 0 14px;
  color: var(--vtsuru-fg-muted);
  font-size: 13px;
  line-height: 1.6;
}

.collection-facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-block: 1px solid var(--vtsuru-border);
}

.collection-facts > div {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  padding: 10px 0;
}

.collection-facts > div + div {
  padding-left: 18px;
  border-left: 1px solid var(--vtsuru-border);
}

.collection-facts span,
.capacity-heading span {
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}

.collection-facts strong,
.capacity-heading strong {
  overflow: hidden;
  color: var(--vtsuru-fg);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.capacity-progress {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 14px;
}

.rule-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
}

.capacity-heading {
  display: flex;
  justify-content: space-between;
}

.review-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border-left: 1px solid var(--vtsuru-border);
}

.review-stats > div {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  min-width: 0;
  padding: 14px 18px;
}

.review-stats > div:nth-child(odd) {
  border-right: 1px solid var(--vtsuru-border);
}

.review-stats > div:nth-child(-n + 2) {
  border-bottom: 1px solid var(--vtsuru-border);
}

.review-stats span {
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}

.review-stats strong {
  font-size: 20px;
  line-height: 1.2;
}

.review-stats .duration-value {
  overflow: hidden;
  font-size: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-tabs {
  width: min(560px, 100%);
}

.review-workspace {
  margin-top: 20px;
}

.status-tab {
  display: flex;
  gap: 8px;
  align-items: center;
}

.review-toolbar {
  display: flex;
  gap: 10px;
}

.batch-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--vtsuru-border);
  border-radius: 8px;
  background: var(--vtsuru-bg-muted);
}

.batch-count {
  font-size: 12px;
  color: var(--vtsuru-fg-muted);
  margin-right: 4px;
}

.review-search {
  width: min(440px, 100%);
}

.review-sort {
  width: 170px;
}

.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
  gap: 12px;
}

.review-empty {
  padding: 64px 0;
}

.share-modal {
  width: min(520px, calc(100vw - 32px));
}

.share-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
}

.qr-code {
  display: flex;
  padding: 10px;
  background: #fff;
  border: 1px solid var(--vtsuru-border);
  border-radius: 6px;
}

@media (max-width: 860px) {
  .collection-overview {
    grid-template-columns: 1fr;
  }

  .collection-copy {
    padding-right: 4px;
  }

  .review-stats {
    border-top: 1px solid var(--vtsuru-border);
    border-left: 0;
  }
}

@media (max-width: 620px) {
  .collection-facts {
    grid-template-columns: minmax(0, 1fr);
  }

  .collection-facts > div + div {
    padding-left: 0;
    border-top: 1px solid var(--vtsuru-border);
    border-left: 0;
  }

  .review-toolbar {
    flex-wrap: wrap;
  }

  .review-search {
    width: 100%;
  }

  .review-sort {
    flex: 1;
    width: auto;
  }

  .video-grid {
    grid-template-columns: 1fr;
  }
}
</style>
