<script setup lang="ts">
import { Checkmark24Regular, Copy24Regular, Open24Regular, Settings24Regular } from '@vicons/fluent'
import { useClipboard } from '@vueuse/core'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import { getCategoryMeta } from '@/apps/obs-store/registry'
import type { ObsComponentDefinition } from '@/apps/obs-store/registry'
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
const statusLabel = computed(() => (props.item.status === 'beta' ? '内测' : isReady.value ? '已就绪' : '规划中'))
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
    class="flex flex-col justify-between bg-popover border border-border rounded-[var(--radius)] p-4 box-border transition-all duration-200 h-full hover:-translate-y-0.5 hover:border-brand hover:shadow-sm"
    :class="{ 'opacity-78 hover:translate-y-0 hover:border-border hover:shadow-none': !isReady }"
  >
    <!-- 卡片头部 -->
    <div class="flex gap-3 items-start mb-3">
      <div class="size-9.5 rounded-lg bg-brand-soft text-brand flex-center shrink-0">
        <component
          :is="item.icon"
          class="size-5"
        />
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between gap-1.5">
          <span class="text-sm font-semibold text-foreground truncate">{{ item.name }}</span>
          <Badge
            variant="outline"
            :class="[
              'text-[10px] h-4.5 px-1.5',
              props.item.status === 'beta'
                ? 'border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10'
                : isReady
                  ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                  : 'text-muted-foreground',
            ]"
          >
            {{ statusLabel }}
          </Badge>
        </div>
        <div class="flex items-center gap-2 mt-0.5">
          <span
            v-if="categoryMeta"
            class="text-xs text-muted-foreground"
          >
            {{ categoryMeta.name }}
          </span>
          <span
            v-if="item.version"
            class="text-[11px] text-muted-foreground/80"
          >
            v{{ item.version }}
          </span>
        </div>
      </div>
    </div>

    <!-- 卡片内容 -->
    <div class="flex-1 flex flex-col gap-2.5">
      <p class="text-[13px] text-muted-foreground leading-relaxed m-0 line-clamp-2">
        {{ item.shortDescription }}
      </p>

      <!-- 特性列表 -->
      <div
        v-if="item.features.length > 0"
        class="flex flex-col gap-1"
      >
        <div
          v-for="(feat, idx) in item.features.slice(0, 2)"
          :key="idx"
          class="flex items-center gap-1.5 text-xs text-foreground"
        >
          <span class="size-1 rounded-full bg-brand shrink-0" />
          <span class="truncate">{{ feat }}</span>
        </div>
      </div>

      <!-- 标签 -->
      <div class="flex flex-wrap gap-1 mt-0.5">
        <span
          v-for="tag in item.tags.slice(0, 4)"
          :key="tag"
          class="text-[11px] text-muted-foreground bg-muted px-1.5 py-px rounded"
        >
          {{ tag }}
        </span>
        <span
          v-if="item.tags.length > 4"
          class="text-[11px] text-muted-foreground px-1 py-px"
        >
          +{{ item.tags.length - 4 }}
        </span>
      </div>

      <!-- 推荐尺寸规格 -->
      <div
        v-if="item.defaultResolution"
        class="flex items-center gap-1.5 text-[11px] bg-muted px-2 py-1 rounded text-muted-foreground mt-auto"
      >
        <span class="opacity-80">推荐尺寸:</span>
        <span class="font-medium text-foreground"
          >{{ item.defaultResolution.width }} × {{ item.defaultResolution.height }} px</span
        >
      </div>
    </div>

    <!-- 卡片底部操作栏 -->
    <div class="flex items-center justify-between gap-2 mt-3.5 pt-3 border-t border-border">
      <template v-if="isReady">
        <Button
          class="flex-1 gap-1.5"
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
                  variant="secondary"
                  class="w-8 p-0"
                  @click="handleCopy"
                >
                  <Checkmark24Regular
                    v-if="copied"
                    class="size-4"
                  />
                  <Copy24Regular
                    v-else
                    class="size-4"
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent> 复制默认 OBS 浏览器源链接 </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider v-if="item.obsPath">
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="secondary"
                  class="w-8 p-0"
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
              <TooltipContent> 在新标签页预览 OBS 源 </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </template>

      <template v-else>
        <div class="w-full text-center py-1">
          <span class="text-xs text-muted-foreground">开发规划中，敬请期待</span>
        </div>
        <div class="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span
            class="size-1.5 rounded-full"
            :class="item.requiresAccount ? 'bg-brand' : 'bg-emerald-500'"
          />
          {{ item.requiresAccount ? '需要账号同步' : '纯本地运行' }}
        </div>
      </template>
    </div>
  </div>
</template>
