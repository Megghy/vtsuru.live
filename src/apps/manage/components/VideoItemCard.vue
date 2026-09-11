<script setup lang="ts">
import {
  ArrowClockwise24Regular,
  Checkmark24Regular,
  Clock24Regular,
  Comment24Regular,
  Dismiss24Regular,
  Heart24Regular,
  Open24Regular,
  Person24Regular,
  Video24Regular,
} from '@vicons/fluent'
import { NButton, NCheckbox, NEllipsis, NIcon, NTag, NTime } from 'naive-ui'
import { computed, ref } from 'vue'

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

const coverError = ref(false)
const isExpandedSenders = ref(false)

const primarySender = computed(() => props.videoInfo.senders[0])
const otherSenders = computed(() => props.videoInfo.senders.slice(1))

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
    : `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

function openVideo() {
  window.open(`https://www.bilibili.com/video/${props.videoInfo.bvid}`, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <article
    class="video-item"
    :class="{
      'video-item--selected': selected,
      'is-accepted': videoInfo.status === VideoStatus.Accepted,
      'is-rejected': videoInfo.status === VideoStatus.Rejected,
    }"
  >
    <div class="video-cover-slot">
      <button
        type="button"
        class="video-cover"
        :aria-label="`在哔哩哔哩打开视频：${videoData.title}`"
        @click="openVideo"
      >
        <img
          v-if="!coverError && videoData.cover"
          :src="videoData.cover.replace('http://', 'https://')"
          :alt="videoData.title"
          referrerpolicy="no-referrer"
          @error="coverError = true"
        />
        <div
          v-else
          class="cover-fallback"
        >
          <NIcon
            :component="Video24Regular"
            class="fallback-icon"
          />
          <span>封面无法加载</span>
        </div>

        <span class="duration-label">
          <NIcon :component="Clock24Regular" />
          {{ formatDuration(videoData.length) }}
        </span>
      </button>

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
    </div>

    <div class="video-content">
      <div class="video-heading">
        <button
          type="button"
          class="video-title"
          :title="videoData.title"
          @click="openVideo"
        >
          <NEllipsis :line-clamp="2">
            {{ videoData.title }}
          </NEllipsis>
        </button>
        <button
          type="button"
          class="open-link-icon-btn"
          title="在哔哩哔哩打开"
          aria-label="在哔哩哔哩打开"
          @click.stop="openVideo"
        >
          <NIcon :component="Open24Regular" />
        </button>
      </div>

      <div class="video-meta">
        <span
          class="owner"
          :title="`UP 主: ${videoData.ownerName}`"
        >
          <NIcon :component="Person24Regular" />
          <span class="owner-name">{{ videoData.ownerName }}</span>
        </span>
        <code class="bvid-code">{{ videoInfo.bvid }}</code>
      </div>

      <!-- 推荐信息与粉丝推荐理由 -->
      <div class="recommendations">
        <div class="recommendations-heading">
          <span class="rec-title">
            <NIcon :component="Heart24Regular" />
            <span>粉丝推荐</span>
          </span>
          <NTag
            v-if="otherSenders.length > 0"
            size="tiny"
            :bordered="false"
            class="more-senders-pill"
            @click="isExpandedSenders = !isExpandedSenders"
          >
            共 {{ videoInfo.senders.length }} 人 {{ isExpandedSenders ? '收起' : '展开' }}
          </NTag>
        </div>

        <!-- 首要推荐人 -->
        <div
          v-if="primarySender"
          class="recommendation-primary"
        >
          <div class="recommendation-author">
            <strong class="author-name">{{ primarySender.sender || '匿名用户' }}</strong>
            <span
              v-if="primarySender.senderId"
              class="author-uid"
              >UID {{ primarySender.senderId }}</span
            >
            <NTime
              :time="primarySender.sendAt"
              type="relative"
            />
          </div>
          <p
            v-if="primarySender.description"
            class="recommendation-quote"
            :title="primarySender.description"
          >
            <NIcon
              :component="Comment24Regular"
              class="quote-icon"
            />
            <span>{{ primarySender.description }}</span>
          </p>
        </div>

        <!-- 展开其他合并推荐人 -->
        <div
          v-if="isExpandedSenders && otherSenders.length > 0"
          class="recommendation-more-list"
        >
          <div
            v-for="(sender, idx) in otherSenders"
            :key="idx"
            class="recommendation-sub-item"
          >
            <div class="recommendation-author">
              <span class="author-name">{{ sender.sender || '匿名用户' }}</span>
              <span
                v-if="sender.senderId"
                class="author-uid"
                >UID {{ sender.senderId }}</span
              >
              <NTime
                :time="sender.sendAt"
                type="relative"
              />
            </div>
            <p
              v-if="sender.description"
              class="recommendation-sub-desc"
            >
              {{ sender.description }}
            </p>
          </div>
        </div>

        <div
          v-if="!primarySender"
          class="recommendation-none"
        >
          <span>无推荐详情</span>
        </div>
      </div>

      <!-- 操作按钮组 -->
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
  border-radius: 8px;
  transition: all 0.16s ease;
  color: var(--vtsuru-fg);
}

.video-item:hover {
  border-color: color-mix(in srgb, var(--vtsuru-brand) 50%, var(--vtsuru-border));
}

.video-item--selected {
  border-color: var(--vtsuru-brand);
  box-shadow: 0 0 0 1px var(--vtsuru-brand);
}

.video-cover-slot {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  flex: 0 0 auto;
}

.select-check {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 3;
  display: inline-flex;
  padding: 3px 5px;
  background: rgb(0 0 0 / 60%);
  backdrop-filter: blur(4px);
  border-radius: 4px;
}

.video-cover {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
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
  display: block;
  transition: transform 0.22s ease;
}

.video-cover:hover img {
  transform: scale(1.03);
}

.cover-fallback {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--vtsuru-fg-muted);
  font-size: 11px;
}

.fallback-icon {
  font-size: 24px;
  opacity: 0.6;
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
  font-variant-numeric: tabular-nums;
  line-height: 1;
  background: rgb(0 0 0 / 72%);
  backdrop-filter: blur(4px);
  border-radius: 4px;
  pointer-events: none;
}

.video-content {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  padding: 12px;
}

.video-heading {
  display: flex;
  gap: 6px;
  align-items: flex-start;
  justify-content: space-between;
  min-height: 40px;
}

.video-title {
  flex: 1;
  min-width: 0;
  padding: 0;
  color: var(--vtsuru-fg);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  text-align: left;
  background: transparent;
  border: 0;
  cursor: pointer;
  transition: color 0.15s ease;
}

.video-title:hover {
  color: var(--vtsuru-brand);
}

.open-link-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 3px;
  color: var(--vtsuru-fg-muted);
  background: transparent;
  border: 0;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.open-link-icon-btn:hover {
  color: var(--vtsuru-brand);
  background: color-mix(in srgb, var(--vtsuru-brand) 12%, transparent);
}

.video-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}

.owner {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  min-width: 0;
  overflow: hidden;
}

.owner-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bvid-code {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 11px;
  color: var(--vtsuru-fg-muted);
  opacity: 0.8;
}

.recommendations {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 80px;
  padding-top: 8px;
  border-top: 1px solid var(--vtsuru-border);
}

.recommendations-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}

.rec-title {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  color: var(--vtsuru-brand);
  font-size: 11px;
  font-weight: 600;
}

.more-senders-pill {
  cursor: pointer;
}

.recommendation-primary {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.recommendation-author {
  display: flex;
  gap: 6px;
  align-items: center;
  min-width: 0;
  font-size: 12px;
}

.author-name {
  overflow: hidden;
  font-weight: 600;
  color: var(--vtsuru-fg);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.author-uid {
  color: var(--vtsuru-fg-muted);
  font-size: 11px;
}

.recommendation-author :deep(.n-time) {
  margin-left: auto;
  color: var(--vtsuru-fg-muted);
  font-size: 11px;
  white-space: nowrap;
}

.recommendation-quote {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: var(--vtsuru-fg);
  font-size: 12px;
  line-height: 1.4;
  font-style: italic;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  opacity: 0.9;
  background: color-mix(in srgb, var(--vtsuru-brand) 6%, transparent);
  padding: 4px 8px;
  border-left: 2px solid var(--vtsuru-brand);
  border-radius: 0 4px 4px 0;
}

.quote-icon {
  margin-right: 4px;
  font-size: 11px;
  vertical-align: -1px;
  color: var(--vtsuru-brand);
}

.recommendation-more-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px;
  background: var(--vtsuru-bg-muted);
  border-radius: 6px;
  max-height: 120px;
  overflow-y: auto;
}

.recommendation-sub-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.recommendation-sub-desc {
  margin: 0;
  color: var(--vtsuru-fg-muted);
  font-size: 11px;
}

.recommendation-none {
  color: var(--vtsuru-fg-muted);
  font-size: 11px;
  font-style: italic;
}

.video-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: auto;
  padding-top: 4px;
}
</style>
