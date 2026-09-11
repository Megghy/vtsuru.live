<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import {
  Checkmark24Regular,
  Copy24Regular,
  Open24Regular,
  Settings24Regular,
} from '@vicons/fluent'
import {
  NButton,
  NFlex,
  NIcon,
  NTag,
  NText,
  NTooltip,
  useMessage,
} from 'naive-ui'
import { computed, ref } from 'vue'

import { getCategoryMeta } from '@/apps/obs-store/registry'
import type { ObsComponentDefinition } from '@/apps/obs-store/registry'

const props = defineProps<{
  item: ObsComponentDefinition
}>()

const emit = defineEmits<{
  configure: [item: ObsComponentDefinition]
}>()

const message = useMessage()
const { copy, isSupported: isCopySupported } = useClipboard()
const copied = ref(false)

const isReady = computed(() => props.item.status === 'ready')
const categoryMeta = computed(() => getCategoryMeta(props.item.category))

const absoluteObsUrl = computed(() => {
  if (!props.item.obsPath) return ''
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${props.item.obsPath}`
  }
  return props.item.obsPath
})

async function handleCopy() {
  if (!props.item.obsPath) return

  if (!isCopySupported) {
    message.warning('当前环境不支持直接写入剪贴板，请手动复制')
    return
  }

  try {
    await copy(absoluteObsUrl.value)
    copied.value = true
    message.success(`已复制 ${props.item.name} 的 OBS 浏览器源链接`)
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    message.error('复制失败，请手动复制')
  }
}
</script>

<template>
  <div
    class="obs-card"
    :class="{ 'is-ready': isReady, 'is-planned': !isReady }"
  >
    <!-- 卡片头部 -->
    <div class="card-header">
      <div class="icon-box">
        <NIcon
          :component="item.icon"
          class="comp-icon"
        />
      </div>
      <div class="header-main">
        <div class="title-row">
          <span class="card-title">{{ item.name }}</span>
          <NTag
            size="tiny"
            :type="isReady ? 'success' : 'default'"
            :bordered="false"
            class="status-tag"
          >
            {{ isReady ? '已就绪' : '规划中' }}
          </NTag>
        </div>
        <div class="meta-row">
          <span
            v-if="categoryMeta"
            class="cat-label"
          >
            {{ categoryMeta.name }}
          </span>
          <span
            v-if="item.version"
            class="ver-label"
          >
            v{{ item.version }}
          </span>
        </div>
      </div>
    </div>

    <!-- 卡片内容 -->
    <div class="card-body">
      <p class="card-desc">
        {{ item.shortDescription }}
      </p>

      <!-- 特性列表 -->
      <div
        v-if="item.features.length > 0"
        class="feature-list"
      >
        <div
          v-for="(feat, idx) in item.features.slice(0, 2)"
          :key="idx"
          class="feature-item"
        >
          <span class="feature-dot" />
          <span class="feature-text">{{ feat }}</span>
        </div>
      </div>

      <!-- 标签 -->
      <div class="tags-wrap">
        <span
          v-for="tag in item.tags.slice(0, 4)"
          :key="tag"
          class="tag-pill"
        >
          {{ tag }}
        </span>
        <span
          v-if="item.tags.length > 4"
          class="tag-more"
        >
          +{{ item.tags.length - 4 }}
        </span>
      </div>

      <!-- 推荐尺寸规格 -->
      <div
        v-if="item.defaultResolution"
        class="resolution-info"
      >
        <span class="res-label">推荐尺寸:</span>
        <span class="res-val">{{ item.defaultResolution.width }} × {{ item.defaultResolution.height }} px</span>
      </div>
    </div>

    <!-- 卡片底部操作栏 -->
    <div class="card-footer">
      <template v-if="isReady">
        <NButton
          type="primary"
          size="small"
          class="action-btn config-btn"
          @click="emit('configure', item)"
        >
          <template #icon>
            <NIcon :component="Settings24Regular" />
          </template>
          配置与调试
        </NButton>

        <NFlex
          :size="6"
          align="center"
        >
          <NTooltip trigger="hover">
            <template #trigger>
              <NButton
                size="small"
                secondary
                class="action-icon-btn"
                @click="handleCopy"
              >
                <template #icon>
                  <NIcon :component="copied ? Checkmark24Regular : Copy24Regular" />
                </template>
              </NButton>
            </template>
            复制默认 OBS 浏览器源链接
          </NTooltip>

          <NTooltip
            v-if="item.obsPath"
            trigger="hover"
          >
            <template #trigger>
              <NButton
                size="small"
                secondary
                tag="a"
                :href="item.obsPath"
                target="_blank"
                class="action-icon-btn"
              >
                <template #icon>
                  <NIcon :component="Open24Regular" />
                </template>
              </NButton>
            </template>
            在新标签页预览 OBS 源
          </NTooltip>
        </NFlex>
      </template>

      <template v-else>
        <div class="planned-footer">
          <span class="planned-text">开发规划中，敬请期待</span>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.obs-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background: var(--vtsuru-bg-elevated);
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius);
  padding: 16px;
  box-sizing: border-box;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  height: 100%;
}

.obs-card:hover {
  transform: translateY(-2px);
  border-color: var(--vtsuru-brand);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.obs-card.is-planned {
  opacity: 0.78;
}

.obs-card.is-planned:hover {
  transform: none;
  border-color: var(--vtsuru-border);
  box-shadow: none;
}

/* 头部 */
.card-header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 12px;
}

.icon-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  background: var(--vtsuru-brand-soft);
  color: var(--vtsuru-brand);
  border-radius: 8px;
  flex-shrink: 0;
}

.comp-icon {
  font-size: 20px;
}

.header-main {
  flex: 1;
  min-width: 0;
}

.title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--vtsuru-fg);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-tag {
  font-size: 11px;
  flex-shrink: 0;
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
}

.cat-label {
  font-size: 12px;
  color: var(--vtsuru-fg-muted);
}

.ver-label {
  font-size: 11px;
  color: var(--vtsuru-fg-muted);
  opacity: 0.8;
}

/* 内容 */
.card-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.card-desc {
  font-size: 13px;
  color: var(--vtsuru-fg-muted);
  line-height: 1.5;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.feature-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--vtsuru-fg);
}

.feature-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--vtsuru-brand);
  flex-shrink: 0;
}

.feature-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tags-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 2px;
}

.tag-pill {
  font-size: 11px;
  color: var(--vtsuru-fg-muted);
  background: var(--vtsuru-bg-muted);
  padding: 1px 6px;
  border-radius: 4px;
}

.tag-more {
  font-size: 11px;
  color: var(--vtsuru-fg-muted);
  padding: 1px 4px;
}

.resolution-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  background: var(--vtsuru-bg-muted);
  padding: 4px 8px;
  border-radius: 4px;
  color: var(--vtsuru-fg-muted);
  margin-top: auto;
}

.res-label {
  opacity: 0.8;
}

.res-val {
  font-weight: 500;
  color: var(--vtsuru-fg);
}

/* 底部操作 */
.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--vtsuru-border);
}

.action-btn {
  flex: 1;
}

.action-icon-btn {
  padding: 0 8px;
}

.planned-footer {
  width: 100%;
  text-align: center;
  padding: 4px 0;
}

.planned-text {
  font-size: 12px;
  color: var(--vtsuru-fg-muted);
}
</style>
