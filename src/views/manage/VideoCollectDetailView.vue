<script setup lang="ts">
import { downloadImage } from '@/Utils'
import {
  VideoCollectCreateModel,
  VideoCollectDetail,
  VideoCollectTable,
  VideoCollectVideo,
  VideoInfo,
  VideoStatus,
} from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import VideoCollectInfoCard from '@/components/VideoCollectInfoCard.vue'
import { CURRENT_HOST, VIDEO_COLLECT_API_URL } from '@/data/constants'
import router from '@/router'
import { Clock24Filled, Person24Filled } from '@vicons/fluent'
import { useWindowSize } from '@vueuse/core'
import { List } from 'linqts'
import {
  FormRules,
  NButton,
  NCard,
  NDatePicker,
  NDivider,
  NEllipsis,
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
  NScrollbar,
  NSpace,
  NTabPane,
  NTabs,
  NText,
  useMessage,
} from 'naive-ui'
import Qrcode from 'qrcode.vue'
import { VNode, computed, h, onActivated, ref } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const message = useMessage()
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
  return videoDetail.value?.videos?.filter((v) => v.info.status == VideoStatus.Pending) ?? []
})
const rejectVideos = computed(() => {
  return videoDetail.value?.videos?.filter((v) => v.info.status == VideoStatus.Rejected) ?? []
})
const acceptVideos = computed(() => {
  return videoDetail.value?.videos?.filter((v) => v.info.status == VideoStatus.Accepted) ?? []
})

async function getData() {
  try {
    const data = await QueryGetAPI<VideoCollectDetail>(VIDEO_COLLECT_API_URL + 'get', { id: route.params.id })
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
    message.error('获取失败')
  }
  return {} as VideoCollectDetail
}
const gridRender = (type: 'padding' | 'reject' | 'accept') => {
  let footer: (arg0: VideoInfo) => VNode
  let videos: { info: VideoInfo; video: VideoCollectVideo }[]
  switch (type) {
    case 'padding':
      footer = paddingButtonGroup
      videos = paddingVideos.value
      break
    case 'reject':
      footer = rejectButtonGroup
      videos = rejectVideos.value
      break
    case 'accept':
      footer = acceptButtonGroup
      videos = acceptVideos.value
      break
  }
  return videos.length == 0
    ? h(NEmpty)
    : h(NGrid, { cols: '1 500:2 700:3 900:4 1200:5  ', xGap: '12', yGap: '12', responsive: 'self' }, () =>
      videos?.map((v) =>
        h(NGridItem, () =>
          h(
            NCard,
            { style: 'height: 330px;', embedded: true, size: 'small' },
            {
              cover: () =>
                h('div', { style: 'position: relative;height: 150px;' }, [
                  h('img', {
                    src: v.video.cover.replace('http://', 'https://'),
                    referrerpolicy: 'no-referrer',
                    style: 'max-height: 100%; object-fit: contain;cursor: pointer',
                    onClick: () => window.open('https://www.bilibili.com/video/' + v.info.bvid, '_blank'),
                  }),
                  h(
                    NSpace,
                    {
                      style: { position: 'relative', bottom: '20px', background: '#00000073' },
                      justify: 'space-around',
                    },
                    () => [
                      h('span', [
                        h(NIcon, { component: Clock24Filled, color: 'lightgrey' }),
                        h(NText, { style: 'color: lightgrey;size:small;' }, () => formatSeconds(v.video.length)),
                      ]),
                      h('span', [
                        h(NIcon, { component: Person24Filled, color: 'lightgrey' }),
                        h(NText, { style: 'color: lightgrey;size:small;' }, () => v.video.ownerName),
                      ]),
                    ],
                  ),
                ]),
              header: () =>
                h(
                  NButton,
                  {
                    style: 'width: 100%;',
                    text: true,
                    onClick: () => window.open('https://www.bilibili.com/video/' + v.info.bvid, '_blank'),
                  },
                  () =>
                    h(
                      NEllipsis,
                      { style: 'max-width: 100%;' },
                      {
                        default: () => v.video.title,
                        tooltip: () => h('div', { style: 'max-width: 300px' }, v.video.title),
                      },
                    ),
                ),
              default: () =>
                h(NScrollbar, { style: 'height: 65px;' }, () =>
                  h(NCard, { contentStyle: 'padding: 5px;' }, () =>
                    v.info.senders.map((s) => [
                      h('div', { style: 'font-size: 12px;' }, [
                        h('div', `推荐人: ${s.sender ?? '未填写'} [${s.senderId ?? '未填写'}]`),
                        h('div', `推荐理由: ${s.description ?? '未填写'}`),
                      ]),
                      h(NSpace, { style: 'margin: 0;' }),
                    ]),
                  ),
                ),
              footer: () => footer(v.info),
            },
          ),
        ),
      ),
    )
}
const paddingButtonGroup = (v: VideoInfo) =>
  h(NSpace, { size: 'small', justify: 'space-around' }, () => [
    h(
      NButton,
      { type: 'success', loading: isLoading.value, onClick: () => setStatus(VideoStatus.Accepted, v) },
      () => '通过',
    ),
    h(
      NButton,
      { type: 'error', loading: isLoading.value, onClick: () => setStatus(VideoStatus.Rejected, v) },
      () => '拒绝',
    ),
  ])
const acceptButtonGroup = (v: VideoInfo) =>
  h(NSpace, { size: 'small', justify: 'space-around' }, () => [
    h(
      NButton,
      { type: 'info', loading: isLoading.value, onClick: () => setStatus(VideoStatus.Pending, v) },
      () => '重设为未审核',
    ),
    h(
      NButton,
      { type: 'error', loading: isLoading.value, onClick: () => setStatus(VideoStatus.Rejected, v) },
      () => '拒绝',
    ),
  ])
const rejectButtonGroup = (v: VideoInfo) =>
  h(NSpace, { size: 'small', justify: 'space-around' }, () => [
    h(
      NButton,
      { type: 'success', loading: isLoading.value, onClick: () => setStatus(VideoStatus.Accepted, v) },
      () => '通过',
    ),
    h(
      NButton,
      { type: 'info', loading: isLoading.value, onClick: () => setStatus(VideoStatus.Pending, v) },
      () => '重设为未审核',
    ),
  ])
function setStatus(status: VideoStatus, video: VideoInfo) {
  isLoading.value = true
  QueryGetAPI(VIDEO_COLLECT_API_URL + 'set-status', {
    id: videoDetail.value.table.id,
    bvid: video.bvid,
    status: status,
  })
    .then((data) => {
      if (data.code == 200) {
        video.status = status
        message.success('设置成功')
      } else {
        message.error('设置失败: ' + data.message)
      }
    })
    .catch((err) => {
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
  QueryPostAPI<VideoCollectTable>(VIDEO_COLLECT_API_URL + 'update', updateModel.value)
    .then((data) => {
      if (data.code == 200) {
        message.success('更新成功')
        videoDetail.value.table = data.data
      } else {
        message.error('更新失败: ' + data.message)
      }
    })
    .catch((err) => {
      message.error('更新失败')
    })
    .finally(() => {
      isLoading.value = false
    })
}
function deleteTable() {
  isLoading.value = true
  QueryGetAPI(VIDEO_COLLECT_API_URL + 'del', {
    id: videoDetail.value.table.id,
  })
    .then((data) => {
      if (data.code == 200) {
        message.success('已删除')
        setTimeout(() => {
          router.push({ name: 'manage-videoCollect' })
        }, 1000)
      } else {
        message.error('删除失败: ' + data.message)
      }
    })
    .catch((err) => {
      message.error('删除失败')
    })
    .finally(() => {
      isLoading.value = false
    })
}
function closeTable() {
  isLoading.value = true
  QueryGetAPI(VIDEO_COLLECT_API_URL + 'finish', {
    id: videoDetail.value.table.id,
    finish: !videoDetail.value.table.isFinish,
  })
    .then((data) => {
      if (data.code == 200) {
        message.success('已' + (videoDetail.value.table.isFinish ? '开启表' : '关闭表'))
        videoDetail.value.table.isFinish = !videoDetail.value.table.isFinish
      } else {
        message.error('操作失败: ' + data.message)
      }
    })
    .catch((err) => {
      message.error('操作失败')
    })
    .finally(() => {
      isLoading.value = false
    })
}
function saveQRCode() {
  downloadImage(
    `https://api.qrserver.com/v1/create-qr-code/?data=${'https://vtsuru.live/video-collect/' + videoDetail.value.table.shortId}`,
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
  <NSpace>
    <NButton @click="$router.go(-1)" text>
      <NText depth="3">{{ '< 返回' }}</NText>
    </NButton>
    <template v-if="width <= 1000">
      <NButton type="success" size="small" @click="shareModalVisiable = true"> 分享 </NButton>
      <NButton type="info" size="small" @click="editModalVisiable = true"> 更新 </NButton>
      <NButton type="warning" size="small" @click="closeTable">
        {{ videoDetail.table.isFinish ? '开启表' : '关闭表' }}
      </NButton>
      <NButton size="small" @click="$router.push({ name: 'video-collect-list', params: { id: videoDetail.table.id } })">
        结果页面
      </NButton>
      <NPopconfirm :on-positive-click="deleteTable">
        <template #trigger>
          <NButton type="error" size="small"> 删除 </NButton>
        </template>
        确定删除表? 此操作无法撤销
      </NPopconfirm>
    </template>
  </NSpace>
  <VideoCollectInfoCard :item="videoDetail.table" style="width: 100%; max-width: 90vw" from="owner">
    <template v-if="width > 1000" #header-extra>
      <NSpace>
        <NButton type="success" size="small" @click="shareModalVisiable = true"> 分享 </NButton>
        <NButton type="info" size="small" @click="editModalVisiable = true"> 更新 </NButton>
        <NButton type="warning" size="small" @click="closeTable">
          {{ videoDetail.table.isFinish ? '开启表' : '关闭表' }}
        </NButton>
        <NButton size="small"
          @click="$router.push({ name: 'video-collect-list', params: { id: videoDetail.table.id } })">
          结果表
        </NButton>
        <NPopconfirm :on-positive-click="deleteTable">
          <template #trigger>
            <NButton type="error" size="small"> 删除 </NButton>
          </template>
          确定删除表? 此操作无法撤销
        </NPopconfirm>
      </NSpace>
    </template>
  </VideoCollectInfoCard>
  <NDivider> 已通过时长: {{ formatSeconds(new List(acceptVideos).Sum((v) => v?.video.length ?? 0)) }} </NDivider>
  <NEmpty v-if="videoDetail?.videos?.length == 0" description="暂无视频" />
  <template v-else>
    <NTabs animated type="segment">
      <NTabPane name="padding">
        <template #tab>
          未审核
          <NDivider vertical style="margin: 0 3px 0 3px" />
          <NText depth="3">
            {{ paddingVideos.length }}
          </NText>
        </template>
        <component :is="gridRender('padding')" />
      </NTabPane>
      <NTabPane name="accept">
        <template #tab>
          <NText style="color: #5bb85f"> 通过 </NText>
          <NDivider vertical style="margin: 0 5px 0 5px" />
          <NText depth="3">
            {{ acceptVideos.length }}
          </NText>
        </template>
        <component :is="gridRender('accept')" />
      </NTabPane>
      <NTabPane name="reject">
        <template #tab>
          <NText style="color: #a85f5f"> 拒绝 </NText>
          <NDivider vertical style="margin: 0 3px 0 3px" />
          <NText depth="3">
            {{ rejectVideos.length }}
          </NText>
        </template>
        <component :is="gridRender('reject')" />
      </NTabPane>
    </NTabs>
  </template>
  <NModal v-model:show="shareModalVisiable" title="分享" preset="card" style="width: 600px; max-width: 90vw">
    <Qrcode :value="`${CURRENT_HOST}video-collect/` + videoDetail.table.shortId" level="Q" :size="100" background="#fff"
      :margin="1" />
    <NInput :value="`${CURRENT_HOST}video-collect/` + videoDetail.table.shortId" />
    <NDivider />
    <NSpace justify="center">
      <NButton type="primary" @click="saveQRCode"> 保存二维码 </NButton>
    </NSpace>
  </NModal>
  <NModal v-model:show="editModalVisiable" title="更新信息" preset="card" style="width: 600px; max-width: 90vw">
    <NForm ref="formRef" :model="updateModel" :rules="createRules">
      <NFormItem label="标题" path="name">
        <NInput v-model:value="updateModel.name" placeholder="征集表的标题" maxlength="30" show-count />
      </NFormItem>
      <NFormItem label="描述" path="description">
        <NInput v-model:value="updateModel.description" placeholder="可以是备注之类的" maxlength="300" show-count />
      </NFormItem>
      <NFormItem label="视频数量" path="maxVideoCount">
        <NInputNumber v-model:value="updateModel.maxVideoCount" placeholder="最大数量" type="number"
          style="max-width: 150px" />
      </NFormItem>
      <NFormItem label="结束时间" path="endAt">
        <NDatePicker v-model:value="updateModel.endAt" type="datetime" placeholder="结束征集的时间"
          :isDateDisabled="dateDisabled" />
        <NDivider vertical />
        <NText depth="3"> 最低为一小时 </NText>
      </NFormItem>
      <NFormItem>
        <NSpace>
          <NButton type="primary" @click="updateTable" :loading="isLoading"> 更新 </NButton>
        </NSpace>
      </NFormItem>
    </NForm>
  </NModal>
</template>
