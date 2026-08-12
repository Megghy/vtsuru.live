<script setup lang="ts">
import {
  ArrowClockwise24Regular,
  Checkmark24Regular,
  Clock24Regular,
  Dismiss24Regular,
  Open24Regular,
  Person24Regular,
} from '@vicons/fluent'
import { NButton, NCheckbox, NEllipsis, NIcon, NTag, NTime } from 'naive-ui'
import { computed } from 'vue'

import type { VideoCollectVideo, VideoInfo } from '@/api/api-models'
import { VideoStatus } from '@/api/api-models'

const props = defineProps<{
  videoInfo: VideoInfo
  videoData: VideoCollectVideo
  loading?: boolean
  selectable?: boolean
  selected?: boolean
}>()

const emit = defineEmits<{
  updateStatus: [status: VideoStatus, video: VideoInfo]
  toggleSelect: [bvid: string]
}>()

const actions = computed(() => {
  if (props.videoInfo.status === VideoStatus.Pending) {
    return [
      { label: '通过', status: VideoStatus.Accepted, type: 'success' as const, icon: Checkmark24Regular },
      { label: '拒绝', status: VideoStatus.Rejected, type: 'error' as const, icon: Dismiss24Regular },
    ]
  }
  if (props.videoInfo.status === VideoStatus.Accepted) {
    return [
      { label: '退回待审', status: VideoStatus.Pending, type: 'default' as const, icon: ArrowClockwise24Regular },
      { label: '改为拒绝', status: VideoStatus.Rejected, type: 'error' as const, icon: Dismiss24Regular },
    ]
  }
  return [
    { label: '退回待审', status: VideoStatus.Pending, type: 'default' as const, icon: ArrowClockwise24Regular },
    { label: '改为通过', status: VideoStatus.Accepted, type: 'success' as const, icon: Checkmark24Regular },
  ]
})

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
    : `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
}

function openVideo() {
  window.open(`https://www.bilibili.com/video/${props.videoInfo.bvid}`, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <article
    class="video-item"
    :class="{ 'video-item--selected': selected }"
  >
    <button
      type="button"
      class="video-cover"
      :aria-label="`打开视频：${videoData.title}`"
      @click="openVideo"
    >
      <img
        :src="videoData.cover.replace('http://', 'https://')"
        :alt="videoData.title"
        referrerpolicy="no-referrer"
      />
      <span
        v-if="selectable"
        class="select-check"
        @click.stop.prevent="emit('toggleSelect', videoInfo.bvid)"
      >
        <NCheckbox
          :checked="selected"
          @update:checked="emit('toggleSelect', videoInfo.bvid)"
          @click.stop
        />
      </span>
      <span class="duration-label">
        <NIcon :component="Clock24Regular" />
        {{ formatDuration(videoData.length) }}
      </span>
    </button>

    <div class="video-content">
      <div class="video-heading">
        <button
          type="button"
          class="video-title"
          @click="openVideo"
        >
          <NEllipsis :line-clamp="2">
            {{ videoData.title }}
          </NEllipsis>
        </button>
        <NButton
          text
          circle
          title="在哔哩哔哩打开"
          @click="openVideo"
        >
          <template #icon>
            <NIcon :component="Open24Regular" />
          </template>
        </NButton>
      </div>

      <div class="video-meta">
        <span>
          <NIcon :component="Person24Regular" />
          {{ videoData.ownerName }}
        </span>
        <code>{{ videoInfo.bvid }}</code>
      </div>

      <div class="recommendations">
        <div class="recommendations-heading">
          <span>推荐记录</span>
          <NTag
            size="tiny"
            :bordered="false"
          >
            {{ videoInfo.senders.length }} 人
          </NTag>
        </div>
        <div class="recommendation-list">
          <div
            v-for="(sender, index) in videoInfo.senders"
            :key="`${sender.senderId ?? sender.sender}-${sender.sendAt}-${index}`"
            class="recommendation-item"
          >
            <div class="recommendation-author">
              <strong>{{ sender.sender || '匿名用户' }}</strong>
              <span v-if="sender.senderId">UID {{ sender.senderId }}</span>
              <NTime
                :time="sender.sendAt"
                type="relative"
              />
            </div>
            <p v-if="sender.description">
              {{ sender.description }}
            </p>
          </div>
        </div>
      </div>

      <div class="video-actions">
        <NButton
          v-for="action in actions"
          :key="action.status"
          secondary
          strong
          size="small"
          :type="action.type"
          :loading="loading"
          @click="emit('updateStatus', action.status, videoInfo)"
        >
          <template #icon>
            <NIcon :component="action.icon" />
          </template>
          {{ action.label }}
        </NButton>
      </div>
    </div>
  </article>
</template>

<style scoped>
.video-item {
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;
  overflow: hidden;
  background: var(--vtsuru-bg-elevated);
  border: 1px solid var(--vtsuru-border);
  border-radius: 6px;
}

.video-item--selected {
  border-color: color-mix(in srgb, var(--vtsuru-primary) 55%, var(--vtsuru-border));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--vtsuru-primary) 35%, transparent);
}

.select-check {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 2;
  display: inline-flex;
  padding: 2px 4px;
  background: rgb(0 0 0 / 45%);
  border-radius: 6px;
}

.video-cover {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  padding: 0;
  overflow: hidden;
  background: var(--vtsuru-bg-muted);
  border: 0;
  cursor: pointer;
}

.video-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.18s ease;
}

.video-cover:hover img {
  transform: scale(1.025);
}

.duration-label {
  position: absolute;
  right: 8px;
  bottom: 8px;
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 3px 6px;
  color: #fff;
  font-size: 11px;
  line-height: 1;
  background: rgb(0 0 0 / 72%);
  border-radius: 4px;
}

.video-content {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 11px;
  min-height: 0;
  padding: 12px;
}

.video-heading {
  display: flex;
  gap: 6px;
  align-items: flex-start;
  min-height: 42px;
}

.video-title {
  flex: 1;
  min-width: 0;
  padding: 0;
  color: var(--vtsuru-fg);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.45;
  text-align: left;
  background: transparent;
  border: 0;
  cursor: pointer;
}

.video-title:hover {
  color: var(--vtsuru-brand);
}

.video-meta,
.video-meta span {
  display: flex;
  align-items: center;
}

.video-meta {
  justify-content: space-between;
  gap: 10px;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}

.video-meta span {
  min-width: 0;
  gap: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.video-meta code {
  font-size: 11px;
}

.recommendations {
  min-height: 98px;
  padding-top: 10px;
  border-top: 1px solid var(--vtsuru-border);
}

.recommendations-heading,
.recommendation-author {
  display: flex;
  align-items: center;
}

.recommendations-heading {
  justify-content: space-between;
  margin-bottom: 7px;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}

.recommendation-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 112px;
  overflow: auto;
}

.recommendation-author {
  gap: 6px;
  min-width: 0;
  font-size: 12px;
}

.recommendation-author strong {
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recommendation-author span,
.recommendation-author :deep(.n-time) {
  color: var(--vtsuru-fg-muted);
  font-size: 11px;
}

.recommendation-author :deep(.n-time) {
  margin-left: auto;
  white-space: nowrap;
}

.recommendation-item p {
  display: -webkit-box;
  margin: 3px 0 0;
  overflow: hidden;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
  line-height: 1.4;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.video-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: auto;
  padding-top: 2px;
}

@media (max-width: 520px) {
  .video-item {
    display: grid;
    grid-template-columns: 120px minmax(0, 1fr);
  }

  .video-cover {
    height: 100%;
    aspect-ratio: auto;
  }

  .video-heading {
    min-height: 0;
  }

  .recommendations {
    min-height: 0;
  }
}
</style>
