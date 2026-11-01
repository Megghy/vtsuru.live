<script setup lang="ts">
import { ArrowLeft24Regular, Checkmark24Regular, Copy24Regular, Open24Regular } from '@vicons/fluent'
import { useClipboard } from '@vueuse/core'
import { computed, defineAsyncComponent, ref, shallowRef, watch } from 'vue'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import { getCategoryMeta } from '@/apps/obs-store/registry'
import type { ObsComponentDefinition } from '@/apps/obs-store/registry'
import { buildObsSourceUrl } from '@/shared/obs/obsUrl'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Spin } from '@/shared/ui/spin'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

const props = defineProps<{
  component: ObsComponentDefinition
}>()

const emit = defineEmits<{
  back: []
}>()

const activeComponentLoader = shallowRef<ReturnType<typeof defineAsyncComponent> | null>(null)
const isLoading = ref(false)

watch(
  () => props.component,
  async (comp) => {
    if (!comp || !comp.manageComponent) {
      activeComponentLoader.value = null
      return
    }

    try {
      isLoading.value = true
      activeComponentLoader.value = defineAsyncComponent({
        loader: comp.manageComponent,
        delay: 100,
        timeout: 20_000,
        onError(error, retry, fail, attempts) {
          if (attempts <= 2) retry()
          else fail()
        },
      })
    } catch {
      activeComponentLoader.value = null
    } finally {
      isLoading.value = false
    }
  },
  { immediate: true },
)

const account = useAccount()
const { copy, isSupported: isCopySupported } = useClipboard()
const copied = ref(false)

const isReady = computed(() => props.component.status === 'ready')
const statusLabel = computed(() => (props.component.status === 'beta' ? '内测' : isReady.value ? '已就绪' : '规划中'))
const categoryMeta = computed(() => getCategoryMeta(props.component.category))

const absoluteObsUrl = computed(() => {
  if (!props.component.obsPath || typeof window === 'undefined') return ''
  return buildObsSourceUrl({
    path: props.component.obsPath,
    host: window.location.origin,
    credential: props.component.requiresAccount ? 'public-id' : 'none',
    userId: props.component.requiresAccount ? account.value.id : undefined,
    params: props.component.requiresAccount ? { channel: 'default' } : undefined,
  })
})

async function handleCopy() {
  if (!absoluteObsUrl.value) {
    toast.warning(props.component.requiresAccount ? '请登录后生成 OBS 浏览器源链接' : '当前组件暂不可用')
    return
  }

  if (!isCopySupported.value) {
    toast.warning('当前环境不支持直接写入剪贴板，请手动复制')
    return
  }

  try {
    await copy(absoluteObsUrl.value)
    copied.value = true
    toast.success(`已复制 ${props.component.name} 的 OBS 浏览器源链接`)
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    toast.error('复制失败，请手动复制')
  }
}
</script>

<template>
  <div class="flex flex-col gap-4 w-full animate-fade-in">
    <!-- 工作台顶部综合导航条 -->
    <div
      class="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-card/60 border border-border/80 rounded-[var(--radius)] backdrop-blur-sm"
    >
      <!-- 左侧：返回与组件信息面包屑 -->
      <div class="flex items-center gap-3 min-w-0">
        <Button
          variant="ghost"
          size="sm"
          class="gap-1.5 text-xs text-muted-foreground hover:text-foreground shrink-0"
          @click="emit('back')"
        >
          <ArrowLeft24Regular class="size-4" />
          返回组件库
        </Button>

        <div class="h-4 w-px bg-border/70 shrink-0" />

        <div class="flex-center size-8 rounded-lg bg-brand-soft text-brand shrink-0">
          <component
            :is="props.component.icon"
            class="size-4.5"
          />
        </div>

        <div class="flex flex-col min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <h1 class="text-sm font-semibold text-foreground m-0 truncate">
              {{ props.component.name }}
            </h1>
            <Badge
              variant="outline"
              :class="[
                'text-[10px] h-4.5 px-1.5',
                props.component.status === 'beta'
                  ? 'border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10'
                  : isReady
                    ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                    : 'text-muted-foreground',
              ]"
            >
              {{ statusLabel }}
            </Badge>
            <span
              v-if="categoryMeta"
              class="text-xs text-muted-foreground"
            >
              {{ categoryMeta.name }}
            </span>
          </div>
          <span class="text-xs text-muted-foreground truncate hidden md:inline-block">
            {{ props.component.shortDescription }}
          </span>
        </div>
      </div>

      <!-- 右侧：快捷工具与 OBS 链接操作 -->
      <div class="flex items-center gap-2 shrink-0">
        <div
          v-if="props.component.defaultResolution"
          class="hidden xl:flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/70 px-2 py-1 rounded"
        >
          <span class="opacity-75">推荐源尺寸:</span>
          <span class="font-medium text-foreground">
            {{ props.component.defaultResolution.width }} × {{ props.component.defaultResolution.height }} px
          </span>
        </div>

        <TooltipProvider v-if="props.component.obsPath">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="secondary"
                size="sm"
                class="gap-1.5"
                :disabled="!absoluteObsUrl"
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
                <span class="hidden sm:inline">复制 OBS 源链接</span>
                <span class="sm:hidden">复制链接</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent> 复制直接粘贴进 OBS 浏览器源的完整 URL </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider v-if="props.component.obsPath">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="outline"
                size="sm"
                class="gap-1.5"
                as-child
                :disabled="!absoluteObsUrl"
              >
                <a
                  :href="absoluteObsUrl || undefined"
                  target="_blank"
                  rel="noopener"
                >
                  <Open24Regular class="size-4" />
                  <span class="hidden sm:inline">OBS 画面预览</span>
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent> 在新标签页打开 OBS 浏览器源渲染画面 </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider v-if="props.component.managePath">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="outline"
                size="sm"
                class="gap-1.5"
                as-child
              >
                <a
                  :href="props.component.managePath"
                  target="_blank"
                  rel="noopener"
                >
                  <Open24Regular class="size-4" />
                  <span class="hidden md:inline">独立窗口</span>
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent> 在新标签页打开独立全屏控制台 </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>

    <!-- 工作台主体内容区：享受 100% 全宽，双栏舒展平铺 -->
    <div class="w-full">
      <Spin :show="isLoading">
        <component
          :is="activeComponentLoader"
          v-if="activeComponentLoader"
        />
        <div
          v-else-if="!isLoading"
          class="flex-center min-h-[320px] border border-dashed border-border rounded-[var(--radius)] bg-card/40"
        >
          <span class="text-sm text-muted-foreground"> 该组件尚在开发规划中，暂无可用的配置控制台。 </span>
        </div>
      </Spin>
    </div>
  </div>
</template>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
