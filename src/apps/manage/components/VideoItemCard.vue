<script setup lang="ts">
import type { VideoCollectVideo, VideoInfo } from '@/api/api-models'
import { VideoStatus } from '@/api/api-models'
import { Clock24Filled, Person24Filled } from '@vicons/fluent'
import {
  NButton,
  NCard,
  NEllipsis,
  NIcon,
  NPopconfirm,
  NScrollbar,
  NSpace,
  NTag,
  NText,
} from 'naive-ui'

const props = defineProps<{
  videoInfo: VideoInfo
  videoData: VideoCollectVideo
  type: 'padding' | 'accept' | 'reject'
  isLoading?: boolean
}>()

const emit = defineEmits<{
  (e: 'updateStatus', status: VideoStatus, video: VideoInfo): void
}>()

function handleStatusChange(status: VideoStatus) {
  emit('updateStatus', status, props.videoInfo)
}

function formatSeconds(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  const formattedMinutes = minutes.toString().padStart(2, '0')
  const formattedSeconds = remainingSeconds.toString().padStart(2, '0')
  return `${formattedMinutes}:${formattedSeconds}`
}

function openVideo() {
  window.open(`https://www.bilibili.com/video/${props.videoInfo.bvid}`, '_blank')
}

</script>

<template>
  <NCard
    size="small"
    hoverable
    embedded
    class="video-card"
    content-style="padding: 0;"
  >
    <template #cover>
      <div
        class="cover-container"
        @click="openVideo"
      >
        <img
          :src="videoData.cover.replace('http://', 'https://')"
          referrerpolicy="no-referrer"
          class="cover-img"
        >
        <div class="cover-info">
          <span class="info-item">
            <NIcon
              :component="Clock24Filled"
              color="lightgrey"
            />
            <NText style="color: lightgrey; font-size: 12px; margin-left: 4px">
              {{ formatSeconds(videoData.length) }}
            </NText>
          </span>
          <span class="info-item">
            <NIcon
              :component="Person24Filled"
              color="lightgrey"
            />
            <NText style="color: lightgrey; font-size: 12px; margin-left: 4px">
              {{ videoData.ownerName }}
            </NText>
          </span>
        </div>
      </div>
    </template>

    <div class="card-content">
      <div class="title-row">
        <NButton
          text
          style="width: 100%; justify-content: flex-start; text-align: left;"
          @click="openVideo"
        >
          <NEllipsis style="max-width: 100%">
            <template #tooltip>
              <div style="max-width: 300px">
                {{ videoData.title }}
              </div>
            </template>
            <span style="font-weight: 500; font-size: 15px;">{{ videoData.title }}</span>
          </NEllipsis>
        </NButton>
      </div>

      <div class="sender-info">
        <NScrollbar style="max-height: 80px">
          <div
            v-for="(sender, index) in videoInfo.senders"
            :key="index"
            class="sender-item"
          >
            <div class="sender-row">
              <NTag
                size="small"
                :bordered="false"
                round
                style="margin-right: 6px; transform: scale(0.85); transform-origin: left center;"
              >
                推荐人
              </NTag>
              <NText depth="2">
                {{ sender.sender ?? '未填写' }}
                <span style="opacity: 0.5">[{{ sender.senderId ?? '未填写' }}]</span>
              </NText>
            </div>
            <div
              v-if="sender.description"
              class="sender-desc"
            >
              <NText depth="3">
                {{ sender.description }}
              </NText>
            </div>
            <NDivider
              v-if="index < videoInfo.senders.length - 1"
              style="margin: 8px 0"
            />
          </div>
        </NScrollbar>
      </div>

      <div class="action-area">
        <template v-if="type === 'padding'">
          <NSpace
            justify="space-between"
            :wrap="false"
          >
            <NButton
              strong
              secondary
              type="success"
              size="small"
              class="flex-1"
              :loading="isLoading"
              @click="handleStatusChange(VideoStatus.Accepted)"
            >
              通过
            </NButton>
            <NButton
              strong
              secondary
              type="error"
              size="small"
              class="flex-1"
              :loading="isLoading"
              @click="handleStatusChange(VideoStatus.Rejected)"
            >
              拒绝
            </NButton>
          </NSpace>
        </template>

        <template v-if="type === 'accept'">
          <NSpace
            justify="space-between"
            :wrap="false"
          >
            <NButton
              secondary
              size="small"
              class="flex-1"
              :loading="isLoading"
              @click="handleStatusChange(VideoStatus.Pending)"
            >
              重置
            </NButton>
            <NPopconfirm @positive-click="handleStatusChange(VideoStatus.Rejected)">
              <template #trigger>
                <NButton
                  strong
                  secondary
                  type="error"
                  size="small"
                  class="flex-1"
                  :loading="isLoading"
                >
                  拒绝
                </NButton>
              </template>
              确定要拒绝这个已通过的视频吗？
            </NPopconfirm>
          </NSpace>
        </template>

        <template v-if="type === 'reject'">
          <NSpace
            justify="space-between"
            :wrap="false"
          >
            <NButton
              strong
              secondary
              type="success"
              size="small"
              class="flex-1"
              :loading="isLoading"
              @click="handleStatusChange(VideoStatus.Accepted)"
            >
              通过
            </NButton>
            <NButton
              secondary
              size="small"
              class="flex-1"
              :loading="isLoading"
              @click="handleStatusChange(VideoStatus.Pending)"
            >
              重置
            </NButton>
          </NSpace>
        </template>
      </div>
    </div>
  </NCard>
</template>

<style scoped>
.video-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.2s ease;
}

.video-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.cover-container {
  position: relative;
  height: 140px;
  overflow: hidden;
  cursor: pointer;
  background: #f0f0f0;
}

.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s;
}

.cover-container:hover .cover-img {
  transform: scale(1.05);
}

.cover-info {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 6px 8px;
  background: linear-gradient(to top, rgba(0,0,0,0.7), transparent);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.info-item {
  display: flex;
  align-items: center;
}

.card-content {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.title-row {
  height: 24px;
  display: flex;
  align-items: center;
}

.sender-info {
  background: rgba(0, 0, 0, 0.02);
  border-radius: 4px;
  padding: 8px;
  font-size: 12px;
  min-height: 60px;
}

.sender-row {
  display: flex;
  align-items: center;
  margin-bottom: 2px;
}

.sender-desc {
  padding-left: 4px;
  line-height: 1.4;
}

.action-area {
  margin-top: auto;
  padding-top: 4px;
}

.flex-1 {
  flex: 1;
}
</style>
