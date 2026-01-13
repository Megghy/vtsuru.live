<script setup lang="ts">
import type {
  FormRules,
} from 'naive-ui'
import type {
  VideoCollectCreateModel,
  VideoCollectDetail,
  VideoCollectTable,
  VideoInfo,
} from '@/api/api-models'
import {
  ArrowLeft24Regular,
  Delete24Regular,
  Edit24Regular,
  MoreVertical24Regular,
  Share24Regular,
  TableDismiss24Regular,
} from '@vicons/fluent'
import { useWindowSize } from '@vueuse/core'
import { List } from 'linqts'
import {
  NBadge,
  NButton,
  NDatePicker,
  NDropdown,
  NEmpty,
  NForm,
  NFormItem,
  NGrid,
  NGridItem,
  NIcon,
  NInput,
  NInputNumber,
  NModal,
  NPopconfirm,
  NSpace,
  NTabPane,
  NTabs,
  NText,
  useMessage,
  useThemeVars,
} from 'naive-ui'
import Qrcode from 'qrcode.vue'
import { computed, h, onActivated, ref } from 'vue'
import { useRoute } from 'vue-router'
import {
  VideoStatus,
} from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import VideoCollectInfoCard from '@/components/VideoCollectInfoCard.vue'
import VideoItemCard from '@/apps/manage/components/VideoItemCard.vue'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import { CURRENT_HOST, VIDEO_COLLECT_API_URL } from '@/shared/config'
import router from '@/app/router'
import { downloadImage } from '@/shared/utils'

const route = useRoute()
const message = useMessage()
const themeVars = useThemeVars()
const { width } = useWindowSize()

const shareModalVisiable = ref(false)
const editModalVisiable = ref(false)
const isLoading = ref(false)

const formRef = ref()
const defaultModel = { maxVideoCount: 50 } as VideoCollectCreateModel
const updateModel = ref<VideoCollectCreateModel>(JSON.parse(JSON.stringify(defaultModel)))

const videoDetail = ref<VideoCollectDetail>(await getData())

const createRules: FormRules = {
  name: [
    {
      required: true,
      message: '请输入征集表名称',
    },
  ],
  endAt: [
    {
      required: true,
      message: '请输入结束日期',
    },
    {
      required: true,
      message: '结束时间不能低于一小时',
      validator: (rule: unknown, value: string) => {
        const date = new Date(value)
        if (date.getTime() < new Date().getTime() + 1000 * 60 * 60) {
          return false
        }
        return true
      },
    },
  ],
  maxVideoCount: [
    {
      required: true,
      message: '请输入最大视频数量',
    },
    {
      required: true,
      message: '视频不能少于1个',
      trigger: ['input', 'blur'],
      validator: (rule: unknown, value: string) => {
        if (Number(value) < 1) {
          return false
        }
        return true
      },
    },
  ],
}

const paddingVideos = computed(() => {
  return videoDetail.value?.videos?.filter(v => v.info.status == VideoStatus.Pending) ?? []
})
const rejectVideos = computed(() => {
  return videoDetail.value?.videos?.filter(v => v.info.status == VideoStatus.Rejected) ?? []
})
const acceptVideos = computed(() => {
  return videoDetail.value?.videos?.filter(v => v.info.status == VideoStatus.Accepted) ?? []
})

// 移动端下拉菜单选项
const mobileMenuOptions = computed(() => [
  {
    label: '分享',
    key: 'share',
    icon: () => h(NIcon, null, { default: () => h(Share24Regular) }),
  },
  {
    label: '更新信息',
    key: 'edit',
    icon: () => h(NIcon, null, { default: () => h(Edit24Regular) }),
  },
  {
    label: videoDetail.value.table.isFinish ? '开启表' : '关闭表',
    key: 'toggle-status',
    icon: () => h(NIcon, null, { default: () => h(TableDismiss24Regular) }),
  },
  {
    label: '结果页面',
    key: 'result',
  },
  {
    label: '删除',
    key: 'delete',
    icon: () => h(NIcon, { color: themeVars.value.errorColor }, { default: () => h(Delete24Regular) }),
  },
])

function handleMobileMenuSelect(key: string) {
  switch (key) {
    case 'share':
      shareModalVisiable.value = true
      break
    case 'edit':
      editModalVisiable.value = true
      break
    case 'toggle-status':
      closeTable()
      break
    case 'result':
      router.push({ name: 'video-collect-list', params: { id: videoDetail.value.table.id } })
      break
    case 'delete':
      deleteTable() // 这里最好加个确认，但在下拉菜单里直接触发确认比较麻烦，暂时直接调用，原逻辑是有Popconfirm的
      // 由于移动端下拉菜单难以直接嵌入Popconfirm，建议改为点击后弹窗确认
      break
  }
}

async function getData() {
  try {
    const id = Array.isArray(route.params.id) ? route.params.id[0] : route.params.id
    if (!id) throw new Error('缺少征集表 id')
    const data = await QueryGetAPI<VideoCollectDetail>(`${VIDEO_COLLECT_API_URL}get`, { id })
    if (data.code == 200) {
      updateModel.value = {
        id: data.data.table.id,
        name: data.data.table.name,
        endAt: data.data.table.endAt,
        description: data.data.table.description,
        maxVideoCount: data.data.table.maxVideoCount,
      } as VideoCollectCreateModel
      return data.data
    }
  } catch (err) {
    console.error(err)
    message.error('获取失败')
  }
  return {} as VideoCollectDetail
}

function setStatus(status: VideoStatus, video: VideoInfo) {
  isLoading.value = true
  QueryGetAPI(`${VIDEO_COLLECT_API_URL}set-status`, {
    id: videoDetail.value.table.id,
    bvid: video.bvid,
    status,
  })
    .then((data) => {
      if (data.code == 200) {
        video.status = status
        message.success('设置成功')
      } else {
        message.error(`设置失败: ${data.message}`)
      }
    })
    .catch((err) => {
      console.error(err)
      message.error('设置失败')
    })
    .finally(() => {
      isLoading.value = false
    })
}

function formatSeconds(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  const formattedMinutes = minutes.toString().padStart(2, '0')
  const formattedSeconds = remainingSeconds.toString().padStart(2, '0')

  return `${formattedMinutes}:${formattedSeconds}`
}

function dateDisabled(ts: number) {
  return ts < Date.now() + 1000 * 60 * 60
}

function updateTable() {
  isLoading.value = true
  updateModel.value.id = videoDetail.value.table.id
  QueryPostAPI<VideoCollectTable>(`${VIDEO_COLLECT_API_URL}update`, updateModel.value)
    .then((data) => {
      if (data.code == 200) {
        message.success('更新成功')
        editModalVisiable.value = false
        videoDetail.value.table = data.data
      } else {
        message.error(`更新失败: ${data.message}`)
      }
    })
    .catch((err) => {
      console.error(err)
      message.error('更新失败')
    })
    .finally(() => {
      isLoading.value = false
    })
}

function deleteTable() {
  isLoading.value = true
  QueryGetAPI(`${VIDEO_COLLECT_API_URL}del`, {
    id: videoDetail.value.table.id,
  })
    .then((data) => {
      if (data.code == 200) {
        message.success('已删除')
        setTimeout(() => {
          router.push({ name: 'manage-videoCollect' })
        }, 1000)
      } else {
        message.error(`删除失败: ${data.message}`)
      }
    })
    .catch((err) => {
      console.error(err)
      message.error('删除失败')
    })
    .finally(() => {
      isLoading.value = false
    })
}

function closeTable() {
  isLoading.value = true
  QueryGetAPI(`${VIDEO_COLLECT_API_URL}finish`, {
    id: videoDetail.value.table.id,
    finish: !videoDetail.value.table.isFinish,
  })
    .then((data) => {
      if (data.code == 200) {
        message.success(`已${videoDetail.value.table.isFinish ? '开启表' : '关闭表'}`)
        videoDetail.value.table.isFinish = !videoDetail.value.table.isFinish
      } else {
        message.error(`操作失败: ${data.message}`)
      }
    })
    .catch((err) => {
      console.error(err)
      message.error('操作失败')
    })
    .finally(() => {
      isLoading.value = false
    })
}

function saveQRCode() {
  downloadImage(
    `https://api.qrserver.com/v1/create-qr-code/?data=${`https://vtsuru.live/video-collect/${videoDetail.value.table.shortId}`}`,
    `vtsuru-视频征集二维码-${videoDetail.value.table.name}.png`,
  )
}

onActivated(async () => {
  if (route.params.id != videoDetail.value.table.id) {
    videoDetail.value = await getData()
  }
})
</script>

<template>
  <div class="video-collect-detail">
    <ManagePageHeader :title="videoDetail?.table?.name || '视频征集'" subtitle="审核与管理视频提交">
      <template #action>
        <NButton secondary size="small" @click="$router.go(-1)">
          <template #icon>
            <NIcon><ArrowLeft24Regular /></NIcon>
          </template>
          返回
        </NButton>

        <NSpace v-if="width > 800">
          <NButton secondary strong size="small" @click="shareModalVisiable = true">
            <template #icon>
              <NIcon><Share24Regular /></NIcon>
            </template>
            分享
          </NButton>
          <NButton secondary strong size="small" @click="editModalVisiable = true">
            <template #icon>
              <NIcon><Edit24Regular /></NIcon>
            </template>
            更新信息
          </NButton>
          <NButton
            secondary
            strong
            size="small"
            :type="videoDetail.table.isFinish ? 'success' : 'warning'"
            @click="closeTable"
          >
            <template #icon>
              <NIcon><TableDismiss24Regular /></NIcon>
            </template>
            {{ videoDetail.table.isFinish ? '开启征集' : '结束征集' }}
          </NButton>
          <NButton
            secondary
            strong
            size="small"
            type="info"
            @click="$router.push({ name: 'video-collect-list', params: { id: videoDetail.table.id } })"
          >
            查看结果
          </NButton>
          <NPopconfirm @positive-click="deleteTable">
            <template #trigger>
              <NButton secondary strong size="small" type="error">
                <template #icon>
                  <NIcon><Delete24Regular /></NIcon>
                </template>
                删除
              </NButton>
            </template>
            确定删除表? 此操作无法撤销
          </NPopconfirm>
        </NSpace>

        <NDropdown
          v-else
          trigger="click"
          :options="mobileMenuOptions"
          @select="handleMobileMenuSelect"
        >
          <NButton secondary strong size="small" circle>
            <template #icon>
              <NIcon><MoreVertical24Regular /></NIcon>
            </template>
          </NButton>
        </NDropdown>
      </template>
    </ManagePageHeader>

    <!-- Info Card -->
    <div class="info-card-wrapper">
      <VideoCollectInfoCard
        :item="videoDetail.table"
        style="width: 100%"
        from="owner"
      />
    </div>

    <!-- Stats -->
    <div class="stats-bar">
      <NText depth="3">
        已通过视频总时长:
        <NText
          strong
          style="color: var(--n-text-color)"
        >
          {{ formatSeconds(new List(acceptVideos).Sum((v) => v?.video.length ?? 0)) }}
        </NText>
      </NText>
    </div>

    <!-- Content Area -->
    <div class="content-area">
      <NEmpty
        v-if="videoDetail?.videos?.length === 0"
        description="暂无视频提交"
      />
      <NTabs
        v-else
        animated
        type="line"
        justify-content="space-evenly"
        class="custom-tabs"
      >
        <NTabPane name="padding">
          <template #tab>
            <div class="tab-label">
              <span>待审核</span>
              <NBadge
                v-if="paddingVideos.length > 0"
                :value="paddingVideos.length"
                :max="99"
                type="warning"
                class="tab-badge"
              />
            </div>
          </template>
          <div class="video-grid">
            <NGrid
              x-gap="12"
              y-gap="12"
              cols="1 520:2 800:3 1100:4 1400:5"
              responsive="self"
            >
              <NGridItem
                v-for="v in paddingVideos"
                :key="v.info.bvid"
              >
                <VideoItemCard
                  :video-info="v.info"
                  :video-data="v.video"
                  type="padding"
                  :is-loading="isLoading"
                  @update-status="setStatus"
                />
              </NGridItem>
            </NGrid>
          </div>
        </NTabPane>

        <NTabPane name="accept">
          <template #tab>
            <div class="tab-label">
              <NText type="success">
                已通过
              </NText>
              <NBadge
                v-if="acceptVideos.length > 0"
                :value="acceptVideos.length"
                :max="99"
                type="success"
                class="tab-badge"
              />
            </div>
          </template>
          <div class="video-grid">
            <NGrid
              x-gap="12"
              y-gap="12"
              cols="1 520:2 800:3 1100:4 1400:5"
              responsive="self"
            >
              <NGridItem
                v-for="v in acceptVideos"
                :key="v.info.bvid"
              >
                <VideoItemCard
                  :video-info="v.info"
                  :video-data="v.video"
                  type="accept"
                  :is-loading="isLoading"
                  @update-status="setStatus"
                />
              </NGridItem>
            </NGrid>
          </div>
        </NTabPane>

        <NTabPane name="reject">
          <template #tab>
            <div class="tab-label">
              <NText type="error">
                已拒绝
              </NText>
              <NBadge
                v-if="rejectVideos.length > 0"
                :value="rejectVideos.length"
                :max="99"
                :color="themeVars.errorColor"
                class="tab-badge"
              />
            </div>
          </template>
          <div class="video-grid">
            <NGrid
              x-gap="12"
              y-gap="12"
              cols="1 520:2 800:3 1100:4 1400:5"
              responsive="self"
            >
              <NGridItem
                v-for="v in rejectVideos"
                :key="v.info.bvid"
              >
                <VideoItemCard
                  :video-info="v.info"
                  :video-data="v.video"
                  type="reject"
                  :is-loading="isLoading"
                  @update-status="setStatus"
                />
              </NGridItem>
            </NGrid>
          </div>
        </NTabPane>
      </NTabs>
    </div>

    <!-- Modals -->
    <NModal
      v-model:show="shareModalVisiable"
      title="分享"
      preset="card"
      style="width: 600px; max-width: 90vw"
    >
      <div style="display: flex; flex-direction: column; align-items: center; gap: 24px; padding: 12px;">
        <div :style="{ padding: '12px', background: themeVars.cardColor, borderRadius: themeVars.borderRadius }">
          <Qrcode
            :value="`${CURRENT_HOST}video-collect/${videoDetail.table.shortId}`"
            level="Q"
            :size="200"
            background="#fff"
            :margin="1"
          />
        </div>
        <NInput
          :value="`${CURRENT_HOST}video-collect/${videoDetail.table.shortId}`"
          readonly
          @click="(e: MouseEvent) => (e.target as HTMLInputElement).select()"
        />
        <NButton
          type="primary"
          @click="saveQRCode"
        >
          保存二维码图片
        </NButton>
      </div>
    </NModal>

    <NModal
      v-model:show="editModalVisiable"
      title="更新信息"
      preset="card"
      style="width: 600px; max-width: 90vw"
    >
      <NForm
        ref="formRef"
        :model="updateModel"
        :rules="createRules"
        label-placement="left"
        label-width="80"
      >
        <NFormItem
          label="标题"
          path="name"
        >
          <NInput
            v-model:value="updateModel.name"
            placeholder="征集表的标题"
            maxlength="30"
            show-count
          />
        </NFormItem>
        <NFormItem
          label="描述"
          path="description"
        >
          <NInput
            v-model:value="updateModel.description"
            type="textarea"
            placeholder="可以是备注之类的"
            maxlength="300"
            show-count
            :autosize="{ minRows: 3, maxRows: 5 }"
          />
        </NFormItem>
        <NGrid
          :cols="2"
          :x-gap="12"
        >
          <NGridItem>
            <NFormItem
              label="最大数量"
              path="maxVideoCount"
            >
              <NInputNumber
                v-model:value="updateModel.maxVideoCount"
                placeholder="最大数量"
                type="number"
                style="width: 100%"
              />
            </NFormItem>
          </NGridItem>
          <NGridItem>
            <NFormItem
              label="结束时间"
              path="endAt"
            >
              <NDatePicker
                v-model:value="updateModel.endAt"
                type="datetime"
                placeholder="结束征集的时间"
                :is-date-disabled="dateDisabled"
                style="width: 100%"
              />
            </NFormItem>
          </NGridItem>
        </NGrid>
        
        <div style="display: flex; justify-content: flex-end; margin-top: 12px;">
          <NButton
            type="primary"
            :loading="isLoading"
            @click="updateTable"
          >
            保存更改
          </NButton>
        </div>
      </NForm>
    </NModal>
  </div>
</template>

<style scoped>
.video-collect-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-card-wrapper {
}

.stats-bar {
  display: flex;
  justify-content: flex-end;
  padding: 0 4px 12px;
}

.content-area {
}

.custom-tabs :deep(.n-tabs-nav) {
  padding: 4px;
}

.tab-label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 8px;
}

.tab-badge {
  transform: scale(0.85);
}

.video-grid {
  padding: 12px 0;
}
</style>
