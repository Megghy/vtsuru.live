<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import {
  Checkmark24Regular,
  Copy24Regular,
  Open24Regular,
  Settings24Regular,
} from '@vicons/fluent'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import { getCategoryMeta } from '@/apps/obs-store/registry'
import type { ObsComponentDefinition } from '@/apps/obs-store/registry'
import { useAccount } from '@/api/account'
import { buildObsSourceUrl } from '@/shared/obs/obsUrl'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

const props = defineProps<{
  item: ObsComponentDefinition
}>()

const emit = defineEmits<{
  configure: [item: ObsComponentDefinition]
}>()

const account = useAccount()
const { copy, isSupported: isCopySupported } = useClipboard()
const copied = ref(false)

const isReady = computed(() => props.item.status === 'ready' || props.item.status === 'beta')
const statusLabel = computed(() => props.item.status === 'beta' ? '内测' : isReady.value ? '已就绪' : '规划中')
const categoryMeta = computed(() => getCategoryMeta(props.item.category))

const absoluteObsUrl = computed(() => {
  if (!props.item.obsPath || typeof window === 'undefined') return ''
  return buildObsSourceUrl({
    path: props.item.obsPath,
    host: window.location.origin,
    credential: props.item.requiresAccount ? 'public-id' : 'none',
    userId: props.item.requiresAccount ? account.value.id : undefined,
    params: props.item.requiresAccount ? { channel: 'default' } : undefined,
  })
})

async function handleCopy() {
  if (!absoluteObsUrl.value) {
    toast.warning(props.item.requiresAccount ? '请登录后生成 OBS 浏览器源链接' : '当前组件暂不可用')
    return
  }

  if (!isCopySupported.value) {
    toast.warning('当前环境不支持直接写入剪贴板，请手动复制')
    return
  }

  try {
    await copy(absoluteObsUrl.value)
    copied.value = true
    toast.success(`已复制 ${props.item.name} 的 OBS 浏览器源链接`)
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    toast.error('复制失败，请手动复制')
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
        <component
          :is="item.icon"
          class="size-5"
        />
      </div>
      <div class="header-main">
        <div class="title-row">
          <span class="card-title">{{ item.name }}</span>
          <Badge
            variant="outline"
            :class="[
              'text-[10px] h-4.5 px-1.5',
              props.item.status === 'beta'
                ? 'border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10'
                : isReady
                  ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                  : 'text-muted-foreground'
            ]"
          >
            {{ statusLabel }}
          </Badge>
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
        <Button
          size="sm"
          class="flex-1 h-8 text-xs gap-1.5"
          @click="emit('configure', item)"
        >
          <Settings24Regular class="size-4" />
          配置与调试
        </Button>

        <div class="flex items-center gap-1.5">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  size="sm"
                  variant="secondary"
                  class="h-8 w-8 p-0"
                  @click="handleCopy"
                >
                  <Checkmark24Regular v-if="copied" class="size-4" />
                  <Copy24Regular v-else class="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                复制默认 OBS 浏览器源链接
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider v-if="item.obsPath">
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  size="sm"
                  variant="secondary"
                  class="h-8 w-8 p-0"
                  as-child
                  :disabled="!absoluteObsUrl"
                >
                  <a
                    :href="absoluteObsUrl || undefined"
                    target="_blank"
                  >
                    <Open24Regular class="size-4" />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                在新标签页预览 OBS 源
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </template>

      <template v-else>
        <div class="planned-footer">
          <span class="planned-text">开发规划中，敬请期待</span>
        </div>
        <div class="requirements-row">
          <span class="requirement-dot" :class="{ local: !item.requiresAccount }" />
          {{ item.requiresAccount ? '需要账号同步' : '纯本地运行' }}
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
  background: var(--popover);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  box-sizing: border-box;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  height: 100%;
}

.obs-card:hover {
  transform: translateY(-2px);
  border-color: var(--brand);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.obs-card.is-planned {
  opacity: 0.78;
}

.obs-card.is-planned:hover {
  transform: none;
  border-color: var(--border);
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
  background: var(--brand-soft);
  color: var(--brand);
  border-radius: 8px;
  flex-shrink: 0;
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
  color: var(--foreground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
}

.cat-label {
  font-size: 12px;
  color: var(--muted-foreground);
}

.ver-label {
  font-size: 11px;
  color: var(--muted-foreground);
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
  color: var(--muted-foreground);
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
  color: var(--foreground);
}

.feature-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--brand);
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
  color: var(--muted-foreground);
  background: var(--muted);
  padding: 1px 6px;
  border-radius: 4px;
}

.tag-more {
  font-size: 11px;
  color: var(--muted-foreground);
  padding: 1px 4px;
}

.resolution-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  background: var(--muted);
  padding: 4px 8px;
  border-radius: 4px;
  color: var(--muted-foreground);
  margin-top: auto;
}

.requirements-row {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--muted-foreground);
}

.requirement-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--brand);
}

.requirement-dot.local {
  background: #10b981;
}

.res-label {
  opacity: 0.8;
}

.res-val {
  font-weight: 500;
  color: var(--foreground);
}

/* 底部操作 */
.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.planned-footer {
  width: 100%;
  text-align: center;
  padding: 4px 0;
}

.planned-text {
  font-size: 12px;
  color: var(--muted-foreground);
}
</style>
