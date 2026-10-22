<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useRemoveBg } from '@/composables/useRemoveBg'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Progress } from '@/shared/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { Switch } from '@/shared/ui/switch'
import { useMessage } from '@/shared/utils'

const props = defineProps<{ show: boolean; sourceUrl: string | null }>()
const emit = defineEmits<{ confirm: [blob: Blob]; cancel: [] }>()

const message = useMessage()
const { options, webgpuSupported, progress, processRemoveBg } = useRemoveBg()

const processing = ref(false)
const resultUrl = ref<string | null>(null)
const resultBlob = ref<Blob | null>(null)

const modeOptions = [
  { label: '去背景', value: 'remove-bg' },
  { label: '去前景', value: 'remove-fg' },
  { label: '生成蒙版', value: 'mask' },
]
const modelOptions = [
  { label: 'quint8 · 最快 (~40MB)', value: 'isnet_quint8' },
  { label: 'fp16 · 均衡 (~80MB)', value: 'isnet_fp16' },
  { label: 'isnet · 最精细 (~170MB)', value: 'isnet' },
]
const deviceOptions = computed(() => [
  { label: 'CPU', value: 'cpu' },
  { label: 'GPU (WebGPU)', value: 'gpu', disabled: !webgpuSupported.value },
])

const progressPercent = computed(() => {
  if (!progress.value?.total) return 0
  return Math.round((progress.value.current / progress.value.total) * 100)
})

watch(
  () => props.show,
  (v) => {
    if (!v) {
      cleanup()
    }
  },
)

function cleanup() {
  if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
  resultUrl.value = null
  resultBlob.value = null
  processing.value = false
}

async function process() {
  if (!props.sourceUrl) return
  processing.value = true
  cleanup()
  try {
    const resp = await fetch(props.sourceUrl)
    const blob = await resp.blob()
    const result = await processRemoveBg(blob)
    resultBlob.value = result
    resultUrl.value = URL.createObjectURL(result)
  } catch (e: any) {
    message.error(`处理失败: ${e?.message ?? e}`)
  } finally {
    processing.value = false
  }
}

function confirm() {
  if (resultBlob.value) emit('confirm', resultBlob.value)
  resultBlob.value = null
  resultUrl.value = null
}

function cancel() {
  cleanup()
  emit('cancel')
}
</script>

<template>
  <Dialog :open="show" @update:open="!$event && cancel()">
    <DialogContent class="max-w-2xl">
      <DialogHeader>
        <DialogTitle>AI 去背景</DialogTitle>
      </DialogHeader>

      <!-- Settings -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 my-2">
        <div class="flex flex-col gap-1">
          <label class="text-[11px] text-muted-foreground">模式</label>
          <Select v-model="options.mode">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="opt in modeOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-[11px] text-muted-foreground">模型</label>
          <Select v-model="options.model">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="opt in modelOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-[11px] text-muted-foreground">设备</label>
          <Select v-model="options.device">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="opt in deviceOptions"
                :key="opt.value"
                :value="opt.value"
                :disabled="opt.disabled"
              >
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="flex flex-col gap-1 justify-center">
          <label class="text-[11px] text-muted-foreground">Worker 代理</label>
          <Switch v-model:checked="options.proxyToWorker" />
        </div>
      </div>

      <!-- Progress -->
      <div v-if="progress && progress.total" class="space-y-1 my-2">
        <Progress :value="progressPercent" />
        <span class="text-[11px] text-muted-foreground">{{ progress.key }} {{ progressPercent }}%</span>
      </div>

      <!-- Preview -->
      <div class="grid grid-cols-2 gap-3 my-2">
        <div class="flex flex-col gap-1">
          <span class="text-[11px] text-muted-foreground">原图</span>
          <div class="aspect-video bg-muted/30 rounded border border-border flex items-center justify-center overflow-hidden">
            <img
              v-if="sourceUrl"
              :src="sourceUrl"
              class="max-h-full max-w-full object-contain"
            />
          </div>
        </div>

        <div class="flex flex-col gap-1">
          <span class="text-[11px] text-muted-foreground">结果</span>
          <div class="aspect-video bg-muted/30 rounded border border-border flex items-center justify-center overflow-hidden manage-checkerboard">
            <img
              v-if="resultUrl"
              :src="resultUrl"
              class="max-h-full max-w-full object-contain"
            />
            <span v-else class="text-xs text-muted-foreground">
              {{ processing ? '处理中...' : '点击下方按钮开始' }}
            </span>
          </div>
        </div>
      </div>

      <DialogFooter class="flex sm:justify-between items-center w-full mt-4">
        <Button variant="secondary" :disabled="processing || !sourceUrl" @click="process">
          {{ resultUrl ? '重新处理' : '开始处理' }}
        </Button>

        <div class="flex gap-2">
          <Button variant="outline" @click="cancel">
            取消
          </Button>
          <Button :disabled="!resultBlob" @click="confirm">
            应用替换
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.manage-checkerboard {
  background-image: linear-gradient(45deg, var(--muted) 25%, transparent 25%),
    linear-gradient(-45deg, var(--muted) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, var(--muted) 75%),
    linear-gradient(-45deg, transparent 75%, var(--muted) 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
}
</style>
