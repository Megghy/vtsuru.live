<script setup lang="ts">
import type { VideoCollectDetail, VideoCollectVideo, VideoInfo } from '@/api/api-models'
import { Clock24Regular, Person24Regular, Question24Regular } from '@vicons/fluent'
import { useElementSize } from '@vueuse/core'
import { List } from 'linqts'
import {
  NAlert,
  NButton,
  NCard,
  NDivider,
  NEllipsis,
  NIcon,
  NImage,
  NLayoutContent,
  NList,
  NListItem,
  NProgress,
  NResult,
  NSpace,
  NText,
  NTooltip,
  useMessage,
} from 'naive-ui'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { VideoStatus } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { VIDEO_COLLECT_API_URL } from '@/shared/config'
import { NavigateToNewTab } from '@/shared/utils'

const route = useRoute()
const message = useMessage()

const card = ref()

const { width } = useElementSize(card)

const videoDetail = ref<VideoCollectDetail | null>(await get())
const acceptVideos = computed(() => {
  return videoDetail.value?.videos.filter(v => v.info.status == VideoStatus.Accepted)
})
const watchedVideos = computed(() => {
  return videoDetail.value?.videos.filter(v => v.video.watched == true) ?? []
})
const watchedTime = computed(() => {
  return new List(watchedVideos.value).Sum(v => v?.video.length ?? 0)
})
const totalTime = computed(() => {
  return new List(videoDetail.value?.videos).Sum(v => v?.video.length ?? 0)
})

async function get() {
  try {
    const data = await QueryGetAPI<VideoCollectDetail>(`${VIDEO_COLLECT_API_URL}get`, { id: route.params.id })
    if (data.code === 200) {
      return data.data
    }
  } catch (err) {
    console.error(err)
    message.error('获取失败')
  }
  return null
}
function onClick(video: VideoCollectVideo) {
  if (video.watched != true) {
    video.watched = true
  }
  // 将视频对象移动到数组的末尾
  const index = videoDetail.value?.videos.findIndex(v => v.video == video) ?? -1
  const tempVideo = videoDetail.value?.videos[index] ?? ({} as { info: VideoInfo, video: VideoCollectVideo })
  if (index > -1) {
    videoDetail.value?.videos.splice(index, 1)
    videoDetail.value?.videos.push(tempVideo)
  }
  NavigateToNewTab(`https://bilibili.com/video/${video.id}`)
}
function formatSeconds(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  const formattedMinutes = minutes.toString().padStart(2, '0')
  const formattedSeconds = remainingSeconds.toString().padStart(2, '0')

  return `${formattedMinutes}:${formattedSeconds}`
}
function formatSecondsToTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  const formattedHours = hours.toString().padStart(2, '0')
  const formattedMinutes = minutes.toString().padStart(2, '0')
  const formattedSeconds = remainingSeconds.toString().padStart(2, '0')

  let formattedTime = ''
  if (hours > 0) {
    formattedTime += `${formattedHours}时`
  }
  if (minutes > 0) {
    formattedTime += `${formattedMinutes}分`
  }
  formattedTime += `${formattedSeconds}秒`

  return formattedTime
}
</script>

<template>
  <NLayoutContent style="height: 100vh; position: relative">
    <NResult
      v-if="!videoDetail"
      status="404"
      title="未找到指定视频征集表"
      description="请检查链接"
    />
    <NCard
      v-else
      style="width: 600px; max-width: 90vw; top: 30px; margin: 0 auto"
    >
      <template #header>
        视频征集表 | {{ videoDetail.table.name }}
      </template>
      <template #header-extra>
        <NTooltip>
          <template #trigger>
            <NButton
              circle
              size="tiny"
            >
              <template #icon>
                <NIcon :component="Question24Regular" />
              </template>
            </NButton>
          </template>
          只会显示已通过的视频
        </NTooltip>
      </template>
      <NProgress
        type="line"
        :percentage="Math.round((watchedTime / totalTime) * 100)"
      />
      <NSpace
        justify="center"
        :size="5"
      >
        共 [<NText depth="3">
          {{ formatSecondsToTime(totalTime) }}
        </NText>]
        <NDivider vertical />
        已观看 [<NText style="color: #4ea555">
          {{ formatSecondsToTime(watchedTime) }}
        </NText>]
      </NSpace>
      <NDivider>
        共 {{ acceptVideos?.length }} 条
        <NDivider vertical />
        已观看 {{ watchedVideos.length }} 条
      </NDivider>
      <NAlert
        v-if="watchedVideos.length === acceptVideos?.length"
        type="success"
      >
        已观看全部视频
      </NAlert>
      <NList ref="card">
        <NListItem
          v-for="item in acceptVideos"
          :key="item.info.bvid"
        >
          <NCard
            size="small"
            :hoverable="!item.video.watched"
            :embedded="!item.video.watched"
          >
            <NSpace>
              <NImage
                :src="`${item.video.cover}@100h`"
                lazy
                :img-props="{ referrerpolicy: 'no-referrer' }"
                height="75"
                preview-disabled
                style="cursor: pointer"
                @click="onClick(item.video)"
              />
              <NSpace
                vertical
                :size="5"
              >
                <NButton
                  style="width: 100%; max-width: 100px"
                  text
                  @click="onClick(item.video)"
                >
                  <NText
                    :title="item.video.title"
                    :delete="item.video.watched"
                    :style="`color: ${item.video.watched ? '#a54e4e' : ''};width: ${width - 20}px;`"
                  >
                    {{ item.video.title }}
                  </NText>
                </NButton>
                <NText
                  depth="3"
                  style="white-space: pre-line; font-size: small"
                >
                  <NEllipsis line-clamp="1">
                    <template #tooltip>
                      <div style="white-space: pre-line; max-width: 300px">
                        {{ item.video.description }}
                      </div>
                    </template>
                    {{ item.video.description }}
                  </NEllipsis>
                </NText>
                <NSpace style="font-size: 12px">
                  <NSpace>
                    <NIcon :component="Clock24Regular" />
                    {{ formatSeconds(item.video.length) }}
                  </NSpace>
                  <NSpace>
                    <NIcon :component="Person24Regular" />
                    {{ item.video.ownerName }}
                  </NSpace>
                </NSpace>
              </NSpace>
            </NSpace>
          </NCard>
        </NListItem>
      </NList>
    </NCard>
  </NLayoutContent>
</template>
