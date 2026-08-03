<script setup lang="ts">
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { computed } from 'vue'

import type { VideoCollectVideo, VideoInfo } from '@/api/api-models'
import { VideoStatus } from '@/api/api-models'

const props = defineProps<{
  videoInfo: VideoInfo
  videoData: VideoCollectVideo
  loading?: boolean
}>()

const emit = defineEmits<{
  updateStatus: [status: VideoStatus, video: VideoInfo]
}>()

const actions = computed(() => {
  if (props.videoInfo.status === VideoStatus.Pending) {
    return [
      { label: '通过', status: VideoStatus.Accepted, type: 'success' as const, icon: 'i-lucide-check' },
      { label: '拒绝', status: VideoStatus.Rejected, type: 'error' as const, icon: 'i-lucide-x' },
    ]
  }
  if (props.videoInfo.status === VideoStatus.Accepted) {
    return [
      { label: '退回待审', status: VideoStatus.Pending, type: 'default' as const, icon: 'i-lucide-rotate-ccw' },
      { label: '改为拒绝', status: VideoStatus.Rejected, type: 'error' as const, icon: 'i-lucide-x' },
    ]
  }
  return [
    { label: '退回待审', status: VideoStatus.Pending, type: 'default' as const, icon: 'i-lucide-rotate-ccw' },
    { label: '改为通过', status: VideoStatus.Accepted, type: 'success' as const, icon: 'i-lucide-check' },
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

function formatRelativeTime(timestamp: number) {
  return formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale: zhCN })
}
</script>

<template>
  <article class="video-item">
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
      <span class="duration-label">
        <UIcon name="i-lucide-clock-3" />
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
          <span class="video-title__text">
            {{ videoData.title }}
          </span>
        </button>
        <UButton
          color="neutral"
          variant="ghost"
          square
          title="在哔哩哔哩打开"
          aria-label="在哔哩哔哩打开"
          @click="openVideo"
        >
          <UIcon name="i-lucide-external-link" />
        </UButton>
      </div>

      <div class="video-meta">
        <span>
          <UIcon name="i-lucide-user" />
          {{ videoData.ownerName }}
        </span>
        <code>{{ videoInfo.bvid }}</code>
      </div>

      <div class="recommendations">
        <div class="recommendations-heading">
          <span>推荐记录</span>
          <UBadge
            size="xs"
            variant="subtle"
          >
            {{ videoInfo.senders.length }} 人
          </UBadge>
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
              <time class="recommendation-time">{{ formatRelativeTime(sender.sendAt) }}</time>
            </div>
            <p v-if="sender.description">
              {{ sender.description }}
            </p>
          </div>
        </div>
      </div>

      <div class="video-actions">
        <UButton
          v-for="action in actions"
          :key="action.status"
          :color="action.type === 'default' ? 'neutral' : action.type"
          variant="soft"
          size="sm"
          :loading="loading"
          @click="emit('updateStatus', action.status, videoInfo)"
        >
          <UIcon :name="action.icon" />
          {{ action.label }}
        </UButton>
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

.video-title__text {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
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
.recommendation-time {
  color: var(--vtsuru-fg-muted);
  font-size: 11px;
}

.recommendation-time {
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
