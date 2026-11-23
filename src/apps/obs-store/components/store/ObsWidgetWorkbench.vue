<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { Check, Copy, ExternalLink, RefreshCw } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import ObsChannelSwitcher from '@/apps/obs-store/components/store/ObsChannelSwitcher.vue'
import { parseObsSyncChannel } from '@/apps/obs-store/sync'
import { buildObsSourceUrl } from '@/shared/obs/obsUrl'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Separator } from '@/shared/ui/separator'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'

const props = withDefaults(
  defineProps<{
    componentId: string
    title: string
    version?: string
    obsPath: string
    recommendedSize: string
    channelId: string
    isSyncing?: boolean
    lastSyncError?: boolean
    hasPendingChanges?: boolean
    currentHash?: string
    stageMinHeight?: number
    previewClass?: string
  }>(),
  {
    version: 'v1.0',
    isSyncing: false,
    lastSyncError: false,
    hasPendingChanges: false,
    currentHash: '',
    stageMinHeight: 200,
    previewClass: '',
  },
)

const emit = defineEmits<{
  'update:channelId': [value: string]
  retry: []
}>()

const account = useAccount()
const { copy, isSupported: isCopySupported } = useClipboard()
const channelDraft = ref(props.channelId)
const previewBg = ref<'checker' | 'dark' | 'transparent'>('checker')
const copied = ref(false)

watch(
  () => props.channelId,
  (val) => {
    channelDraft.value = val
  },
)

const obsAbsoluteUrl = computed(() =>
  buildObsSourceUrl({
    path: props.obsPath,
    host: typeof window !== 'undefined' ? window.location.origin : '',
    credential: 'public-id',
    userId: account.value.id,
    params: { channel: props.channelId },
  }),
)

function handleChannelSubmit() {
  const parsed = parseObsSyncChannel(channelDraft.value)
  if (!parsed) {
    toast.warning('频道名仅支持 1~32 位字母、数字、下划线或连字符')
    channelDraft.value = props.channelId
    return
  }
  emit('update:channelId', parsed)
  toast.success(`已切换至频道: ${parsed}`)
}

async function copyObsUrl() {
  if (!isCopySupported.value) {
    toast.warning('当前环境不支持剪贴板，请手动复制')
    return
  }
  try {
    await copy(obsAbsoluteUrl.value)
    copied.value = true
    toast.success('OBS 浏览器源链接已复制')
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    toast.error('复制失败，请重试')
  }
}

function openObsPreview() {
  if (typeof window === 'undefined') return
  window.open(obsAbsoluteUrl.value, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <div class="w-full max-w-[1040px] mx-auto min-w-0">
    <Card class="p-4 overflow-hidden">
      <CardContent class="p-0 space-y-4 min-w-0">
        <!-- 头部与同步栏 -->
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold text-foreground truncate">{{ title }}</span>
              <span class="px-1.5 py-0.5 rounded-sm bg-muted text-[11px] font-medium text-muted-foreground">
                {{ version }}
              </span>
            </div>
            <div class="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground">
              <span
                class="size-1.5 rounded-full shrink-0"
                :class="
                  lastSyncError
                    ? 'bg-destructive'
                    : isSyncing
                      ? 'bg-amber-500 animate-pulse'
                      : 'bg-emerald-500'
                "
              />
              <span v-if="lastSyncError">同步失败，请重试</span>
              <span v-else-if="isSyncing">正在同步云端状态...</span>
              <span v-else-if="hasPendingChanges">有修改尚未保存</span>
              <span v-else-if="currentHash" class="tabular-nums">
                已同步 ({{ currentHash.slice(0, 8) }})
              </span>
              <span v-else>就绪</span>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <ObsChannelSwitcher
              v-model="channelDraft"
              @submit="handleChannelSubmit"
            />

            <Button
              v-if="lastSyncError"
              variant="secondary"
              :disabled="isSyncing"
              class="gap-1.5"
              @click="emit('retry')"
            >
              <RefreshCw class="size-3.5" />
              重试
            </Button>

            <Button
              variant="outline"
              class="gap-1.5"
              @click="openObsPreview"
            >
              <ExternalLink class="size-3.5" />
              新窗预览
            </Button>

            <Button
              class="gap-1.5"
              @click="copyObsUrl"
            >
              <Check v-if="copied" class="size-3.5" />
              <Copy v-else class="size-3.5" />
              复制 OBS 链接
            </Button>
          </div>
        </div>

        <Separator />

        <!-- 主控台 + 实时画布预览 -->
        <div class="grid grid-cols-1 xl:grid-cols-12 gap-4 min-w-0">
          <div class="xl:col-span-5 rounded-lg border border-border bg-inset/60 p-3 space-y-3 min-w-0 overflow-hidden">
            <slot name="controls" />
          </div>

          <div class="xl:col-span-7 rounded-lg border border-border bg-inset/60 p-3 flex flex-col min-w-0 overflow-hidden">
            <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span class="text-xs font-semibold text-foreground">OBS 实时监视器</span>
              <div class="flex flex-wrap items-center gap-2">
                <slot name="stage-actions" />
                <ToggleGroup
                  type="single"
                  size="xs"
                  :model-value="previewBg"
                  @update:model-value="(val) => val && (previewBg = val as any)"
                >
                  <ToggleGroupItem value="checker">网格底</ToggleGroupItem>
                  <ToggleGroupItem value="dark">暗黑底</ToggleGroupItem>
                  <ToggleGroupItem value="transparent">透明底</ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>

            <div
              class="obs-stage-frame relative flex-1 w-full rounded-md border border-border overflow-auto flex-center p-2"
              :class="[`obs-stage-${previewBg}`, previewClass]"
              :style="{ minHeight: `${stageMinHeight}px` }"
            >
              <slot name="preview" />
            </div>

            <div class="mt-2 flex-between gap-2 text-[11px] text-muted-foreground">
              <span>推荐 OBS 尺寸：<strong class="text-foreground font-medium">{{ recommendedSize }}</strong></span>
              <span class="truncate">频道：{{ channelId }}</span>
            </div>
          </div>
        </div>

        <template v-if="$slots.settings">
          <Separator />
          <div class="space-y-3">
            <div class="text-xs font-semibold text-foreground">样式与数据源配置</div>
            <slot name="settings" />
          </div>
        </template>
      </CardContent>
    </Card>
  </div>
</template>

<style scoped>
.obs-stage-checker {
  background-image:
    linear-gradient(45deg, rgba(128, 128, 128, 0.14) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(128, 128, 128, 0.14) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(128, 128, 128, 0.14) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(128, 128, 128, 0.14) 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0;
}

.obs-stage-dark {
  background: #0d1117;
}

.obs-stage-transparent {
  background: transparent;
}
</style>
